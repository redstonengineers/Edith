// «Mantener la sesión iniciada» (solo clientes): la cookie dura 12 h normalmente y 30 días si se marca; la casilla recuerda la elección.
// Las demos nunca tienen «mantener sesión»: 12 h como máximo y sin casilla.
// Servidor: TENANTS=1 + PROVISION_* + PERSONAL_PASSWORD. Prueba: APP_URL, PERSONAL_TEST_PASSWORD y ATLANTA_ADMIN_EMAIL (= PROVISION_ADMIN_EMAIL).
const { chromium } = require('playwright'); const { realClient, J } = require('./acceso-lib.cjs');
const U = process.env.APP_URL || 'http://127.0.0.1:4021';
let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
const age = (r) => { const c = r.headers.getSetCookie().find((x) => x.startsWith('ac_session=')); const m = c && /Max-Age=(\d+)/i.exec(c); return m ? Number(m[1]) : null; };
(async () => {
  const real = await realClient(U); const login = (remember) => fetch(U + '/api/auth/login', { method: 'POST', headers: J(), body: JSON.stringify({ email: real.email, password: real.password, ...(remember === undefined ? {} : { remember }) }) });
  const a = await login(); ok(a.status === 200 && age(a) === 12 * 3600, `sin marcar: sesión de 12 h (Max-Age ${age(a)})`);
  const f = await login(false); ok(age(f) === 12 * 3600, 'remember:false = 12 h');
  const t = await login(true); ok(t.status === 200 && age(t) === 30 * 86400, `marcado: sesión de 30 días (Max-Age ${age(t)})`);
  const bad = await login('si'); ok(bad.status === 400, 'valor no booleano rechazado (400)');
  // Las demos ignoran «mantener sesión»: siempre 12 h
  const d = await fetch(U + '/api/auth/demo', { method: 'POST', headers: J(), body: JSON.stringify({ academy: 'academia', profile: 'director', remember: true }) }); ok(d.status === 200 && age(d) === 12 * 3600, `demo: 12 h aunque se pida «mantener» (Max-Age ${age(d)})`);

  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage();
  await p.goto(U + '/acceso/academia'); await p.waitForSelector('[aria-label="Entrar como"]');
  ok(await p.getByLabel(/Mantener la sesión iniciada/).count() === 0, 'en el acceso demo no hay casilla de «mantener sesión»');
  await p.goto(U + '/login'); await p.waitForSelector('#pw'); const box = p.getByLabel(/Mantener la sesión iniciada/); ok(await box.count() === 1 && !(await box.isChecked()), 'en /login la casilla existe y viene sin marcar');
  await p.getByLabel(/Correo o usuario/).fill(real.email); await p.getByLabel('Contraseña').fill(real.password); await box.check(); await p.getByRole('button', { name: /Entrar/ }).click(); await p.locator('main h1').first().waitFor();
  const ck = (await ctx.cookies()).find((c) => c.name === 'ac_session' || c.httpOnly); const days = ck ? (ck.expires - Date.now() / 1000) / 86400 : 0;
  ok(days > 29 && days < 31, `la cookie del navegador dura ~30 días (${days.toFixed(1)})`);
  await p.reload(); await p.locator('main h1').first().waitFor(); ok(true, 'la sesión sigue al recargar');
  await p.evaluate(() => fetch('/api/auth/logout', { method: 'POST', credentials: 'include', headers: { 'X-Requested-With': 'edith' } }));
  await p.goto(U + '/login'); await p.waitForSelector('#pw'); ok(await p.getByLabel(/Mantener la sesión iniciada/).isChecked(), 'la casilla recuerda la elección');
  await b.close(); console.log(fails ? `${fails} FALLOS` : 'TODO OK'); process.exit(fails ? 1 : 0);
})().catch((e) => { console.log('CRASH', e.message.split('\n').slice(0, 4).join(' | ')); process.exit(1); });
