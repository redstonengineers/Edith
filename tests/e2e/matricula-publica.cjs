// Formulario público de solicitud de matrícula: cualquier negocio, sin cuenta, con antispam, aviso al equipo y control desde Matrículas.
// Modo API con el servidor arrancado con TENANTS=1 (+ PROVISION_*). El onboarding limita altas: usa una base limpia.
const { chromium } = require('playwright');
const U = process.env.APP_URL || 'http://127.0.0.1:4015';
let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
const api = async (method, path, body) => { const r = await fetch(U + '/api' + path, { method, headers: { 'content-type': 'application/json', 'x-requested-with': 'edith' }, body: body ? JSON.stringify(body) : undefined }); let j = {}; try { j = await r.json(); } catch { /* */ } return { s: r.status, j }; };
const valid = (o = {}) => ({ name: 'Marina Ortega Sanz', email: 'marina.ortega@correo.test', phone: '612 345 678', birthDate: '1998-06-10', interest: 'Permiso B', message: 'Quiero empezar pronto.', consent: true, elapsed: 20000, ...o });
(async () => {
  const b = await chromium.launch(); const errs = [];
  // — Información pública: sin datos de personas
  let r = await api('GET', '/public/apply/atlanta'); ok(r.s === 200 && r.j.info?.name === 'Autoescuela Atlanta' && r.j.info.interests.includes('Permiso B'), 'info pública de Atlanta (nombre y permisos)');
  ok(!/@|"pwd"|password/i.test(JSON.stringify(r.j)), 'la info pública no lleva correos ni secretos');
  ok((await api('GET', '/public/apply/no-existe')).s === 404, 'negocio inexistente → 404');
  // — Validaciones y antispam por API (negocio «academia»)
  r = await api('POST', '/public/apply/academia', valid({ consent: false })); ok(r.s === 400, 'sin aceptar el tratamiento de datos → 400');
  r = await api('POST', '/public/apply/academia', valid({ email: 'mal' })); ok(r.s === 400, 'correo inválido → 400');
  r = await api('POST', '/public/apply/academia', valid({ birthDate: new Date(Date.now() - 15 * 365 * 86400000).toISOString().slice(0, 10) })); ok(r.s === 422 && /tutor/.test(r.j.error), 'menor sin datos de tutor → 422');
  r = await api('POST', '/public/apply/academia', valid({ website: 'http://spam.test', email: 'bot1@correo.test' })); ok(r.s === 200, 'señuelo relleno: responde ok (sin dar pistas)');
  r = await api('POST', '/public/apply/academia', valid({ elapsed: 300, email: 'bot2@correo.test' })); ok(r.s === 200, 'envío instantáneo: responde ok (sin dar pistas)');
  // — Formulario real (UI) en Atlanta
  const page = async () => { const p = await (await b.newContext({ viewport: { width: 1200, height: 900 } })).newPage(); p.on('pageerror', (e) => errs.push(e.message)); return p; };
  let p = await page(); await p.goto(U + '/matricula/atlanta'); await p.getByLabel('Nombre completo').waitFor();
  ok(await p.locator('img[alt^="Logo de"]').count() === 1 || await p.getByRole('heading', { name: 'Autoescuela Atlanta' }).count() === 1, 'atlanta: muestra el negocio');
  ok(await p.getByLabel('Permiso que quieres sacar').count() === 1, 'atlanta: pregunta por el permiso (texto propio de autoescuela)');
  ok((await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--brand').trim().toLowerCase())) === '#f97316', 'atlanta: usa sus colores');
  await p.getByLabel('Nombre completo').fill('Marina Ortega Sanz'); await p.getByLabel('Correo electrónico').fill('marina.ortega@correo.test'); await p.getByLabel('Teléfono').fill('612345678'); await p.getByLabel('Fecha de nacimiento').fill('1998-06-10');
  await p.getByLabel('Permiso que quieres sacar').selectOption('Permiso B'); await p.getByLabel(/Mensaje/).fill('Trabajo por las mañanas, ¿tenéis clases de tarde?');
  await p.getByRole('button', { name: 'Enviar solicitud' }).click(); await p.waitForTimeout(300); ok(await p.getByText('Debes aceptar el tratamiento de tus datos').count() >= 1, 'UI: exige aceptar el tratamiento de datos');
  await p.getByRole('checkbox').check(); await p.waitForTimeout(2600); await p.getByRole('button', { name: 'Enviar solicitud' }).click(); await p.getByText('¡Solicitud enviada!').waitFor({ timeout: 8000 }); ok(true, 'UI: solicitud enviada');
  // — Menor de edad: pide tutor
  p = await page(); await p.goto(U + '/matricula/atlanta'); await p.getByLabel('Nombre completo').fill('Hugo Prieto Lara'); await p.getByLabel('Correo electrónico').fill('familia.prieto2@correo.test'); await p.getByLabel('Teléfono').fill('633770142');
  await p.getByLabel('Fecha de nacimiento').fill(new Date(Date.now() - 15 * 365 * 86400000).toISOString().slice(0, 10)); await p.getByLabel('Permiso que quieres sacar').selectOption('Permiso B');
  ok(await p.getByRole('group', { name: 'Madre, padre o tutor' }).count() === 1, 'UI: al ser menor aparece el bloque de tutor');
  // — Otros negocios: cada uno con su pregunta
  p = await page(); await p.goto(U + '/matricula/clinica'); await p.getByLabel('Nombre completo').waitFor(); ok(await p.getByLabel('Motivo de la consulta').count() === 1, 'clínica: «Motivo de la consulta»');
  p = await page(); await p.goto(U + '/matricula/academia'); await p.getByLabel('Nombre completo').waitFor(); ok(await p.getByLabel('Curso o asignatura').count() === 1, 'academia: «Curso o asignatura»');
  // — Duplicado: misma persona dos veces → una sola solicitud
  r = await api('POST', '/public/apply/atlanta', valid({ name: 'Marina Ortega Sanz' })); ok(r.s === 200, 'duplicado: responde ok');
  // — El equipo lo ve en Matrículas
  p = await page(); await p.goto(U + '/acceso/atlanta'); await p.waitForSelector('[aria-label="Entrar como"]'); await p.getByRole('group', { name: 'Entrar como' }).getByRole('button', { name: 'Director' }).click(); await p.waitForURL((u) => !/acceso/.test(u.pathname));
  await p.goto(U + '/matriculas'); await p.getByRole('heading', { name: 'Matrículas' }).waitFor();
  const col = p.getByRole('region', { name: 'Solicitud' }); ok(await col.getByText('Marina Ortega Sanz').count() === 1, 'Matrículas: la solicitud web aparece una sola vez (sin duplicar)');
  ok(await col.getByText('Web').count() >= 1 && await p.getByText(/clases de tarde/).count() >= 1, 'Matrículas: etiqueta «Web» y mensaje del interesado');
  ok(await p.getByText('Bot1').count() === 0 && await p.getByText('bot1@correo.test').count() === 0, 'el spam (señuelo/instantáneo) no se guarda');
  ok(await p.getByRole('region', { name: 'Formulario público de solicitud' }).count() === 1, 'Matrículas: tarjeta del formulario público');
  const link = await p.getByLabel('Enlace del formulario público').inputValue(); ok(/\/matricula\/atlanta$/.test(link), 'enlace público del negocio: ' + link);
  // — Desactivar y volver a activar
  await p.getByRole('switch', { name: 'Formulario público activo' }).click(); await p.waitForTimeout(1200);
  ok((await api('GET', '/public/apply/atlanta')).s === 404 && (await api('POST', '/public/apply/atlanta', valid({ email: 'otra@correo.test' }))).s === 404, 'desactivado: el enlace deja de admitir solicitudes');
  const off = await page(); await off.goto(U + '/matricula/atlanta'); await off.getByText('Este formulario no está disponible').waitFor({ timeout: 8000 }).catch(() => {}); ok(await off.getByText('Este formulario no está disponible').count() === 1, 'desactivado: la página lo explica');
  await p.getByRole('switch', { name: 'Formulario público activo' }).click(); await p.waitForTimeout(1200); ok((await api('GET', '/public/apply/atlanta')).s === 200, 'reactivado: vuelve a funcionar');
  await p.getByRole('button', { name: 'Personalizar' }).click(); await p.getByLabel(/Texto de bienvenida/).fill('¡Bienvenido a Atlanta! Te llamamos hoy.'); await p.getByLabel(/Opciones de/).fill('Permiso B, Permiso A2, Refresco de conducción'); await p.getByRole('button', { name: 'Guardar' }).click(); await p.waitForTimeout(800);
  r = await api('GET', '/public/apply/atlanta'); ok(r.j.info.message.startsWith('¡Bienvenido a Atlanta!') && JSON.stringify(r.j.info.interests) === JSON.stringify(['Permiso B', 'Permiso A2', 'Refresco de conducción']), 'texto y opciones personalizados se reflejan en el formulario');
  // — Negocio nuevo de otro tipo (gimnasio): funciona con su id sin configurar nada
  const ob = await api('POST', '/onboarding', { academyName: 'Gimnasio Titán', adminName: 'Laura Gil', adminEmail: 'laura@gimnasio-titan.test', adminPassword: 'Titan12345', type: 'fitness', modules: ['students', 'enrollments', 'applications'] });
  if (ob.s === 200) {
    const q = await page(); await q.goto(U + '/login'); await q.getByLabel(/Correo o usuario/).fill('laura@gimnasio-titan.test'); await q.getByLabel('Contraseña').fill('Titan12345'); await q.getByRole('button', { name: /Entrar/ }).click(); await q.waitForURL((u) => !/login/.test(u.pathname)); await q.goto(U + '/matriculas');
    const url = await q.getByLabel('Enlace del formulario público').inputValue(); const k = url.split('/matricula/')[1]; ok(!!k, 'gimnasio nuevo: tiene enlace público por defecto');
    const g = await page(); await g.goto(U + '/matricula/' + k); await g.getByLabel('Nombre completo').waitFor(); ok(await g.getByLabel('Actividad que te interesa').count() === 1, 'gimnasio: «Actividad que te interesa»');
    await g.getByLabel('Nombre completo').fill('Carlos Vidal Pons'); await g.getByLabel('Correo electrónico').fill('carlos.vidal@correo.test'); await g.getByLabel('Teléfono').fill('655443322'); await g.getByLabel('Actividad que te interesa').fill('Yoga y pilates'); await g.getByRole('checkbox').check(); await g.waitForTimeout(2600); await g.getByRole('button', { name: 'Enviar solicitud' }).click(); await g.getByText('¡Solicitud enviada!').waitFor({ timeout: 8000 });
    await q.reload(); await q.getByText('Carlos Vidal Pons').first().waitFor({ timeout: 10000 }).catch(() => {}); ok(await q.getByText('Carlos Vidal Pons').count() >= 1, 'gimnasio: la solicitud llega a su Matrículas');
  } else ok(false, 'onboarding del gimnasio: ' + ob.s + ' ' + JSON.stringify(ob.j));
  // — Límite por red: demasiados envíos seguidos
  let last = 0; for (let i = 0; i < 8; i++) last = (await api('POST', '/public/apply/clinica', valid({ email: `p${i}@correo.test`, phone: `60000000${i}` }))).s; ok(last === 429, 'límite: tras varios envíos seguidos responde 429');
  console.log('ERRORS', JSON.stringify(errs)); console.log(fails ? `${fails} FALLOS` : 'TODO OK'); await b.close(); process.exit(fails ? 1 : 0);
})().catch((e) => { console.log('CRASH', e.message.slice(0, 400)); process.exit(1); });
