// Autoescuela Atlanta (híbrido EDITH + prácticas): coches, prácticas 1 a 1, choques, series, horas del alumno y alcance del profesor.
const { chromium } = require('playwright');
const U = process.env.APP_URL || 'http://127.0.0.1:4010';
let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
const iso = (d) => d.toISOString().slice(0, 10);
const nextDow = (dow, skip = 0) => { const d = new Date(); d.setDate(d.getDate() + ((dow - d.getDay() + 7) % 7 || 7) + 7 * skip); return iso(d); };
(async () => {
  const b = await chromium.launch(); const errs = [];
  const login = async (name) => { const p = await (await b.newContext({ viewport: { width: 1360, height: 900 } })).newPage(); p.on('pageerror', (e) => errs.push(e.message)); await p.goto(U + '/login'); await p.locator('button').filter({ hasText: name }).first().click(); await p.waitForSelector('main h1'); return p; };
  const p = await login('Director Atlanta'); const dlg = p.locator('[role=dialog]');
  const go = async (r) => { await p.goto(U + r); await p.locator('main h1').first().waitFor(); await p.waitForTimeout(300); };
  ok(await p.getByRole('link', { name: 'Prácticas' }).count() >= 1 && await p.getByRole('link', { name: 'Coches' }).count() >= 1, 'el menú de la autoescuela tiene Prácticas y Coches');
  await go('/practicas'); ok(await p.locator('[draggable]').count() > 0, 'el calendario muestra prácticas programadas');
  const sat = nextDow(6);
  const fill = async (date, start) => { await dlg.getByLabel('Día').fill(date); await dlg.getByLabel('Hora').fill(start); };
  await p.getByRole('button', { name: /Apuntar práctica/ }).click(); await dlg.getByLabel(/Alumno/).fill('Lucía'); await dlg.getByRole('button', { name: /Lucía Fernández/ }).click(); await fill(sat, '10:00'); await dlg.getByRole('button', { name: 'Guardar' }).click();
  await p.waitForSelector('text=Práctica apuntada'); ok(true, 'apuntar una práctica');
  // Choque: mismo profesor y coche a la misma hora con otro alumno
  await p.waitForTimeout(500); await p.getByRole('button', { name: /Apuntar práctica/ }).click(); await dlg.getByLabel(/Alumno/).fill('Carmen'); await dlg.getByRole('button', { name: /Carmen Ortiz/ }).click(); await fill(sat, '10:30');
  await dlg.getByLabel('Profesor').selectOption({ label: 'David Ruiz' }); await dlg.getByLabel('Coche').selectOption({ index: 1 }); await p.waitForTimeout(300);
  ok(await dlg.getByText('Hay un choque').count() === 1 && await dlg.getByRole('button', { name: 'Guardar igualmente' }).count() === 1, 'avisa del choque y ofrece «Guardar igualmente»'); await dlg.getByRole('button', { name: 'Cancelar' }).click();
  // Serie semanal
  await p.getByRole('button', { name: /Apuntar práctica/ }).click(); await dlg.getByLabel(/Alumno/).fill('Pablo'); await dlg.getByRole('button', { name: /Pablo Jiménez/ }).click(); const sun = nextDow(0); await fill(sun, '09:00');
  await dlg.getByLabel('Repetir cada semana').check(); await dlg.getByLabel('Semanas').fill('3'); await dlg.getByRole('button', { name: 'Guardar' }).click(); await p.waitForSelector('text=Prácticas apuntadas'); ok(true, 'serie semanal (3 semanas)');
  // Coches
  await go('/coches'); ok(await p.locator('tbody tr').count() >= 3 && await p.getByText(/ITV de Seat Ibiza/).count() === 1, 'coches con aviso de ITV próxima');
  ok(await p.getByText('En el taller').count() >= 1, 'un coche en el taller');
  await p.getByRole('button', { name: /Añadir coche/ }).click(); await dlg.getByLabel(/Matrícula/).fill('0000 AAA'); await dlg.getByLabel(/Modelo/).fill('Test Car'); await dlg.getByRole('button', { name: 'Guardar' }).click(); await p.waitForSelector('text=Coche añadido'); ok(true, 'añadir un coche');
  // Coche en taller: no seleccionable
  await go('/practicas'); await p.getByRole('button', { name: /Apuntar práctica/ }).click(); ok(await dlg.getByLabel('Coche').locator('option[disabled]').count() >= 1, 'el coche del taller no se puede elegir'); await dlg.getByRole('button', { name: 'Cancelar' }).click();
  // Terminar y firmar (firma táctil de alumno y profesor), parte mensual y WhatsApp
  await go('/practicas'); await p.getByRole('button', { name: /Apuntar práctica/ }).click(); await dlg.getByLabel(/Alumno/).fill('Sara'); await dlg.getByRole('button', { name: /Sara Medina/ }).click(); const tod = iso(new Date()); await fill(tod, '21:00'); await dlg.getByLabel('Profesor').selectOption({ label: 'Marta Cano' }); await dlg.getByLabel('Coche').selectOption({ index: 2 }); await dlg.getByRole('button', { name: /Guardar/ }).click(); await p.waitForSelector('text=Práctica apuntada'); await p.waitForTimeout(500);
  await p.getByRole('button', { name: /Sara Medina Ortega.*21:00/ }).first().click(); ok(await dlg.getByRole('button', { name: /Avisar por WhatsApp/ }).count() === 1, 'práctica con botón de WhatsApp'); await dlg.getByRole('button', { name: /Avisar por WhatsApp/ }).click(); const wa = p.getByRole('link', { name: 'Abrir WhatsApp' }); const href = await wa.getAttribute('href'); ok(/^https:\/\/wa\.me\/34\d{9}\?text=/.test(href) && decodeURIComponent(href).includes('práctica'), 'enlace de WhatsApp con el mensaje preparado'); await p.getByRole('button', { name: 'Cerrar' }).last().click();
  await dlg.first().getByRole('button', { name: /Terminar y firmar/ }).click(); const sign = async (name) => { const c = p.getByRole('img', { name }); const bb = await c.boundingBox(); await p.mouse.move(bb.x + 30, bb.y + 40); await p.mouse.down(); await p.mouse.move(bb.x + 120, bb.y + 90, { steps: 6 }); await p.mouse.move(bb.x + 200, bb.y + 50, { steps: 6 }); await p.mouse.up(); };
  await sign('Firma del alumno'); await p.getByRole('button', { name: 'Firmar', exact: true }).click(); ok(await p.getByText('Devuelve el móvil a tu profesor').count() === 1, 'tras la firma del alumno pide devolver el móvil'); await p.getByRole('button', { name: /Soy el profesor/ }).click(); await sign('Firma del profesor'); await p.getByLabel(/Kilómetros de la práctica/).fill('33'); await p.getByRole('button', { name: 'Guardar clase firmada' }).click(); await p.waitForSelector('text=Práctica firmada y guardada'); ok(true, 'práctica firmada y guardada');
  await go('/parte'); ok(await p.getByText(/Sara Medina/).count() >= 1 && await p.getByText('✓').count() >= 1, 'el parte mensual recoge la práctica firmada'); const dl = p.waitForEvent('download'); await p.getByRole('button', { name: 'CSV' }).click(); ok((await dl).suggestedFilename().startsWith('parte-'), 'descarga del parte en CSV');
  // Ficha del alumno
  await go('/alumnos'); await p.getByText('Lucía Fernández').first().click(); await p.getByRole('progressbar', { name: /horas de prácticas/ }).waitFor().catch(() => {}); ok(await p.getByRole('progressbar', { name: /horas de prácticas/ }).count() === 1, 'ficha del alumno con barra de horas');
  await p.screenshot({ path: (process.env.SHOT_DIR || '/tmp') + '/atlanta-alumno.png' });
  await go('/practicas'); await p.screenshot({ path: (process.env.SHOT_DIR || '/tmp') + '/atlanta-practicas.png' });
  // Fase 3: exámenes de conducir e importar alumnos
  await go('/alumnos'); await p.getByText('Lucía Fernández').first().click(); await p.waitForSelector('text=Exámenes');
  await p.getByLabel('Fecha del examen').fill(iso(new Date())); await p.getByRole('button', { name: 'Anotar' }).click(); await p.waitForSelector('text=Examen anotado');
  await p.getByLabel('Resultado del examen teorico').selectOption('aprobado'); await p.waitForSelector('text=Resultado guardado'); ok(await p.getByText('1/1 aprobados').count() === 1, 'examen teórico anotado y aprobado (1/1)');
  await go('/parte'); ok(await p.getByText(/100% aprobados/).count() === 1, 'el parte mensual muestra el porcentaje de aprobados');
  await go('/alumnos'); await p.getByRole('button', { name: /Importar CSV/ }).click();
  await dlg.getByLabel('Contenido CSV').fill('Nombre;Apellidos;Fecha de nacimiento;Correo;Teléfono\nÁlex;Importado Uno;14/03/2004;alex@correo.es;600111222\nMala;Fila;no-fecha;x;1\nEva;Importada Dos;2003-07-01;eva@correo.es;600333444');
  ok(await dlg.getByText(/2 filas válidas/).count() === 1 && await dlg.getByText(/1 con errores/).count() === 1, 'la importación valida fila a fila (2 válidas, 1 con error)');
  await dlg.getByRole('button', { name: 'Importar 2' }).click(); await p.waitForSelector('text=2 alumnos importados'); await p.waitForTimeout(500);
  ok(await p.getByText('Álex Importado Uno').count() >= 1 && await p.getByText('Eva Importada Dos').count() >= 1, 'los alumnos importados aparecen en la lista');
  // Profesor: ve solo lo suyo y no gestiona coches
  const t = await login('David Ruiz'); await t.goto(U + '/alumnos'); await t.waitForTimeout(700); const mine = await t.locator('tbody tr').count(); ok(mine > 0 && mine < 14, `el profesor ve solo sus alumnos (${mine} de 14)`);
  await t.goto(U + '/coches'); await t.waitForTimeout(600); ok(await t.getByRole('button', { name: /Añadir coche/ }).count() === 0, 'el profesor no puede añadir coches');
  await t.goto(U + '/practicas'); await t.waitForTimeout(600); ok(await t.locator('[draggable]').count() > 0, 'el profesor ve sus prácticas');
  console.log('ERRORS', JSON.stringify(errs)); console.log(fails ? `${fails} FALLOS` : 'TODO OK'); await b.close(); process.exit(fails ? 1 : 0);
})().catch((e) => { console.log('CRASH', e.message.split('\n')[0]); process.exit(1); });
