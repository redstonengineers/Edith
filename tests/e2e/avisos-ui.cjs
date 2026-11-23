// Página de avisos: bandeja y configuración (eventos, plantillas con vista previa, canales, recordatorio, descanso, prueba de canales).
const { chromium } = require('playwright');
const U = process.env.APP_URL || 'http://127.0.0.1:4016';
let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const errs = []; const p = await (await b.newContext({ viewport: { width: 1360, height: 1000 } })).newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(U + '/acceso/atlanta'); await p.waitForSelector('[aria-label="Entrar como"]'); await p.getByRole('group', { name: 'Entrar como' }).getByRole('button', { name: 'Director' }).click(); await p.waitForSelector('main h1');
  await p.goto(U + '/avisos-alumnos'); await p.waitForSelector('[role=tablist]'); ok(await p.getByRole('tab', { name: 'Bandeja' }).count() === 1 && await p.getByRole('tab', { name: 'Configuración' }).count() === 1, 'pestañas Bandeja y Configuración');
  await p.getByRole('tab', { name: 'Configuración' }).click();
  ok(await p.getByRole('switch', { name: /WhatsApp activado/ }).count() === 1 && await p.getByRole('switch', { name: /Correo electrónico activado|Integración/ }).count() === 0, 'solo el canal de WhatsApp');
  const txt = p.getByLabel('Texto: Práctica nueva'); await txt.fill('Hola {nombre}, nueva práctica el {fecha} a las {hora}. ¡Te esperamos!');
  ok(await p.getByText(/Vista previa:.*Hola Lucía, nueva práctica el lunes 3 de marzo a las 10:00/).count() >= 1, 'vista previa con datos de ejemplo');
  const sw = p.getByRole('switch', { name: 'Avisar: Práctica restaurada' }); if (await sw.getAttribute('aria-checked') === 'true') await sw.click(); await p.getByLabel('Horas de antelación del recordatorio').fill('12');
  await p.getByRole('button', { name: 'Guardar ajustes de avisos' }).click(); await p.waitForSelector('text=Ajustes de avisos guardados'); ok(true, 'guardar ajustes');
  await p.reload(); await p.getByRole('tab', { name: 'Configuración' }).click(); await p.waitForSelector('[aria-label="Texto: Práctica nueva"]');
  ok((await p.getByLabel('Texto: Práctica nueva').inputValue()).includes('¡Te esperamos!') && await p.getByLabel('Horas de antelación del recordatorio').inputValue() === '12' && await p.getByRole('switch', { name: 'Avisar: Práctica restaurada' }).getAttribute('aria-checked') === 'false', 'los ajustes se conservan');
  await p.getByLabel('Teléfono de prueba').fill('600111222'); await p.getByRole('button', { name: 'Enviar prueba' }).click(); await p.waitForSelector('ul[aria-live=polite] li'); ok(await p.locator('ul[aria-live=polite] li').count() >= 1, 'prueba de canales desde la página (resultado por canal)');
  await p.screenshot({ path: (process.env.SHOT_DIR || '/tmp') + '/avisos-config.png', fullPage: false });
  // Un profesor solo ve la bandeja
  const t = await (await b.newContext({ viewport: { width: 1360, height: 900 } })).newPage(); await t.goto(U + '/acceso/atlanta'); await t.waitForSelector('[aria-label="Entrar como"]'); await t.getByRole('group', { name: 'Entrar como' }).getByRole('button', { name: 'Profesor' }).click(); await t.waitForSelector('main h1'); await t.goto(U + '/avisos-alumnos'); await t.waitForSelector('main h1'); await t.waitForTimeout(600);
  ok(await t.getByRole('tab', { name: 'Configuración' }).count() === 0, 'el profesor no ve la configuración');
  console.log('ERRORS', JSON.stringify(errs)); console.log(fails ? `${fails} FALLOS` : 'TODO OK'); await b.close(); process.exit(fails ? 1 : 0);
})().catch((e) => { console.log('CRASH', e.message.split('\n')[0]); process.exit(1); });
