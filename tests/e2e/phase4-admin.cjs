// Prueba end-to-end con Playwright. Uso: APP_URL=http://127.0.0.1:5173 node tests/e2e/phase4-admin.cjs
const { chromium } = require('playwright');
const out = (process.env.SHOT_DIR || '/tmp/');
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const U = process.env.APP_URL || 'http://127.0.0.1:5173';
(async () => {
  const b = await chromium.launch(); const errors = [];
  const login = async (who, vp = { width: 1440, height: 900 }) => {
    const c = await b.newContext({ viewport: vp }); const p = await c.newPage();
    p.on('pageerror', e => errors.push(e.message)); p.on('console', m => m.type() === 'error' && errors.push(m.text()));
    await p.goto(U + '/'); await p.getByRole('button', { name: new RegExp(who) }).first().click(); await p.waitForSelector('text=Academy Command Center'); return p;
  };
  const toasts = async (p) => (await p.locator('[role=status],[role=alert]').allInnerTexts()).join(' | ');
  let p = await login('Pablo Vidal');
  // ── waitlist
  await p.goto(U + '/lista-espera'); await p.waitForSelector('table'); const n0 = await p.locator('tbody tr').count(); ok(n0 > 0, `waitlist rows ${n0}`);
  await p.getByRole('button', { name: 'Contactado', exact: true }).first().click(); await p.waitForTimeout(300); ok(/contactado/i.test(await toasts(p)), 'mark contacted');
  await p.screenshot({ path: out + 'shot-waitlist.png' });
  await p.getByRole('button', { name: /Convertir en alumno/ }).first().click(); await p.waitForSelector('[role=dialog]');
  await p.getByRole('button', { name: 'Crear ficha' }).click(); ok(await p.locator('[role=dialog] [role=alert]').count() >= 1, 'convert requires birthdate');
  await p.locator('[role=dialog] input[type=date]').fill('2005-04-12');
  const opt = await p.locator('[role=dialog] select option:not([disabled])').nth(1).getAttribute('value'); await p.locator('[role=dialog] select').selectOption(opt); await p.getByRole('button', { name: 'Crear ficha' }).click(); await p.waitForURL(/\/alumnos\/.+/);
  await p.waitForTimeout(600); ok(await p.getByText('Activo', { exact: true }).count() >= 1, 'converted student is active in group');
  await p.goto(U + '/lista-espera'); await p.getByRole('button', { name: /Matriculado/ }).click(); ok(await p.locator('tbody tr').count() >= 1, 'waitlist entry now matriculado');
  // ── admission flow
  await p.goto(U + '/solicitudes'); await p.waitForSelector('table');
  await p.getByRole('button', { name: 'Nueva solicitud' }).click(); const d = p.locator('[role=dialog]');
  await d.locator('input').nth(0).fill('Irene Salvador Pons'); await d.locator('input[type=email]').fill('irene@correo.demo'); await d.locator('input[type=tel]').fill('655444333'); await d.locator('input').nth(3).fill('Matemáticas'); await d.locator('input[type=date]').fill('2008-02-02');
  await d.getByRole('button', { name: 'Guardar' }).click(); await p.waitForTimeout(400);
  ok(await p.getByText('Irene Salvador Pons').count() === 1, 'application created');
  const row = () => p.locator('tbody tr', { hasText: 'Irene Salvador Pons' });
  await row().getByRole('button', { name: 'Pasar a revisión' }).click(); await p.waitForTimeout(250);
  await row().getByRole('button', { name: 'Aceptar' }).click(); await p.waitForTimeout(250);
  await row().getByRole('button', { name: 'Matricular' }).click(); await p.waitForTimeout(250);
  ok(await row().getByRole('button', { name: /Asignar grupo/ }).count() === 1, 'reached matrícula stage (student created)');
  await row().getByRole('button', { name: /Asignar grupo/ }).click(); await p.waitForSelector('[role=dialog]');
  await p.getByRole('button', { name: 'Confirmar' }).click(); await p.waitForTimeout(250); ok(await p.locator('[role=dialog] [role=alert]').count() >= 1, 'group required to activate');
  const o2 = await p.locator('[role=dialog] select option:not([disabled])').nth(1).getAttribute('value'); await p.locator('[role=dialog] select').selectOption(o2); await p.getByRole('button', { name: 'Confirmar' }).click(); await p.waitForTimeout(500);
  ok(await p.locator('[role=dialog]').count() === 0, 'activated with group');
  await p.goto(U + '/matriculas'); await p.waitForSelector('section[aria-label="Activo"]'); ok(await p.locator('section[aria-label="Activo"]').getByText('Irene Salvador Pons').count() === 1, 'pipeline shows Irene in Activo');
  await p.screenshot({ path: out + 'shot-enrollments.png' });
  // ── payments
  await p.goto(U + '/pagos'); await p.waitForSelector('table'); await p.getByRole('button', { name: /^Vencidos/ }).click();
  const cnt = async () => Number((await p.getByText(/\d+ resultados?/).first().innerText()).match(/(\d+)/)[1]); const nv = await cnt(); ok(nv > 0, `overdue rows ${nv}`);
  await p.screenshot({ path: out + 'shot-payments.png' });
  await p.getByRole('button', { name: /Enviar recordatorio/ }).first().click(); await p.waitForTimeout(300); ok(/Recordatorio enviado/.test(await toasts(p)), 'reminder sent');
  await p.getByRole('button', { name: 'Cobrar' }).first().click(); await p.getByRole('button', { name: 'Registrar pago' }).click(); await p.waitForTimeout(400);
  ok(await cnt() === nv - 1, 'collected → one fewer overdue');
  await p.getByRole('button', { name: 'Nuevo cobro' }).click(); await p.getByRole('button', { name: 'Guardar' }).click(); ok(await p.locator('[role=dialog] [role=alert]').count() >= 1, 'payment validation');
  await p.locator('[role=dialog] select').selectOption({ index: 1 }); await p.locator('[role=dialog] input[type=number]').fill('-5'); await p.getByRole('button', { name: 'Guardar' }).click(); ok(/mayor que 0/.test(await p.locator('[role=dialog]').innerText()), 'negative amount rejected');
  await p.locator('[role=dialog] input[type=number]').fill('90'); await p.getByRole('button', { name: 'Guardar' }).click(); await p.waitForTimeout(400); ok(await p.locator('[role=dialog]').count() === 0, 'payment created');
  await p.goto(U + '/facturacion'); await p.waitForSelector('table'); ok(await p.locator('tbody tr').count() > 5, 'receipts listed');
  await p.locator('tbody tr').first().click(); await p.waitForSelector('.print-area'); ok(/REC-\d{4}-\d{4}/.test(await p.locator('.print-area').innerText()), 'receipt shows number');
  await p.keyboard.press('Escape');
  // ── incidents
  await p.goto(U + '/incidencias?nuevo=1'); await p.waitForSelector('[role=dialog]');
  await p.locator('[role=dialog] input').first().fill('Fuga de agua en aseos'); await p.locator('[role=dialog] select').nth(0).selectOption('Instalaciones'); await p.locator('[role=dialog] select').nth(1).selectOption('critica'); await p.locator('[role=dialog] textarea').fill('Hay una fuga en la planta baja.');
  await p.getByRole('button', { name: 'Guardar' }).click(); await p.waitForURL(/\/incidencias\/.+/);
  const incUrl = p.url(); await p.getByRole('button', { name: 'En proceso' }).click(); await p.waitForTimeout(300); ok(await p.getByRole('button', { name: 'En proceso' }).getAttribute('aria-current') === 'step', 'incident → en proceso');
  await p.getByRole('button', { name: /Resolver/ }).click(); await p.waitForTimeout(300); ok(await p.getByRole('button', { name: 'Resuelto' }).getAttribute('aria-current') === 'step', 'incident resolved');
  await p.screenshot({ path: out + 'shot-incident.png' });
  ok((await p.getByRole('heading', { level: 2, name: 'Historial' }).count()) === 1 && (await p.locator('ol').last().innerText()).includes('Fuga'), 'incident history logged');
  // ── documents
  await p.goto(U + '/documentos'); await p.waitForSelector('table'); await p.getByRole('button', { name: 'Subir documento' }).click();
  await p.locator('[role=dialog] select').nth(1).selectOption({ index: 1 });
  await p.setInputFiles('input[type=file]', { name: 'virus.exe', mimeType: 'application/x-msdownload', buffer: Buffer.from('x') }); await p.getByRole('button', { name: 'Subir', exact: true }).click(); await p.waitForTimeout(300);
  ok(/no permitido/.test(await toasts(p)), 'disallowed file type rejected');
  await p.setInputFiles('input[type=file]', { name: 'contrato-firmado.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(2048) }); await p.getByRole('button', { name: 'Subir', exact: true }).click(); await p.waitForTimeout(400);
  ok(await p.getByText('contrato-firmado.pdf').count() === 1, 'pdf uploaded');
  await p.getByRole('button', { name: 'Eliminar contrato-firmado.pdf' }).click(); await p.getByRole('button', { name: 'Eliminar', exact: true }).last().click(); await p.waitForTimeout(300); ok(await p.getByText('contrato-firmado.pdf').count() === 0, 'document deleted');
  // ── announcements + messages
  await p.goto(U + '/avisos'); await p.getByRole('button', { name: 'Nuevo aviso' }).click(); await p.locator('[role=dialog] input').first().fill('Cierre por festivo'); await p.locator('[role=dialog] textarea').fill('El centro cerrará el lunes.');
  await p.locator('[role=dialog] select').nth(1).selectOption('whatsapp'); await p.getByRole('button', { name: 'Publicar' }).click(); await p.waitForTimeout(400);
  ok(/no conectado|registra/.test(await toasts(p)), 'whatsapp channel flagged as simulated'); ok(await p.getByText('Cierre por festivo').count() >= 1, 'announcement listed');
  await p.goto(U + '/mensajes'); await p.getByRole('button', { name: 'Nuevo mensaje' }).click(); await p.getByRole('button', { name: 'Enviar' }).click(); ok(await p.locator('[role=dialog] [role=alert]').count() >= 1, 'message validation');
  await p.getByRole('button', { name: 'Carlos Fernández' }).click(); await p.locator('[role=dialog] input').first().fill('Prueba E2E'); await p.locator('[role=dialog] textarea').fill('Hola equipo'); await p.getByRole('button', { name: 'Enviar' }).click(); await p.waitForTimeout(400);
  await p.goto(U + '/notificaciones'); await p.waitForSelector('ul'); await p.getByRole('button', { name: /Marcar todas/ }).click(); await p.waitForTimeout(300); ok(await p.getByText('Estás al día.').count() === 1, 'notifications all read');
  // ── isolation & roles
  const pa = await login('Beatriz Quintana'); await pa.goto(incUrl.replace(U, U)); await pa.waitForTimeout(500); ok(await pa.getByText('Sin permisos').count() === 1, 'other academy incident not accessible');
  await pa.goto(U + '/documentos'); await pa.waitForTimeout(300); ok(await pa.getByText('Módulo no activado').count() === 1, 'Atlas: documents module off');
  const pt = await login('Carlos Fernández.*Profesor'); await pt.goto(U + '/pagos'); await pt.waitForTimeout(300); ok(await pt.getByText('Sin permisos').count() === 1, 'teacher blocked from payments');
  await pt.goto(U + '/lista-espera'); await pt.waitForTimeout(300); ok(await pt.getByText('Sin permisos').count() === 1, 'teacher blocked from waitlist');
  await pt.goto(U + '/mensajes'); await pt.waitForTimeout(500); ok(await pt.getByText('Prueba E2E').count() >= 0, 'teacher messages page');
  const pm = await login('Pablo Vidal', { width: 390, height: 844 }); for (const r of ['pagos', 'lista-espera', 'matriculas', 'incidencias']) { await pm.goto(U + '/' + r); await pm.waitForTimeout(400); ok(await pm.evaluate(() => document.documentElement.scrollWidth) <= 392, `mobile /${r} no overflow`); }
  await pm.goto(U + '/matriculas'); await pm.screenshot({ path: out + 'shot-enrollments-mobile.png' });
  console.log('ERRORS', JSON.stringify(errors)); await b.close();
})().catch(e => { console.log('CRASH', e.message.split('\n').slice(0, 4).join(' | ')); process.exit(1); });
