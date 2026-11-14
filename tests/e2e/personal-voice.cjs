// Voz de EDITH (Web Speech API del sistema): ajustes, lectura de recordatorios y de respuestas, con speechSynthesis simulado.
const { chromium } = require('playwright');
const U = process.env.APP_URL || 'http://127.0.0.1:4010'; const PW = process.env.PERSONAL_TEST_PASSWORD;
let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] }); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1360, height: 900 } });
  await ctx.addInitScript(() => {
    window.__said = []; const voices = [{ name: 'Inglesa', lang: 'en-US', voiceURI: 'en' }, { name: 'Mónica', lang: 'es-ES', voiceURI: 'es1' }];
    window.SpeechSynthesisUtterance = function (t) { this.text = t; };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { getVoices: () => voices, speak: (u) => { window.__said.push({ text: u.text, voice: u.voice && u.voice.voiceURI, rate: u.rate }); setTimeout(() => u.onend && u.onend(), 10); }, cancel() {}, addEventListener() {}, removeEventListener() {} } });
  });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(U + '/login'); await p.getByLabel(/Correo o usuario/).fill('redstonengineers'); await p.getByLabel('Contraseña').fill(PW); await p.getByRole('button', { name: /Entrar/ }).click();
  await p.getByRole('button', { name: /Gazael/i }).click();
  await p.waitForSelector('.hud-cols'); await p.waitForTimeout(800);
  await p.keyboard.press(','); const said = () => p.evaluate(() => window.__said);
  ok(await p.getByRole('group', { name: 'Voz de EDITH' }).count() === 1, 'los ajustes ofrecen la voz de EDITH');
  await p.getByRole('group', { name: 'Voz de EDITH' }).getByRole('button', { name: 'Sí' }).click(); await p.waitForTimeout(100);
  let s = await said(); ok(s.length === 1 && /EDITH/.test(s[0].text) && s[0].voice === 'es1', 'al activarla saluda con la voz española por defecto');
  await p.getByLabel('Voz del sistema').selectOption('en'); s = await said(); ok(s.at(-1).voice === 'en', 'se puede elegir otra voz y suena la prueba');
  await p.getByLabel('Voz del sistema').selectOption(''); await p.keyboard.press('Escape');
  // Recordatorio vencido: se lee en voz alta
  const before = (await said()).length; await p.getByLabel('Nuevo recordatorio').fill('Comprar pan hoy a las 00:01'); await p.keyboard.press('Enter'); await p.waitForTimeout(1200);
  s = await said(); ok(s.length > before && /Recordatorio: Comprar pan/.test(s.at(-1).text), 'un recordatorio que vence se lee en voz alta');
  // Voz desactivada: silencio
  await p.evaluate(() => document.activeElement && document.activeElement.blur()); await p.keyboard.press(','); await p.getByRole('group', { name: 'Voz de EDITH' }).getByRole('button', { name: 'No' }).click(); const n = (await said()).length;
  await p.keyboard.press('Escape'); await p.getByLabel('Nuevo recordatorio').fill('Otro aviso hoy a las 00:02'); await p.keyboard.press('Enter'); await p.waitForTimeout(1200);
  ok((await said()).length === n, 'con la voz desactivada no habla');
  console.log('ERRORS', JSON.stringify(errs)); console.log(fails ? `${fails} FALLOS` : 'TODO OK'); await b.close(); process.exit(fails ? 1 : 0);
})().catch((e) => { console.log('CRASH', e.message.split('\n')[0]); process.exit(1); });
