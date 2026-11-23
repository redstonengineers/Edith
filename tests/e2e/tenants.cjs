// Acceso por negocio (demos abiertas): tarjetas en /login, página personalizada (logo, colores) y perfiles que entran directamente, sin contraseña.
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
  // «director» sin @ ya no es un acceso de negocio: solo existe el acceso personal, y con esa contraseña no entra
  await p.locator('input#email').fill('director'); await p.locator('input#pw').fill('x-no-vale'); await p.getByRole('button', { name: /Entrar/ }).click(); await p.waitForTimeout(1200);
  ok(await p.getByRole('alert').count() === 1 && p.url().includes('/login'), 'un usuario sin @ no entra por /login con una contraseña cualquiera');
  // Personal sigue igual
  if (PERSONAL) { await p.locator('input#email').fill('redstonengineers'); await p.locator('input#pw').fill(PERSONAL); await p.getByRole('button', { name: /Entrar/ }).click(); await p.waitForURL(/personal/, { timeout: 8000 }).then(() => ok(true, 'el acceso personal sigue con su propia contraseña'), () => ok(false, 'el acceso personal sigue con su propia contraseña')); }
  const T = [['atlanta', 'Autoescuela Atlanta', ['Director', 'Secretaría', 'Profesor', 'Alumno'], '#f97316'], ['academia', 'Academia', ['Director', 'Secretaría', 'Profesor', 'Alumno', 'Padre'], '#8b7bff'], ['clinica', 'Clínica', ['Director', 'Recepción', 'Doctor', 'Paciente', 'Familiar'], '#14b8a6']];
  for (const [slug, card, profiles, color] of T) {
    p = await page(); await p.goto(U + '/login'); await p.getByRole('link', { name: `Entrar en ${card}` }).click(); await p.waitForURL(new RegExp('/acceso/' + slug)); await p.waitForSelector('[aria-label="Entrar como"]');
    ok(await p.locator('img[alt^="Logo de"]').first().count() === 1, `${slug}: muestra el logo del negocio`);
    ok((await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--brand').trim().toLowerCase())) === color, `${slug}: usa los colores del negocio`);
    const chips = await p.getByRole('group', { name: 'Entrar como' }).getByRole('button').allInnerTexts(); ok(JSON.stringify(chips) === JSON.stringify(profiles), `${slug}: perfiles ${profiles.join(', ')}`);
    if (slug === 'atlanta') await p.screenshot({ path: (process.env.SHOT_DIR || '/tmp') + '/acceso-atlanta.png' });
    // Cada perfil entra directamente
    for (const pr of profiles) {
      const q = await page(); await q.goto(U + '/acceso/' + slug); await q.waitForSelector('[aria-label="Entrar como"]'); await q.getByRole('group', { name: 'Entrar como' }).getByRole('button', { name: pr, exact: true }).click(); await q.waitForSelector('main h1', { timeout: 10000 }).then(() => ok(!q.url().includes('/acceso'), `${slug}: entra como ${pr}`), () => ok(false, `${slug}: entra como ${pr}`)); await q.context().close();
    }
    // Sin contraseña: la página no tiene campo de contraseña ni habla de ella
    ok(await p.locator('#p, input[type=password]').count() === 0 && !/contraseña demo|contraseña:|contraseña «/i.test(await p.locator('body').innerText()), `${slug}: no pide contraseña ni habla de «contraseña demo»`);
    const e2 = await page(); await e2.goto(U + '/acceso/' + slug); await e2.getByRole('group', { name: 'Entrar como' }).getByRole('button', { name: profiles[0], exact: true }).click(); await e2.waitForSelector('main h1', { timeout: 10000 }); p = e2;
    if (slug === 'clinica') { ok(await p.getByRole('link', { name: /Pacientes/ }).count() >= 1, 'clínica: el menú habla de Pacientes'); await p.screenshot({ path: (process.env.SHOT_DIR || '/tmp') + '/clinica-home.png' }); }
    if (slug === 'atlanta') ok(await p.getByRole('link', { name: 'Prácticas' }).count() >= 1 && await p.getByRole('link', { name: 'Coches' }).count() >= 1, 'atlanta: módulos de autoescuela (Prácticas, Coches)');
    if (slug === 'academia') ok(await p.getByRole('link', { name: /Notas|Calificaciones/ }).count() >= 1 && await p.getByRole('link', { name: 'Coches' }).count() === 0, 'academia: módulos de academia (sin Coches)');
  }
  // Un perfil de un negocio no entra en otro, y /api/auth/demo no admite nada que no sea un perfil demo
  const demo = (academy, profile) => fetch(U + '/api/auth/demo', { method: 'POST', headers: { 'content-type': 'application/json', 'x-requested-with': 'edith' }, body: JSON.stringify({ academy, profile }) });
  ok((await demo('clinica', 'padre')).status === 403 && (await demo('atlanta', 'paciente')).status === 403, 'un perfil que no existe en ese negocio → 403');
  ok((await demo('atlanta', 'director')).status === 200, 'el perfil «director» entra por /api/auth/demo sin contraseña');
  console.log('ERRORS', JSON.stringify(errs)); console.log(fails ? `${fails} FALLOS` : 'TODO OK'); await b.close(); process.exit(fails ? 1 : 0);
})().catch((e) => { console.log('CRASH', e.message.split('\n')[0]); process.exit(1); });
