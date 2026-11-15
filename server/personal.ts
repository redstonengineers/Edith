import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Store } from './store';
import { config } from './config';

/**
 * Modo personal (uso privado de los dueños, no de negocio). Se activa SOLO si el servidor tiene
 * PERSONAL_PASSWORD en el entorno (y opcionalmente PERSONAL_USER, por defecto «redstonengineers»).
 * La contraseña nunca está en el código ni en el repositorio ni llega al navegador.
 * Sesión: cookie httpOnly firmada con HMAC. Datos: un documento JSON por perfil, con control de versiones.
 */
const USER = (process.env.PERSONAL_USER ?? 'redstonengineers').toLowerCase();
const PASS = process.env.PERSONAL_PASSWORD;
const PROFILES = ['gazael', 'hokage'] as const;
type Profile = (typeof PROFILES)[number];
const COOKIE = 'ac_personal'; const TTL = 30 * 24 * 3600_000;

export const personalEnabled = () => !!PASS;
const key = () => createHmac('sha256', 'edith-personal').update(PASS ?? '').digest();
const sign = (v: string) => createHmac('sha256', key()).update(v).digest('base64url');
const same = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };

interface Sess { p: Profile | null; exp: number }
function read(req: FastifyRequest): Sess | null {
  const raw = req.cookies[COOKIE]; if (!raw || !PASS) return null; const [body, mac] = raw.split('.'); if (!body || !mac || !same(mac, sign(body))) return null;
  try { const s = JSON.parse(Buffer.from(body, 'base64url').toString()) as Sess; return s.exp > Date.now() ? s : null; } catch { return null; }
}
function issue(reply: FastifyReply, p: Profile | null) {
  const body = Buffer.from(JSON.stringify({ p, exp: Date.now() + TTL } satisfies Sess)).toString('base64url');
  reply.setCookie(COOKIE, `${body}.${sign(body)}`, { httpOnly: true, sameSite: 'strict', secure: config.cookieSecure, path: '/api/personal', maxAge: TTL / 1000 });
}

/** Gestión de los negocios cliente desde el modo personal del propietario (la lógica vive en app.ts, con la base y la cola de escritura). */
export interface ClientsOps {
  list: () => unknown;
  setPlan: (id: string, plan: 'trial' | 'basic' | 'pro' | 'premium', applyModules: boolean) => Promise<{ name: string; plan: string; disabled: string[] }>;
  setStatus: (id: string, status: 'active' | 'suspended') => Promise<{ name: string; status: string }>;
}

export function registerPersonal(app: FastifyInstance, store: Store, lim: ((k: string) => void) & { blocked: (k: string) => boolean; clear: (k: string) => void }, fail: (r: FastifyReply, c: number, e: string) => FastifyReply, clients: ClientsOps) {
  if (!PASS) return;
  const secure = (req: FastifyRequest, reply: FastifyReply) => { const s = read(req); if (!s) { fail(reply, 401, 'Sesión personal no válida.'); return null; } return s; };

  app.get('/api/personal/me', async (req) => { const s = read(req); return { authed: !!s, profile: s?.p ?? null }; });

  app.post('/api/personal/login', async (req, reply) => {
    const lk = `personal:${req.ip}`; if (lim.blocked(lk)) return fail(reply, 429, 'Demasiados intentos. Inténtalo más tarde.');
    const b = z.object({ user: z.string().max(80), password: z.string().max(200) }).safeParse(req.body); if (!b.success) return fail(reply, 400, 'Datos no válidos');
    const okUser = same(b.data.user.trim().toLowerCase(), USER); const okPass = same(b.data.password, PASS as string);
    if (!okUser || !okPass) { lim(lk); return fail(reply, 401, 'Usuario o contraseña incorrectos.'); }
    lim.clear(lk); issue(reply, null); return { ok: true };
  });

  app.post('/api/personal/profile', async (req, reply) => {
    const s = secure(req, reply); if (!s) return reply;
    const b = z.object({ profile: z.enum(PROFILES) }).safeParse(req.body); if (!b.success) return fail(reply, 400, 'Perfil no válido');
    issue(reply, b.data.profile); return { ok: true, profile: b.data.profile };
  });

  // Panel de clientes: ver y cambiar la suscripción de cada negocio. Solo cifras de uso, nunca datos personales de sus alumnos.
  app.get('/api/personal/clients', async (req, reply) => { if (!secure(req, reply)) return reply; return clients.list(); });
  app.post<{ Params: { id: string } }>('/api/personal/clients/:id/plan', async (req, reply) => {
    if (!secure(req, reply)) return reply;
    const b = z.object({ plan: z.enum(['trial', 'basic', 'pro', 'premium']), applyModules: z.boolean().optional() }).safeParse(req.body); if (!b.success) return fail(reply, 400, 'Plan no válido');
    try { return { ok: true, ...(await clients.setPlan(req.params.id, b.data.plan, !!b.data.applyModules)) }; } catch (e) { return fail(reply, 404, (e as Error).message); }
  });
  app.post<{ Params: { id: string } }>('/api/personal/clients/:id/status', async (req, reply) => {
    if (!secure(req, reply)) return reply;
    const b = z.object({ status: z.enum(['active', 'suspended']) }).safeParse(req.body); if (!b.success) return fail(reply, 400, 'Estado no válido');
    try { return { ok: true, ...(await clients.setStatus(req.params.id, b.data.status)) }; } catch (e) { return fail(reply, 404, (e as Error).message); }
  });

  app.post('/api/personal/logout', async (_req, reply) => { reply.clearCookie(COOKIE, { path: '/api/personal' }); return { ok: true }; });

  app.get('/api/personal/data', async (req, reply) => {
    const s = secure(req, reply); if (!s) return reply; if (!s.p) return fail(reply, 400, 'Elige un perfil.');
    const row = store.personalGet(s.p); return { rev: row?.rev ?? 0, data: row ? JSON.parse(row.body) : null };
  });

  app.put('/api/personal/data', async (req, reply) => {
    const s = secure(req, reply); if (!s) return reply; if (!s.p) return fail(reply, 400, 'Elige un perfil.');
    const b = z.object({ rev: z.number().int().min(0), data: z.record(z.string(), z.unknown()) }).safeParse(req.body); if (!b.success) return fail(reply, 400, 'Datos no válidos');
    const body = JSON.stringify(b.data.data); if (body.length > 900_000) return fail(reply, 413, 'Demasiados datos.');
    const rev = store.personalPut(s.p, body, b.data.rev); if (rev === null) return fail(reply, 409, 'Los datos cambiaron en otro dispositivo. Recarga.');
    return { rev };
  });

  /** JARVIS personal: contexto = datos del perfil de la sesión. Con ANTHROPIC_API_KEY responde Claude; si no, un resumen local. */
  app.post('/api/personal/ai', async (req, reply) => {
    const s = secure(req, reply); if (!s) return reply; if (!s.p) return fail(reply, 400, 'Elige un perfil.');
    const b = z.object({ question: z.string().min(1).max(400), history: z.array(z.object({ role: z.enum(['user', 'ai']), text: z.string().max(500) })).max(20).optional() }).safeParse(req.body); if (!b.success) return fail(reply, 400, 'Pregunta no válida');
    const row = store.personalGet(s.p); const data = row ? JSON.parse(row.body) : {};
    const { askPersonal } = await import('./claude');
    return askPersonal(s.p, data, b.data.question, b.data.history ?? []);
  });
}
