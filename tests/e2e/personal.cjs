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
  ok(await p.locator('nav[aria-label="Módulos"]').getByRole('button').count() === 7 && await dock('Clientes').count() === 1 && await dock('Notas').count() === 0 && await dock('Apuntes').count() === 0, 'sin Apuntes ni Notas: 6 módulos personales + Clientes');
  await dock('Agenda').click(); await p.getByPlaceholder('Examen de cálculo').fill('Examen de cálculo'); await p.locator('[role=dialog]').getByRole('button', { name: /Añadir/ }).click(); ok(await p.locator('[role=dialog]').getByText('Examen de cálculo').count() >= 1, 'crear evento'); await p.keyboard.press('Escape');
  const dlg = p.locator('[role=dialog]');
  await dock('Horario').click(); const col = p.locator('.tt-col').nth(0); await col.click({ position: { x: 30, y: 150 } }); await p.getByPlaceholder('Cálculo I').last().fill('Física'); await p.getByRole('button', { name: 'Guardar' }).click();
  const blk = () => p.getByRole('button', { name: /^Física,/ }); ok(await blk().count() === 1 && /Lunes/.test(await blk().getAttribute('aria-label')), 'crear clase pulsando un hueco del horario');
  let bb = await blk().boundingBox(); const cw = (await p.locator('.tt-cols').boundingBox()).width / 7; await p.mouse.move(bb.x + 20, bb.y + 14); await p.mouse.down(); await p.mouse.move(bb.x + 20 + cw * 2, bb.y + 14 + 54, { steps: 8 }); await p.mouse.up();
  ok(await p.getByRole('button', { name: 'Solo esta semana' }).count() === 1, 'al arrastrar pregunta el alcance'); await p.getByRole('button', { name: 'Solo esta semana' }).click();
  ok(/Miércoles/.test(await blk().getAttribute('aria-label')) && /excepción/.test(await blk().getAttribute('aria-label')), 'excepción: la clase se mueve solo esta semana');
  await p.getByRole('button', { name: 'Semana siguiente' }).click(); ok(/Lunes/.test(await blk().getAttribute('aria-label')) && !/excepción/.test(await blk().getAttribute('aria-label')), 'la semana siguiente sigue el horario normal (se repite)');
  await p.getByRole('button', { name: 'Semana anterior' }).click(); await p.getByRole('button', { name: 'Semana anterior' }).click(); ok(/Lunes/.test(await blk().getAttribute('aria-label')), 'y la anterior también');
  await p.getByRole('button', { name: 'Ir a esta semana' }).click(); await blk().click(); await p.getByRole('button', { name: 'Cancelar solo esta semana' }).click(); ok(/cancelada/.test(await blk().getAttribute('aria-label')), 'cancelar la clase solo esta semana'); await p.keyboard.press('Escape');
  ok(await p.locator('.mini-blk').count() >= 1, 'el panel de portada muestra el horario semanal en miniatura');
  await p.getByLabel('Nombre del temporizador').fill('Repaso de cálculo'); await p.getByLabel('Minutos del temporizador').fill('40'); await p.keyboard.press('Enter'); ok(await p.getByText('40:00').count() >= 1, 'temporizador con tiempo editable (40 min)');
  await p.reload(); await p.waitForSelector('.hud-cols'); ok(await p.getByLabel('Nombre del temporizador').inputValue() === 'Repaso de cálculo' && await p.getByText('40:00').count() >= 1, 'el nombre y el tiempo del temporizador se recuerdan');
  await p.screenshot({ path: (process.env.SHOT_DIR || '/tmp') + '/hud-mini.png' });
  await p.getByLabel('Nuevo recordatorio').fill('Llamar al médico mañana a las 10:30'); ok(await p.getByText(/Llamar al médico →/).count() === 1, 'el recordatorio entiende «mañana a las 10:30»'); await p.keyboard.press('Enter'); ok(await p.getByText('Mañana 10:30').count() >= 1, 'crear recordatorio rápido');
  await p.getByLabel('Nuevo recordatorio').fill('Prueba en 1 min'); await p.keyboard.press('Enter'); await p.waitForTimeout(100);
  await dock('Finanzas').click(); await dlg.getByRole('button', { name: 'Efectivo' }).click(); await dlg.getByLabel('Saldo inicial').fill('100'); await dlg.getByRole('button', { name: /Crear/ }).click();
  await dlg.getByRole('button', { name: /Nueva carpeta/ }).first().click(); await dlg.getByRole('button', { name: 'Banco' }).click(); await dlg.getByLabel('Nombre de la carpeta').fill('Caixa'); await dlg.getByLabel('Saldo inicial').fill('200'); await dlg.getByRole('button', { name: /Crear/ }).click();
  ok(await dlg.getByText('300 €').count() >= 1, 'varias carpetas: el total suma sus saldos (100 + 200)');
  await dlg.getByRole('button', { name: /Carpeta Efectivo/ }).click(); await dlg.getByRole('button', { name: 'Meter' }).click(); await dlg.getByLabel('Importe').fill('50'); await dlg.getByLabel('Concepto').fill('Paga'); await dlg.getByRole('button', { name: 'Confirmar' }).click(); ok(await dlg.getByRole('button', { name: /Carpeta Efectivo: 150/ }).count() === 1, 'meter dinero en una carpeta');
  await dlg.getByRole('button', { name: 'Mover' }).click(); await dlg.getByLabel('Importe').fill('40'); await dlg.getByLabel('Carpeta de destino').selectOption({ label: 'Caixa' }); await dlg.getByRole('button', { name: 'Confirmar' }).click(); ok(await dlg.getByRole('button', { name: /Carpeta Efectivo: 110/ }).count() === 1 && await dlg.getByRole('button', { name: /Carpeta Caixa: 240/ }).count() === 1, 'mover dinero entre carpetas');
  await dlg.getByRole('button', { name: /Carpeta Efectivo/ }).click(); await dlg.getByRole('button', { name: 'Editar carpeta' }).click(); await dlg.getByLabel('Presupuesto mensual de ingresos').fill('200'); await dlg.getByLabel('Presupuesto mensual de gastos de la carpeta').fill('100'); await dlg.getByLabel('Saldo inicial').click();
  ok(await dlg.getByText(/50\s*€ de 200\s*€/).count() === 1 && await dlg.getByText(/Faltan 150\s*€ por ingresar/).count() === 1, 'presupuesto mensual de ingresos por carpeta (el traspaso no cuenta)'); ok(await dlg.getByText(/Quedan 100\s*€/).count() === 1, 'presupuesto mensual de gastos por carpeta');
  await dlg.getByRole('button', { name: 'Sacar' }).click(); await dlg.getByLabel('Importe').fill('30'); await dlg.getByLabel('Concepto').fill('Café'); await dlg.getByRole('button', { name: 'Confirmar' }).click(); ok(await dlg.getByText(/30\s*€ de 100\s*€/).count() === 1 && await dlg.getByText(/Quedan 70\s*€/).count() === 1, 'el gasto de la carpeta consume su presupuesto');
  await dlg.getByRole('button', { name: 'Meter' }).click(); await dlg.getByLabel('Importe').fill('150'); await dlg.getByRole('button', { name: 'Confirmar' }).click(); ok(await dlg.getByText(/Objetivo de ingresos cumplido/).count() === 1, 'objetivo de ingresos cumplido al llegar al presupuesto');
  await dlg.getByRole('button', { name: /Carpeta Caixa/ }).click(); await dlg.getByRole('button', { name: 'Sacar' }).click(); await dlg.getByLabel('Importe').fill('10'); await dlg.getByLabel('Concepto').fill('Libro'); await dlg.getByRole('button', { name: 'Confirmar' }).click(); ok(await dlg.getByText('460 €').count() >= 1, 'sacar dinero y el total baja (350 − 30 + 150 − 10)'); await p.keyboard.press('Escape');
  await p.getByLabel('Concepto del movimiento').fill('Menú'); await p.getByLabel('Importe', { exact: true }).fill('5'); await p.getByRole('button', { name: 'Añadir movimiento' }).click(); ok(await p.getByText('455 €').count() >= 1 && await p.getByRole('button', { name: /Abrir carpeta Efectivo/ }).count() === 1, 'el panel de portada muestra el total y las carpetas');
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
