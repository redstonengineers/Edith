// Panel «Clientes» → «Nuevo cliente»: alta con contraseña generada (se muestra una vez), primer acceso con cambio de contraseña obligatorio,
// y /acceso/<negocio> sin contraseña. Servidor: TENANTS=1 + PROVISION_* + PERSONAL_PASSWORD. APP_URL, PERSONAL_TEST_PASSWORD.
const { chromium } = require('playwright');
const U = process.env.APP_URL || 'http://127.0.0.1:4020'; const PW = process.env.PERSONAL_TEST_PASSWORD;
let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(U + '/login'); await p.getByLabel(/Correo o usuario/).fill('redstonengineers'); await p.getByLabel('Contraseña').fill(PW); await p.getByRole('button', { name: /Entrar/ }).click(); await p.waitForURL(/\/personal/); await p.waitForSelector('text=Abrir mi EDITH');
  await p.getByRole('button', { name: /Entrar como Gazael/ }).click(); await p.waitForSelector('.core-btn');
  await p.getByRole('button', { name: 'Abrir panel de control de clientes' }).click(); const dlg = p.getByRole('dialog'); await dlg.getByRole('list', { name: 'Clientes' }).waitFor();
  ok(await dlg.getByText('Demo', { exact: true }).count() === 3, 'las tres demos llevan la etiqueta «Demo»');
  await dlg.getByRole('button', { name: 'Nuevo cliente' }).click(); const f = dlg.getByRole('form', { name: 'Nuevo cliente' });
  await f.getByLabel('Nombre del negocio').fill('Gimnasio Olimpo'); await f.getByLabel('Sector').selectOption('fitness'); await f.getByLabel('Plan').selectOption('premium'); await f.getByLabel('Correo del administrador').fill('Gerente@Olimpo.test');
  await f.getByRole('button', { name: 'Crear cliente' }).click(); const res = dlg.getByRole('region', { name: 'Cliente creado' }); await res.waitFor();
  const pass = (await res.getByTestId('new-client-password').innerText()).trim(); ok(/^[A-Za-z0-9-]{19}$/.test(pass), 'se muestra la contraseña generada una sola vez');
  ok((await res.innerText()).includes('gerente@olimpo.test') && /NO se vuelve a mostrar/.test(await res.innerText()), 'avisa de que no se vuelve a mostrar');
  await res.getByRole('button', { name: /Hecho/ }).click(); await dlg.getByRole('list', { name: 'Clientes' }).getByText('Gimnasio Olimpo').waitFor(); ok(true, 'el cliente nuevo aparece en la lista (sin etiqueta Demo)');
  ok(await dlg.locator('li', { hasText: 'Gimnasio Olimpo' }).getByText('Demo', { exact: true }).count() === 0, 'el cliente nuevo no es demo');
  await p.keyboard.press('Escape');

  // Primer acceso del cliente: /login → cambio de contraseña obligatorio
  const c = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); c.on('pageerror', (e) => errs.push(e.message));
  await c.goto(U + '/login'); ok(!/contraseña demo/i.test(await c.locator('body').innerText()), '/login no habla de «contraseña demo»');
  await c.getByLabel(/Correo o usuario/).fill('gerente@olimpo.test'); await c.getByLabel('Contraseña').fill(pass); await c.getByRole('button', { name: /Entrar/ }).click();
  await c.getByRole('heading', { name: /Elige tu contraseña/ }).waitFor(); ok(true, 'con la contraseña generada pide elegir una nueva antes de entrar');
  await c.getByLabel('Contraseña provisional').fill(pass); await c.getByLabel('Contraseña nueva', { exact: true }).fill('corta'); await c.getByLabel('Repite la contraseña nueva').fill('corta'); await c.getByRole('button', { name: /Guardar y entrar/ }).click(); ok(await c.getByRole('alert').count() === 1, 'una contraseña débil se rechaza');
  await c.getByLabel('Contraseña nueva', { exact: true }).fill('Olimpo2026ok'); await c.getByLabel('Repite la contraseña nueva').fill('Olimpo2027ok'); await c.getByRole('button', { name: /Guardar y entrar/ }).click(); ok(/no coinciden/.test(await c.getByRole('alert').innerText()), 'las contraseñas nuevas deben coincidir');
  await c.getByLabel('Repite la contraseña nueva').fill('Olimpo2026ok'); await c.getByRole('button', { name: /Guardar y entrar/ }).click(); await c.getByRole('heading', { name: /Elige tu contraseña/ }).waitFor({ state: 'detached' }); await c.locator('aside nav').first().waitFor(); ok(true, 'tras cambiarla entra en la aplicación');
  await c.reload(); await c.locator('main h1').first().waitFor(); ok(!(await c.getByRole('heading', { name: /Elige tu contraseña/ }).count()), 'al recargar ya no pide cambiarla');
  ok(await c.locator('html').getAttribute('data-tier') === 'premium', 'el cliente Premium ve su aspecto Premium');

  // Acceso demo: sin contraseña
  const d = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await d.goto(U + '/acceso/academia'); await d.waitForSelector('[aria-label="Entrar como"]'); ok(await d.locator('input').count() === 0 && !/contraseña demo|contraseña:/i.test(await d.locator('body').innerText()), '/acceso/<negocio> no tiene campos ni habla de contraseña demo');
  await d.getByRole('group', { name: 'Entrar como' }).getByRole('button', { name: 'Director' }).click(); await d.locator('main h1').first().waitFor(); ok(!d.url().includes('/acceso'), 'pulsar un perfil entra directamente');
  const tiles = await (await b.newContext()).newPage(); await tiles.goto(U + '/login'); await tiles.waitForSelector('[aria-label="Elige tu negocio"] a'); ok(!(await tiles.locator('body').innerText()).includes('Olimpo') && await tiles.locator('[aria-label="Elige tu negocio"] a').count() === 3, 'el cliente no sale en las tarjetas de acceso demo');
  ok(errs.length === 0, 'sin errores JS ' + errs.join('|')); console.log(fails ? fails + ' FALLOS' : 'TODO OK'); await b.close(); process.exit(fails ? 1 : 0);
})().catch((e) => { console.log('CRASH', e.message.split('\n').slice(0, 5).join(' | ')); process.exit(1); });
