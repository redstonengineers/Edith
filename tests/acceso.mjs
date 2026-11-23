// Modelo de acceso: demos abiertas (isDemo, sin contraseña) y clientes (correo + contraseña generada). Arranca su propio servidor y proveedores falsos.
// Uso: node tests/acceso.mjs      (ACCESO_PORT=4300 por defecto; usa una base temporal)
import { spawn } from 'node:child_process';
import http from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = Number(process.env.ACCESO_PORT ?? 4300); const FAKE = PORT + 1; const B = `http://127.0.0.1:${PORT}/api`; const PW = 'owner-test-pw-123';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Proveedores externos falsos: cuentan qué llamadas recibe cada uno (correo, WhatsApp, Anthropic).
const calls = { mail: 0, wa: 0, ai: 0 };
const fake = http.createServer((req, res) => { req.resume(); req.on('end', () => {
  res.setHeader('content-type', 'application/json');
  if (req.url.includes('/emails/batch')) { calls.mail++; return res.end('{}'); }
  if (req.url.includes('/messages') && req.url.startsWith('/v1/')) { calls.ai++; return res.end(JSON.stringify({ content: [{ type: 'text', text: 'respuesta del modelo falso' }] })); }
  if (req.url.includes('/messages')) { calls.wa++; return res.end(JSON.stringify({ messages: [{ id: 'wamid.x' }] })); }
  res.end('{}'); }); }).listen(FAKE);

const dir = mkdtempSync(join(tmpdir(), 'edith-acceso-')); let child = null;
const env = { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', DB_PATH: join(dir, 'a.db'), BACKUP_HOURS: '0', TENANTS: '1', PROVISION_ACADEMY_NAME: 'Autoescuela Atlanta', PROVISION_ADMIN_EMAIL: 'owner@atlanta.test', PERSONAL_PASSWORD: PW, SESSION_HOURS: '100',
  RESEND_API_KEY: 'k', MAIL_API_BASE: `http://127.0.0.1:${FAKE}`, WHATSAPP_TOKEN: 't', WHATSAPP_PHONE_ID: 'p1', WHATSAPP_API_BASE: `http://127.0.0.1:${FAKE}`, ANTHROPIC_API_KEY: 'ak', ANTHROPIC_API_BASE: `http://127.0.0.1:${FAKE}`, NOTICES_TICK_MS: '400', DEMO_RESET_DAILY: '0', LOGIN_FAILS_PER_IP: '100000', NODE_ENV: 'development' };
for (const k of ['SEED_DEMO', 'TENANT_PASSWORD', 'BOOTSTRAP_ADMIN_EMAIL']) delete env[k];
async function start() {
  child = spawn('npx', ['tsx', 'server/index.ts'], { env, stdio: ['ignore', 'ignore', 'ignore'], detached: true });
  for (let i = 0; i < 60; i++) { try { if ((await fetch(B + '/health')).ok) return; } catch { /* aún arrancando */ } await wait(500); }
  throw new Error('el servidor no arrancó');
}
const stop = async () => { if (child) { try { process.kill(-child.pid, 'SIGTERM'); } catch { /* ya parado */ } await wait(1200); child = null; } };

const H = (cookie) => ({ 'content-type': 'application/json', 'x-requested-with': 'edith', ...(cookie ? { cookie } : {}) });
const call = async (method, path, body, cookie) => { const r = await fetch(B + path, { method, headers: H(cookie), body: body === undefined ? undefined : JSON.stringify(body) }); let j = null; try { j = await r.json(); } catch { /* sin cuerpo */ } return { status: r.status, j, r }; };
const cookieOf = (r, name) => { const c = r.headers.getSetCookie().find((x) => x.startsWith(name + '=')); return c ? c.split(';')[0] : null; };
const maxAge = (r, name) => { const c = r.headers.getSetCookie().find((x) => x.startsWith(name + '=')); const m = c && /Max-Age=(\d+)/i.exec(c); return m ? Number(m[1]) : null; };
const demo = async (academy, profile) => { const r = await call('POST', '/auth/demo', { academy, profile }); return { ...r, cookie: cookieOf(r.r, 'ac_session') }; };
const login = async (email, password) => { const r = await call('POST', '/auth/login', { email, password }); return { ...r, cookie: cookieOf(r.r, 'ac_session') }; };
const rpc = (name, args, cookie) => call('POST', `/rpc/${name}`, { args }, cookie);
const settle = async (ms = 1500) => wait(ms);

try {
  await start();
  // ── Acceso 1: demos abiertas ──
  const atl = await demo('atlanta', 'director');
  ok(atl.status === 200 && !!atl.cookie && atl.j.user.role === 'ADMIN', 'la demo de Atlanta entra sin contraseña');
  ok(maxAge(atl.r, 'ac_session') === 12 * 3600, 'la sesión demo dura 12 h aunque SESSION_HOURS sea mayor, y sin «mantener sesión»');
  ok((await demo('academia', 'director')).status === 200 && (await demo('clinica', 'director')).status === 200, 'Academia y Clínica también entran sin contraseña');
  ok((await call('GET', '/auth/me', undefined, atl.cookie)).j.user?.role === 'ADMIN', 'la sesión demo funciona');
  ok((await demo('atlanta', 'nadie')).status === 403 && (await demo('no-existe', 'director')).status === 403, 'perfil o negocio inexistente → 403');
  const pub = await (await fetch(B + '/public/tenants')).json(); ok(pub.tenants.length === 3 && !/pwd|hash|salt|@|password/i.test(JSON.stringify(pub)), 'tarjetas públicas: solo las 3 demos, sin datos sensibles');

  // Las cuentas demo no tienen contraseña utilizable
  let leaked = 0; for (const slug of ['atlanta', 'academia', 'clinica']) for (const u of ['director', 'secretaria', 'profesor', 'alumno']) for (const p of ['demo', '', 'Demo1234', u, 'password', slug])
    if ((await login(`${u}@${slug}.demo`, p || 'x')).status === 200 || (await login(u, p || 'x')).status === 200) leaked++;
  ok(leaked === 0, 'ninguna cuenta demo entra por /login (ni con «demo» ni con nada)');
  ok((await login('owner@atlanta.test', 'demo')).status === 401 && (await login('owner@atlanta.test', PW)).status === 401, 'el administrador de Atlanta (demo) tampoco entra por /login');

  // ── Acceso 2: clientes ──
  const newClient = { academyName: 'Autoescuela Sol', type: 'autoescuela', plan: 'pro', adminEmail: 'Ana@Sol.test', adminName: 'Ana Sol' };
  ok((await call('POST', '/onboarding', newClient)).status === 401, 'POST /api/onboarding sin sesión personal → 401');
  ok((await call('POST', '/onboarding', newClient, 'ac_personal=falsa')).status === 401 && (await call('POST', '/onboarding', newClient, atl.cookie)).status === 401, 'con cookie falsa o de sesión demo → 401');
  const pl = await call('POST', '/personal/login', { user: 'redstonengineers', password: PW }); const pc = cookieOf(pl.r, 'ac_personal'); ok(pl.status === 200 && !!pc, 'sesión personal del propietario');
  const mk = await call('POST', '/onboarding', newClient, pc); const pw1 = mk.j?.password;
  ok(mk.status === 200 && /^[A-Za-z0-9-]{19}$/.test(pw1 ?? '') && mk.j.adminEmail === 'ana@sol.test', 'con sesión personal crea el cliente y devuelve una contraseña fuerte generada');
  ok(!!mk.j?.academyId && mk.j.plan === 'pro', 'el cliente nace con el plan elegido');
  const clients = (await call('GET', '/personal/clients', undefined, pc)).j.clients; const cl = clients.find((c) => c.id === mk.j.academyId);
  ok(cl?.isDemo === false && !cl.slug, 'el cliente tiene isDemo:false y no tiene slug');
  ok(clients.filter((c) => c.isDemo).map((c) => c.slug).sort().join() === 'academia,atlanta,clinica' && clients.filter((c) => c.isDemo).length === 3, 'solo Atlanta, Academia y Clínica tienen isDemo:true');
  ok(!(await (await fetch(B + '/public/tenants')).text()).includes('Sol'), 'el cliente no aparece en las tarjetas de acceso de demos');
  ok((await demo(mk.j.academyId, 'ana@sol.test')).status === 403, 'un negocio con isDemo:false no entra por /api/auth/demo → 403');
  ok((await login('ana@sol.test', 'demo')).status === 401, 'el cliente no entra con «demo»');
  const l1 = await login('ana@sol.test', pw1); ok(l1.status === 200 && l1.j.user.mustChangePassword === true, 'entra por /login con la contraseña generada y debe cambiarla');
  const snap0 = await call('GET', '/snapshot', undefined, l1.cookie); ok(snap0.status === 403 && snap0.j.code === 'password_change_required', 'hasta cambiar la contraseña la API está bloqueada');
  ok((await call('GET', '/auth/me', undefined, l1.cookie)).j.user.mustChangePassword === true, '/auth/me sigue disponible para mostrar el cambio de contraseña');
  ok((await call('POST', '/auth/password', { current: 'mal', next: 'Nueva2026ok' }, l1.cookie)).status === 401, 'cambio con la contraseña actual incorrecta → 401');
  ok((await call('POST', '/auth/password', { current: pw1, next: 'corta' }, l1.cookie)).status === 400 && (await call('POST', '/auth/password', { current: pw1, next: pw1 }, l1.cookie)).status === 400, 'contraseña nueva débil o igual a la actual → 400');
  const ch = await call('POST', '/auth/password', { current: pw1, next: 'Nueva2026ok' }, l1.cookie); const ck = cookieOf(ch.r, 'ac_session');
  ok(ch.status === 200 && !ch.j.user.mustChangePassword && !!ck, 'cambia la contraseña y recibe sesión nueva');
  ok((await call('GET', '/snapshot', undefined, l1.cookie)).status === 401 && (await call('GET', '/snapshot', undefined, ck)).status === 200, 'la sesión antigua se cierra y la nueva ya usa la API');
  ok((await login('ana@sol.test', pw1)).status === 401 && (await login('ana@sol.test', 'Nueva2026ok')).status === 200, 'la contraseña generada deja de valer');
  ok(maxAge(ch.r, 'ac_session') === 100 * 3600, 'la sesión de cliente sí usa SESSION_HOURS');

  // Dos clientes con el mismo nombre de administrador: el login por correo no da conflictos
  const mk2 = await call('POST', '/onboarding', { academyName: 'Autoescuela Luna', type: 'autoescuela', plan: 'basic', adminEmail: 'ana@luna.test', adminName: 'Ana Sol' }, pc);
  ok(mk2.status === 200 && mk2.j.password !== pw1, 'segundo cliente con administrador del mismo nombre');
  const l2 = await login('ana@luna.test', mk2.j.password); ok(l2.status === 200 && l2.j.user.academyId === mk2.j.academyId, 'cada cliente entra en su negocio por su correo, sin conflictos');
  ok((await call('POST', '/onboarding', { ...newClient, academyName: 'Otra' }, pc)).status === 422, 'correo de administrador repetido → 422');
  ok((await call('POST', '/onboarding', { ...newClient, adminEmail: 'no-es-correo' }, pc)).status === 422 && (await call('POST', '/onboarding', { academyName: 'X' }, pc)).status === 400, 'datos no válidos rechazados');

  // Reiniciar el servidor no cambia la contraseña de un cliente ni los flags
  await stop(); await start();
  ok((await login('ana@sol.test', 'Nueva2026ok')).status === 200, 'tras reiniciar, la contraseña del cliente sigue igual');
  const l2b = await login('ana@luna.test', mk2.j.password); ok(l2b.status === 200 && l2b.j.user.mustChangePassword === true, 'tras reiniciar, el cliente que no la cambió conserva su contraseña generada y el aviso de cambio');
  const pc2 = cookieOf(await call('POST', '/personal/login', { user: 'redstonengineers', password: PW }).then((r) => r.r), 'ac_personal'); const cl2 = (await call('GET', '/personal/clients', undefined, pc2)).j.clients;
  ok(cl2.filter((c) => c.isDemo).length === 3 && cl2.filter((c) => !c.isDemo).length === 2, 'tras reiniciar, isDemo no cambia (3 demos y 2 clientes)');
  ok((await login('director@atlanta.demo', 'demo')).status === 401, 'tras reiniciar, las demos siguen sin contraseña');

  // ── Límites de las sesiones demo ──
  const dm = await demo('atlanta', 'director'); const A = await login('ana@sol.test', 'Nueva2026ok');
  await settle(300); let m0 = { ...calls };
  const t1 = await call('POST', '/notices/test', { email: 'visitante@real.com', phone: '600111222' }, dm.cookie);
  ok(t1.status === 200 && /simulado/.test(JSON.stringify(t1.j)) && calls.mail === m0.mail && calls.wa === m0.wa, 'demo: la prueba de canales es simulada y no llama a correo ni WhatsApp');
  const t2 = await call('POST', '/notices/test', { email: 'cliente@real.com', phone: '600111222' }, A.cookie); await settle(300);
  ok(t2.status === 200 && calls.mail > m0.mail && calls.wa > m0.wa, 'control: un cliente real sí llama a correo y WhatsApp');
  m0 = { ...calls };
  const a1 = await call('POST', '/ai/chat', { question: '¿Cuántos alumnos tenemos?' }, dm.cookie); ok(a1.status === 200 && !!a1.j.text && calls.ai === m0.ai, 'demo: JARVIS responde con el motor local y no llama a Anthropic');
  const a2 = await call('POST', '/ai/chat', { question: '¿Cuántos alumnos tenemos?' }, A.cookie); ok(a2.status === 200 && a2.j.text === 'respuesta del modelo falso' && calls.ai === m0.ai + 1, 'control: un cliente sí usa Anthropic');
  const ap = await fetch(B + '/public/apply/atlanta', { method: 'POST', headers: H(), body: JSON.stringify({ name: 'Visitante Real', email: 'visitante@real.com', phone: '600123123', birthDate: '1990-01-01', interest: 'Permiso B', consent: true, website: '', startedAt: Date.now() - 20000 }) }); await settle(600);
  ok(calls.mail === m0.mail, 'demo: una solicitud pública no envía correos reales' + (ap.status === 200 ? '' : ` (HTTP ${ap.status}, no creada)`));
  const dsnap = await call('GET', '/snapshot', undefined, dm.cookie); const stu = dsnap.j.students.find((s) => s.phone); const tea = dsnap.j.teachers[0]; const veh = dsnap.j.vehicles?.[0];
  const w0 = calls.wa; const before = dsnap.j.outbox?.length ?? 0;
  const pr = await rpc('createPractice', [{ studentId: stu.id, teacherId: tea.id, vehicleId: veh?.id, date: new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10), start: '03:00', end: '04:00' }, true], dm.cookie); await settle(1500);
  const after = (await call('GET', '/snapshot', undefined, dm.cookie)).j.outbox ?? [];
  ok(pr.status === 200 && calls.wa === w0 && after.filter((o) => o.waStatus === 'pendiente' || o.emailStatus === 'pendiente').length === 0, `demo: los avisos de una práctica nueva quedan simulados (${after.length - before} nuevos), sin envíos reales`);
  ok(after.slice(0, Math.max(1, after.length - before)).every((o) => !o.note || /Simulado/.test(o.note)), 'demo: los avisos llevan la nota «Simulado (demo)»');
  ok((await rpc('setAcademyPlan', [dsnap.j.academy.id, 'premium'], dm.cookie)).status === 403 && (await rpc('platformOverview', [], dm.cookie)).status === 403 && (await rpc('setAcademyStatus', [dsnap.j.academy.id, 'suspended'], dm.cookie)).status === 403, 'demo: no puede cambiar plan, suspender ni ver la plataforma');
  ok((await call('POST', `/personal/clients/${dsnap.j.academy.id}/plan`, { plan: 'premium' }, dm.cookie)).status === 401 && (await call('GET', '/personal/clients', undefined, dm.cookie)).status === 401, 'demo: el panel de clientes del propietario no se abre con una sesión demo');

  // ── Restauración de las demos ──
  const cs = await rpc('createStudent', [{ firstName: 'Marcador', lastName: 'Visitante Demo', birthDate: '1999-09-09', email: 'marcador@demo.test', phone: '611000999' }], dm.cookie); ok(cs.status === 200, 'demo: un visitante añade un alumno');
  const rs = await call('POST', '/personal/demos/reset', {}, pc2); ok(rs.status === 200 && ['atlanta', 'academia', 'clinica'].every((s) => rs.j.restored.includes(s)), 'el propietario restaura las demos');
  ok((await call('GET', '/auth/me', undefined, dm.cookie)).j.user === null, 'la restauración cierra las sesiones demo');
  const dm2 = await demo('atlanta', 'director'); const s2 = await call('GET', '/snapshot', undefined, dm2.cookie);
  ok(s2.status === 200 && s2.j.students.length > 20 && !s2.j.students.some((s) => s.lastName === 'Visitante Demo'), 'tras restaurar, Atlanta vuelve a sus datos de fábrica (sin lo añadido por el visitante)');
  const cl3 = (await call('GET', '/personal/clients', undefined, pc2)).j.clients; ok(cl3.filter((c) => !c.isDemo).length === 2, 'la restauración no toca a los clientes');
  ok((await login('ana@sol.test', 'Nueva2026ok')).status === 200 && (await login('ana@luna.test', mk2.j.password)).status === 200, 'tras restaurar, los clientes conservan sus contraseñas');
  ok((await demo('academia', 'director')).status === 200 && (await login('director@atlanta.demo', 'demo')).status === 401, 'tras restaurar, las demos entran sin contraseña y siguen sin tenerla');

  // ── Límite de aperturas demo por IP (al final: bloquea esta IP) ──
  let tooMany = 0; for (let i = 0; i < 50; i++) if ((await demo('academia', 'director')).status === 429) tooMany++;
  ok(tooMany > 0, `límite de aperturas de sesión demo por IP (${tooMany} bloqueadas de 50)`);
} catch (e) { console.error('ERROR', e); fails++; }
finally { await stop(); fake.close(); rmSync(dir, { recursive: true, force: true }); }
console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK'); process.exit(fails ? 1 : 0);
