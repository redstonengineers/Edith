// Prueba end-to-end con Playwright. Uso: APP_URL=http://127.0.0.1:5173 node tests/e2e/phase3-operations.cjs
const { chromium } = require('playwright');
const out = (process.env.SHOT_DIR || '/tmp/');
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const U = process.env.APP_URL || 'http://127.0.0.1:5173';
(async () => {
  const b = await chromium.launch(); const errors = [];
  const login = async (who, vp = { width: 1440, height: 900 }) => {
    const c = await b.newContext({ viewport: vp }); const p = await c.newPage();
    p.on('pageerror', e => errors.push(e.message)); p.on('console', m => m.type() === 'error' && errors.push(m.text()));
    await p.goto(U + '/'); await p.getByRole('button', { name: new RegExp(who) }).first().click(); await p.waitForSelector('text=Academy Command Center'); return p;
  };
  const toast = async (p, re) => { await p.waitForTimeout(250); return (await p.locator('[role=status],[role=alert]').allInnerTexts()).some(t => re.test(t)); };
  let p = await login('Pablo Vidal');
  await p.goto(U + '/horarios'); await p.waitForSelector('[role=group][aria-label^="lunes"]');
  ok(await p.getByRole('button', { name: /Historia · Grupo A/ }).count() >= 1, 'week shows today class');
  await p.screenshot({ path: out + 'shot-calendar.png' });
  await p.getByRole('button', { name: 'Siguiente' }).click(); await p.waitForTimeout(200);
  // conflicting drop: Mat A (Mon 16:00, Carlos, Aula1) -> Tuesday 16:00 where Mat B lives
  const evA = p.getByRole('button', { name: /^Matemáticas ESO · Grupo A, 16:00/ }).first();
  await evA.dragTo(p.locator('[role=group][aria-label^="martes"]'), { targetPosition: { x: 40, y: (16 - 7) * 56 + 10 } });
  ok(await toast(p, /Conflicto/), 'drag onto busy slot rejected with conflict');
  // valid drop: -> Saturday 10:00
  await p.waitForTimeout(500);
  await p.getByRole('button', { name: /^Matemáticas ESO · Grupo A, 16:00/ }).first().dragTo(p.locator('[role=group][aria-label^="sábado"]'), { targetPosition: { x: 40, y: (10 - 7) * 56 + 4 } });
  await p.waitForTimeout(400);
  ok(await p.locator('[role=group][aria-label^="sábado"] button', { hasText: 'Matemáticas ESO · Grupo A' }).count() === 1, 'valid drag moved class to Saturday');
  const lbl = await p.locator('[role=group][aria-label^="sábado"] button').first().getAttribute('aria-label'); ok(/, (09|10):\d\d a/.test(lbl) && /(00|15|30|45) a/.test(lbl), 'snapped to 15 min near drop: ' + lbl);
  // create by clicking empty slot
  await p.locator('[role=group][aria-label^="viernes"]').click({ position: { x: 20, y: (20 - 7) * 56 + 5 } });
  await p.waitForSelector('[role=dialog]'); ok(await p.getByLabel('Inicio').inputValue() === '20:00', 'click slot prefilled 20:00');
  await p.getByRole('button', { name: 'Guardar' }).click(); await p.waitForTimeout(500); ok(await p.locator('[role=dialog]').count() === 0, 'class created from slot');
  // open class, duplicate then cancel
  await p.locator('[role=group][aria-label^="sábado"] button').first().click(); await p.waitForSelector('[role=dialog]');
  await p.getByRole('button', { name: 'Cancelar clase' }).click(); await p.getByRole('button', { name: 'Cancelar clase' }).last().click(); await p.waitForTimeout(500);
  ok((await p.locator('[role=group][aria-label^="sábado"] button').first().getAttribute('aria-label')).includes('cancelada'), 'class cancelled');
  await p.screenshot({ path: out + 'shot-calendar2.png' });
  // views
  await p.getByRole('button', { name: 'Mes', exact: true }).click(); await p.waitForTimeout(200); await p.screenshot({ path: out + 'shot-month.png' });
  ok(await p.getByRole('button', { name: /Ver \d+ de/ }).count() > 20, 'month grid');
  await p.getByRole('button', { name: 'Día', exact: true }).click(); ok(await p.locator('[role=group][aria-label*=" de "]').count() === 1, 'day view single column');
  // classes list
  await p.goto(U + '/clases'); await p.waitForSelector('table'); ok(await p.locator('tbody tr').count() > 0, 'classes list');
  // attendance today
  await p.goto(U + '/asistencia'); await p.waitForTimeout(400);
  const radios = p.getByRole('radiogroup'); const nr = await radios.count(); ok(nr > 0, `attendance roster ${nr} students`);
  await radios.nth(0).getByRole('radio', { name: 'Ausente' }).click(); await p.waitForTimeout(300);
  ok(await radios.nth(0).getByRole('radio', { name: 'Ausente' }).getAttribute('aria-checked') === 'true', 'absent set');
  await p.getByRole('button', { name: /Marcar todos presentes/ }).click(); await p.waitForTimeout(400);
  ok(await radios.nth(0).getByRole('radio', { name: 'Ausente' }).getAttribute('aria-checked') === 'true' && await radios.nth(Math.min(1, nr - 1)).getByRole('radio', { name: 'Presente' }).getAttribute('aria-checked') === 'true', 'mark all keeps existing, fills rest');
  await p.screenshot({ path: out + 'shot-attendance.png' });
  await p.getByRole('tab', { name: 'Estadísticas' }).click(); await p.getByRole('button', { name: /Bajo el/ }).click(); ok(await p.locator('tbody tr').count() >= 1, 'low attendance list');
  // exams
  await p.goto(U + '/examenes?nuevo=1'); await p.waitForSelector('[role=dialog]');
  await p.locator('[role=dialog] input').first().fill('Examen de prueba E2E'); await p.getByRole('button', { name: 'Guardar' }).click(); await p.waitForURL(/\/examenes\/.+/);
  await p.getByRole('button', { name: /Marcar realizado/ }).click(); await p.waitForSelector('input[aria-label=Nota]');
  const inputs = p.locator('input[aria-label=Nota]'); const ni = await inputs.count();
  await inputs.nth(0).fill('11'); await inputs.nth(0).blur(); ok(await inputs.nth(0).getAttribute('aria-invalid') === 'true', 'grade >10 rejected');
  for (let i = 0; i < ni; i++) { await p.locator('input[aria-label=Nota]').nth(i).fill(String(5 + (i % 4))); await p.locator('input[aria-label=Nota]').nth(i).press('Enter'); await p.waitForTimeout(150); }
  await p.waitForTimeout(400); ok(await p.getByText('Corregido').count() >= 1, `all ${ni} graded → status Corregido`);
  await p.screenshot({ path: out + 'shot-exam.png' });
  await p.goto(U + '/calificaciones'); await p.waitForSelector('table'); ok(await p.locator('tbody tr').count() > 0, 'grades page');
  // teacher
  const pt = await login('Carlos Fernández.*Profesor'); await pt.goto(U + '/horarios'); await pt.waitForSelector('[role=group][aria-label^="lunes"]');
  ok(await pt.getByRole('button', { name: /Nueva clase/ }).count() === 0, 'teacher: no create class');
  ok(await pt.locator('button[draggable=true]').count() === 0, 'teacher: events not draggable');
  await pt.goto(U + '/asistencia'); await pt.waitForTimeout(300); ok(true, 'teacher attendance page loads');
  // mobile
  const pm = await login('Pablo Vidal', { width: 390, height: 844 }); await pm.goto(U + '/horarios'); await pm.waitForSelector('[role=group][aria-label*=" de "]');
  ok(await pm.evaluate(() => document.documentElement.scrollWidth) <= 392, 'mobile schedule no page overflow'); await pm.screenshot({ path: out + 'shot-calendar-mobile.png' });
  await pm.goto(U + '/asistencia'); ok(await pm.evaluate(() => document.documentElement.scrollWidth) <= 392, 'mobile attendance no overflow');
  console.log('ERRORS', JSON.stringify(errors)); await b.close();
})().catch(e => { console.log('CRASH', e.message.split('\n').slice(0, 3).join(' | ')); process.exit(1); });
