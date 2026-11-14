// Cada sector: onboarding → vocabulario aplicado, género correcto ("Nueva sesión"/"Nuevo paciente") y pantallas sin caídas.
const { chromium } = require('playwright');
const U = process.env.APP_URL || 'http://127.0.0.1:5173';
const CASES = [
  ['Clínica de fisioterapia', 'Pacientes', /Nuevo paciente/, '/clases', /Nueva sesión/],
  ['Psicología y logopedia', 'Pacientes', /Nuevo paciente/, '/clases', /Nueva sesión/],
  ['Gimnasio, yoga y pilates', 'Socios', /Nuevo socio/, '/clases', /Nueva clase/],
  ['Escuela de danza', 'Bailarines', /Nuevo bailarín/, '/clases', /Nueva clase/],
  ['Club o escuela deportiva', 'Jugadores', /Nuevo jugador/, '/clases', /Nuevo entrenamiento/],
  ['Escuela infantil y ludoteca', 'Niños', /Nuevo niño/, '/clases', /Nueva actividad/],
  ['Formación profesional', 'Participantes', /Nuevo participante/, '/grupos', /Nueva convocatoria/],
  ['Náutica, vuelo y conducción especial', 'Alumnos', /Nuevo alumno/, '/clases', /Nueva práctica/],
  ['Adiestramiento canino', 'Perros', /Nuevo perro/, '/clases', /Nueva sesión/],
  ['Peluquería y estética', 'Clientes', /Nuevo cliente/, '/clases', /Nueva cita/],
  ['Talleres y artes', 'Participantes', /Nuevo participante/, '/grupos', /Nuevo taller/],
];
(async () => {
  const b = await chromium.launch(); let fails = 0; const errs = [];
  for (const [label, plural, newStudent, route, newOther] of CASES) {
    const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
    p.on('pageerror', (e) => errs.push(label + ': ' + e.message)); p.on('console', (m) => m.type() === 'error' && !/Failed to load/.test(m.text()) && errs.push(label + ': ' + m.text().slice(0, 120)));
    const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', label, '·', m); if (!c) fails++; };
    try {
      await p.goto(U + '/onboarding'); await p.getByLabel(/Nombre de la academia/).fill('Centro ' + label.slice(0, 6)); await p.getByRole('button', { name: 'Continuar' }).click(); await p.getByRole('button', { name: 'Continuar' }).click();
      await p.getByRole('radio', { name: new RegExp(label.replace(/[()]/g, '')) }).click(); await p.getByRole('button', { name: 'Continuar' }).click(); await p.getByRole('button', { name: 'Continuar' }).click();
      await p.getByLabel(/Tu nombre/).fill('Dueño Prueba'); await p.getByLabel(/Correo/).fill('dueno@prueba.demo'); await p.getByLabel(/Contraseña/).fill('Prueba2026ok'); await p.getByRole('button', { name: 'Crear academia' }).click();
      await p.waitForSelector('text=Academy Command Center', { timeout: 10000 }); await p.waitForTimeout(500);
      ok((await p.locator('aside').innerText()).includes(plural), `menú usa «${plural}»`);
      await p.goto(U + '/alumnos'); await p.locator('main h1').first().waitFor(); ok(await p.getByRole('button', { name: newStudent }).count() >= 1, `botón ${newStudent}`);
      await p.goto(U + route); await p.locator('main h1, main [role=alert]').first().waitFor(); const txt = await p.locator('main').innerText(); const mod = /Módulo no activado/.test(txt);
      ok(mod || await p.getByRole('button', { name: newOther }).count() >= 1 || await p.getByRole('link', { name: newOther }).count() >= 1, `botón ${newOther} (o módulo desactivado)`);
      for (const r of ['/horarios', '/pagos', '/estadisticas', '/jarvis', '/configuracion', '/personalizacion']) { await p.goto(U + r); await p.waitForTimeout(250); const bad = await p.getByText(/Algo ha salido mal/).count(); if (bad) { ok(false, 'caída en ' + r); } }
    } catch (e) { ok(false, 'CRASH ' + e.message.split('\n')[0]); }
  }
  console.log('ERRORS', JSON.stringify(errs)); console.log(fails ? `${fails} FALLOS` : 'TODO OK'); await b.close(); process.exit(fails ? 1 : 0);
})();
