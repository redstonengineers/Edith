// Ayudantes de acceso para las pruebas con servidor real. Las demos (Atlanta, Academia, Clínica) no envían nada real y no tienen contraseña:
// las pruebas que comprueban envíos reales pasan antes Atlanta a cliente real con la sesión personal (isDemo:false) y entran con la contraseña generada.
//   Servidor: PERSONAL_PASSWORD=<pw> (+ TENANTS=1 y PROVISION_*). Prueba: PERSONAL_TEST_PASSWORD=<pw> y ATLANTA_ADMIN_EMAIL=<PROVISION_ADMIN_EMAIL>.
const J = (cookie, extra = {}) => ({ 'content-type': 'application/json', 'x-requested-with': 'edith', ...(cookie ? { cookie } : {}), ...extra });
const cookieOf = (r, name) => { const c = r.headers.getSetCookie().find((x) => x.startsWith(name + '=')); return c ? c.split(';')[0] : null; };

async function ownerCookie(U, pw = process.env.PERSONAL_TEST_PASSWORD) {
  if (!pw) throw new Error('Falta PERSONAL_TEST_PASSWORD (y PERSONAL_PASSWORD en el servidor)');
  const r = await fetch(U + '/api/personal/login', { method: 'POST', headers: J(), body: JSON.stringify({ user: 'redstonengineers', password: pw }) });
  if (!r.ok) throw new Error('login personal ' + r.status); return cookieOf(r, 'ac_personal');
}
/** Demo abierta: sesión sin contraseña. */
async function demoSession(U, academy, profile) {
  const r = await fetch(U + '/api/auth/demo', { method: 'POST', headers: J(), body: JSON.stringify({ academy, profile }) });
  if (!r.ok) throw new Error(`demo ${academy}/${profile}: ${r.status}`); return cookieOf(r, 'ac_session');
}
/** Pasa el negocio con ese slug a cliente real y devuelve la sesión de su administrador (ya con la contraseña cambiada). */
async function realClient(U, slug = 'atlanta', adminEmail = process.env.ATLANTA_ADMIN_EMAIL, newPassword = 'Cambiada2026ok') {
  const own = await ownerCookie(U); const list = await (await fetch(U + '/api/personal/clients', { headers: J(own) })).json();
  const c = list.clients.find((x) => x.slug === slug); if (!c) throw new Error('no hay negocio ' + slug);
  const mk = await fetch(U + `/api/personal/clients/${c.id}/real`, { method: 'POST', headers: J(own), body: JSON.stringify({ adminEmail }) }); const mj = await mk.json(); if (!mk.ok) throw new Error('pasar a real: ' + mj.error);
  const lg = await fetch(U + '/api/auth/login', { method: 'POST', headers: J(), body: JSON.stringify({ email: mj.adminEmail, password: mj.password }) }); if (!lg.ok) throw new Error('login cliente ' + lg.status);
  const ch = await fetch(U + '/api/auth/password', { method: 'POST', headers: J(cookieOf(lg, 'ac_session')), body: JSON.stringify({ current: mj.password, next: newPassword }) }); if (!ch.ok) throw new Error('cambio de contraseña ' + ch.status);
  return { cookie: cookieOf(ch, 'ac_session'), email: mj.adminEmail, password: newPassword, academyId: c.id };
}
/** Alta de un cliente real con la sesión personal (como el panel «Nuevo cliente»); entra, cambia la contraseña provisional y devuelve su sesión. */
async function newClient(U, { academyName, type = 'otro', plan = 'basic', adminEmail, password = 'Cliente2026ok' }) {
  const own = await ownerCookie(U); const r = await fetch(U + '/api/onboarding', { method: 'POST', headers: J(own), body: JSON.stringify({ academyName, type, plan, adminEmail }) }); const j = await r.json(); if (!r.ok) throw new Error('alta cliente: ' + r.status + ' ' + (j.error || ''));
  const lg = await fetch(U + '/api/auth/login', { method: 'POST', headers: J(), body: JSON.stringify({ email: j.adminEmail, password: j.password }) }); if (!lg.ok) throw new Error('login cliente ' + lg.status);
  const ch = await fetch(U + '/api/auth/password', { method: 'POST', headers: J(cookieOf(lg, 'ac_session')), body: JSON.stringify({ current: j.password, next: password }) }); if (!ch.ok) throw new Error('cambio de contraseña ' + ch.status);
  return { cookie: cookieOf(ch, 'ac_session'), email: j.adminEmail, password, academyId: j.academyId };
}
module.exports = { J, cookieOf, ownerCookie, demoSession, realClient, newClient };
