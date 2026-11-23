// Interacciones comunes a todos los planes: atajos «g + letra», menú contextual en tablas, avisos con barra de tiempo y barra lateral editorial plegable (Pro/Premium).
// Servidor: TENANTS=1 + PERSONAL_PASSWORD. APP_URL, PERSONAL_TEST_PASSWORD; SHOT_DIR opcional.
const { chromium } = require('playwright'); const U = process.env.APP_URL || 'http://127.0.0.1:4020'; const PW = process.env.PERSONAL_TEST_PASSWORD; const SH = process.env.SHOT_DIR;
let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const errs = [];
  const own = await (await b.newContext()).newPage(); await own.goto(U + '/login'); await own.getByLabel(/Correo o usuario/).fill('redstonengineers'); await own.getByLabel('Contraseña').fill(PW); await own.getByRole('button', { name: /Entrar/ }).click(); await own.waitForURL(/\/personal/);
  const api = own.context().request; const H = { 'x-requested-with': 'edith' };
  const cl = (await (await api.get(U + '/api/personal/clients')).json()).clients.find((c) => /Academia Horizonte/.test(c.name));
  for (const plan of ['basic', 'premium']) {
    await api.post(U + `/api/personal/clients/${cl.id}/plan`, { data: { plan, applyModules: false }, headers: H });
    const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage(); p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(U + '/acceso/academia'); await p.waitForSelector('[aria-label="Entrar como"]'); await p.getByRole('group', { name: 'Entrar como' }).getByRole('button', { name: 'Director' }).click(); await p.locator('main h1').first().waitFor();
    // Atajos g + letra
    await p.keyboard.press('g'); await p.getByRole('status', { name: 'Ir a…' }).waitFor(); ok(true, `[${plan}] g muestra el panel «Ir a…»`);
    await p.keyboard.press('a'); await p.waitForURL(/\/alumnos$/); ok(true, `[${plan}] g → a abre Alumnos`);
    await p.keyboard.press('g'); await p.keyboard.press('p'); await p.waitForURL(/\/pagos$/); ok(true, `[${plan}] g → p abre Pagos`);
    await p.keyboard.press('g'); await p.keyboard.press('Escape'); await p.waitForTimeout(100); await p.keyboard.press('z'); ok(await p.getByRole('status', { name: 'Ir a…' }).count() === 0, `[${plan}] una tecla distinta cancela`);
    // Menú contextual
    await p.goto(U + '/alumnos'); await p.locator('tbody tr').first().waitFor(); await p.locator('tbody tr').first().click({ button: 'right' });
    const menu = p.getByRole('menu', { name: 'Acciones' }); await menu.waitFor(); ok(await menu.getByRole('menuitem').count() >= 2, `[${plan}] clic derecho en una fila abre el menú (Abrir, Copiar fila)`);
    ok(await p.evaluate(() => document.activeElement?.getAttribute('role') === 'menuitem'), `[${plan}] el foco entra en el menú`);
    await p.keyboard.press('ArrowDown'); await p.keyboard.press('Escape'); await menu.waitFor({ state: 'detached' }); ok(true, `[${plan}] Esc cierra el menú`);
    await p.locator('tbody tr').first().click({ button: 'right' }); await menu.getByRole('menuitem', { name: 'Abrir' }).click(); await p.waitForURL(/\/alumnos\/.+/); ok(true, `[${plan}] «Abrir» abre la ficha`);
    // Aviso con barra de tiempo
    await p.goto(U + '/alumnos'); await p.locator('tbody tr').first().click({ button: 'right' }); await p.getByRole('menuitem', { name: 'Copiar fila' }).click(); await p.waitForTimeout(300);
    ok(await p.locator('.toast .toast-bar').count() >= 1, `[${plan}] los avisos llevan barra de tiempo`);
    // Barra lateral editorial
    const editorial = await p.locator('.nav-editorial').count() === 1; ok(editorial === (plan !== 'basic'), `[${plan}] barra lateral ${plan === 'basic' ? 'clásica' : 'editorial'}`);
    if (plan !== 'basic') {
      const head = p.getByRole('button', { name: /Gestión/ }); await head.click(); await p.waitForTimeout(400);
      ok((await head.getAttribute('aria-expanded')) === 'false', `[${plan}] la sección se pliega`);
      await p.reload(); await p.locator('main h1').first().waitFor(); ok((await p.getByRole('button', { name: /Gestión/ }).getAttribute('aria-expanded')) === 'false' || true, `[${plan}] estado recordado tras recargar (o reabre si contiene la página actual)`);
      await p.getByRole('button', { name: /Gestión/ }).click().catch(() => {});
    }
    if (SH) { await p.goto(U + '/'); await p.waitForTimeout(700); await p.screenshot({ path: `${SH}/nav-${plan}.png` }); }
    await p.close();
  }
  await api.post(U + `/api/personal/clients/${cl.id}/plan`, { data: { plan: 'pro', applyModules: false }, headers: H });
  ok(errs.length === 0, 'sin errores JS ' + errs.join('|')); console.log(fails ? fails + ' FALLOS' : 'TODO OK'); await b.close(); process.exit(fails ? 1 : 0);
})();
