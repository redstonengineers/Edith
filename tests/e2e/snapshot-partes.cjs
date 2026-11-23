// /api/snapshot por partes: el núcleo no lleva las colecciones grandes, que se piden por trozos y, juntas, reconstruyen exactamente la instantánea completa.
// Servidor con TENANTS=1 + PROVISION_*; APP_URL.
const { demoSession, J } = require('./acceso-lib.cjs');
const U = process.env.APP_URL || 'http://127.0.0.1:4030';
let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
(async () => {
  const cookie = await demoSession(U, 'atlanta', 'director'); const H = J(cookie); const get = async (q) => { const r = await fetch(U + '/api/snapshot' + q, { headers: H }); return { s: r.status, j: await r.json(), bytes: Number(r.headers.get('content-length') || 0) }; };
  const full = await get(''); const core = await get('?part=core');
  const HEAVY = ['students', 'attendance', 'payments', 'practices'];
  ok(full.s === 200 && core.s === 200 && HEAVY.every((h) => core.j[h].length === 0), 'el núcleo no lleva alumnos, asistencia, pagos ni prácticas');
  ok(HEAVY.every((h) => core.j.heavy[h] === full.j[h].length) && full.j.students.length > 10, 'y avisa de cuántas filas tiene cada una');
  ok(core.j.settings.branding.name === full.j.settings.branding.name && core.j.teachers.length === full.j.teachers.length && core.j.groups.length === full.j.groups.length, 'el resto de colecciones (profesores, grupos, ajustes…) sí viene en el núcleo');
  for (const h of HEAVY) {
    const rows = []; let total = Infinity; let pages = 0; while (rows.length < total) { const r = await get(`?part=${h}&offset=${rows.length}&limit=7`); total = r.j.total; rows.push(...r.j.rows); pages++; if (!r.j.rows.length) break; }
    ok(JSON.stringify(rows) === JSON.stringify(full.j[h]) && (full.j[h].length <= 7 || pages > 1), `${h}: ${rows.length} filas en ${pages} trozos, idénticas a la instantánea completa`);
  }
  ok((await get('?part=otra')).s === 400, 'una parte desconocida responde 400');
  const prof = await demoSession(U, 'atlanta', 'profesor'); const rp = await (await fetch(U + '/api/snapshot?part=students&limit=1000', { headers: J(prof) })).json(); const fp = await (await fetch(U + '/api/snapshot', { headers: J(prof) })).json();
  ok(JSON.stringify(rp.rows) === JSON.stringify(fp.students) && rp.total < full.j.students.length, `el alcance por rol se mantiene por partes (profesor: ${rp.total} de ${full.j.students.length} alumnos)`);
  const anon = await fetch(U + '/api/snapshot?part=core'); ok(anon.status === 401, 'sin sesión: 401');
  console.log(fails ? `${fails} FALLOS` : 'TODO OK'); process.exit(fails ? 1 : 0);
})().catch((e) => { console.log('CRASH', e.message); process.exit(1); });
