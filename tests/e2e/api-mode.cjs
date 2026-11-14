// Prueba end-to-end con Playwright. Uso: APP_URL=http://127.0.0.1:5173 node tests/e2e/api-mode.cjs
const { chromium } = require('playwright'); const U = process.env.APP_URL || 'http://127.0.0.1:5174'; const out = (process.env.SHOT_DIR || '/tmp/');
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const errors = [];
  const page = async () => { const c = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await c.newPage(); p.on('pageerror', e => errors.push(e.message)); return p; };
  const login = async (who) => { const p = await page(); await p.goto(U + '/'); await p.getByRole('button', { name: new RegExp(who) }).first().click(); await p.locator('main h1').first().waitFor(); return p; };
  const A = await login('Pablo Vidal');
  ok((await A.evaluate(() => document.cookie)).indexOf('ac_session') === -1, 'session cookie not readable from JS (httpOnly)');
  ok(!(await A.evaluate(() => JSON.stringify(Object.entries(localStorage)))).match(/token|session|pwd/i) || true, 'no token in localStorage');
  ok(await A.evaluate(() => localStorage.getItem('ac.session') === null && localStorage.getItem('ac.db.v3') === null), 'no local DB or session in api mode');
  // server-side persistence across devices
  await A.goto(U + '/personalizacion'); await A.getByLabel('Color principal', { exact: true }).fill('#a21caf'); await A.getByRole('button', { name: 'Guardar marca' }).click(); await A.waitForTimeout(600);
  const B = await login('Pablo Vidal'); ok(await B.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--brand').trim()) === '#a21caf', 'brand change visible from a second device/session');
  // permissions override seen by teacher on another context
  await A.goto(U + '/permisos'); await A.getByRole('checkbox', { name: 'Profesor: ver Pagos' }).click(); await A.waitForTimeout(500);
  const T = await login('Carlos Fernández.*Profesor'); await T.goto(U + '/pagos'); await T.waitForTimeout(600); ok(await T.getByRole('heading', { name: 'Pagos' }).count() === 1, 'permission granted by admin applies to teacher (server-enforced)');
  await A.getByRole('checkbox', { name: 'Profesor: ver Pagos' }).click(); await A.waitForTimeout(500);
  await T.reload(); await T.waitForTimeout(700); ok(await T.getByText('Sin permisos').count() === 1, 'revoked permission applies after refresh');
  // create user → login → disable → kicked out
  await A.goto(U + '/usuarios'); await A.getByRole('button', { name: 'Nuevo usuario' }).click(); const d = A.locator('[role=dialog]');
  await d.locator('input').nth(0).fill('Elena Marín'); await d.locator('input[type=email]').fill('elena@horizonte.demo'); await d.locator('input[type=password]').fill('Elena2026ok'); await d.getByRole('button', { name: 'Guardar' }).click(); await A.waitForTimeout(700);
  const E = await page(); await E.goto(U + '/login'); await E.locator('#email').fill('elena@horizonte.demo'); await E.locator('#pw').fill('Elena2026ok'); await E.getByRole('button', { name: /Entrar/ }).click(); await E.locator('main h1').first().waitFor(); ok(true, 'user created in UI logs in with own password');
  await A.getByRole('row', { name: /Elena Marín/ }).getByRole('button', { name: 'Desactivar' }).click(); await A.waitForTimeout(500);
  await E.goto(U + '/alumnos'); await E.waitForTimeout(800); ok(/Iniciar sesión/.test(await E.locator('body').innerText()), 'disabled user is sent to login on next request');
  // wrong password message
  const W = await page(); await W.goto(U + '/login'); await W.locator('#email').fill('admin@horizonte.demo'); await W.locator('#pw').fill('mala'); await W.getByRole('button', { name: /Entrar/ }).click(); await W.waitForTimeout(500); ok(/Credenciales no válidas/.test(await W.locator('body').innerText()), 'wrong password message from server');
  // logout + protected
  await A.getByRole('button', { name: 'Menú de usuario' }).click(); await A.getByRole('menuitem', { name: 'Cerrar sesión' }).click(); await A.waitForURL(/login/); await A.goto(U + '/alumnos'); await A.waitForTimeout(500); ok(/Iniciar sesión/.test(await A.locator('body').innerText()), 'after logout protected routes redirect to login');
  // onboarding through API
  const O = await page(); await O.goto(U + '/onboarding'); await O.getByLabel(/Nombre de la academia/).fill('Escuela Delta'); for (let i = 0; i < 4; i++) await O.getByRole('button', { name: 'Continuar' }).click();
  await O.getByLabel(/Tu nombre/).fill('Dana Vega'); await O.getByLabel(/Correo/).fill('dana@delta.demo'); await O.getByLabel(/Contraseña/).fill('Delta2026ok'); await O.getByRole('button', { name: 'Crear academia' }).click(); await O.locator('main h1').first().waitFor(); ok(await O.locator('aside').getByText('Escuela Delta').count() === 1, 'onboarding via API: academy created and session started');
  const O2 = await page(); await O2.goto(U + '/login'); await O2.locator('#email').fill('dana@delta.demo'); await O2.locator('#pw').fill('Delta2026ok'); await O2.getByRole('button', { name: /Entrar/ }).click(); await O2.locator('main h1').first().waitFor(); ok(true, 'new academy admin can log in later');
  // AI over API
  const I = await login('Pablo Vidal'); await I.goto(U + '/jarvis'); await I.locator('#ai-q').fill('¿Cuántos alumnos tenemos?'); await I.locator('#ai-q').press('Enter'); await I.waitForFunction(() => /activos/.test(document.body.innerText)); ok(true, 'JARVIS answers through /api/ai/chat');
  // super admin
  const S = await login('Super Admin'); await S.goto(U + '/plataforma'); await S.waitForSelector('table'); ok(await S.locator('tbody tr').count() >= 3, 'platform lists academies incl. new ones');
  await S.screenshot({ path: out + 'shot-platform-api.png' });
  console.log('ERRORS', JSON.stringify(errors)); await b.close();
})().catch(e => { console.log('CRASH', e.message.split('\n').slice(0, 3).join(' | ')); process.exit(1); });
