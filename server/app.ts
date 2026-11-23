import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import type { User } from '../src/types';
import { askClaude, claudeEnabled } from './claude';
import { personalEnabled, personalSession, registerPersonal } from './personal';
import { DEMO_BLOCKED_RPC, generatePassword, isDemoAcademy } from './access';
import { createClient } from './clients';
import { resetDemos } from './demo';
import { mockAIProvider } from '../src/lib/ai';
import { hashPassword } from '../src/services/crypto';
import { createRepos } from '../src/services/repositories';
import { getDatabase, installDatabase } from '../src/services/database';
import { logActivity } from '../src/services/activity';
import { verifyPassword } from '../src/services/crypto';
import * as M from '../src/services/mutations.local';
import { config } from './config';
import { reportError } from './sentry';
import { KeyedQueue } from './queues';
import { securityHeaders } from './security';
import { deliverOutbox, queueReminders, testChannels, webhookEnabled, whatsappEnabled } from './notifier';
import { mailEnabled, sendMail } from './mailer';
import { PublicApplyError, publicApplyInfo, submitPublicApplication, type PublicApplyResult } from '../src/services/publicApply';
import { can } from '../src/lib/permissions';
import { publicTenants } from '../src/data/tenants';
import { changeAcademyPlan, platformRows } from '../src/services/platform';
import { accessLogBody, aiBody, demoBody, loginBody, newClientBody, passwordBody, RPC } from './validators';
import type { Store } from './store';

const COOKIE = 'ac_session';
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const publicUser = (u: User) => { const { pwd: _p, ...rest } = u; return rest; };

/** Limitador en memoria por clave (ventana deslizante simple). Sustituible por Redis al escalar horizontalmente. */
function limiter(max: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  const live = (key: string, now: number) => (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  const hit = (key: string) => { const now = Date.now(); const arr = live(key, now); arr.push(now); hits.set(key, arr); if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k); return arr.length > max; };
  return Object.assign(hit, { blocked: (key: string) => live(key, Date.now()).length >= max, clear: (key: string) => { hits.delete(key); } });
}

export function buildApp(store: Store) {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info', redact: ['req.headers.cookie', 'req.headers.authorization'] }, bodyLimit: 1_000_000, trustProxy: config.trustProxy });
  app.register(cookie);

  // Mutaciones expuestas = todas las funciones exportadas salvo las públicas; cada una DEBE tener validador.
  const exposed = Object.entries(M).filter(([n, f]) => typeof f === 'function' && n !== 'createAcademy' && n !== 'DomainError') as [string, (...a: unknown[]) => unknown][];
  for (const [n] of exposed) if (!RPC[n]) throw new Error(`Mutación sin validador: ${n}`);

  // Serializa las operaciones que tocan el dominio en memoria (hay mutaciones asíncronas).
  // Una cola por negocio (los negocios no se bloquean entre sí) y una exclusiva para lo que toca la plataforma o varios negocios.
  const queues = new KeyedQueue();
  const serial = <T,>(fn: () => Promise<T> | T): Promise<T> => queues.runAll(fn);
  const flush = () => store.flush(getDatabase());

  const loginLimit = limiter(8, 15 * 60_000); const ipFail = limiter(config.loginFailsPerIp, 15 * 60_000); const apiLimit = limiter(config.apiPerMinute, 60_000); const demoLimit = limiter(config.demoPerHour, 60 * 60_000);
  const fail = (reply: FastifyReply, code: number, error: string) => reply.code(code).send({ error });

  app.addHook('onRequest', async (req, reply) => {
    reply.headers({ ...securityHeaders(), 'Cache-Control': 'no-store' });
    if (req.url.startsWith('/api/') && apiLimit(req.ip)) return fail(reply, 429, 'Demasiadas peticiones. Inténtalo en un minuto.');
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      // CSRF: cabecera personalizada (un sitio externo no puede enviarla sin pasar por CORS, que no habilitamos) + Origin coherente.
      if (req.headers['x-requested-with'] !== 'edith') return fail(reply, 403, 'Petición no permitida.');
      const origin = req.headers.origin; if (origin) { try { if (new URL(origin).host !== req.headers.host) return fail(reply, 403, 'Origen no permitido.'); } catch { return fail(reply, 403, 'Origen no válido.'); } }
    }
  });

  // Frontend compilado (producción): sirve dist/ con fallback SPA. Solo si existe y STATIC_DIR no está vacío.
  const staticDir = resolve(process.env.STATIC_DIR ?? './dist');
  if (existsSync(join(staticDir, 'index.html'))) {
    const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8' };
    app.setNotFoundHandler(async (req, reply) => {
      if (req.method !== 'GET' || req.url.startsWith('/api/')) return fail(reply, 404, 'No encontrado.');
      const clean = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
      let file = join(staticDir, clean);
      if (!file.startsWith(staticDir) || !existsSync(file) || !statSync(file).isFile()) file = join(staticDir, 'index.html');
      const ext = extname(file);
      reply.header('Content-Type', MIME[ext] ?? 'application/octet-stream');
      reply.header('Cache-Control', file.includes(`${sep}assets${sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache');
      return reply.send(readFileSync(file));
    });
  }

  const startSession = (reply: FastifyReply, u: User, remember = false, maxHours?: number) => {
    const hours = maxHours ?? (remember ? config.rememberDays * 24 : config.sessionHours);
    const token = randomBytes(32).toString('base64url'); const exp = Date.now() + hours * 3_600_000;
    store.saveSession(sha(token), u.id, u.academyId, exp);
    reply.setCookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: config.cookieSecure, path: '/', maxAge: hours * 3600 });
  };

  /** Usuario autenticado desde la cookie; se revalida en cada petición (cuenta activa, academia activa). */
  const auth = (req: FastifyRequest): User | null => {
    const t = req.cookies[COOKIE]; if (!t) return null;
    const s = store.findSession(sha(t)); if (!s || s.expiresAt < Date.now()) return null;
    const db = getDatabase(); const u = db.users.find((x) => x.id === s.userId);
    if (!u || u.disabled || u.academyId !== s.academyId) return null;
    const a = db.academies.find((x) => x.id === u.academyId);
    if (!a || (a.status !== 'active' && u.role !== 'SUPER_ADMIN')) return null;
    return u;
  };
  const need = (req: FastifyRequest, reply: FastifyReply) => {
    const u = auth(req); if (!u) { fail(reply, 401, 'Sesión no válida o caducada.'); return null; }
    // Primer acceso de un cliente con la contraseña generada: hasta que la cambie solo puede usar /auth/me, /auth/password y /auth/logout.
    if (u.mustChangePassword) { reply.code(403).send({ error: 'Debes cambiar tu contraseña para continuar.', code: 'password_change_required' }); return null; }
    return u;
  };
  const demoUser = (u: User) => isDemoAcademy(getDatabase(), u.academyId);

  // Salud: base de datos y antigüedad de la última copia (sin datos de personas). 503 si la base no responde; «degradado» si la copia es demasiado antigua.
  app.get('/api/health', async (_req, reply) => {
    let db = false; try { db = store.ping(); } catch { /* sin respuesta */ }
    const at = store.getMeta('backup_last_at'); const ageH = at ? Math.round((Date.now() - Date.parse(at)) / 360_000) / 10 : null;
    const stale = config.backupHours > 0 && (ageH === null ? process.uptime() > (config.backupHours + 1) * 3600 : ageH > config.backupHours * 2 + 1);
    const lastOk = store.getMeta('backup_last_ok'); const backup = { last: at, ageHours: ageH, ok: lastOk === null ? null : lastOk === '1', external: store.getMeta('backup_last_s3') === '1', stale };
    if (!db) return reply.code(503).send({ ok: false, db: false });
    return { ok: true, status: stale || lastOk === '0' ? 'degraded' : 'ok', db, backup, encrypted: !!config.dataKey, ai: claudeEnabled() ? 'claude' : 'local', personal: personalEnabled() };
  });

  // ── Registro de accesos a fichas de pacientes/alumnos ──
  // El navegador avisa al abrir una ficha, al exportar CSV o al abrir un informe; el servidor comprueba que la persona es del mismo negocio y lo anota.
  app.post('/api/access-log', async (req, reply) => {
    const u = need(req, reply); if (!u) return reply; const p = accessLogBody.safeParse(req.body); if (!p.success) return fail(reply, 400, 'Datos no válidos');
    if (u.role === 'ALUMNO' || u.role === 'TUTOR') return { ok: true }; // solo se registra al personal del negocio
    let subject: string | undefined;
    if (p.data.entity === 'student') { const s = getDatabase().students.find((x) => x.id === p.data.id && x.academyId === u.academyId); if (!s) return fail(reply, 404, 'No encontrado'); subject = `${s.firstName} ${s.lastName}`; }
    store.logAccess({ academyId: u.academyId, userId: u.id, userName: u.name, role: u.role, action: p.data.action, entity: p.data.entity, entityId: p.data.id, subject, detail: p.data.detail });
    return { ok: true };
  });
  app.get('/api/access-log', async (req, reply) => {
    const u = need(req, reply); if (!u) return reply; if (u.role !== 'ADMIN') return fail(reply, 403, 'Solo el administrador del negocio puede ver el registro de accesos.');
    const q = req.query as { user?: string; from?: string; to?: string; limit?: string }; const day = (v?: string, end = false) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}${end ? 'T23:59:59.999Z' : 'T00:00:00.000Z'}` : undefined);
    const users = getDatabase().users.filter((x) => x.academyId === u.academyId && x.role !== 'ALUMNO' && x.role !== 'TUTOR').map((x) => ({ id: x.id, name: x.name }));
    return { entries: store.listAccess(u.academyId, { userId: q.user || undefined, from: day(q.from), to: day(q.to, true), limit: Number(q.limit) || 200 }), users };
  });

  // Configuración pública del navegador: el DSN de Sentry es público por diseño (solo permite enviar eventos).
  app.get('/api/public/config', async () => ({ sentryDsn: config.sentryDsn }));
  app.get('/api/public/tenants', async () => ({ tenants: publicTenants(getDatabase()) }));

  // Formulario público de solicitud de matrícula (cualquier negocio, sin cuenta). Límites por red y por negocio contra el spam.
  const applyIp = limiter(6, 60 * 60_000); const applyDay = limiter(80, 24 * 60 * 60_000);
  const keyOf = (req: FastifyRequest) => String((req.params as { key?: string }).key ?? '').slice(0, 80);
  const realMail = (e?: string) => !!e && !/@(horizonte|atlas|atlanta|vitalia)\.demo$|\.(demo|local|test)$/i.test(e);
  /** Correo al equipo (director y secretaría) y acuse al interesado. Solo si el correo está conectado; los fallos no afectan a la solicitud. */
  const announceApplication = async (r: PublicApplyResult) => {
    if (!mailEnabled() || isDemoAcademy(getDatabase(), r.academyId)) return; const db = getDatabase(); const e = db.enrollments.find((x) => x.id === r.enrollmentId); if (!e?.applicant) return; const ap = e.applicant; // las demos nunca envían correo real
    const staff = [...new Set(db.users.filter((u) => u.academyId === r.academyId && !u.disabled && (u.role === 'ADMIN' || u.role === 'SECRETARIA') && realMail(u.email)).map((u) => u.email))];
    const lines = [`Nombre: ${ap.name}`, `Teléfono: ${ap.phone}`, `Correo: ${ap.email}`, `Interés: ${ap.course}`, ap.birthDate ? `Nacimiento: ${ap.birthDate}` : '', ap.guardianName ? `Tutor: ${ap.guardianName} (${ap.guardianPhone})` : '', ap.message ? `Mensaje: ${ap.message}` : ''].filter(Boolean);
    if (staff.length) await sendMail(staff, `Nueva solicitud de matrícula · ${ap.name}`, `Has recibido una solicitud desde el formulario web de ${r.academyName}:\n\n${lines.join('\n')}\n\nEstá en Matrículas, en la columna «Solicitud».`);
    if (realMail(ap.email)) await sendMail([ap.email], `Hemos recibido tu solicitud · ${r.academyName}`, `Hola ${ap.name.split(' ')[0]},\n\nHemos recibido tu solicitud (${ap.course}). ${r.academyName} se pondrá en contacto contigo lo antes posible.\n\nGracias.`);
  };
  app.get('/api/public/apply/:key', async (req, reply) => { const info = publicApplyInfo(getDatabase(), keyOf(req)); return info ? { info } : fail(reply, 404, 'Este formulario no está disponible.'); });
  app.post('/api/public/apply/:key', async (req, reply) => {
    const key = keyOf(req);
    if (applyIp(`${req.ip}|${key}`)) return fail(reply, 429, 'Has enviado varias solicitudes seguidas. Inténtalo de nuevo más tarde.');
    if (applyDay(key)) return fail(reply, 429, 'Este formulario ha recibido muchas solicitudes hoy. Por favor, llama directamente.');
    const target = getDatabase().academies.find((a) => a.status === 'active' && (a.slug === key || a.id === key));
    return queues.run(target?.id ?? '_public', () => {
      try { const r = submitPublicApplication(getDatabase(), key, req.body); if (r.created) { flush(); void announceApplication(r).catch((e) => req.log.warn(e)); } return { ok: true }; }
      catch (e) { if (e instanceof PublicApplyError) return fail(reply, e.status, e.message); req.log.error(e); return fail(reply, 500, 'Error interno'); }
    });
  });
  // Cuentas de acceso rápido (solo con SEED_DEMO=1, para desarrollo): únicamente de negocios isDemo y nunca el Super Admin.
  app.get('/api/demo-accounts', async (_req, reply) => {
    if (!config.seedDemo) return fail(reply, 404, 'No disponible');
    const db = getDatabase();
    return { accounts: db.users.filter((u) => isDemoAcademy(db, u.academyId) && u.role !== 'SUPER_ADMIN' && !u.disabled).map((u) => { const a = db.academies.find((x) => x.id === u.academyId)!; return { id: u.id, name: u.name, role: u.role, academy: a.name, key: a.slug ?? a.id, profile: u.username ?? u.email }; }) };
  });

  // ── Acceso 1: demos abiertas, sin contraseña ──
  // Solo negocios con isDemo: true. Sesión de 12 h como máximo y sin «mantener sesión»; límite de aperturas por IP.
  app.post('/api/auth/demo', async (req, reply) => {
    const p = demoBody.safeParse(req.body); if (!p.success) return fail(reply, 400, 'Datos no válidos');
    if (demoLimit(req.ip)) return fail(reply, 429, 'Demasiados accesos de demostración desde esta red. Inténtalo más tarde.');
    const key = p.data.academy.toLowerCase(); const acad0 = getDatabase().academies.find((a) => (a.slug === key || a.id === p.data.academy) && a.isDemo === true);
    return queues.run(acad0?.id ?? '_demo', () => {
      const db = getDatabase(); const acad = db.academies.find((a) => a.id === acad0?.id && a.isDemo === true);
      if (!acad || acad.status !== 'active') return fail(reply, 403, 'Este acceso no está disponible.');
      const who = p.data.profile.trim().toLowerCase();
      const u = db.users.find((x) => x.academyId === acad.id && !x.disabled && x.role !== 'SUPER_ADMIN' && (x.username?.toLowerCase() === who || x.email.toLowerCase() === who));
      if (!u) return fail(reply, 403, 'Este acceso no está disponible.');
      startSession(reply, u, false, Math.min(12, config.sessionHours)); logActivity(u, 'inició sesión', 'session', `${u.name} entró en la demo`); flush();
      return { user: publicUser(u) };
    });
  });

  // ── Acceso 2: clientes, con correo y contraseña ──
  // Solo cuentas de negocios que NO son demo; el identificador es el correo (único en toda la plataforma), así que no hay conflictos entre clientes.
  app.post('/api/auth/login', async (req, reply) => {
    const p = loginBody.safeParse(req.body); if (!p.success) return fail(reply, 400, 'Datos no válidos');
    const key = `${req.ip}|${p.data.email.toLowerCase()}`;
    if (loginLimit.blocked(key) || ipFail.blocked(req.ip)) return fail(reply, 429, 'Demasiados intentos. Espera unos minutos.');
    // La verificación de la contraseña (lenta a propósito) se hace FUERA de las colas: solo lee. Solo abrir la sesión entra en la cola del negocio.
    const db = getDatabase(); const id = p.data.email.trim().toLowerCase();
    const cands = db.users.filter((x) => x.email.toLowerCase() === id && !isDemoAcademy(db, x.academyId));
    // Se verifica siempre (hash ficticio si no existe) para no filtrar por tiempo si el usuario existe.
    const okList: typeof cands = [];
    for (const c of cands) if (c.pwd && await verifyPassword(p.data.password, c.pwd)) okList.push(c);
    if (!cands.length) await verifyPassword(p.data.password, { salt: '00', hash: '00' });
    const u = okList.length === 1 ? okList[0] : undefined;
    if (!u) { loginLimit(key); ipFail(req.ip); return fail(reply, 401, 'Credenciales no válidas'); }
    loginLimit.clear(key); // solo cuentan los intentos fallidos
    return queues.run(u.academyId, () => {
      if (u.disabled) return fail(reply, 403, 'Tu cuenta está desactivada. Contacta con el administrador.');
      const a = getDatabase().academies.find((x) => x.id === u.academyId);
      if (!a || (a.status !== 'active' && u.role !== 'SUPER_ADMIN')) return fail(reply, 403, 'Esta academia está suspendida. Contacta con soporte.');
      startSession(reply, u, !!p.data.remember); logActivity(u, 'inició sesión', 'session', `${u.name} inició sesión`); flush();
      return { user: publicUser(u) };
    });
  });

  // Cambio de contraseña (obligatorio en el primer acceso de un cliente). No usa need(): es justo lo que desbloquea la cuenta.
  app.post('/api/auth/password', async (req, reply) => {
    const u = auth(req); if (!u) return fail(reply, 401, 'Sesión no válida o caducada.');
    const p = passwordBody.safeParse(req.body); if (!p.success) return fail(reply, 400, p.error.issues[0]?.message ?? 'Contraseña no válida');
    if (demoUser(u)) return fail(reply, 403, 'Las cuentas de demostración no tienen contraseña.');
    const key = `pw|${req.ip}|${u.id}`; if (loginLimit.blocked(key) || ipFail.blocked(req.ip)) return fail(reply, 429, 'Demasiados intentos. Espera unos minutos.');
    if (!u.pwd || !(await verifyPassword(p.data.current, u.pwd))) { loginLimit(key); ipFail(req.ip); return fail(reply, 401, 'La contraseña actual no es correcta.'); }
    if (p.data.current === p.data.next) return fail(reply, 400, 'La contraseña nueva debe ser distinta de la actual.');
    const hashed = await hashPassword(p.data.next);
    return queues.run(u.academyId, () => {
      u.pwd = hashed; delete u.mustChangePassword; loginLimit.clear(key);
      store.deleteUserSessions(u.id); startSession(reply, u, false); logActivity(u, 'modificó', 'user', `${u.name} cambió su contraseña`, u.id); flush();
      return { user: publicUser(u) };
    });
  });

  app.post('/api/auth/logout', async (req, reply) => { const t = req.cookies[COOKIE]; if (t) store.deleteSession(sha(t)); reply.clearCookie(COOKIE, { path: '/' }); return { ok: true }; });
  app.get('/api/auth/me', async (req) => { const u = auth(req); return { user: u ? publicUser(u) : null }; });

  // Instantánea de datos. Sin parámetros: todo (compatible). `?part=core`: todo salvo las colecciones grandes, que se piden aparte y por trozos
  // (`?part=students|attendance|payments|practices&offset=0&limit=1000` → { rows, total }) para no mandar un JSON enorme de golpe.
  const HEAVY = ['students', 'attendance', 'payments', 'practices'] as const;
  app.get('/api/snapshot', async (req, reply) => {
    const u = need(req, reply); if (!u) return reply; const snap = (await createRepos(getDatabase(), u).snapshot()) as unknown as Record<string, unknown[]>;
    const q = req.query as { part?: string; offset?: string; limit?: string };
    if (!q.part) return snap;
    if (q.part === 'core') { const counts: Record<string, number> = {}; const core = { ...snap } as Record<string, unknown>; for (const h of HEAVY) { counts[h] = snap[h].length; core[h] = []; } return { ...core, heavy: counts }; }
    if (!(HEAVY as readonly string[]).includes(q.part)) return fail(reply, 400, 'Parte no válida');
    const rows = snap[q.part]; const off = Math.max(0, Number(q.offset) || 0); const lim = Math.min(Math.max(1, Number(q.limit) || 1000), 5000);
    return { rows: rows.slice(off, off + lim), total: rows.length };
  });

  app.get('/api/channels/status', async (req, reply) => { const u = need(req, reply); if (!u) return reply; return { email: mailEnabled(), whatsapp: whatsappEnabled(), webhook: webhookEnabled() }; });
  app.post('/api/notices/test', async (req, reply) => {
    const u = need(req, reply); if (!u) return reply; if (!can(u, 'settings:write')) return fail(reply, 403, 'Sin permiso');
    if (demoUser(u)) return { email: 'simulado (demo)', whatsapp: 'simulado (demo)', webhook: 'simulado (demo)' }; // las demos nunca envían nada real
    const b = (req.body ?? {}) as { email?: unknown; phone?: unknown }; const email = typeof b.email === 'string' && b.email.length < 200 ? b.email.trim() : undefined; const phone = typeof b.phone === 'string' && b.phone.length < 30 ? b.phone.trim() : undefined;
    return testChannels({ email, phone }, getDatabase().settings.find((s) => s.academyId === u.academyId)?.branding.name ?? 'tu academia');
  });
  setInterval(() => { if (queueReminders()) flush(); void deliverOutbox(flush); }, Number(process.env.NOTICES_TICK_MS ?? 60_000)).unref();

  app.post<{ Params: { name: string } }>('/api/rpc/:name', async (req, reply) => {
    const u = need(req, reply); if (!u) return reply;
    const fn = exposed.find(([n]) => n === req.params.name)?.[1]; const schema = RPC[req.params.name];
    if (!fn || !schema) return fail(reply, 404, 'Operación desconocida');
    if (demoUser(u) && DEMO_BLOCKED_RPC.has(req.params.name)) return fail(reply, 403, 'No disponible en la demostración.');
    const body = req.body as { args?: unknown } | undefined;
    const parsed = schema.safeParse(body?.args ?? []);
    if (!parsed.success) return fail(reply, 400, `Datos no válidos: ${parsed.error.issues[0]?.message ?? 'revisa el formulario'}`);
    const run = u.role === 'SUPER_ADMIN' ? queues.runAll.bind(queues) : (f: () => Promise<unknown>) => queues.run(u.academyId, f); // el Super Admin toca varios negocios: cola exclusiva
    return run(async () => {
      try {
        const cur = getDatabase().users.find((x) => x.id === u.id) ?? u; // tras un rollback la fila puede ser otro objeto
        const result = await fn(cur, ...parsed.data);
        flush(); void deliverOutbox(flush);
        return { result: JSON.parse(JSON.stringify(result ?? null, (k, v) => (k === 'pwd' ? undefined : v))) };
      } catch (e) {
        // La mutación pudo dejar el dominio en memoria a medias: se restauran desde disco las filas de ESTE negocio.
        if (u.role === 'SUPER_ADMIN') installDatabase(store.load(), flush); // operación de plataforma (cola exclusiva): se recarga todo
        else store.rollbackAcademy(getDatabase(), u.academyId); // solo se revierte este negocio; los demás siguen intactos
        if (!(e instanceof M.DomainError)) { req.log.error(e); reportError(e, req.url); return fail(reply, 500, 'Error interno'); }
        return fail(reply, 422, e.message);
      }
    });
  });

  const audit = (academyId: string, summary: string, id: string) => getDatabase().activity.unshift({ academyId, id: `${academyId}_log_${Date.now().toString(36)}`, at: new Date().toISOString(), actorId: 'owner', actorName: 'Propietario de la plataforma', action: 'modificó', entityType: 'academy', entityId: id, summary });
  // Alta de clientes: SOLO con la sesión personal del propietario (panel «Clientes») — o con `npm run client:new` en el servidor.
  // La contraseña la genera el servidor y se devuelve una única vez; no se guarda en claro.
  app.post('/api/onboarding', async (req, reply) => {
    if (!personalSession(req)) return fail(reply, 401, 'Solo el propietario puede dar de alta clientes.');
    const p = newClientBody.safeParse(req.body); if (!p.success) return fail(reply, 400, `Datos no válidos: ${p.error.issues[0]?.message ?? ''}`);
    return serial(async () => {
      try { const r = await createClient(p.data); audit(r.academyId, `Cliente creado (${r.plan})`, r.academyId); flush(); return { ok: true, ...r }; }
      catch (e) { if (e instanceof M.DomainError) return fail(reply, 422, e.message); req.log.error(e); return fail(reply, 500, 'Error interno'); }
    });
  });

  app.post('/api/ai/chat', async (req, reply) => {
    const u = need(req, reply); if (!u) return reply;
    const p = aiBody.safeParse(req.body); if (!p.success) return fail(reply, 400, 'Pregunta no válida');
    // El contexto lo construye el servidor con el alcance y permisos del usuario autenticado (nunca el cliente).
    const snapshot = await createRepos(getDatabase(), u).snapshot();
    // Las demos usan siempre el motor local: nunca se gasta ANTHROPIC_API_KEY en visitantes anónimos.
    const req2 = { question: p.data.question, history: p.data.history ?? [], snapshot, user: u };
    return demoUser(u) ? mockAIProvider.ask(req2) : askClaude(req2);
  });

  registerPersonal(app, store, loginLimit, fail, {
    list: () => ({ clients: platformRows(getDatabase()).map((r) => ({ id: r.academy.id, name: r.academy.name, slug: r.academy.slug, isDemo: r.academy.isDemo === true, type: r.academy.type, plan: r.academy.plan, status: r.academy.status, createdAt: r.academy.createdAt, users: r.users, students: r.students, modules: r.modules, storageKb: r.storageKb, lastActivity: r.lastActivity, waMonth: r.waMonth, waPrev: r.waPrev })) }),
    setPlan: (id, plan, applyModules) => serial(() => { const r = changeAcademyPlan(getDatabase(), id, plan, applyModules); audit(id, `Plan cambiado a ${plan}${r.disabled.length ? ` (módulos desactivados: ${r.disabled.join(', ')})` : ''}`, id); flush(); return { name: r.academy.name, plan: r.academy.plan, disabled: r.disabled as string[] }; }),
    makeReal: (id, adminEmail) => serial(async () => {
      const db = getDatabase(); const a = db.academies.find((x) => x.id === id); if (!a) throw new Error('Negocio no encontrado.'); if (a.isDemo !== true) throw new Error('Ese negocio ya es un cliente.');
      const adm = db.users.find((u) => u.academyId === id && u.role === 'ADMIN' && u.email.toLowerCase() === adminEmail.trim().toLowerCase()); if (!adm) throw new Error('No hay un administrador con ese correo en ese negocio.');
      const password = generatePassword(); adm.pwd = await hashPassword(password); adm.mustChangePassword = true; a.isDemo = false; store.deleteAcademySessions(id);
      audit(id, 'Pasó de demostración a cliente real', id); flush(); return { name: a.name, adminEmail: adm.email, password };
    }),
    resetDemos: () => serial(() => { const r = resetDemos(store); flush(); return { restored: r }; }),
    setStatus: (id, status) => serial(() => { const a = getDatabase().academies.find((x) => x.id === id); if (!a) throw new Error('Negocio no encontrado.'); a.status = status; audit(id, status === 'active' ? 'Negocio reactivado' : 'Negocio suspendido', id); flush(); return { name: a.name, status: a.status }; }),
  });
  app.setErrorHandler((err, req, reply) => { req.log.error(err); const code = (err as { statusCode?: number }).statusCode; if (!code || code >= 500) reportError(err, req.url); reply.code(code && code < 500 ? code : 500).send({ error: code && code < 500 ? 'Petición no válida' : 'Error interno' }); });
  app.addHook('onClose', async () => { store.close(); });
  setInterval(() => { store.purgeSessions(Date.now()); store.purgeAccess(new Date(Date.now() - config.accessLogDays * 86_400_000).toISOString()); }, 3_600_000).unref();
  // Ejecuta una tarea de mantenimiento en la misma cola que las mutaciones (p. ej. la restauración diaria de las demos).
  return Object.assign(app, { runExclusive: async (fn: () => void) => { await serial(() => { fn(); flush(); }); } });
}
