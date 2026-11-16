// Panel «Clientes» del modo personal: ver negocios, cambiar plan (con y sin desactivar módulos), suspender y reactivar.
// Servidor: TENANTS=1 + PROVISION_* + PERSONAL_PASSWORD; la contraseña llega por PERSONAL_TEST_PASSWORD. APP_URL=http://127.0.0.1:4020
const { chromium } = require('playwright');
const U = process.env.APP_URL || 'http://127.0.0.1:4020'; const PW = process.env.PERSONAL_TEST_PASSWORD;
let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const errs = [];
  ok((await fetch(U + '/api/personal/clients')).status === 401, 'clientes sin sesión personal → 401');
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  p.on('dialog', (d) => void d.accept());
  await p.goto(U + '/login'); await p.getByLabel(/Correo o usuario/).fill('redstonengineers'); await p.getByLabel('Contraseña').fill(PW); await p.getByRole('button', { name: /Entrar/ }).click(); await p.waitForURL(/\/personal/); await p.waitForSelector('text=Abrir mi EDITH');
  await p.getByRole('button', { name: /Entrar como Gazael/ }).click(); await p.waitForSelector('.hud-cols');
  const list = async () => (await ctx.request.get(U + '/api/personal/clients')).json();
  const first = await list(); ok(first.clients.length >= 1 && !JSON.stringify(first).includes('@'), `la API lista ${first.clients.length} negocio(s) sin datos personales`);
  // Tarjeta grande en la pantalla principal: resumen siempre visible, lista al desplegar, se recuerda
  const card = p.locator('.clients-card'); await card.waitFor();
  ok(await card.getByText('Clientes activos').count() === 1 && await card.getByText('Ingreso mensual').count() === 1, 'tarjeta «Clientes» en la pantalla principal con resumen');
  ok(await card.getByRole('list', { name: 'Clientes' }).count() === 0, 'la tarjeta empieza minimizada');
  await card.getByRole('button', { name: 'Desplegar clientes' }).click(); await card.getByRole('list', { name: 'Clientes' }).waitFor();
  ok(await card.getByRole('list', { name: 'Clientes' }).locator('li').count() === first.clients.length, 'desplegada: lista todos los clientes');
  await p.reload(); await p.locator('.clients-card').waitFor(); await p.locator('.clients-card').getByRole('list', { name: 'Clientes' }).waitFor(); ok(true, 'la tarjeta recuerda que estaba desplegada');
  const cid = first.clients[0].id; const target = first.clients[0].plan === 'premium' ? 'basic' : 'premium';
  await p.locator('.clients-card').getByLabel(/^Plan de /).first().selectOption(target); await p.locator('.clients-card').getByText(/: plan /).waitFor();
  ok((await list()).clients.find((c) => c.id === cid).plan === target, 'cambiar el plan desde la tarjeta funciona');
  await p.locator('.clients-card').getByRole('button', { name: 'Minimizar clientes' }).click(); ok(await p.locator('.clients-card').getByRole('list', { name: 'Clientes' }).count() === 0, 'minimizar oculta la lista y deja el resumen');
  await p.locator('.clients-card').getByRole('button', { name: 'Abrir Clientes' }).click(); await p.getByRole('list', { name: 'Clientes' }).waitFor(); ok(true, 'el botón + de la tarjeta abre el panel completo'); await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  await p.locator('nav[aria-label="Módulos"]').getByRole('button', { name: 'Clientes' }).click(); await p.getByRole('list', { name: 'Clientes' }).waitFor();
  ok(await p.getByRole('dialog').getByText('Clientes activos').count() === 1 && await p.getByRole('dialog').getByText('Ingreso mensual').count() === 1, 'panel de clientes con resumen');

  // Negocio de prueba: el de la autoescuela (director de /acceso/atlanta)
  const dctx = await b.newContext(); const d = await dctx.newPage(); await d.goto(U + '/acceso/atlanta'); await d.waitForSelector('#u'); await d.getByRole('group', { name: 'Entrar como' }).getByRole('button', { name: 'Director' }).click(); await d.locator('main h1').first().waitFor();
  const snap = () => d.evaluate(async () => (await fetch('/api/snapshot', { credentials: 'include' })).json());
  const s0 = await snap(); const id = s0.academy.id; const idx = first.clients.findIndex((c) => c.id === id); ok(idx >= 0, 'el negocio del director aparece en la lista');
  const row = p.getByRole('list', { name: 'Clientes' }).locator('li').nth(idx); const planSel = row.getByLabel(/^Plan de /);
  const avisos0 = s0.settings.modules.avisos; ok(avisos0 === true, 'antes: el módulo «avisos» está activo');

  await planSel.selectOption('basic'); await p.waitForSelector('text=plan Esencial');
  const c1 = (await list()).clients[idx]; ok(c1.plan === 'basic', 'plan cambiado a Esencial (servidor)');
  const s1 = await snap(); ok(s1.settings.modules.avisos === false && s1.settings.modules.practicas === true, 'Esencial desactiva «avisos» y conserva prácticas');
  ok(await p.getByText(/módulos desactivados: avisos/).count() === 1, 'el panel informa de los módulos desactivados');

  await planSel.selectOption('pro'); await p.waitForSelector('text=plan Profesional');
  const s2 = await snap(); ok((await list()).clients[idx].plan === 'pro' && s2.settings.modules.avisos === false, 'subir de plan no reactiva módulos solos');
  await p.getByLabel(/desactivar los módulos/).uncheck(); await planSel.selectOption('premium'); await p.waitForSelector('text=plan Premium');
  ok((await list()).clients[idx].plan === 'premium', 'cambio de plan sin tocar módulos');

  await row.getByRole('button', { name: /Suspender/ }).click(); await p.waitForSelector('text=suspendido');
  ok((await list()).clients[idx].status === 'suspended' && (await d.evaluate(async () => (await fetch('/api/snapshot', { credentials: 'include' })).status)) === 401, 'suspendido: el negocio pierde el acceso');
  await row.getByRole('button', { name: /Reactivar/ }).click(); await p.waitForSelector('text=reactivado');
  ok((await list()).clients[idx].status === 'active', 'reactivado');
  await p.screenshot({ path: (process.env.SHOT_DIR || '/tmp') + '/clientes-personal.png' });
  console.log('ERRORS', JSON.stringify(errs)); console.log(fails ? `${fails} FALLOS` : 'TODO OK'); await b.close(); process.exit(fails ? 1 : 0);
})().catch((e) => { console.log('CRASH', e.message.split('\n').slice(0, 5).join(' | ')); process.exit(1); });
