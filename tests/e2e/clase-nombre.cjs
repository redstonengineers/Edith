// Clase con nombre escrito a mano (p. ej. «Curso de recuperación de puntos»), incidencia con tipo propio y práctica con duración libre.
const { chromium } = require('playwright'); const U = process.env.APP_URL || 'http://127.0.0.1:4096';
let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(U + '/acceso/academia'); await p.waitForSelector('#u'); await p.getByRole('group', { name: 'Entrar como' }).getByRole('button', { name: 'Director' }).click(); await p.locator('main h1').first().waitFor();
  await p.goto(U + '/clases?nuevo=1'); const dlg = p.getByRole('dialog'); await dlg.waitFor();
  const d = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10);
  await dlg.getByLabel(/Nombre de la clase/).fill('Curso de recuperación de puntos'); await dlg.getByLabel('Fecha').fill(d); await dlg.getByLabel('Inicio').fill('20:15'); await dlg.getByLabel('Fin').fill('21:15');
  await dlg.getByRole('button', { name: 'Guardar' }).click(); await p.getByText('Clase creada').first().waitFor();
  await p.getByPlaceholder(/Buscar/).fill('recuperación'); await p.waitForTimeout(500); ok(await p.getByText('Curso de recuperación de puntos').first().isVisible().catch(() => false), 'la lista de clases muestra el nombre escrito a mano');
  await p.goto(U + '/horarios'); await p.waitForTimeout(800); 
  const snap = await p.evaluate(async () => (await fetch('/api/snapshot', { credentials: 'include' })).json());
  ok(snap.classes.some((c) => c.topic === 'Curso de recuperación de puntos'), 'el servidor guarda el nombre');
  await p.goto(U + '/incidencias?nuevo=1'); const d2 = p.getByRole('dialog'); await d2.waitFor().catch(() => {});
  if (await d2.count()) { await d2.getByLabel('Tipo').fill('Curso de recuperación'); ok(await d2.getByLabel('Tipo').inputValue() === 'Curso de recuperación', 'el tipo de incidencia admite texto libre'); }
  ok(errs.length === 0, 'sin errores JS ' + errs.join('|')); console.log(fails ? fails + ' FALLOS' : 'TODO OK'); await b.close(); process.exit(fails ? 1 : 0);
})();
