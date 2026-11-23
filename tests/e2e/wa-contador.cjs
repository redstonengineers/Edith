// Contador interno de WhatsApp: un aviso automático enviado suma en Plataforma (Super Admin).
// Requiere servidor con TENANTS=1 + PROVISION_*, WHATSAPP_TOKEN/PHONE_ID/TEMPLATE y WHATSAPP_API_BASE=http://127.0.0.1:4998 (este script levanta esa API falsa), NOTICES_TICK_MS=1000. APP_URL=http://127.0.0.1:4019
const http = require('http'); const { chromium } = require('playwright'); const { realClient } = require('./acceso-lib.cjs');
// Las demos no envían nada real ni cuentan WhatsApp: se pasa Atlanta a cliente real. Servidor con PERSONAL_PASSWORD, PROVISION_ADMIN_EMAIL y BOOTSTRAP_ADMIN_EMAIL/PASSWORD (propietario de la plataforma);
// prueba con PERSONAL_TEST_PASSWORD, ATLANTA_ADMIN_EMAIL, PLATFORM_EMAIL y PLATFORM_PASSWORD.
let calls = 0; const fake = http.createServer((q, r) => { q.resume(); q.on('end', () => { calls++; r.setHeader('content-type', 'application/json'); r.end(JSON.stringify({ messages: [{ id: 'wamid.' + calls }] })); }); }).listen(4998);
let f = 0; const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) f++; };
(async () => {
  const U = process.env.APP_URL || 'http://127.0.0.1:4019'; const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1360, height: 900 } })).newPage();
  const real = await realClient(U); await p.goto(U + '/login'); await p.getByLabel(/Correo o usuario/).fill(real.email); await p.getByLabel('Contraseña').fill(real.password); await p.getByRole('button', { name: /Entrar/ }).click(); await p.locator('main h1').first().waitFor();
  const stu = await p.evaluate(async () => { const s = await (await fetch('/api/snapshot', { credentials: 'include' })).json(); return s.students.find((x) => x.phone && (!x.notifyVia || x.notifyVia === 'whatsapp' || x.notifyVia === 'ambos') && x.status === 'activo' && !x.guardianId); });
  // Las horas de descanso por defecto (22:00–08:00, Madrid) retrasarían el envío según la hora a la que se pase la prueba: se desactivan.
  await p.evaluate(async () => { await fetch('/api/rpc/updateNoticeSettings', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json', 'x-requested-with': 'edith' }, body: JSON.stringify({ args: [{ quiet: { enabled: false }, reminderHours: 0 }] }) }); });
  const dlg = p.locator('[role=dialog]'); await p.goto(U + '/practicas'); await p.locator('main h1').first().waitFor();
  await p.getByRole('button', { name: /Apuntar práctica/ }).click(); await dlg.getByLabel(/Alumno/).fill(stu.firstName + ' ' + stu.lastName);
  const d = new Date(); d.setDate(d.getDate() + 3); await dlg.getByLabel('Día').fill(d.toISOString().slice(0, 10)); await dlg.getByLabel('Hora').fill('12:40'); await dlg.getByLabel('Coche').selectOption({ index: 1 }); await dlg.getByRole('button', { name: /Guardar/ }).click(); await p.waitForSelector('text=Práctica apuntada');
  await p.waitForTimeout(3500);
  ok(calls >= 1, `la API de WhatsApp recibió ${calls} envío(s)`);
  const q = await (await b.newContext({ viewport: { width: 1360, height: 900 } })).newPage(); await q.goto(U + '/login'); await q.getByLabel(/Correo o usuario/).fill(process.env.PLATFORM_EMAIL); await q.getByLabel('Contraseña').fill(process.env.PLATFORM_PASSWORD); await q.getByRole('button', { name: /Entrar/ }).click(); await q.waitForSelector('main h1');
  await q.goto(U + '/plataforma'); await q.getByRole('button', { name: 'WhatsApp (mes)' }).waitFor();
  const rows = (await q.locator('tr', { hasText: 'Autoescuela Atlanta' }).allInnerTexts()).map((t) => t.replace(/\s+/g, ' ')); console.log(rows.join('\n'));
  const sum = rows.reduce((a, t) => a + Number((t.match(/(\d+)\s*\(\d+ mes ant/) || [0, 0])[1]), 0);
  ok(sum === calls && calls > 0, `Plataforma suma ${sum} = ${calls} envíos de WhatsApp (por negocio y mes)`);
  await b.close(); fake.close(); process.exit(f ? 1 : 0);
})().catch((e) => { console.log('CRASH', e.message.split('\n').slice(0,6).join(' | ')); process.exit(1); });
