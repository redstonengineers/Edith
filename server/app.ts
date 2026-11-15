import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import type { User } from '../src/types';
import { askClaude, claudeEnabled } from './claude';
import { personalEnabled, registerPersonal } from './personal';
import { createRepos } from '../src/services/repositories';
import { getDatabase, installDatabase } from '../src/services/database';
import { logActivity } from '../src/services/activity';
import { verifyPassword } from '../src/services/crypto';
import * as M from '../src/services/mutations.local';
import { config } from './config';
import { deliverOutbox, queueReminders, testChannels, webhookEnabled, whatsappEnabled } from './notifier';
import { mailEnabled, sendMail } from './mailer';
import { PublicApplyError, publicApplyInfo, submitPublicApplication, type PublicApplyResult } from '../src/services/publicApply';
import { can } from '../src/lib/permissions';
import { publicTenants } from '../src/data/tenants';
import { changeAcademyPlan, platformRows } from '../src/services/platform';
import { aiBody, loginBody, onboardingBody, RPC } from './validators';
import type { Store } from './store';

const COOKIE = 'ac_session';
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const publicUser = (u: User) => { const { pwd: _p, ...rest } = u; return rest; };
const DEMO_EMAIL = /@(horizonte|atlas|atlanta)\.demo$|@academycontrol\.demo$/;

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
  let chain: Promise<unknown> = Promise.resolve();
  const serial = <T,>(fn: () => Promise<T> | T): Promise<T> => { const r = chain.then(fn, fn); chain = r.catch(() => undefined); return r; };
  const flush = () => store.flush(getDatabase());

  const loginLimit = limiter(8, 15 * 60_000); const apiLimit = limiter(600, 60_000); const onboardLimit = limiter(5, 60 * 60_000);
  const fail = (reply: FastifyReply, code: number, error: string) => reply.code(code).send({ error });

  app.addHook('onRequest', async (req, reply) => {
    reply.headers({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store', 'Cross-Origin-Resource-Policy': 'same-origin' });
    if (apiLimit(req.ip)) return fail(reply, 429, 'Demasiadas peticiones. Inténtalo en un minuto.');
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
      reply.header('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; frame-ancestors 'none'");
      return reply.send(readFileSync(file));
    });
  }

  const startSession = (reply: FastifyReply, u: User) => {
    const token = randomBytes(32).toString('base64url'); const exp = Date.now() + config.sessionHours * 3_600_000;
    store.saveSession(sha(token), u.id, u.academyId, exp);
    reply.setCookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: config.cookieSecure, path: '/', maxAge: config.sessionHours * 3600 });
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
  const need = (req: FastifyRequest, reply: FastifyReply) => { const u = auth(req); if (!u) { fail(reply, 401, 'Sesión no válida o caducada.'); return null; } return u; };

  app.get('/api/health', async () => ({ ok: true, ai: claudeEnabled() ? 'claude' : 'local', personal: personalEnabled() }));

  app.get('/api/public/tenants', async () => ({ tenants: publicTenants(getDatabase()) }));

  // Formulario público de solicitud de matrícula (cualquier negocio, sin cuenta). Límites por red y por negocio contra el spam.
  const applyIp = limiter(6, 60 * 60_000); const applyDay = limiter(80, 24 * 60 * 60_000);
  const keyOf = (req: FastifyRequest) => String((req.params as { key?: string }).key ?? '').slice(0, 80);
  const realMail = (e?: string) => !!e && !/@(horizonte|atlas|atlanta|vitalia)\.demo$|\.(demo|local|test)$/i.test(e);
  /** Correo al equipo (director y secretaría) y acuse al interesado. Solo si el correo está conectado; los fallos no afectan a la solicitud. */
  const announceApplication = async (r: PublicApplyResult) => {
    if (!mailEnabled()) return; const db = getDatabase(); const e = db.enrollments.find((x) => x.id === r.enrollmentId); if (!e?.applicant) return; const ap = e.applicant;
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
    return serial(() => {
      try { const r = submitPublicApplication(getDatabase(), key, req.body); if (r.created) { flush(); void announceApplication(r).catch((e) => req.log.warn(e)); } return { ok: true }; }
      catch (e) { if (e instanceof PublicApplyError) return fail(reply, e.status, e.message); req.log.error(e); return fail(reply, 500, 'Error interno'); }
    });
  });
  app.get('/api/demo-accounts', async (_req, reply) => {
    if (!config.seedDemo) return fail(reply, 404, 'No disponible');
    const db = getDatabase();
    return { accounts: db.users.filter((u) => DEMO_EMAIL.test(u.email)).map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, academy: db.academies.find((a) => a.id === u.academyId)?.name ?? '' })) };
  });

  app.post('/api/auth/login', async (req, reply) => {
    const p = loginBody.safeParse(req.body); if (!p.success) return fail(reply, 400, 'Datos no válidos');
    const key = `${req.ip}|${p.data.academy ?? '*'}|${p.data.email.toLowerCase()}`;
    if (loginLimit.blocked(key)) return fail(reply, 429, 'Demasiados intentos. Espera unos minutos.');
    return serial(async () => {
      const db = getDatabase(); const id = p.data.email.trim().toLowerCase(); const scope = p.data.academy ? db.academies.find((a) => a.slug === p.data.academy)?.id : undefined;
      // El usuario («director»…) solo es único dentro de su negocio: con `academy` se busca ahí; sin él, entre todos.
      const cands = db.users.filter((x) => (x.email.toLowerCase() === id || x.username?.toLowerCase() === id) && (!p.data.academy || x.academyId === scope));
      // Se verifica siempre (hash ficticio si no existe) para no filtrar por tiempo si el usuario existe.
      const okList: typeof cands = [];
      for (const c of cands) if (c.pwd && await verifyPassword(p.data.password, c.pwd)) okList.push(c);
      if (!cands.length) await verifyPassword(p.data.password, { salt: '00', hash: '00' });
      if (okList.length > 1) return fail(reply, 409, 'Ese usuario existe en varios negocios. Entra desde la tarjeta de tu negocio.');
      const u = okList[0]; const ok = !!u;
      if (!u || !ok) { loginLimit(key); return fail(reply, 401, 'Credenciales no válidas'); }
      loginLimit.clear(key); // solo cuentan los intentos fallidos
      if (u.disabled) return fail(reply, 403, 'Tu cuenta está desactivada. Contacta con el administrador.');
      const a = db.academies.find((x) => x.id === u.academyId);
      if (!a || (a.status !== 'active' && u.role !== 'SUPER_ADMIN')) return fail(reply, 403, 'Esta academia está suspendida. Contacta con soporte.');
      startSession(reply, u); logActivity(u, 'inició sesión', 'session', `${u.name} inició sesión`); flush();
      return { user: publicUser(u) };
    });
  });

  app.post('/api/auth/logout', async (req, reply) => { const t = req.cookies[COOKIE]; if (t) store.deleteSession(sha(t)); reply.clearCookie(COOKIE, { path: '/' }); return { ok: true }; });
  app.get('/api/auth/me', async (req) => { const u = auth(req); return { user: u ? publicUser(u) : null }; });

  app.get('/api/snapshot', async (req, reply) => { const u = need(req, reply); if (!u) return reply; return createRepos(getDatabase(), u).snapshot(); });

  app.get('/api/channels/status', async (req, reply) => { const u = need(req, reply); if (!u) return reply; return { email: mailEnabled(), whatsapp: whatsappEnabled(), webhook: webhookEnabled() }; });
  app.post('/api/notices/test', async (req, reply) => {
    const u = need(req, reply); if (!u) return reply; if (!can(u, 'settings:write')) return fail(reply, 403, 'Sin permiso');
    const b = (req.body ?? {}) as { email?: unknown; phone?: unknown }; const email = typeof b.email === 'string' && b.email.length < 200 ? b.email.trim() : undefined; const phone = typeof b.phone === 'string' && b.phone.length < 30 ? b.phone.trim() : undefined;
    return testChannels({ email, phone }, getDatabase().settings.find((s) => s.academyId === u.academyId)?.branding.name ?? 'tu academia');
  });
  setInterval(() => { if (queueReminders()) flush(); void deliverOutbox(flush); }, Number(process.env.NOTICES_TICK_MS ?? 60_000)).unref();

  app.post<{ Params: { name: string } }>('/api/rpc/:name', async (req, reply) => {
    const u = need(req, reply); if (!u) return reply;
    const fn = exposed.find(([n]) => n === req.params.name)?.[1]; const schema = RPC[req.params.name];
    if (!fn || !schema) return fail(reply, 404, 'Operación desconocida');
    const body = req.body as { args?: unknown } | undefined;
    const parsed = schema.safeParse(body?.args ?? []);
    if (!parsed.success) return fail(reply, 400, `Datos no válidos: ${parsed.error.issues[0]?.message ?? 'revisa el formulario'}`);
    return serial(async () => {
      try {
        const result = await fn(u, ...parsed.data);
        flush(); void deliverOutbox(flush);
        return { result: JSON.parse(JSON.stringify(result ?? null, (k, v) => (k === 'pwd' ? undefined : v))) };
      } catch (e) {
        // La mutación pudo dejar el dominio en memoria a medias: se restaura desde disco para no divergir de lo persistido.
        installDatabase(store.load(), flush);
        if (!(e instanceof M.DomainError)) { req.log.error(e); return fail(reply, 500, 'Error interno'); }
        return fail(reply, 422, e.message);
      }
    });
  });

  app.post('/api/onboarding', async (req, reply) => {
    if (onboardLimit(req.ip)) return fail(reply, 429, 'Demasiadas altas desde esta red. Inténtalo más tarde.');
    const p = onboardingBody.safeParse(req.body); if (!p.success) return fail(reply, 400, `Datos no válidos: ${p.error.issues[0]?.message ?? ''}`);
    return serial(async () => {
      try { await M.createAcademy({ ...p.data, modules: p.data.modules as never }); flush(); return { ok: true }; }
      catch (e) { if (e instanceof M.DomainError) return fail(reply, 422, e.message); req.log.error(e); return fail(reply, 500, 'Error interno'); }
    });
  });

  app.post('/api/ai/chat', async (req, reply) => {
    const u = need(req, reply); if (!u) return reply;
    const p = aiBody.safeParse(req.body); if (!p.success) return fail(reply, 400, 'Pregunta no válida');
    // El contexto lo construye el servidor con el alcance y permisos del usuario autenticado (nunca el cliente).
    const snapshot = await createRepos(getDatabase(), u).snapshot();
    return askClaude({ question: p.data.question, history: p.data.history ?? [], snapshot, user: u });
  });

  const audit = (academyId: string, summary: string, id: string) => getDatabase().activity.unshift({ academyId, id: `${academyId}_log_${Date.now().toString(36)}`, at: new Date().toISOString(), actorId: 'owner', actorName: 'Propietario de la plataforma', action: 'modificó', entityType: 'academy', entityId: id, summary });
  registerPersonal(app, store, loginLimit, fail, {
    list: () => ({ clients: platformRows(getDatabase()).map((r) => ({ id: r.academy.id, name: r.academy.name, slug: r.academy.slug, type: r.academy.type, plan: r.academy.plan, status: r.academy.status, createdAt: r.academy.createdAt, users: r.users, students: r.students, modules: r.modules, storageKb: r.storageKb, lastActivity: r.lastActivity, waMonth: r.waMonth, waPrev: r.waPrev })) }),
    setPlan: (id, plan, applyModules) => serial(() => { const r = changeAcademyPlan(getDatabase(), id, plan, applyModules); audit(id, `Plan cambiado a ${plan}${r.disabled.length ? ` (módulos desactivados: ${r.disabled.join(', ')})` : ''}`, id); flush(); return { name: r.academy.name, plan: r.academy.plan, disabled: r.disabled as string[] }; }),
    setStatus: (id, status) => serial(() => { const a = getDatabase().academies.find((x) => x.id === id); if (!a) throw new Error('Negocio no encontrado.'); a.status = status; audit(id, status === 'active' ? 'Negocio reactivado' : 'Negocio suspendido', id); flush(); return { name: a.name, status: a.status }; }),
  });
  app.setErrorHandler((err, req, reply) => { req.log.error(err); const code = (err as { statusCode?: number }).statusCode; reply.code(code && code < 500 ? code : 500).send({ error: code && code < 500 ? 'Petición no válida' : 'Error interno' }); });
  app.addHook('onClose', async () => { store.close(); });
  setInterval(() => store.purgeSessions(Date.now()), 3_600_000).unref();
  return app;
}
