// «Mantener la sesión iniciada»: la cookie dura 12 h normalmente y 30 días si se marca; la casilla recuerda la elección.
// Servidor: TENANTS=1 + PROVISION_*. APP_URL=http://127.0.0.1:4021
const { chromium } = require('playwright');
const U = process.env.APP_URL || 'http://127.0.0.1:4021';
let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
const login = async (remember) => { const r = await fetch(U + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json', 'x-requested-with': 'edith' }, body: JSON.stringify({ email: 'director', password: 'demo', academy: 'atlanta', ...(remember === undefined ? {} : { remember }) }) }); const c = r.headers.get('set-cookie') || ''; return { status: r.status, maxAge: Number((c.match(/Max-Age=(\d+)/i) || [])[1]) }; };
(async () => {
  const a = await login(); ok(a.status === 200 && a.maxAge === 12 * 3600, `sin marcar: sesión de 12 h (Max-Age ${a.maxAge})`);
  const f = await login(false); ok(f.maxAge === 12 * 3600, 'remember:false = 12 h');
  const t = await login(true); ok(t.status === 200 && t.maxAge === 30 * 86400, `marcado: sesión de 30 días (Max-Age ${t.maxAge})`);
  const bad = await fetch(U + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json', 'x-requested-with': 'edith' }, body: JSON.stringify({ email: 'director', password: 'demo', academy: 'atlanta', remember: 'si' }) }); ok(bad.status === 400, 'valor no booleano rechazado (400)');

  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage();
  await p.goto(U + '/acceso/atlanta'); await p.waitForSelector('#u');
  const box = p.getByLabel(/Mantener la sesión iniciada/); ok(await box.count() === 1 && !(await box.isChecked()), 'en el acceso del negocio la casilla existe y viene sin marcar');
  await box.check(); await p.getByRole('group', { name: 'Entrar como' }).getByRole('button', { name: 'Director' }).click(); await p.locator('main h1').first().waitFor();
  const ck = (await ctx.cookies()).find((c) => c.name === 'ac_session' || c.httpOnly); const days = ck ? (ck.expires - Date.now() / 1000) / 86400 : 0;
  ok(days > 29 && days < 31, `la cookie del navegador dura ~30 días (${days.toFixed(1)})`);
  await p.reload(); await p.locator('main h1').first().waitFor(); ok(true, 'la sesión sigue al recargar');
  await p.evaluate(() => fetch('/api/auth/logout', { method: 'POST', credentials: 'include', headers: { 'X-Requested-With': 'edith' } }));
  await p.goto(U + '/acceso/atlanta'); await p.waitForSelector('#u'); ok(await p.getByLabel(/Mantener la sesión iniciada/).isChecked(), 'la casilla recuerda la elección');
  await p.goto(U + '/login'); await p.waitForSelector('#pw'); ok(await p.getByLabel(/Mantener la sesión iniciada/).count() === 1, 'también está en el acceso general');
  await b.close(); process.exit(fails ? 1 : 0);
})().catch((e) => { console.log('CRASH', e.message.split('\n').slice(0, 4).join(' | ')); process.exit(1); });
