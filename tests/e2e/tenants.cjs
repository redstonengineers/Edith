// Acceso por negocio: tarjetas en /login, página personalizada (logo, colores), perfiles con usuario = perfil y contraseña «demo».
const { chromium } = require('playwright');
const U = process.env.APP_URL || 'http://127.0.0.1:4015'; const PERSONAL = process.env.PERSONAL_TEST_PASSWORD;
let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const errs = [];
  const page = async () => { const p = await (await b.newContext({ viewport: { width: 1360, height: 900 } })).newPage(); p.on('pageerror', (e) => errs.push(e.message)); return p; };
  let p = await page(); await p.goto(U + '/login'); await p.waitForSelector('[aria-label="Elige tu negocio"] a');
  const cards = await p.locator('[aria-label="Elige tu negocio"] a').allInnerTexts();
  ok(cards.length === 3 && /Autoescuela Atlanta/.test(cards[0]) && /^Academia/.test(cards[1]) && /^Clínica/.test(cards[2]), 'tres tarjetas: Autoescuela Atlanta, Academia y Clínica (en ese orden)');
  ok(await p.locator('input#email').count() === 1 && await p.locator('input#pw').count() === 1, 'arriba siguen el usuario y la contraseña');
  await p.screenshot({ path: (process.env.SHOT_DIR || '/tmp') + '/login-tarjetas.png' });
  // Genérico: «director» existe en varios negocios → pide elegir negocio
  await p.locator('input#email').fill('director'); await p.locator('input#pw').fill('demo'); await p.getByRole('button', { name: /Entrar/ }).click(); await p.waitForTimeout(1200);
  ok(await p.getByText(/varios negocios/).count() === 1, 'el usuario «director» sin negocio pide elegir negocio');
  // Personal sigue igual
  if (PERSONAL) { await p.locator('input#email').fill('redstonengineers'); await p.locator('input#pw').fill(PERSONAL); await p.getByRole('button', { name: /Entrar/ }).click(); await p.waitForURL(/personal/, { timeout: 8000 }).then(() => ok(true, 'el acceso personal sigue con su propia contraseña'), () => ok(false, 'el acceso personal sigue con su propia contraseña')); }
  const T = [['atlanta', 'Autoescuela Atlanta', ['Director', 'Secretaría', 'Profesor', 'Alumno'], '#f97316'], ['academia', 'Academia', ['Director', 'Secretaría', 'Profesor', 'Alumno', 'Padre'], '#8b7bff'], ['clinica', 'Clínica', ['Director', 'Recepción', 'Doctor', 'Paciente', 'Familiar'], '#14b8a6']];
  for (const [slug, card, profiles, color] of T) {
    p = await page(); await p.goto(U + '/login'); await p.getByRole('link', { name: `Entrar en ${card}` }).click(); await p.waitForURL(new RegExp('/acceso/' + slug)); await p.waitForSelector('#u');
    ok(await p.locator('img[alt^="Logo de"]').first().count() === 1, `${slug}: muestra el logo del negocio`);
    ok((await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--brand').trim().toLowerCase())) === color, `${slug}: usa los colores del negocio`);
    const chips = await p.getByRole('group', { name: 'Entrar como' }).getByRole('button').allInnerTexts(); ok(JSON.stringify(chips) === JSON.stringify(profiles), `${slug}: perfiles ${profiles.join(', ')}`);
    if (slug === 'atlanta') await p.screenshot({ path: (process.env.SHOT_DIR || '/tmp') + '/acceso-atlanta.png' });
    // Cada perfil entra con «demo»
    for (const pr of profiles) {
      const q = await page(); await q.goto(U + '/acceso/' + slug); await q.waitForSelector('#u'); await q.getByRole('group', { name: 'Entrar como' }).getByRole('button', { name: pr, exact: true }).click(); await q.waitForSelector('main h1', { timeout: 10000 }).then(() => ok(!q.url().includes('/acceso'), `${slug}: entra como ${pr}`), () => ok(false, `${slug}: entra como ${pr}`)); await q.context().close();
    }
    // Usuario escrito a mano + contraseña mala
    await p.locator('#u').fill('director'); await p.locator('#p').fill('mala'); await p.getByRole('button', { name: /Entrar/ }).click(); await p.waitForTimeout(1000); ok(await p.getByRole('alert').count() === 1, `${slug}: contraseña incorrecta → error`);
    await p.locator('#p').fill('demo'); await p.getByRole('button', { name: /Entrar/ }).click(); await p.waitForSelector('main h1', { timeout: 10000 }); ok(true, `${slug}: «director» + demo entra`);
    if (slug === 'clinica') { ok(await p.getByRole('link', { name: /Pacientes/ }).count() >= 1, 'clínica: el menú habla de Pacientes'); await p.screenshot({ path: (process.env.SHOT_DIR || '/tmp') + '/clinica-home.png' }); }
    if (slug === 'atlanta') ok(await p.getByRole('link', { name: 'Prácticas' }).count() >= 1 && await p.getByRole('link', { name: 'Coches' }).count() >= 1, 'atlanta: módulos de autoescuela (Prácticas, Coches)');
    if (slug === 'academia') ok(await p.getByRole('link', { name: /Notas|Calificaciones/ }).count() >= 1 && await p.getByRole('link', { name: 'Coches' }).count() === 0, 'academia: módulos de academia (sin Coches)');
  }
  // Un usuario de un negocio no entra en otro
  p = await page(); await p.goto(U + '/acceso/clinica'); await p.locator('#u').fill('padre'); await p.locator('#p').fill('demo'); await p.getByRole('button', { name: /Entrar/ }).click(); await p.waitForTimeout(1000); ok(await p.getByRole('alert').count() === 1, 'el usuario «padre» no existe en la clínica (hay «familiar»)');
  console.log('ERRORS', JSON.stringify(errs)); console.log(fails ? `${fails} FALLOS` : 'TODO OK'); await b.close(); process.exit(fails ? 1 : 0);
})().catch((e) => { console.log('CRASH', e.message.split('\n')[0]); process.exit(1); });
