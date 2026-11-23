// Funciones no cubiertas por otras suites: paleta Ctrl+K, buscador, tema, sidebar, profesores, asignaturas, grupos, exámenes+notas, mensajes, avisos, ajustes, cerrar sesión.
const { chromium } = require('playwright');
const U = process.env.APP_URL || 'http://127.0.0.1:5173';
let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({ viewport: { width: 1360, height: 900 } })).newPage();
  p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && !/Failed to load/.test(m.text()) && errs.push(m.text().slice(0, 140)));
  await p.goto(U + '/'); await p.locator('button[class*="text-xs"]').filter({ hasText: 'Pablo' }).first().click(); await p.waitForSelector('main h1');
  const go = async (r) => { await p.goto(U + r); await p.locator('main h1').first().waitFor(); await p.waitForTimeout(250); };
  const dlg = () => p.locator('[role=dialog]');
  const last = async (l) => { const sel = dlg().getByLabel(l); const vals = await sel.locator('option').evaluateAll((o) => o.map((x) => x.value).filter(Boolean)); await sel.selectOption(vals[vals.length - 1]); };
  const save = async (name = 'Guardar') => { await dlg().getByRole('button', { name }).click(); await p.waitForTimeout(500); };

  // Paleta de comandos
  await p.keyboard.press('Control+k'); await p.waitForTimeout(300); ok(await p.getByRole('dialog').count() >= 1, 'Ctrl+K abre la paleta');
  await p.keyboard.type('pagos'); await p.waitForTimeout(300); await p.keyboard.press('Enter'); await p.waitForTimeout(600); ok(p.url().endsWith('/pagos'), 'paleta navega a Pagos');
  await p.keyboard.press('Control+k'); await p.keyboard.type('nuevo alumno'); await p.waitForTimeout(300); await p.keyboard.press('Enter'); await p.waitForTimeout(700);
  ok(/alumnos/.test(p.url()) && await dlg().count() >= 1, 'paleta: acción «Nuevo alumno» abre el formulario'); await p.keyboard.press('Escape');
  await p.keyboard.press('Control+k'); await p.keyboard.type('María García'); await p.waitForTimeout(500); await p.getByRole('dialog').getByText('María García Ruiz').first().click(); await p.waitForTimeout(700); ok(/\/alumnos\/.+/.test(p.url()), 'paleta encuentra a un alumno y abre su ficha');

  // Buscador de cabecera
  await go('/'); await p.locator('header').getByRole('button', { name: /^Buscar/ }).first().click(); await p.waitForTimeout(300); ok(await p.getByRole('dialog').count() >= 1, 'buscador de cabecera abre la paleta');
  await p.keyboard.press('Escape');

  // Tema + sidebar
  const theme0 = await p.evaluate(() => document.documentElement.dataset.theme); await p.getByRole('button', { name: /^Cambiar a tema/ }).click(); await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.documentElement.dataset.theme) !== theme0, 'cambiar tema'); await p.reload(); await p.waitForSelector('main h1'); ok(await p.evaluate(() => document.documentElement.dataset.theme) !== theme0, 'el tema persiste tras recargar');
  const w0 = (await p.locator('aside').boundingBox()).width; await p.getByRole('button', { name: /Plegar/ }).click(); await p.waitForTimeout(400); ok((await p.locator('aside').boundingBox()).width < w0 - 80, 'plegar sidebar'); await p.getByRole('button', { name: /Expandir|Desplegar|Plegar/ }).last().click().catch(() => {});

  // Profesores
  await go('/profesores'); await p.getByRole('button', { name: 'Nuevo profesor' }).click(); await save(); ok(await dlg().locator('[role=alert]').count() >= 3, 'profesor: validación de campos');
  const f = (l) => dlg().getByLabel(l);
  await f(/^Nombre/).fill('Irene'); await f(/Apellidos/).fill('Campos Lara'); await f(/Correo/).fill('irene.campos@centro.demo'); await f(/Teléfono/).fill('655111222'); await f(/Especialidad/).fill('Dibujo'); await f(/Horas semanales/).fill('12'); await save();
  await go('/profesores'); ok(await p.getByText('Irene Campos Lara').count() >= 1, 'profesor creado aparece en el listado');
  await p.getByText('Irene Campos Lara').first().click(); await p.waitForTimeout(600); ok(/\/profesores\/.+/.test(p.url()) && await p.getByRole('heading', { name: /Irene Campos/ }).count() >= 1, 'ficha de profesor');

  // Asignaturas
  await go('/asignaturas'); await p.getByRole('button', { name: 'Nueva asignatura' }).click(); await f(/^Nombre/).fill('Dibujo Técnico'); await f(/Código/).fill('DIB'); await save();
  await go('/asignaturas'); ok(await p.getByText('Dibujo Técnico').count() >= 1, 'asignatura creada');
  await p.getByRole('button', { name: 'Editar Dibujo Técnico' }).click(); await f(/^Nombre/).fill('Dibujo Artístico'); await save(); await go('/asignaturas'); ok(await p.getByText('Dibujo Artístico').count() >= 1, 'asignatura editada');
  await p.getByRole('button', { name: 'Eliminar Dibujo Artístico' }).click(); await p.getByRole('alertdialog').getByRole('button', { name: /Eliminar|Confirmar/ }).click().catch(async () => { await dlg().getByRole('button', { name: /Eliminar|Confirmar/ }).click(); }); await p.waitForTimeout(500);
  await go('/asignaturas'); ok(await p.getByText('Dibujo Artístico').count() === 0, 'asignatura eliminada');

  // Grupos: capacidad
  await go('/grupos'); await p.getByRole('button', { name: 'Nuevo grupo' }).click(); await save(); ok(await dlg().locator('[role=alert]').count() >= 1, 'grupo: validación');
  await f(/^Nombre/).fill('Taller de Prueba'); await dlg().getByLabel(/Asignatura/).fill('Asignatura nueva de prueba'); await last(/Profesor/); await last(/Aula/); await f(/Capacidad/).fill('2'); await save(); if (await dlg().count()) console.log('   (diálogo grupo)', (await dlg().locator('[role=alert]').allInnerTexts()).join(' / ').replace(/\n+/g, ' ').slice(0, 220));
  await p.waitForURL(/\/grupos\/.+/, { timeout: 6000 }).catch(() => {}); await p.getByText('Taller de Prueba').first().waitFor({ timeout: 4000 }).catch(() => {}); ok(/\/grupos\/.+/.test(p.url()) && await p.getByText('Taller de Prueba').count() >= 1, 'grupo creado y abre su ficha');

  // Exámenes + notas
  await go('/examenes'); await p.getByRole('button', { name: 'Nuevo examen' }).click(); await save(); ok(await dlg().locator('[role=alert]').count() >= 1, 'examen: validación');
  await f(/Título/).fill('Prueba de unidad 1'); await dlg().getByLabel(/Grupo/).selectOption({ index: 1 }); await dlg().getByLabel(/Profesor/).selectOption({ index: 1 }); await dlg().getByLabel(/Aula/).selectOption({ index: 1 });
  const d = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10); await f(/Fecha/).fill(d); await f(/Hora/).fill('10:00'); await f(/Duración/).fill('60'); await save();
  await go('/examenes'); ok(await p.getByText('Prueba de unidad 1').count() >= 1, 'examen creado');
  await p.getByText('Prueba de unidad 1').first().click(); await p.waitForTimeout(700); await p.getByRole('button', { name: /Marcar realizado/ }).click(); await p.waitForTimeout(700);
  const inputs = p.locator('input[type=number], input[inputmode=decimal]'); const n = await inputs.count(); ok(n > 0, `pantalla de calificar con ${n} campos de nota`);
  if (n) { await inputs.nth(0).fill('8.5'); await inputs.nth(0).blur(); await p.waitForTimeout(300); await p.getByRole('button', { name: /Guardar/ }).first().click().catch(() => {}); await p.waitForTimeout(600); await p.reload(); await p.waitForSelector('main h1'); ok(await p.locator('input[type=number], input[inputmode=decimal]').first().inputValue() === '8.5', 'la nota se guarda y persiste'); }

  // Mensajes y avisos
  await go('/mensajes'); await p.getByRole('button', { name: 'Nuevo mensaje' }).click(); await f(/Asunto/).fill('Prueba interna'); await f(/^Mensaje/).fill('Mensaje de comprobación del sistema.'); await dlg().getByRole('button', { name: 'Carlos Fernández' }).click(); await save('Enviar');
  await go('/mensajes'); ok(await p.getByText('Prueba interna').count() >= 1, 'mensaje enviado y visible');
  await go('/avisos'); await p.getByRole('button', { name: 'Nuevo aviso' }).click(); await f(/Título/).fill('Aviso de prueba'); await f(/^Mensaje/).fill('Mañana no hay clase.'); await save('Publicar'); await go('/avisos'); ok(await p.getByText('Aviso de prueba').count() >= 1, 'aviso publicado');

  // Notificaciones
  await p.getByRole('button', { name: /Notificaciones/ }).first().click().catch(() => {}); await p.waitForTimeout(400); ok(await p.getByText(/notificaci/i).count() >= 1, 'campana de notificaciones abre');
  await p.keyboard.press('Escape');

  // Facturación y exportaciones
  await go('/facturacion'); ok(await p.locator('tbody tr').count() > 0, 'facturación lista recibos');
  await go('/informes'); const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 5000 }).catch(() => null), p.getByRole('button', { name: 'Exportar CSV' }).click()]); ok(!!dl, 'informe: exportar CSV descarga un archivo');

  // Ajustes y cierre de sesión
  await go('/configuracion'); await p.getByRole('button', { name: 'Guardar' }).first().click(); await p.getByText(/guardad/i).first().waitFor({ timeout: 4000 }).catch(() => {}); ok(await p.getByText(/guardad/i).count() >= 1, 'ajustes: guardar confirma');
  await p.getByRole('button', { name: 'Menú de usuario' }).click(); await p.getByRole('menuitem', { name: /Cerrar sesión|Salir/ }).click();  await p.waitForTimeout(700);
  ok(await p.getByText('Iniciar sesión').count() >= 1, 'cerrar sesión vuelve al login');
  console.log('ERRORS', JSON.stringify(errs)); console.log(fails ? `${fails} FALLOS` : 'TODO OK'); await b.close(); process.exit(fails ? 1 : 0);
})().catch((e) => { console.log('CRASH', e.message.split('\n').slice(0, 3).join(' | ')); process.exit(1); });
