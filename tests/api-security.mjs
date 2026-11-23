// Pruebas de seguridad de la API. Requiere el servidor con SEED_DEMO=1, una base NUEVA, PERSONAL_PASSWORD y BOOTSTRAP_ADMIN_EMAIL/PASSWORD (propietario de la plataforma).
// Uso: API_URL=http://127.0.0.1:4000 PERSONAL_TEST_PASSWORD=<pw> PLATFORM_EMAIL=<email> PLATFORM_PASSWORD=<pw> node tests/api-security.mjs
// Las cuentas de negocios demo entran por /api/auth/demo (sin contraseña); los clientes y el propietario, por /api/auth/login.
const B = (process.env.API_URL || 'http://127.0.0.1:4000') + '/api'; let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const H = (cookie, extra = {}) => ({ 'content-type': 'application/json', 'x-requested-with': 'edith', ...(cookie ? { cookie } : {}), ...extra });
const call = async (method, path, body, cookie, extra) => { const r = await fetch(B + path, { method, headers: H(cookie, extra), body: body === undefined ? undefined : JSON.stringify(body) }); let j = null; try { j = await r.json(); } catch {} return { status: r.status, j, headers: r.headers }; };
const DEMO_ACADEMY = { horizonte: 'acad_001', atlas: 'acad_002', atlanta: 'acad_atlanta', vitalia: 'acad_clinica' };
const demo = async (email) => { const r = await call('POST', '/auth/demo', { academy: DEMO_ACADEMY[email.split('@')[1].split('.')[0]], profile: email }); const sc = r.headers.get('set-cookie'); return { r, cookie: sc ? sc.split(';')[0] : null, setCookie: sc }; };
const login = async (email, pw) => { const r = await call('POST', '/auth/login', { email, password: pw }); const sc = r.headers.get('set-cookie'); return { r, cookie: sc ? sc.split(';')[0] : null, setCookie: sc }; };
const rpc = (name, args, cookie) => call('POST', `/rpc/${name}`, { args }, cookie);

(async () => {
  ok((await call('GET', '/snapshot')).status === 401, 'snapshot without session → 401');
  ok((await rpc('createStudent', [{}])).status === 401, 'rpc without session → 401');
  ok((await call('GET', '/demo-accounts')).status === 200, 'demo accounts exposed only in SEED_DEMO');
  const bad = await login('admin@horizonte.demo', 'x'); ok(bad.r.status === 401 && bad.r.j.error === 'Credenciales no válidas', 'wrong password → generic 401');
  const nouser = await login('nadie@nada.demo', 'x'); ok(nouser.r.status === 401 && nouser.r.j.error === bad.r.j.error, 'unknown email → same message (no user enumeration)');
  const A = await demo('admin@horizonte.demo'); ok(A.r.status === 200 && !!A.cookie, 'admin entra por la demo (sin contraseña)');
  ok(/HttpOnly/i.test(A.setCookie) && /SameSite=Lax/i.test(A.setCookie), 'cookie is HttpOnly + SameSite=Lax');
  ok(!JSON.stringify(A.r.j).includes('pwd'), 'login response has no password hash');
  // CSRF
  const noHdr = await fetch(B + '/rpc/setStudentStatus', { method: 'POST', headers: { 'content-type': 'application/json', cookie: A.cookie }, body: JSON.stringify({ args: ['x', 'baja'] }) }); ok(noHdr.status === 403, 'POST without X-Requested-With → 403 (CSRF)');
  const evil = await call('POST', '/rpc/setStudentStatus', { args: ['x', 'baja'] }, A.cookie, { origin: 'https://evil.example' }); ok(evil.status === 403, 'foreign Origin → 403');
  // snapshot & data
  const snap = await call('GET', '/snapshot', undefined, A.cookie); ok(snap.status === 200 && snap.j.students.length > 20, `admin snapshot (${snap.j.students.length} students)`);
  ok(!JSON.stringify(snap.j).includes('"pwd"'), 'snapshot contains no password hashes');
  ok(snap.j.students.every(s => s.academyId === 'acad_001'), 'snapshot only own academy');
  const stu = snap.j.students[0];
  // validation
  ok((await rpc('createStudent', [{}], A.cookie)).status === 400, 'invalid payload → 400');
  const created = await rpc('createStudent', [{ firstName: 'Nora', lastName: 'Esteve Ruiz', birthDate: '1995-03-02', email: 'nora@correo.demo', phone: '611222333', academyId: 'acad_002', status: 'baja', id: 'hacked' }], A.cookie);
  ok(created.status === 200 && created.j.result.academyId === 'acad_001' && created.j.result.id !== 'hacked' && created.j.result.status === 'nuevo', 'mass-assignment (academyId/id/status) ignored on create');
  const upd = await rpc('updateStudent', [stu.id, { notes: 'ok', academyId: 'acad_002', status: 'baja' }], A.cookie); ok(upd.status === 200 && upd.j.result.academyId === 'acad_001' && upd.j.result.status === stu.status, 'mass-assignment ignored on update');
  ok((await rpc('updateStudent', [stu.id, { email: 'no-es-email' }], A.cookie)).status === 400, 'update field validated');
  ok((await call('POST', '/rpc/__proto__', { args: [] }, A.cookie)).status === 404, 'unknown rpc → 404');
  ok((await call('POST', '/rpc/createStudent', JSON.parse('{"args":[{"__proto__":{"admin":true}}]}'), A.cookie)).status === 400, 'prototype pollution attempt rejected');
  ok((await call('POST', '/rpc/createStudent', { args: ['x'.repeat(1_100_000)] }, A.cookie)).status === 413, 'oversized body → 413');
  // cross-tenant
  const T = await demo('admin@atlas.demo'); const tsnap = await call('GET', '/snapshot', undefined, T.cookie);
  ok(tsnap.j.students.length > 0 && tsnap.j.students.every(s => s.academyId === 'acad_002'), 'other academy sees only its own data');
  ok(!tsnap.j.students.some(s => s.id === stu.id), 'foreign student absent from other tenant snapshot');
  const x1 = await rpc('updateStudent', [stu.id, { notes: 'pwn' }], T.cookie); ok(x1.status === 422 && /no encontrado/i.test(x1.j.error), 'cross-tenant update → not found');
  const x2 = await rpc('setStudentStatus', [stu.id, 'baja'], T.cookie); ok(x2.status === 422, 'cross-tenant status change blocked');
  const grp = snap.j.groups[0]; const x3 = await rpc('addStudentToGroup', [tsnap.j.students[0].id, grp.id], T.cookie); ok(x3.status === 422, 'cross-tenant group assignment blocked');
  const x4 = await rpc('setAcademyStatus', ['acad_001', 'suspended'], T.cookie); ok(x4.status === 403 || x4.status === 422, 'tenant admin (demo) cannot suspend academies');
  // roles
  const P = await demo('carlos@horizonte.demo'); const psnap = await call('GET', '/snapshot', undefined, P.cookie);
  ok(psnap.j.payments.length === 0 && psnap.j.waitlist.length === 0, 'teacher snapshot excludes payments & waitlist');
  ok(psnap.j.groups.length > 0 && psnap.j.groups.length < snap.j.groups.length && psnap.j.groups.every(g => g.teacherId === psnap.j.teachers.find(t => t.email.startsWith('carlos')).id), 'teacher sees only own groups');
  ok((await rpc('createPayment', [{ studentId: stu.id, concept: 'x payment', amount: 10, dueDate: '2030-01-01' }], P.cookie)).status === 422, 'teacher cannot create payments');
  ok((await rpc('setRolePermission', ['PROFESOR', 'payments:read', true], P.cookie)).status === 422, 'teacher cannot change permissions');
  const me = psnap.j.users.find(u => u.email.startsWith('carlos')); ok((await rpc('updateUser', [me.id, { role: 'ADMIN' }], P.cookie)).status === 422, 'teacher cannot self-promote');
  ok([403, 422].includes((await rpc('platformOverview', [], A.cookie)).status), 'tenant admin (demo) cannot call platform ops');
  const S = await login(process.env.PLATFORM_EMAIL, process.env.PLATFORM_PASSWORD); const ov = await rpc('platformOverview', [], S.cookie); ok(ov.status === 200 && ov.j.result.length >= 2, 'super admin platform overview');
  ok(!JSON.stringify(ov.j).includes('"pwd"'), 'platform overview has no secrets');
  // AI scoped
  const ai = await call('POST', '/ai/chat', { question: '¿Cuánto dinero está pendiente de cobrar?' }, P.cookie); ok(ai.status === 200 && /no tiene acceso/.test(ai.j.text), 'AI endpoint respects role (teacher refused)');
  const ai2 = await call('POST', '/ai/chat', { question: '¿Cuántos alumnos tenemos?' }, A.cookie); ok(/activos/.test(ai2.j.text), 'AI endpoint answers with tenant data');
  ok((await call('POST', '/ai/chat', { question: 'x' }, undefined)).status === 401, 'AI requires session');
  // disable → immediate lockout
  // clientes: alta solo con la sesión personal; usuarios creados por su administrador entran por /login
  const own = await fetch(B + '/personal/login', { method: 'POST', headers: H(null), body: JSON.stringify({ user: 'redstonengineers', password: process.env.PERSONAL_TEST_PASSWORD }) }); const ownCookie = own.headers.get('set-cookie').split(';')[0];
  const mk = await call('POST', '/onboarding', { academyName: 'Cliente Prueba', type: 'educativa', plan: 'basic', adminEmail: 'dueno@cliente.test' }, ownCookie); ok(mk.status === 200 && !!mk.j.password, 'cliente creado con contraseña generada');
  const C0 = await login('dueno@cliente.test', mk.j.password); const chg = await call('POST', '/auth/password', { current: mk.j.password, next: 'Cliente2026ok' }, C0.cookie); const C = { cookie: chg.headers.get('set-cookie').split(';')[0] };
  const u2 = await rpc('createUser', [{ name: 'Test Temp', email: 'temp@cliente.test', role: 'SECRETARIA', password: 'Temporal2026' }], C.cookie); ok(u2.status === 200 && !JSON.stringify(u2.j).includes('pwd'), 'createUser (hash never returned)');
  const TU = await login('temp@cliente.test', 'Temporal2026'); ok(TU.r.status === 200, 'new user can log in (scrypt hash)'); ok((await call('GET', '/snapshot', undefined, TU.cookie)).status === 200, 'new user session works');
  ok((await rpc('platformOverview', [], C.cookie)).status === 422 && (await rpc('setAcademyPlan', [mk.j.academyId, 'premium'], C.cookie)).status === 422, 'un cliente tampoco puede usar las operaciones de plataforma (422)');
  await rpc('updateUser', [u2.j.result.id, { disabled: true }], C.cookie); ok((await call('GET', '/snapshot', undefined, TU.cookie)).status === 401, 'disabling a user kills their live session');
  // logout
  await call('POST', '/auth/logout', {}, P.cookie); ok((await call('GET', '/auth/me', undefined, P.cookie)).j.user === null && (await call('GET', '/snapshot', undefined, P.cookie)).status === 401, 'logout invalidates session server-side');
  // suspended academy
  await rpc('setAcademyStatus', ['acad_002', 'suspended'], S.cookie); ok((await call('GET', '/snapshot', undefined, T.cookie)).status === 401, 'suspending academy kills its sessions'); const T2 = await demo('admin@atlas.demo'); ok(T2.r.status === 403, 'suspended academy cannot be entered');
  // onboarding cerrado
  ok((await call('POST', '/onboarding', { academyName: 'Música Aria', type: 'musica', plan: 'basic', adminEmail: 'aria@aria.test' })).status === 401, 'onboarding sin sesión personal → 401');
  ok((await call('POST', '/onboarding', { academyName: 'Música Aria', type: 'musica', plan: 'basic', adminEmail: 'aria@aria.test' }, A.cookie)).status === 401, 'onboarding con sesión de academia → 401');
  ok((await call('POST', '/onboarding', { academyName: 'X', type: 'musica', plan: 'basic', adminEmail: 'aria@aria.test' }, ownCookie)).status === 400, 'onboarding valida los datos');
  ok((await call('POST', '/onboarding', { academyName: 'Otra', type: 'musica', plan: 'basic', adminEmail: 'dueno@cliente.test' }, ownCookie)).status === 422, 'correo de administrador repetido → 422');
  ok((await call('POST', '/rpc/createStudent', { args: [] }, 'ac_session=forged')).status === 401, 'forged cookie → 401');
  // Acceso por negocio: la ficha pública no filtra datos de personas ni secretos; un usuario de un negocio no entra en otro
  const pub = await fetch(B + '/public/tenants'); const pj = await pub.json(); const raw = JSON.stringify(pj);
  ok(pub.status === 200 && pj.tenants.length === 3 && !/pwd|hash|salt|@|password/i.test(raw), 'public/tenants: 3 negocios y sin correos, hashes ni contraseñas');
  ok((await login('director', 'demo')).r.status === 401 && (await login('director@atlanta.demo', 'demo')).r.status === 401, 'las cuentas demo no entran por /login');
  ok((await call('POST', '/auth/demo', { academy: 'clinica', profile: 'padre' })).status === 403, 'un perfil de otro negocio no entra por la demo');
  ok((await call('POST', '/auth/demo', { academy: "x'; drop", profile: 'director' })).status === 403, 'slug con caracteres raros → 403');
  ok((await call('POST', '/auth/demo', { academy: 'acad_platform', profile: process.env.PLATFORM_EMAIL })).status === 403, 'la plataforma (propietario) no entra por la demo');
  // rate limit (last: locks this ip+email)
  let last; for (let i = 0; i < 10; i++) last = await login('admin@atlas.demo', 'bad' + i); ok(last.r.status === 429, 'brute force → 429');
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})();
