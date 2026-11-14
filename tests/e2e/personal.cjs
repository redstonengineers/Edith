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
  await p.getByLabel('Contraseña').fill(PW); await p.getByRole('button', { name: /Entrar/ }).click(); await p.waitForURL(/\/personal/); await p.waitForSelector('text=Abrir mi JARVIS');
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
  await dock('Hábitos').click(); await p.getByPlaceholder('Leer 20 minutos').fill('Leer'); await p.locator('[role=dialog]').getByRole('button', { name: /Añadir/ }).click(); await p.getByRole('checkbox', { name: 'Hoy: Leer' }).check(); ok(await p.locator('[role=dialog]').getByText('1 días').count() >= 1, 'hábito con racha'); await p.keyboard.press('Escape');
  await dock('Gastos').click(); await p.locator('[role=dialog] input[inputmode=decimal]').first().fill('200'); await p.locator('[role=dialog]').getByLabel('Concepto').fill('Libro'); await p.locator('[role=dialog]').getByLabel(/Importe/).fill('25,5'); await p.locator('[role=dialog]').getByRole('button', { name: /Añadir/ }).click(); ok(await p.locator('[role=dialog]').getByText(/25,5/).count() >= 1, 'registrar gasto'); await p.keyboard.press('Escape');
  await dock('Objetivos').click(); await p.getByPlaceholder(/Aprobar el curso/).fill('Aprobar con 8'); await p.locator('[role=dialog]').getByRole('button', { name: /Añadir/ }).click(); ok(await p.locator('[role=dialog]').getByText('Aprobar con 8').count() >= 1, 'crear objetivo'); await p.keyboard.press('Escape');
  await p.waitForSelector('text=Guardado', { timeout: 6000 }); ok(true, 'indicador «Todo guardado»');
  await p.screenshot({ path: (process.env.SHOT_DIR || '/tmp') + '/hud-datos.png' });
  // Persistencia: recarga y cambio de perfil → datos aislados
  await p.reload(); await p.waitForSelector('.hud-cols'); ok(await p.getByText('Entregar práctica').count() >= 1, 'los datos persisten tras recargar (sesión por cookie)');
  await p.getByRole('button', { name: 'Cerrar sesión' }).click(); await p.waitForURL(/\/login/);
  await p.getByLabel(/Correo o usuario/).fill('redstonengineers'); await p.getByLabel('Contraseña').fill(PW); await p.getByRole('button', { name: /Entrar/ }).click(); await p.waitForSelector('text=Abrir mi JARVIS');
  await p.getByRole('button', { name: /Entrar como Hokage/ }).click(); await p.waitForSelector('.hud-cols'); ok(await p.getByText('Entregar práctica').count() === 0, 'Hokage no ve los datos de Gazael');
  await p.getByRole('textbox', { name: 'Pregunta para JARVIS' }).fill('¿Qué tengo pendiente?'); await p.getByRole('button', { name: 'Enviar' }).click(); await p.waitForSelector('text=ANTHROPIC_API_KEY', { timeout: 8000 }).catch(() => {}); ok(await p.getByText(/modelo de lenguaje|ANTHROPIC/).count() >= 1, 'chat de JARVIS responde (sin clave: avisa)');
  // Las cuentas de academia siguen funcionando con correo
  const p2 = await (await b.newContext()).newPage(); await p2.goto(U + '/login'); await p2.locator('button[class*="text-xs"]').filter({ hasText: 'Pablo' }).first().click(); await p2.waitForSelector('main h1'); ok(true, 'login de academia sigue funcionando');
  console.log('ERRORS', JSON.stringify(errs)); console.log(fails ? `${fails} FALLOS` : 'TODO OK'); await b.close(); process.exit(fails ? 1 : 0);
})().catch((e) => { console.log('CRASH', e.message.split('\n').slice(0, 3).join(' | ')); process.exit(1); });
