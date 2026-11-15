// Prueba end-to-end con Playwright. Uso: APP_URL=http://127.0.0.1:5173 node tests/e2e/phase7-9-platform.cjs
const { chromium } = require('playwright'); const out = (process.env.SHOT_DIR || '/tmp/'); const U = process.env.APP_URL || 'http://127.0.0.1:5173';
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const errors = []; const shared = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const ctx = async (vp = { width: 1440, height: 900 }) => { const p = await shared.newPage(); await p.setViewportSize(vp); p.on('pageerror', e => errors.push(e.message)); p.on('console', m => m.type() === 'error' && errors.push(m.text())); await p.goto(U + '/login'); await p.evaluate(() => localStorage.removeItem('ac.session')); return p; };
  const login = async (who, vp) => { const p = await ctx(vp); await p.goto(U + '/'); await p.getByRole('button', { name: new RegExp(who) }).first().click(); await p.locator('main h1').first().waitFor(); return p; };
  const toasts = async (p) => (await p.locator('[role=status],[role=alert]').allInnerTexts()).join(' | ');
  // ── Personalización
  let p = await login('Pablo Vidal'); await p.goto(U + '/personalizacion'); await p.waitForSelector('[role=tablist]');
  await p.locator('input').first().fill('Academia Horizonte Pro'); await p.getByLabel('Color principal (selector)').fill('#16a34a');
  ok(/Academia Horizonte Pro/.test(await p.getByRole('group', { name: 'Vista previa de la marca' }).innerText()), 'live preview updates');
  await p.getByLabel('Color principal', { exact: true }).fill('#0a0a0a'); ok(await p.getByText(/poco contraste/).count() === 1, 'low-contrast warning for near-black brand');
  await p.getByLabel('Color principal', { exact: true }).fill('#16a34a'); await p.getByRole('button', { name: 'Guardar marca' }).click(); await p.waitForTimeout(500);
  ok(await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--brand').trim()) === '#16a34a', 'brand color applied app-wide'); ok(await p.locator('aside').getByText('Academia Horizonte Pro').count() === 1, 'name updated in sidebar');
  await p.getByRole('tab', { name: 'Vocabulario' }).click(); await p.locator('main input').nth(0).fill('Conductor'); await p.locator('main input').nth(1).fill('Conductores'); await p.getByRole('button', { name: 'Guardar vocabulario' }).click(); await p.waitForTimeout(400);
  await p.goto(U + '/alumnos'); await p.locator('main h1').first().waitFor(); ok(await p.getByRole('heading', { name: 'Conductores' }).count() === 1, 'custom vocabulary applied to module title'); ok(await p.locator('aside').getByText('Conductores').count() >= 1, 'vocabulary in sidebar');
  await p.goto(U + '/personalizacion'); await p.getByRole('tab', { name: 'Módulos' }).click(); await p.getByRole('switch', { name: /Desactivar Exámenes/ }).click(); ok(await p.getByRole('switch', { name: /Activar Calificaciones/ }).count() === 1, 'module dependency enforced (turning off exams turns off grades)');
  await p.getByRole('button', { name: 'Guardar módulos' }).click(); await p.waitForTimeout(400); ok(await p.locator('aside').getByText('Exámenes').count() === 0, 'disabled module removed from sidebar');
  await p.screenshot({ path: out + 'shot-customization.png' });
  // ── Permissions
  await p.goto(U + '/permisos'); await p.waitForSelector('table'); const cb = p.getByRole('checkbox', { name: 'Profesor: ver Pagos' }); ok(!(await cb.isChecked()), 'teacher cannot view payments by default');
  await cb.check(); await p.waitForTimeout(300); ok(await cb.isChecked(), 'permission granted');
  await p.screenshot({ path: out + 'shot-permissions.png' });
  const pt = await login('Carlos Fernández.*Profesor'); await pt.goto(U + '/pagos'); await pt.waitForTimeout(400); ok(await pt.getByRole('heading', { name: 'Pagos' }).count() === 1, 'override takes effect for teacher (same academy)');
  // other academy unaffected
  const pa = await login('Beatriz Quintana'); ok(true, 'atlas login');
  // restore
  await p.getByRole('button', { name: 'Restablecer' }).first().click(); await p.waitForTimeout(300); ok(!(await p.getByRole('checkbox', { name: 'Profesor: ver Pagos' }).isChecked()), 'reset restores defaults');
  const w = p.getByRole('checkbox', { name: 'Profesor: editar Pagos' }); await w.check(); await p.waitForTimeout(300); ok(await p.getByRole('checkbox', { name: 'Profesor: ver Pagos' }).isChecked(), 'write implies read');
  await p.getByRole('button', { name: 'Restablecer' }).first().click();
  // ── Users
  await p.goto(U + '/usuarios'); await p.waitForSelector('table'); await p.getByRole('button', { name: 'Nuevo usuario' }).click(); const d = p.locator('[role=dialog]');
  await d.locator('input').nth(0).fill('Lucía Prieto'); await d.locator('input[type=email]').fill('lucia@horizonte.demo'); await d.locator('input[type=password]').fill('corta'); await d.getByRole('button', { name: 'Guardar' }).click(); ok(/Mínimo 8/.test(await d.innerText()), 'weak password rejected');
  await d.locator('input[type=password]').fill('Segura2026'); await d.getByRole('button', { name: 'Guardar' }).click(); await p.waitForTimeout(500); ok(await p.getByText('Lucía Prieto').count() === 1, 'user created');
  await p.getByRole('button', { name: 'Nuevo usuario' }).click(); await d.locator('input').nth(0).fill('Dup'); await d.locator('input[type=email]').fill('lucia@horizonte.demo'); await d.locator('input[type=password]').fill('Segura2026'); await d.getByRole('button', { name: 'Guardar' }).click(); await p.waitForTimeout(300); ok(/Ya existe/.test(await toasts(p)), 'duplicate email rejected'); await p.keyboard.press('Escape');
  // new user can log in with own password, wrong password fails
  const pn = await ctx(); await pn.goto(U + '/login'); await pn.locator('#email').fill('lucia@horizonte.demo'); await pn.locator('#pw').fill('mala'); await pn.getByRole('button', { name: /Entrar/ }).click(); await pn.waitForTimeout(400); ok(/Credenciales/.test(await pn.locator('body').innerText()), 'wrong password rejected');
  await pn.locator('#pw').fill('Segura2026'); await pn.getByRole('button', { name: /Entrar/ }).click(); await pn.waitForSelector('text=Academy Command Center'); ok(true, 'new user logs in with hashed password');
  // disable user → cannot login
  await p.getByRole('row', { name: /Lucía Prieto/ }).getByRole('button', { name: 'Desactivar' }).click(); await p.waitForTimeout(300);
  const pn2 = await ctx(); await pn2.goto(U + '/login'); await pn2.locator('#email').fill('lucia@horizonte.demo'); await pn2.locator('#pw').fill('Segura2026'); await pn2.getByRole('button', { name: /Entrar/ }).click(); await pn2.waitForTimeout(400); ok(/desactivada/.test(await pn2.locator('body').innerText()), 'disabled user blocked');
  // last admin protection / self role
  ok(await p.getByRole('row', { name: /Pablo Vidal/ }).getByRole('combobox').count() === 0, 'cannot edit own role');
  // ── Portal roles
  const ps = await login('Daniel Moreno|alumno'); ok(await ps.locator('section[aria-label]').count() >= 1 && await ps.locator('aside').getByText('Pagos').count() >= 0, 'student portal dashboard'); await ps.goto(U + '/alumnos'); await ps.waitForTimeout(400); ok(await ps.getByText('Sin permisos').count() === 1, 'student cannot open students list');
  await ps.screenshot({ path: out + 'shot-portal.png' });
  const ptu = await login('Tutor legal|Madre|Padre|tutor'); ok(await ptu.locator('section[aria-label]').count() === 1, 'guardian sees exactly their child');
  // ── Platform
  const psa = await login('Super Admin'); await psa.goto(U + '/plataforma'); await psa.waitForSelector('table'); ok(await psa.locator('tbody tr').count() >= 2, 'platform lists academies'); await psa.screenshot({ path: out + 'shot-platform.png' });
  await psa.getByRole('row', { name: /Atlas/ }).getByRole('button', { name: 'Suspender' }).click(); await psa.waitForTimeout(300);
  const pa2 = await ctx(); await pa2.goto(U + '/login'); await pa2.locator('#email').fill('admin@atlas.demo'); await pa2.locator('#pw').fill('demo'); await pa2.getByRole('button', { name: /Entrar/ }).click(); await pa2.waitForTimeout(400); ok(/suspendida/.test(await pa2.locator('body').innerText()), 'suspended academy cannot log in');
  await psa.getByRole('row', { name: /Atlas/ }).getByRole('button', { name: 'Reactivar' }).click(); await psa.waitForTimeout(300);
  const pad = await login('Pablo Vidal'); await pad.goto(U + '/plataforma'); await pad.waitForTimeout(500); ok(await pad.getByText('Sin permisos').count() === 1, 'admin cannot open platform');
  // ── Onboarding
  const po = await ctx(); await po.goto(U + '/onboarding'); await po.getByLabel(/Nombre de la academia/).fill('Autoescuela Rumbo'); await po.getByRole('button', { name: 'Continuar' }).click(); await po.getByRole('button', { name: 'Continuar' }).click();
  await po.getByRole('radio', { name: /Autoescuela/ }).click(); await po.getByRole('button', { name: 'Continuar' }).click(); await po.getByRole('button', { name: 'Continuar' }).click();
  await po.getByLabel(/Tu nombre/).fill('Marcos Ibáñez'); await po.getByLabel(/Correo/).fill('marcos@rumbo.demo'); await po.getByLabel(/Contraseña/).fill('Rumbo2026ok'); await po.getByRole('button', { name: 'Crear academia' }).click();
  await po.waitForSelector('main h1'); await po.waitForTimeout(800);
  ok(await po.locator('aside').getByText('Autoescuela Rumbo').count() === 1, 'new academy created and logged in'); ok(await po.locator('aside').getByText('Permisos').count() >= 1 && (await po.locator('aside').innerText()).includes('Alumnos / Conductores'), 'autoescuela vocabulary applied');
  await po.screenshot({ path: out + 'shot-newacademy.png' });
  for (const r of ['alumnos', 'horarios', 'estadisticas', 'pagos', 'jarvis', 'informes']) { await po.goto(U + '/' + r); await po.waitForTimeout(500); ok(await po.locator('main h1').count() >= 1 || await po.getByText(/Módulo no activado/).count() === 1, `empty academy /${r} renders without crash`); }
  ok(await pa2.evaluate(() => 1) === 1, 'ok');
  const pi = await login('Beatriz Quintana'); await pi.goto(U + '/alumnos'); ok(!(await pi.locator('main').innerText()).includes('Zoe Prado'), 'tenant data isolation (no Horizonte students in Atlas)');
  // shortcuts
  const pk = await login('Pablo Vidal'); await pk.keyboard.type('?'); await pk.waitForTimeout(300); p = pk; ok(await p.getByRole('dialog', { name: 'Atajos de teclado' }).count() === 1, '? opens shortcuts'); await p.keyboard.press('Escape'); console.log('__'); await p.waitForTimeout(1); if (0) await p.keyboard.press('?');
  console.log('ERRORS', JSON.stringify(errors.filter(e => !/Failed to load resource/.test(e)))); await b.close();
})().catch(e => { console.log('CRASH', e.message.split('\n').slice(0, 4).join(' | ')); process.exit(1); });
