// Prueba end-to-end con Playwright. Uso: APP_URL=http://127.0.0.1:5173 node tests/e2e/phase5-analytics.cjs
const { chromium } = require('playwright'); const { mockLogin } = require('./acceso-lib.cjs'); const out = (process.env.SHOT_DIR || '/tmp/'); const U = process.env.APP_URL || 'http://127.0.0.1:5173';
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const errors = [];
  const login = async (who, vp = { width: 1440, height: 900 }) => { const c = await b.newContext({ viewport: vp, acceptDownloads: true }); const p = await c.newPage(); p.on('pageerror', e => errors.push(e.message)); p.on('console', m => m.type() === 'error' && errors.push(m.text())); await mockLogin(p, U, who); return p; };
  let p = await login('Pablo Vidal');
  await p.goto(U + '/estadisticas'); await p.waitForSelector('svg[role=img]'); await p.waitForTimeout(500);
  ok(await p.locator('svg[role=img]').count() >= 4, 'charts rendered');
  await p.screenshot({ path: out + 'shot-stats.png', fullPage: true });
  const alt = await p.getByLabel(/Altas y bajas por mes/).first(); const box = await p.locator('svg[aria-label="Altas y bajas por mes"]').boundingBox();
  await p.mouse.move(box.x + box.width * 0.9, box.y + box.height / 2); await p.waitForTimeout(200); ok(await p.locator('[role=status]', { hasText: 'Altas' }).count() >= 1, 'hover tooltip shows series values');
  await p.getByRole('button', { name: 'Ver tabla' }).first().click(); ok(await p.locator('table').count() === 1, 'table view toggle');
  await p.goto(U + '/informes'); await p.waitForSelector('table');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: 'Exportar CSV' }).click()]); const txt = require('fs').readFileSync(await dl.path(), 'utf8'); ok(txt.includes('Nombre;Edad') && txt.split('\n').length > 5, 'CSV export content');
  await p.getByRole('button', { name: /Morosidad/ }).click(); await p.waitForTimeout(200); ok(await p.locator('tbody tr').count() > 0, 'debt report rows');
  const pa = await login('Beatriz Quintana'); await pa.goto(U + '/estadisticas'); await pa.waitForSelector('svg[role=img]'); ok(await pa.getByText('Estadísticas').count() >= 1, 'atlas stats renders'); await pa.screenshot({ path: out + 'shot-stats-atlas.png' });
  const pm = await login('Pablo Vidal', { width: 390, height: 844 }); await pm.goto(U + '/estadisticas'); await pm.waitForSelector('svg[role=img]'); await pm.waitForTimeout(400); ok(await pm.evaluate(() => document.documentElement.scrollWidth) <= 392, 'mobile stats no overflow'); await pm.screenshot({ path: out + 'shot-stats-mobile.png' });
  console.log('ERRORS', JSON.stringify(errors)); await b.close();
})().catch(e => { console.log('CRASH', e.message.split('\n').slice(0, 3).join(' | ')); process.exit(1); });
