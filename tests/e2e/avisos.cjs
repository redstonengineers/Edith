// Avisos automáticos al alumno: correo (Resend) y WhatsApp (Cloud API) simulados, y modo manual (wa.me) sin claves.
// MODE=auto: el servidor se arranca con las claves apuntando a servidores simulados de este script. MODE=manual: sin claves.
const http = require('http'); const { chromium } = require('playwright'); const { realClient } = require('./acceso-lib.cjs');
// Servidor además con PERSONAL_PASSWORD y PROVISION_ADMIN_EMAIL; la prueba con PERSONAL_TEST_PASSWORD y ATLANTA_ADMIN_EMAIL (las demos no envían nada real: se pasa Atlanta a cliente real).
const U = process.env.APP_URL || 'http://127.0.0.1:4014'; const MODE = process.env.MODE || 'auto'; const MAIL_PORT = 4021; const WA_PORT = 4022;
let fails = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
const mails = []; const was = [];
const mock = (port, sink, status = 200) => new Promise((res) => { const s = http.createServer((q, r) => { let b = ''; q.on('data', (c) => (b += c)); q.on('end', () => { sink.push({ url: q.url, auth: q.headers.authorization, body: JSON.parse(b || '{}') }); r.writeHead(status, { 'content-type': 'application/json' }); r.end('{}'); }); }); s.listen(port, '127.0.0.1', () => res(s)); });
const iso = (d) => d.toISOString().slice(0, 10); const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const servers = MODE === 'auto' ? [await mock(MAIL_PORT, mails), await mock(WA_PORT, was)] : [];
  const H = { 'content-type': 'application/json', origin: U, 'x-requested-with': 'edith' }; let cookie = '';
  const real = await realClient(U); cookie = real.cookie;
  const call = async (name, args) => { const r = await fetch(U + '/api/rpc/' + name, { method: 'POST', headers: { ...H, cookie }, body: JSON.stringify({ args }) }); const j = await r.json(); if (!r.ok) throw new Error(name + ': ' + j.error); return j.result; };
  const snap = async () => (await fetch(U + '/api/snapshot', { headers: { cookie } })).json();
  let s = await snap(); const stu = s.students.find((x) => x.email && x.phone && x.firstName === 'Lucía') || s.students.find((x) => x.email && x.phone); const teacher = s.teachers[0].id; const veh = s.vehicles.find((v) => v.status === 'activo');
  const st = await (async () => { const r = await fetch(U + '/api/channels/status', { headers: { cookie } }); return r.json(); })(); ok(st.email === (MODE === 'auto') && st.whatsapp === (MODE === 'auto'), `estado de canales (${MODE})`);
  await call('updateNoticeSettings', [{ quiet: { enabled: false }, reminderHours: 0 }]); // las horas de descanso por defecto (22:00–08:00) retrasarían el envío
  const base = { studentId: stu.id, teacherId: teacher, vehicleId: veh.id, date: day(20), start: '09:00', end: '10:00' };
  const p = await call('createPractice', [base]);
  await wait(1500); s = await snap(); let ob = s.outbox.filter((o) => o.studentId === stu.id);
  ok(ob.length === 1 && /Nueva práctica/.test(ob[0].subject) && /09:00/.test(ob[0].body), 'una práctica nueva genera un aviso al alumno');
  if (MODE === 'auto') {
    ok(ob[0].emailStatus === 'enviado' && ob[0].waStatus === 'enviado', 'correo y WhatsApp enviados solos');
    ok(mails.length === 1 && mails[0].auth === 'Bearer k-mail' && JSON.stringify(mails[0].body).includes(stu.email), 'el correo sale a Resend con el correo del alumno');
    const w = was[0]; ok(was.length >= 1 && w.url.startsWith('/' + 'PHONEID/messages') && w.body.type === 'template' && w.body.template.name === 'aviso' && /^34\d{9}$/.test(w.body.to), 'WhatsApp Cloud API: plantilla con el texto y número internacional');
    ok(/09:00/.test(w.body.template.components[0].parameters[0].text), 'el texto de la plantilla lleva el aviso');
  } else ok(ob[0].emailStatus === 'no' && ob[0].waStatus === 'manual', 'sin claves: WhatsApp queda «por enviar» a mano');
  // Cambio de hora y cancelación
  await call('updatePractice', [p.id, { ...base, start: '11:00', end: '12:00' }]); await wait(1500); s = await snap(); ob = s.outbox.filter((o) => o.studentId === stu.id);
  ok(ob.length === (MODE === 'auto' ? 2 : 1) && /11:00/.test(ob[0].body), MODE === 'auto' ? 'un cambio de hora genera otro aviso' : 'un cambio antes de enviar sustituye el aviso (no duplica)');
  await call('cancelPractice', [p.id, true]); await wait(1500); s = await snap(); ob = s.outbox.filter((o) => o.studentId === stu.id); ok(/cancel/i.test(ob[0].subject), 'cancelar avisa al alumno');
  // Examen y resultado
  const sx = await call('addDrivingExam', [stu.id, { kind: 'teorico', date: day(30), result: 'pendiente' }]); await wait(1200);
  const ex = (await snap()).students.find((x) => x.id === stu.id).driving[0]; await call('setDrivingExamResult', [stu.id, ex.id, 'aprobado']); await wait(1500); s = await snap(); ob = s.outbox.filter((o) => o.studentId === stu.id);
  ok(ob.some((o) => /enhorabuena/i.test(o.body)), 'el resultado del examen se avisa');
  // Preferencia: no avisar
  await call('setStudentTraining', [stu.id, { notifyVia: 'nada' }]); const n0 = (await snap()).outbox.length; await call('createPractice', [{ ...base, date: day(21) }]); await wait(800); ok((await snap()).outbox.length === n0, 'con «No avisar» no se genera aviso');
  // Interfaz
  const b = await chromium.launch(); const pg = await (await b.newContext({ viewport: { width: 1360, height: 900 } })).newPage();
  await pg.goto(U + '/login'); await pg.getByLabel(/Correo o usuario/).fill(real.email); await pg.getByLabel('Contraseña').fill(real.password); await pg.getByRole('button', { name: /Entrar/ }).click(); await pg.waitForSelector('main h1');
  await pg.goto(U + '/avisos-alumnos'); await pg.waitForSelector('main h1'); await pg.waitForTimeout(800); ok(await pg.getByText(/Nueva práctica de conducir|Cambio en tu práctica|Resultado de tu examen/).count() >= 1, 'la página Avisos lista los avisos');
  if (MODE === 'manual') { const link = pg.getByRole('link', { name: /Enviar a/ }).first(); ok(/wa\.me\/34\d{9}\?text=/.test(await link.getAttribute('href')), 'WhatsApp manual: enlace wa.me con el mensaje'); }
  else ok(await pg.getByText('WhatsApp · automático').count() === 1, 'la página indica que WhatsApp es automático');
  await pg.screenshot({ path: (process.env.SHOT_DIR || '/tmp') + `/avisos-${MODE}.png` });
  await b.close(); servers.forEach((x) => x.close());
  console.log(fails ? `${fails} FALLOS` : 'TODO OK'); process.exit(fails ? 1 : 0);
})().catch((e) => { console.log('CRASH', e.message.split('\n')[0]); process.exit(1); });
