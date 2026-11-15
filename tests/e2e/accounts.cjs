// Academia dada de alta con PROVISION_*: una cuenta por perfil (director, secretaria, profesor, alumno, padre), mismo contraseña, usuario = nombre del perfil.
const { chromium } = require('playwright');
const U = process.env.APP_URL || 'http://127.0.0.1:4012'; const PW = process.env.PV_PASSWORD;
let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const errs = [];
  const login = async (user, pw = PW) => { const p = await (await b.newContext({ viewport: { width: 1360, height: 900 } })).newPage(); p.on('pageerror', (e) => errs.push(e.message)); await p.goto(U + '/login'); await p.getByLabel(/Correo o usuario/).fill(user); await p.getByLabel('Contraseña').fill(pw); await p.getByRole('button', { name: /Entrar/ }).click(); await p.waitForTimeout(1800); return p; };
  for (const [u, role] of [['director', 'Director'], ['secretaria', 'Secretar'], ['profesor', 'Profesor'], ['alumno', 'Alumno'], ['padre', 'Padre']]) { const p = await login(u); ok(!p.url().includes('/login') && !p.url().includes('/personal'), `entra con el usuario «${u}»`); if (u === 'director') { await p.goto(U + '/personalizacion'); await p.waitForSelector('main h1'); await p.waitForTimeout(500); ok(await p.getByRole('tab', { name: 'Módulos' }).count() === 1, 'el director gestiona la personalización'); } }
  const pr = await login('profesor'); await pr.goto(U + '/alumnos'); await pr.waitForTimeout(800); ok(await pr.getByText('Alumno Atlanta').count() >= 1, 'el profesor ve a su alumno');
  const bad = await login('director', 'incorrecta'); ok(bad.url().includes('/login'), 'una contraseña incorrecta no entra');
  const me = await login('Director'); ok(!me.url().includes('/login'), 'el usuario no distingue mayúsculas');
  console.log('ERRORS', JSON.stringify(errs)); console.log(fails ? `${fails} FALLOS` : 'TODO OK'); await b.close(); process.exit(fails ? 1 : 0);
})().catch((e) => { console.log('CRASH', e.message.split('\n')[0]); process.exit(1); });
