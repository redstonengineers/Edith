// EDITH personal en iPhone (vista compacta con pestañas) y en iPad (misma disposición que el ordenador).
const { chromium, devices } = require('playwright');
const U = process.env.APP_URL || 'http://127.0.0.1:4010'; const PW = process.env.PERSONAL_TEST_PASSWORD;
let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] }); const errs = [];
  const open = async (dev) => { const p = await (await b.newContext(devices[dev])).newPage(); p.on('pageerror', (e) => errs.push(e.message)); await p.goto(U + '/login'); await p.getByLabel(/Correo o usuario/).fill('redstonengineers'); await p.getByLabel('Contraseña').fill(PW); await p.getByRole('button', { name: /Entrar/ }).click(); await p.waitForURL(/personal/); await p.getByRole('button', { name: /Entrar como Gazael/ }).click(); return p; };
  // iPad: la disposición de escritorio completa, sin desbordes
  for (const dev of ['iPad (gen 7)', 'iPad (gen 7) landscape']) { const t = await open(dev); await t.waitForSelector('.hud-cols'); await t.waitForTimeout(800);
    ok(await t.locator('.hud-cols').count() === 1 && await t.locator('.hud-phone').count() === 0, `${dev}: misma disposición que el ordenador`);
    ok(await t.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${dev}: sin desbordes horizontales`);
    ok(await t.getByRole('navigation', { name: 'Módulos' }).getByRole('button').count() === 6, `${dev}: los 6 módulos accesibles`); }
  // iPhone
  const p = await open('iPhone 14'); await p.waitForSelector('.hud-phone'); await p.waitForTimeout(800); const tab = (n) => p.locator('.ph-tabs').getByRole('button', { name: n, exact: true });
  ok(await p.locator('.hud-cols').count() === 0 && await p.locator('.ph-tabs').count() === 1, 'iPhone: vista compacta con barra de pestañas');
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'iPhone: sin desbordes horizontales');
  await p.getByLabel('Nuevo recordatorio').fill('Llamar al médico mañana a las 10:30'); await p.keyboard.press('Enter'); ok(await p.getByText('Mañana 10:30').count() >= 1, 'iPhone: recordatorio rápido desde Hoy');
  await tab('Horario').click(); ok(await p.getByRole('group', { name: 'Día de la semana' }).count() === 1, 'iPhone: horario por días'); await p.getByRole('button', { name: 'Volver' }).click();
  await tab('Dinero').click(); ok(await p.getByText('Todo tu dinero').count() === 1, 'iPhone: pestaña Dinero'); await p.getByRole('button', { name: 'Volver' }).click();
  await tab('Más').click(); for (const n of ['Recordatorios', 'Agenda', 'Tareas', 'Estudio', 'Ajustes', 'Ayuda']) ok(await p.getByRole('button', { name: n, exact: true }).count() >= 1, `iPhone: «Más» incluye ${n}`); await p.getByRole('button', { name: 'Volver' }).click();
  await p.getByRole('button', { name: 'Hablar con EDITH' }).click(); ok(await p.getByRole('textbox', { name: 'Pregunta para EDITH' }).count() === 1, 'iPhone: botón central abre el chat con EDITH');
  console.log('ERRORS', JSON.stringify(errs)); console.log(fails ? `${fails} FALLOS` : 'TODO OK'); await b.close(); process.exit(fails ? 1 : 0);
})().catch((e) => { console.log('CRASH', e.message.split('\n')[0]); process.exit(1); });
