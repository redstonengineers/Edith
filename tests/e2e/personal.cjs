// Modo personal contra el servidor real. La contraseña llega por entorno (PERSONAL_TEST_PASSWORD); nunca está en el repositorio.
const { chromium } = require('playwright');
const U = process.env.APP_URL || 'http://127.0.0.1:5174'; const PW = process.env.PERSONAL_TEST_PASSWORD; const API = process.env.API_URL || 'http://127.0.0.1:4000';
let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const errs = [];
  // API directa: sin cookie no hay acceso; contraseña errónea rechazada.
  const h = { 'content-type': 'application/json', 'x-requested-with': 'edith' };
  ok((await fetch(API + '/api/personal/data', { headers: h })).status === 401, 'datos personales sin sesión → 401');
  ok((await fetch(API + '/api/personal/login', { method: 'POST', headers: h, body: JSON.stringify({ user: 'redstonengineers', password: 'incorrecta' }) })).status === 401, 'contraseña incorrecta → 401');
  ok((await fetch(API + '/api/personal/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user: 'x', password: 'y' }) })).status === 403, 'login sin cabecera anti-CSRF → 403');
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && !/Failed to load|401|409/.test(m.text()) && errs.push(m.text().slice(0, 140)));
  await p.goto(U + '/login'); await p.getByLabel(/Correo o usuario/).fill('redstonengineers'); await p.getByLabel('Contraseña').fill('mala'); await p.getByRole('button', { name: /Entrar/ }).click(); await p.waitForTimeout(700);
  ok(await p.getByText(/incorrectos/).count() === 1, 'login personal con contraseña mala muestra error');
  await p.getByLabel('Contraseña').fill(PW); await p.getByRole('button', { name: /Entrar/ }).click(); await p.waitForURL(/\/personal/); await p.waitForSelector('text=Abrir mi EDITH');
  ok(await p.getByRole('button', { name: /Entrar como Gazael/ }).count() === 1 && await p.getByRole('button', { name: /Entrar como Hokage/ }).count() === 1, 'selector de perfiles Gazael / Hokage');
  await p.getByRole('button', { name: /Entrar como Gazael/ }).click(); await p.waitForSelector('.hud-cols'); ok(true, 'HUD de Gazael abre');
  await p.screenshot({ path: (process.env.SHOT_DIR || '/tmp') + '/hud-vacio.png' });
  const dock = (n) => p.locator('nav[aria-label="Módulos"]').getByRole('button', { name: n });
  // Tareas, asignaturas, notas, agenda, hábito, gasto, objetivo
  await dock('Tareas').click(); await p.getByPlaceholder('Entregar práctica de física…').fill('Entregar práctica'); await p.locator('[role=dialog]').getByRole('button', { name: /Añadir/ }).click(); ok(await p.getByText('Entregar práctica').count() >= 1, 'crear tarea'); await p.keyboard.press('Escape');
  await dock('Notas').click(); await p.getByPlaceholder('Cálculo I').fill('Cálculo I'); await p.locator('[role=dialog]').getByRole('button', { name: 'Asignatura', exact: true }).click(); await p.waitForTimeout(300);
  await p.locator('[role=dialog] select').first().selectOption({ index: 1 }); await p.getByPlaceholder('Parcial 1').fill('Parcial 1'); await p.locator('[role=dialog] input[inputmode=decimal]').first().fill('8'); await p.locator('[role=dialog]').getByRole('button', { name: 'Nota', exact: true }).click(); await p.waitForTimeout(300);
  ok(await p.locator('[role=dialog]').getByText('8.00').count() >= 1, 'media ponderada de la asignatura'); await p.keyboard.press('Escape');
  await dock('Agenda').click(); await p.getByPlaceholder('Examen de cálculo').fill('Examen de cálculo'); await p.locator('[role=dialog]').getByRole('button', { name: /Añadir/ }).click(); ok(await p.locator('[role=dialog]').getByText('Examen de cálculo').count() >= 1, 'crear evento'); await p.keyboard.press('Escape');
  const dlg = p.locator('[role=dialog]');
  await dock('Horario').click(); await p.getByPlaceholder('Cálculo I').first().fill('Física'); await dlg.getByRole('button', { name: /Añadir clase/ }).click(); ok(await dlg.getByText('09:00–10:00').count() >= 1, 'añadir clase al horario'); await p.keyboard.press('Escape');
  await p.getByLabel('Nuevo recordatorio').fill('Llamar al médico mañana a las 10:30'); ok(await p.getByText(/Llamar al médico →/).count() === 1, 'el recordatorio entiende «mañana a las 10:30»'); await p.keyboard.press('Enter'); ok(await p.getByText('Mañana 10:30').count() >= 1, 'crear recordatorio rápido');
  await p.getByLabel('Nuevo recordatorio').fill('Prueba en 1 min'); await p.keyboard.press('Enter'); await p.waitForTimeout(100);
  await dock('Finanzas').click(); await dlg.locator('input[inputmode=decimal]').first().fill('200'); await dlg.getByPlaceholder('Café, libro…').fill('Libro'); await dlg.locator('input[inputmode=decimal]').nth(1).fill('25,5'); await dlg.getByRole('button', { name: /^Gasto$/ }).last().click(); ok(await dlg.getByText(/25,5/).count() >= 1, 'registrar gasto'); await p.keyboard.press('Escape');
  await p.getByLabel('Concepto del movimiento').fill('Beca'); await p.getByLabel('Importe', { exact: true }).fill('300'); await p.getByRole('button', { name: 'Gasto (pulsa para ingreso)' }).click(); await p.getByRole('button', { name: 'Añadir movimiento' }).click(); ok(await p.getByText(/274,5/).count() >= 1, 'saldo = ingreso − gasto en el panel');
  await p.waitForSelector('text=Guardado', { timeout: 6000 }); ok(true, 'indicador «Todo guardado»');
  await p.screenshot({ path: (process.env.SHOT_DIR || '/tmp') + '/hud-datos.png' });
  // Persistencia: recarga y cambio de perfil → datos aislados
  await p.reload(); await p.waitForSelector('.hud-cols'); ok(await p.getByText('Física').count() >= 1, 'los datos persisten tras recargar (sesión por cookie)');
  await p.getByRole('button', { name: 'Cerrar sesión' }).click(); await p.waitForURL(/\/login/);
  await p.getByLabel(/Correo o usuario/).fill('redstonengineers'); await p.getByLabel('Contraseña').fill(PW); await p.getByRole('button', { name: /Entrar/ }).click(); await p.waitForSelector('text=Abrir mi EDITH');
  await p.getByRole('button', { name: /Entrar como Hokage/ }).click(); await p.waitForSelector('.hud-cols'); ok(await p.getByText('Física').count() === 0, 'Hokage no ve los datos de Gazael');
  await p.getByRole('textbox', { name: 'Pregunta para EDITH' }).fill('¿Qué tengo pendiente?'); await p.getByRole('button', { name: 'Enviar' }).click(); await p.waitForSelector('text=ANTHROPIC_API_KEY', { timeout: 8000 }).catch(() => {}); ok(await p.getByText(/modelo de lenguaje|ANTHROPIC/).count() >= 1, 'chat de EDITH responde (sin clave: avisa)');
  // Las cuentas de academia siguen funcionando con correo
  const p2 = await (await b.newContext()).newPage(); await p2.goto(U + '/login'); await p2.locator('button[class*="text-xs"]').filter({ hasText: 'Pablo' }).first().click(); await p2.waitForSelector('main h1'); ok(true, 'login de academia sigue funcionando');
  console.log('ERRORS', JSON.stringify(errs)); console.log(fails ? `${fails} FALLOS` : 'TODO OK'); await b.close(); process.exit(fails ? 1 : 0);
})().catch((e) => { console.log('CRASH', e.message.split('\n').slice(0, 3).join(' | ')); process.exit(1); });
