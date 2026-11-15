// Ajustes → Módulos en una academia recién dada de alta (solo guarda los módulos activos): activar uno con dependencias y guardar.
const { chromium } = require('playwright');
const U = process.env.APP_URL || 'http://127.0.0.1:4012'; const EMAIL = process.env.PV_EMAIL; const PW = process.env.PV_PASSWORD;
let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const errs = []; const p = await (await b.newContext({ viewport: { width: 1360, height: 900 } })).newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(U + '/login'); await p.getByLabel(/Correo/).fill(EMAIL); await p.getByLabel('Contraseña').fill(PW); await p.getByRole('button', { name: /Entrar/ }).click(); await p.waitForSelector('main h1');
  await p.goto(U + '/personalizacion'); await p.getByRole('tab', { name: 'Módulos' }).click();
  const sw = (n) => p.getByRole('switch', { name: new RegExp(n) });
  // «Calificaciones» necesita «Exámenes»: al activarla se activa también la dependencia
  await sw('Activar Calificaciones').click(); ok(await sw('Desactivar Exámenes').count() === 1, 'al activar Calificaciones se activa Exámenes automáticamente');
  await p.getByRole('button', { name: 'Guardar módulos' }).click(); await p.waitForSelector('text=Módulos actualizados'); ok(true, 'guardar módulos sin error');
  await p.reload(); await p.getByRole('tab', { name: 'Módulos' }).click(); ok(await sw('Desactivar Calificaciones').count() === 1, 'el cambio se conserva');
  await sw('Desactivar Exámenes').click(); ok(await sw('Activar Calificaciones').count() === 1, 'al desactivar Exámenes se desactiva Calificaciones');
  console.log('ERRORS', JSON.stringify(errs)); console.log(fails ? `${fails} FALLOS` : 'TODO OK'); await b.close(); process.exit(fails ? 1 : 0);
})().catch((e) => { console.log('CRASH', e.message.split('\n')[0]); process.exit(1); });
