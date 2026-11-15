// Modo sin conexión: la app abre sin red, se firma una práctica sin conexión, se envía sola al volver, no se duplica y un rechazo se conserva.
// Requiere: build en modo API servido por el servidor (TENANTS=1 + PROVISION_*), APP_URL=http://127.0.0.1:4017
const { chromium } = require('playwright');
const U = process.env.APP_URL || 'http://127.0.0.1:4017';
let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
const iso = (d) => d.toISOString().slice(0, 10);
(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1360, height: 900 } }); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  const login = async (page) => { await page.goto(U + '/acceso/atlanta'); await page.waitForSelector('#u'); await page.getByRole('group', { name: 'Entrar como' }).getByRole('button', { name: 'Director' }).click(); await page.locator('main h1').first().waitFor(); };
  await login(p); const dlg = p.locator('[role=dialog]');
  const go = async (r) => { await p.goto(U + r); await p.locator('main h1').first().waitFor(); await p.waitForTimeout(300); };
  const today = iso(new Date());
  const newPractice = async (start) => {
    await go('/practicas'); await p.getByRole('button', { name: /Apuntar práctica/ }).click();
    await dlg.getByLabel(/Alumno/).fill('a'); await dlg.locator('ul li button').first().click();
    await dlg.getByLabel('Día').fill(today); await dlg.getByLabel('Hora').fill(start);
    await dlg.getByLabel('Coche').selectOption({ index: 1 }); await dlg.getByRole('button', { name: /Guardar/ }).click(); await p.waitForSelector('text=Práctica apuntada'); await p.waitForTimeout(500);
  };
  const apiSnap = (page) => page.evaluate(async () => (await fetch('/api/snapshot', { credentials: 'include' })).json());
  const sign = async (name) => { const c = p.getByRole('img', { name }); const bb = await c.boundingBox(); await p.mouse.move(bb.x + 30, bb.y + 40); await p.mouse.down(); await p.mouse.move(bb.x + 120, bb.y + 90, { steps: 6 }); await p.mouse.move(bb.x + 200, bb.y + 50, { steps: 6 }); await p.mouse.up(); };
  const signFlow = async (start, km) => {
    await p.getByRole('button', { name: new RegExp(start) }).first().click(); await dlg.first().getByRole('button', { name: /Terminar y firmar/ }).click();
    await sign('Firma del alumno'); await p.getByRole('button', { name: 'Firmar', exact: true }).click(); await p.getByRole('button', { name: /Soy el profesor/ }).click();
    await sign('Firma del profesor'); await p.getByLabel(/Kilómetros de la práctica/).fill(String(km)); await p.getByRole('button', { name: /Guardar clase firmada/ }).click();
  };

  // 1) App instalable y service worker
  await go('/');
  ok(await p.evaluate(async () => { const r = await navigator.serviceWorker.ready; return !!r.active; }), 'service worker activo');
  ok((await (await p.request.get(U + '/manifest.webmanifest')).json()).display === 'standalone', 'manifiesto de la app');
  const pre = await (await p.request.get(U + '/precache.json')).json(); ok(Array.isArray(pre) && pre.length > 5 && pre.every((f) => f.startsWith('/assets/')), 'lista de caché generada al compilar');
  await newPractice('21:30'); await newPractice('21:50');
  await p.reload(); await p.locator('main h1').first().waitFor(); await p.waitForTimeout(800); // ya controlado por el SW

  // 2) Sin conexión: abre y muestra la última copia
  const before = await apiSnap(p); const veh0 = Object.fromEntries(before.vehicles.map((v) => [v.id, v.km]));
  await ctx.setOffline(true);
  await go('/practicas');
  ok(await p.getByText('Sin conexión.').count() === 1, 'sin red: la app abre y avisa «Sin conexión»');
  ok(await p.getByRole('button', { name: new RegExp('21:30') }).count() >= 1, 'sin red: se ven las prácticas guardadas');

  // 3) Firmar sin conexión
  await signFlow('21:30', 12);
  await p.waitForSelector('text=Firma guardada en este móvil'); ok(true, 'sin red: la firma se guarda en el móvil');
  ok(await p.getByText(/1 práctica firmada pendiente/).count() === 1, 'aviso de 1 cierre pendiente');
  ok(await p.getByText(/⟳ por enviar/).count() >= 1, 'la práctica se ve «por enviar»');
  await p.reload(); await p.locator('main h1').first().waitFor(); ok(await p.getByText(/1 práctica firmada pendiente/).count() === 1, 'el cierre pendiente sobrevive a recargar la página');

  // 4) Segundo cierre que otra persona cancelará mientras tanto
  await go('/practicas'); await signFlow('21:50', 5); await p.waitForSelector('text=Firma guardada en este móvil');
  const p2 = await (await b.newContext({ viewport: { width: 1360, height: 900 } })).newPage(); await login(p2);
  const s2 = await apiSnap(p2); const b2 = s2.practices.find((x) => x.start === '21:50' && x.date === today);
  const cancelRes = await p2.evaluate(async (id) => (await fetch('/api/rpc/cancelPractice', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'edith' }, body: JSON.stringify({ args: [id] }) })).status, b2.id);
  ok(cancelRes === 200, 'otra persona cancela la práctica de las 21:50 mientras tanto');

  // 5) Vuelve la red: se envía solo
  await ctx.setOffline(false); await p.evaluate(() => window.dispatchEvent(new Event('online')));
  await p.waitForSelector('text=No se pudo enviar', { timeout: 20000 }); ok(true, 'el cierre rechazado se conserva con aviso (Reintentar / Descartar)');
  await p.waitForFunction(() => !document.body.innerText.includes('Sin conexión.'), null, { timeout: 15000 });
  const after = await apiSnap(p2); const a1 = after.practices.find((x) => x.start === '21:30' && x.date === today);
  ok(a1.status === 'hecha' && a1.km === 12 && a1.signed === true && !!a1.signedAt, 'el cierre de las 21:30 llegó al servidor (km 12, firmado, hora real de firma)');
  const vehId = a1.vehicleId; const dKm = after.vehicles.find((v) => v.id === vehId).km - veh0[vehId]; ok(dKm === 12, `el coche sumó 12 km (suma ${dKm})`);

  // 6) Idempotencia: repetir el mismo cierre no duplica
  const rep = await p2.evaluate(async ([id, opId]) => (await fetch('/api/rpc/completePractice', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'edith' }, body: JSON.stringify({ args: [id, { km: 12, studentSig: 'data:image/png;base64,AAAA', teacherSig: 'data:image/png;base64,AAAA', opId }] }) })).status, [a1.id, a1.closureId]);
  const again = await apiSnap(p2); const dKm2 = again.vehicles.find((v) => v.id === vehId).km - veh0[vehId];
  ok(rep === 200 && dKm2 === 12, `repetir el mismo cierre no duplica los km (${dKm2})`);

  // 7) Descartar el rechazado
  await p.getByRole('button', { name: 'Descartar' }).click(); await p.waitForTimeout(500); ok(await p.getByText('No se pudo enviar').count() === 0, 'descartar quita el aviso');
  await p.screenshot({ path: (process.env.SHOT_DIR || '/tmp') + '/offline-final.png' });
  ok(await p.getByText(/pendiente/).count() === 0, 'sin pendientes tras sincronizar');

  console.log('ERRORS', JSON.stringify(errs)); console.log(fails ? `${fails} FALLOS` : 'TODO OK'); await b.close(); process.exit(fails ? 1 : 0);
})().catch((e) => { console.log('CRASH', e.message.split('\n').slice(0, 4).join(' | ')); process.exit(1); });
