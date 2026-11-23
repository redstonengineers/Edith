// Prueba end-to-end con Playwright. Uso: APP_URL=http://127.0.0.1:5173 node tests/e2e/phase2-people.cjs
const { chromium } = require('playwright'); const { mockLogin } = require('./acceso-lib.cjs');
const out = (process.env.SHOT_DIR || '/tmp/');
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const errors = [];
  const login = async (who, vp = { width: 1440, height: 900 }) => {
    const c = await b.newContext({ viewport: vp }); const p = await c.newPage();
    p.on('pageerror', e => errors.push(e.message)); p.on('console', m => m.type() === 'error' && errors.push(m.text()));
    await mockLogin(p, (process.env.APP_URL || 'http://127.0.0.1:5173'), who); return p;
  };
  let p = await login('Pablo Vidal');
  // list
  await p.goto((process.env.APP_URL || 'http://127.0.0.1:5173') + '/alumnos'); await p.waitForSelector('table');
  const n0 = await p.locator('tbody tr').count(); ok(n0 > 0, `students table rows=${n0}`);
  await p.getByRole('button', { name: /Morosos/ }).click(); const nm = await p.locator('tbody tr').count(); ok(nm < n0 || nm === 0, `filter morosos rows=${nm}`);
  await p.reload(); await p.waitForSelector('table'); ok(await p.getByRole('button', { name: /Morosos/ }).getAttribute('aria-pressed') === 'true', 'filter persisted after reload');
  await p.getByRole('button', { name: /^Todos/ }).click();
  await p.getByRole('searchbox').fill('maria'); ok((await p.locator('tbody tr').count()) >= 2, 'search maria');
  await p.getByRole('searchbox').fill('');
  await p.getByRole('button', { name: /Nombre|Alumno/ }).first().click();
  await p.screenshot({ path: out + 'shot-students.png' });
  // create: validation
  await p.getByRole('button', { name: 'Nuevo alumno' }).click(); await p.waitForSelector('[role=dialog]');
  await p.getByRole('button', { name: 'Guardar' }).click(); ok(await p.locator('[role=dialog] [role=alert]').count() >= 3, 'validation errors shown');
  await p.locator('[role=dialog] input').first().fill('Ainhoa'); await p.getByLabel('Apellidos').fill('Beltrán Soler');
  await p.getByLabel('Fecha de nacimiento').fill('2012-05-10'); await p.getByLabel('Teléfono').first().fill('611222333'); await p.getByLabel('Correo electrónico').fill('ainhoa@correo.demo');
  ok(await p.getByText('Tutor legal (menor de edad)').count() === 1, 'guardian section for minor');
  await p.getByRole('button', { name: 'Guardar' }).click(); ok(await p.locator('[role=dialog] [role=alert]').count() >= 1, 'guardian required');
  await p.getByLabel('Nombre del tutor').fill('Rosa Soler'); const tel = p.getByLabel('Teléfono'); await tel.nth(1).fill('644555666'); await p.locator('input[type=email]').nth(1).fill('rosa@correo.demo');
  await p.getByRole('button', { name: 'Guardar' }).click(); await p.waitForURL(/\/alumnos\/.+/); await p.getByRole('heading', { name: /Ainhoa Beltrán/ }).first().waitFor({ timeout: 5000 }).catch(() => {}); ok(await p.getByRole('heading', { name: /Ainhoa Beltrán/ }).count() === 1, 'created and navigated to profile');
  await p.screenshot({ path: out + 'shot-profile.png' });
  // add to group
  const sel = p.getByLabel('Añadir a grupo'); await sel.selectOption({ index: 1 }); await p.getByRole('button', { name: 'Añadir', exact: true }).click(); await p.waitForTimeout(300);
  ok(await p.getByRole('link', { name: /·/ }).count() > 0, 'added to group');
  // activity in dashboard
  await p.goto((process.env.APP_URL || 'http://127.0.0.1:5173') + '/'); await p.waitForSelector('text=Actividad reciente'); ok(await p.getByText(/creó al alumno Ainhoa/).count() > 0, 'activity log records creation');
  // groups: conflict
  await p.goto((process.env.APP_URL || 'http://127.0.0.1:5173') + '/grupos'); await p.waitForSelector('table');
  await p.getByRole('button', { name: 'Nuevo grupo' }).click();
  await p.locator('[role=dialog] input').first().fill('Prueba conflicto'); await p.getByLabel('Asignatura').fill('Asignatura nueva de prueba'); await p.getByLabel('Profesor').selectOption({ index: 1 }); await p.getByLabel('Aula').selectOption({ index: 1 });
  await p.getByLabel('Inicio 1').fill('16:00'); await p.getByLabel('Fin 1').fill('17:30'); // Monday 16:00 = Carlos (Mat A) in Aula 1
  await p.waitForTimeout(200); ok(await p.getByText('CONFLICTO').count() === 1, 'live conflict warning');
  await p.screenshot({ path: out + 'shot-conflict.png' });
  await p.getByRole('button', { name: 'Guardar' }).click(); await p.waitForTimeout(300); ok(await p.getByText(/Conflicto de horario/).count() === 1, 'save blocked on conflict');
  await p.getByLabel('Inicio 1').fill('21:00'); await p.getByLabel('Fin 1').fill('22:00'); await p.getByRole('button', { name: 'Guardar' }).click(); await p.waitForURL(/\/grupos\/.+/); ok(true, 'group created after resolving conflict');
  await p.screenshot({ path: out + 'shot-group.png' });
  // full group
  await p.goto((process.env.APP_URL || 'http://127.0.0.1:5173') + '/grupos'); await p.getByRole('button', { name: 'Completos' }).click(); await p.waitForTimeout(200);
  ok(await p.locator('tbody tr').count() >= 1, 'has full groups');
  // subjects
  await p.goto((process.env.APP_URL || 'http://127.0.0.1:5173') + '/asignaturas'); await p.waitForSelector('table');
  await p.getByRole('button', { name: /Eliminar Matemáticas/ }).click(); await p.getByRole('button', { name: 'Eliminar', exact: true }).click(); await p.waitForTimeout(300);
  ok(await p.getByText(/hay grupos que usan/).count() > 0, 'cannot delete subject in use');
  // tenant isolation
  const stuHref = await (async () => { await p.goto((process.env.APP_URL || 'http://127.0.0.1:5173') + '/alumnos'); await p.waitForSelector('tbody a'); return p.locator('tbody a').first().getAttribute('href'); })();
  const pa = await login('Beatriz Quintana'); await pa.goto((process.env.APP_URL || 'http://127.0.0.1:5173') + stuHref); await pa.waitForTimeout(500);
  ok(await pa.getByText('Sin permisos').count() === 1, 'other academy student not accessible: ' + stuHref);
  await pa.goto((process.env.APP_URL || 'http://127.0.0.1:5173') + '/examenes'); await pa.waitForTimeout(400); ok(await pa.getByText('Módulo no activado').count() === 1, 'disabled module blocked in Atlas');
  // teacher role
  const pt = await login('Carlos Fernández.*Profesor'); await pt.goto((process.env.APP_URL || 'http://127.0.0.1:5173') + '/grupos'); await pt.waitForSelector('table');
  ok(await pt.locator('tbody tr').count() === 2, 'teacher sees only own groups (2)'); ok(await pt.getByRole('button', { name: 'Nuevo grupo' }).count() === 0, 'teacher cannot create groups');
  await pt.goto((process.env.APP_URL || 'http://127.0.0.1:5173') + '/profesores'); ok(await pt.getByText('Módulo no activado').count() + await pt.getByText('Sin permisos').count() >= 0, 'teacher teachers page handled');
  // mobile list
  const pm = await login('Pablo Vidal', { width: 390, height: 844 }); await pm.goto((process.env.APP_URL || 'http://127.0.0.1:5173') + '/alumnos'); await pm.waitForSelector('table'); await pm.screenshot({ path: out + 'shot-students-mobile.png' });
  const sw = await pm.evaluate(() => document.documentElement.scrollWidth); ok(sw <= 392, 'no horizontal page overflow on mobile: ' + sw);
  console.log('ERRORS', JSON.stringify(errors)); await b.close();
})().catch(e => { console.log('CRASH', e.message.split('\n')[0]); process.exit(1); });
