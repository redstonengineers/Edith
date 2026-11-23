// Prueba end-to-end con Playwright. Uso: APP_URL=http://127.0.0.1:5173 node tests/e2e/phase6-ai.cjs
const { chromium } = require('playwright'); const { mockLogin } = require('./acceso-lib.cjs'); const out = (process.env.SHOT_DIR || '/tmp/'); const U = process.env.APP_URL || 'http://127.0.0.1:5173';
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const errors = [];
  const login = async (who) => { const c = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await c.newPage(); p.on('pageerror', e => errors.push(e.message)); p.on('console', m => m.type() === 'error' && errors.push(m.text())); await mockLogin(p, U, who); return p; };
  const ask = async (p, q) => { const n = await p.locator('.anim-rise').count(); await p.locator('#ai-q').fill(q); await p.locator('#ai-q').press('Enter'); await p.waitForFunction((n) => document.querySelectorAll('.anim-rise').length >= n + 2, n); await p.waitForTimeout(150); return p.locator('.anim-rise').last().innerText(); };
  let p = await login('Pablo Vidal'); await p.goto(U + '/jarvis'); await p.waitForSelector('#ai-q');
  const tests = [['¿Cuántos alumnos tenemos?', /activos/], ['¿Qué grupos están completos?', /completos/], ['¿Cuánto dinero está pendiente de cobrar?', /Pendiente de cobro/], ['¿Qué alumnos tienen baja asistencia?', /asistencia inferior|por debajo/], ['¿Qué profesores tienen más horas esta semana?', /horas/], ['¿Qué alumnos están en lista de espera?', /lista de espera/], ['dime sobre María García', /María García/], ['¿Qué debería revisar hoy?', /requieren atención|en orden/], ['blablabla xyz', /No he encontrado/]];
  for (const [q, re] of tests) { const a = await ask(p, q); ok(re.test(a), `"${q}" → ${a.replace(/\n/g, ' ').slice(0, 70)}`); }
  await p.screenshot({ path: out + 'shot-jarvis.png' });
  await p.reload(); await p.waitForSelector('#ai-q'); await p.waitForTimeout(300); ok(await p.getByText('blablabla xyz').count() === 1, 'history persists after reload');
  // drawer
  await p.goto(U + '/'); await p.getByRole('button', { name: 'Asistente' }).click(); await p.waitForSelector('[role=dialog] #ai-q'); ok(await p.locator('[role=dialog]').getByText('blablabla xyz').count() === 1, 'panel shares history');
  const pt = await login('Carlos Fernández.*Profesor'); await pt.goto(U + '/jarvis'); await pt.waitForSelector('#ai-q');
  ok(/no tiene acceso/.test(await ask(pt, '¿Cuánto dinero está pendiente de cobrar?')), 'teacher refused on payments'); ok(await pt.getByText('blablabla xyz').count() === 0, 'history isolated per user');
  ok(!/Pagos y morosidad/.test(await pt.locator('main').innerText()), 'teacher scope list hides payments');
  console.log('ERRORS', JSON.stringify(errors)); await b.close();
})().catch(e => { console.log('CRASH', e.message.split('\n').slice(0, 3).join(' | ')); process.exit(1); });
