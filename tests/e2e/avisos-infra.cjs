// Infraestructura de avisos: plantillas y eventos configurables, canales, webhook firmado, horas de descanso, reintentos, recordatorio automático, clases y permisos.
const http = require('http'); const { createHmac } = require('node:crypto');
const U = process.env.APP_URL || 'http://127.0.0.1:4016'; const SECRET = 'hook-secret';
let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
const mails = []; const was = []; const hooks = []; let waStatus = 200;
const mock = (port, sink, statusOf = () => 200) => new Promise((res) => { const s = http.createServer((q, r) => { let b = ''; q.on('data', (c) => (b += c)); q.on('end', () => { sink.push({ url: q.url, headers: q.headers, raw: b, body: JSON.parse(b || '{}') }); r.writeHead(statusOf(), { 'content-type': 'application/json' }); r.end('{}'); }); }); s.listen(port, '127.0.0.1', () => res(s)); });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const iso = (d) => d.toISOString().slice(0, 10);
const madrid = (d) => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d).map((x) => [x.type, x.value])); return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` }; };
(async () => {
  const servers = [await mock(4021, mails), await mock(4022, was, () => waStatus), await mock(4023, hooks)];
  const H = { 'content-type': 'application/json', origin: U, 'x-requested-with': 'edith' };
  const session = async (email, academy) => { const r = await fetch(U + '/api/auth/login', { method: 'POST', headers: H, body: JSON.stringify({ email, password: 'demo', ...(academy ? { academy } : {}) }) }); if (!r.ok) throw new Error('login ' + email); const cookie = r.headers.get('set-cookie').split(';')[0];
    return { call: async (name, args, raw) => { const x = await fetch(U + '/api/rpc/' + name, { method: 'POST', headers: { ...H, cookie }, body: JSON.stringify({ args }) }); const j = await x.json(); if (raw) return { status: x.status, j }; if (!x.ok) throw new Error(name + ': ' + j.error); return j.result; }, snap: async () => (await fetch(U + '/api/snapshot', { headers: { cookie } })).json(), post: async (path, body) => { const x = await fetch(U + path, { method: 'POST', headers: { ...H, cookie }, body: JSON.stringify(body) }); return { status: x.status, j: await x.json() }; } }; };
  const A = await session('director@atlanta.demo'); let s = await A.snap(); const stu = s.students.find((x) => x.email && x.phone); const teacher = s.teachers[0].id; const veh = s.vehicles.find((v) => v.status === 'activo').id;
  const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); }; const base = (n, h = '09:00', e = '10:00') => ({ studentId: stu.id, teacherId: teacher, vehicleId: veh, date: day(n), start: h, end: e });
  const mine = async () => (await A.snap()).outbox.filter((o) => o.studentId === stu.id);
  const cfg = (extra) => A.call('updateNoticeSettings', [{ reminderHours: 0, quiet: { enabled: false }, ...extra }]);
  // 1. Eventos y plantillas propias
  await cfg({ events: { practica_cambio: { enabled: false }, practica_nueva: { body: 'Hola {nombre}: práctica el {fecha} a las {hora} ({profesor}).' } } });
  const p = await A.call('createPractice', [base(40)]); await wait(1500); let ob = await mine();
  ok(ob.length === 1 && /^Hola Lucía: práctica el .* a las 09:00 \(.*\)\.\n— /.test(ob[0].body.replace(stu.firstName, 'Lucía')) || /Hola .*: práctica el/.test(ob[0].body), 'la plantilla propia se aplica con sus variables');
  await A.call('updatePractice', [p.id, base(40, '11:00', '12:00')]); await wait(800); ok((await mine()).length === ob.length, 'un evento desactivado («cambio») no genera aviso');
  // 2. Webhook firmado
  const hk = hooks.find((h) => h.body.type === 'notice'); ok(!!hk && hk.body.student && hk.body.event === 'practica_nueva' && hk.body.to.length >= 1, 'el webhook recibe el aviso (evento, alumno, destinatarios)');
  const ts = hk.headers['x-edith-timestamp']; ok(hk.headers['x-edith-signature'] === 'sha256=' + createHmac('sha256', SECRET).update(`${ts}.${hk.raw}`).digest('hex'), 'el webhook va firmado (HMAC-SHA256 de «timestamp.cuerpo»)');
  // 3. Canal de la academia desactivado
  const m0 = mails.length; await cfg({ channels: { email: false } }); await A.call('createPractice', [base(41)]); await wait(1500); ob = await mine(); ok(ob[0].emailStatus === 'no' && mails.length === m0, 'con el correo desactivado en la academia no se envía correo');
  // 4. Horas de descanso
  await cfg({ quiet: { enabled: true, from: '00:00', to: '23:59' } }); const w0 = was.length; await A.call('createPractice', [base(42)]); await wait(2500); ob = await mine();
  ok(ob[0].waStatus === 'pendiente' && was.length === w0, 'en horas de descanso el aviso espera (no se envía)');
  await cfg({ quiet: { enabled: false } }); await wait(2500); ob = await mine(); ok(ob[0].waStatus === 'enviado' && was.length > w0, 'al acabar el descanso se envía solo');
  // 5. Fallo y reintento
  waStatus = 500; await A.call('createPractice', [base(43)]); await wait(6500); ob = await mine(); ok(ob[0].waStatus === 'fallido' && /HTTP 500/.test(ob[0].note || ''), 'si WhatsApp falla, tras 3 intentos queda «fallido» con el motivo');
  waStatus = 200; await A.call('retryNotice', [ob[0].id]); await wait(2500); ob = await mine(); ok(ob[0].waStatus === 'enviado', '«Reintentar» lo envía cuando el canal vuelve');
  // 6. Recordatorio automático
  await cfg({ channels: { email: true }, reminderHours: 24 }); const t2 = madrid(new Date(Date.now() + 3 * 3600e3)); const hh = t2.time; const [h, m] = hh.split(':').map(Number); const end = `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  const before = (await mine()).length; await A.call('createPractice', [{ ...base(0), date: t2.date, start: hh, end: h === 23 ? '23:59' : end }, true]); await wait(3500); ob = await mine();
  ok(ob.some((o) => o.event === 'practica_recordatorio' && /hoy|mañana/.test(o.body)), 'el recordatorio automático sale solo antes de la práctica (hoy/mañana)');
  const rem = ob.filter((o) => o.event === 'practica_recordatorio').length; await wait(3000); ok((await mine()).filter((o) => o.event === 'practica_recordatorio').length === rem, 'el recordatorio no se repite');
  // 7. Prueba de canales
  const t = await A.post('/api/notices/test', { email: 'prueba@correo.es', phone: '600111222' }); ok(t.status === 200 && t.j.email === 'enviado' && t.j.whatsapp === 'enviado' && t.j.webhook === 'enviado', 'la prueba de canales envía por correo, WhatsApp y webhook');
  // 8. Permisos
  const P = await session('david@atlanta.demo'); const r = await P.call('updateNoticeSettings', [{ reminderHours: 1 }], true); ok(r.status >= 400, 'un profesor no puede cambiar los ajustes de avisos'); ok((await P.post('/api/notices/test', {})).status === 403, 'un profesor no puede usar la prueba de canales');
  // 9. Clases (academia): cancelar una clase avisa a los alumnos del grupo
  const Q = await session('director', 'academia'); const qs = await Q.snap(); const today = iso(new Date());
  const cls = qs.classes.find((c) => c.status === 'programada' && c.date > today && qs.students.some((x) => x.groupIds.includes(c.groupId) && (x.email || x.phone) && x.status !== 'baja'));
  if (cls) { await Q.call('cancelClass', [cls.id, true]); await wait(1500); const q2 = await Q.snap(); ok(q2.outbox.some((o) => o.event === 'clase_cancelada' && /cancela/.test(o.body)), 'cancelar una clase avisa a los alumnos de su grupo'); } else ok(false, 'hay una clase futura con alumnos para probar');
  const prefStu = qs.students.find((x) => x.groupIds.length && (x.email || x.phone)); await Q.call('setStudentTraining', [prefStu.id, { notifyVia: 'nada' }]); ok(true, 'preferencia por alumno guardable fuera de autoescuela');
  servers.forEach((x) => x.close()); console.log(fails ? `${fails} FALLOS` : 'TODO OK'); process.exit(fails ? 1 : 0);
})().catch((e) => { console.log('CRASH', e.message.split('\n')[0]); process.exit(1); });
