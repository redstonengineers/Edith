// Registro de accesos: quién abre fichas, exporta CSV o abre informes; solo lo ve el administrador del negocio y se filtra por usuario y fecha.
// Servidor con TENANTS=1 + PROVISION_*; APP_URL.
const { chromium } = require('playwright'); const { demoSession, J } = require('./acceso-lib.cjs');
const U = process.env.APP_URL || 'http://127.0.0.1:4031'; let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
(async () => {
  const dir = await demoSession(U, 'atlanta', 'director'); const sec = await demoSession(U, 'atlanta', 'secretaria'); const alu = await demoSession(U, 'atlanta', 'alumno'); const other = await demoSession(U, 'clinica', 'director');
  const post = (c, b) => fetch(U + '/api/access-log', { method: 'POST', headers: J(c), body: JSON.stringify(b) }); const get = async (c, q = '') => { const r = await fetch(U + '/api/access-log' + q, { headers: J(c) }); return { s: r.status, j: await r.json() }; };
  const snap = await (await fetch(U + '/api/snapshot', { headers: J(dir) })).json(); const st = snap.students[0]; const otherSnap = await (await fetch(U + '/api/snapshot', { headers: J(other) })).json();
  ok((await post(dir, { action: 'view', entity: 'student', id: st.id })).status === 200, 'el director abre una ficha: se anota');
  ok((await post(sec, { action: 'view', entity: 'student', id: snap.students[1].id })).status === 200, 'la secretaría abre otra ficha: se anota');
  ok((await post(alu, { action: 'view', entity: 'student', id: st.id })).status === 200, 'un alumno (portal) recibe ok…');
  ok((await post(dir, { action: 'view', entity: 'student', id: otherSnap.students[0].id })).status === 404, 'no se puede anotar una persona de otro negocio (404)');
  ok((await post(dir, { action: 'export', entity: 'report', detail: 'alumnos' })).status === 200 && (await post(dir, { action: 'report', entity: 'report', detail: 'parte-mensual' })).status === 200, 'exportaciones e informes se anotan');
  ok((await post(dir, { action: 'borrar', entity: 'student' })).status === 400, 'una acción inventada se rechaza (400)');
  const all = await get(dir); ok(all.s === 200 && all.j.entries.some((e) => e.subject === `${st.firstName} ${st.lastName}` && e.action === 'view' && e.userName.length) && all.j.entries.some((e) => e.action === 'export') && all.j.entries.some((e) => e.action === 'report'), 'el administrador ve fichas, exportaciones e informes con el nombre de quien lo hizo');
  ok(!all.j.entries.some((e) => e.userName === 'Alumno' || e.role === 'ALUMNO'), '…pero no los accesos del propio alumno (portal)');
  ok((await get(sec)).s === 403 && (await get(alu)).s === 403, 'la secretaría y el alumno NO pueden ver el registro (403)');
  const clin = await get(other); ok(clin.s === 200 && !clin.j.entries.some((e) => e.subject === `${st.firstName} ${st.lastName}`), 'el administrador de OTRO negocio no ve estos accesos');
  const secId = all.j.entries.find((e) => e.role === 'SECRETARIA').userId; const f = await get(dir, `?user=${secId}`); ok(f.j.entries.length >= 1 && f.j.entries.every((e) => e.userId === secId), 'filtrar por usuario');
  const today = new Date().toISOString().slice(0, 10); ok((await get(dir, `?from=${today}&to=${today}`)).j.entries.length >= 3 && (await get(dir, '?from=2000-01-01&to=2000-01-02')).j.entries.length === 0, 'filtrar por fecha');
  ok(all.j.users.length >= 3 && all.j.users.every((u) => u.name), 'la lista de usuarios para el filtro viene con nombres');

  // Interfaz
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1360, height: 900 } })).newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(U + '/acceso/atlanta'); await p.waitForSelector('[aria-label="Entrar como"]'); await p.getByRole('group', { name: 'Entrar como' }).getByRole('button', { name: 'Director', exact: true }).click(); await p.waitForSelector('main h1'); await p.waitForTimeout(800);
  ok(await p.getByRole('link', { name: 'Registro de accesos' }).count() >= 1, 'el menú del administrador tiene «Registro de accesos»');
  await p.goto(U + '/alumnos/' + snap.students[2].id); await p.waitForSelector('main h1'); await p.waitForTimeout(600);
  await p.goto(U + '/informes'); await p.waitForSelector('main h1'); await p.waitForTimeout(500); await p.getByRole('button', { name: /CSV/ }).first().click(); await p.waitForTimeout(500);
  await p.goto(U + '/registro-accesos'); await p.waitForSelector('main h1'); await p.waitForTimeout(1000);
  const txt = await p.locator('main').innerText(); ok(/Abrió la ficha/.test(txt) && /Exportó a CSV/.test(txt) && txt.includes(`${snap.students[2].firstName} ${snap.students[2].lastName}`) && /Director/.test(txt), 'la página lista las fichas abiertas y la exportación (con la persona y el usuario)');
  const rowsAll = await p.locator('tbody tr').count(); await p.getByRole('button', { name: /^Usuario:/ }).click(); await p.getByRole('menuitem', { name: /Secretar/ }).click(); await p.waitForTimeout(800);
  const rowsSec = await p.locator('tbody tr').count(); ok(rowsSec >= 1 && rowsSec < rowsAll, `el filtro «Usuario» (desplegable de la app) reduce la lista (${rowsAll} → ${rowsSec})`);
  ok(await p.locator('select').count() === 0, 'sin <select> nativos en la página');
  await p.getByLabel('Desde').fill('2000-01-01'); await p.getByLabel('Hasta').fill('2000-01-02'); await p.waitForTimeout(800); ok(await p.getByText('Sin accesos registrados').count() === 1, 'el filtro por fechas funciona (vacío fuera de rango)');
  const sp = await (await b.newContext()).newPage(); await sp.goto(U + '/acceso/atlanta'); await sp.waitForSelector('[aria-label="Entrar como"]'); await sp.getByRole('group', { name: 'Entrar como' }).getByRole('button', { name: 'Secretaría', exact: true }).click(); await sp.waitForSelector('main h1'); await sp.waitForTimeout(500);
  ok(await sp.getByRole('link', { name: 'Registro de accesos' }).count() === 0, 'la secretaría no ve el enlace en su menú');
  await sp.goto(U + '/registro-accesos'); await sp.waitForTimeout(800); ok(/No tienes permiso|permiso|acceso/i.test(await sp.locator('body').innerText()) && !(await sp.getByText('Fecha y hora').count()), 'y si entra por la dirección, no ve la tabla');
  ok(errs.length === 0, 'sin errores de página'); await b.close(); console.log(fails ? `${fails} FALLOS` : 'TODO OK'); process.exit(fails ? 1 : 0);
})().catch((e) => { console.log('CRASH', e.message.split('\n').slice(0, 3).join(' | ')); process.exit(1); });
