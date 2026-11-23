// Sentry opcional: el evento sale SIN datos de personas. Uso: npx tsx tests/monitorizacion.ts
import { buildEvent, parseDsn, scrubText, sendError } from '../src/lib/errorReport';
let fails = 0; const ok = (c: boolean, m: string) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const e = new Error('No se pudo avisar a maria.lopez@correo.es (tel. +34 612 345 678, DNI 12345678Z) token abcdefghijklmnopqrstuvwxyz0123456789ABCD');
e.stack = 'Error: x\n    at fn (/srv/app/server/notifier.ts:10:5)\n    at send (/srv/app/server/x.ts:1:1) pedro@x.es';
const ev = JSON.stringify(buildEvent({ error: e, where: 'server', url: '/api/rpc/createStudent?email=a@b.es&id=stu_123', environment: 'production' }));
ok(!/maria\.lopez|@correo|612 345|12345678Z|abcdefghijkl|pedro@x/.test(ev), 'el evento no contiene correos, teléfonos, DNI ni tokens');
ok(ev.includes('[correo]') && ev.includes('[número]') && ev.includes('[documento]') && ev.includes('[token]'), 'se sustituyen por marcas');
ok(!ev.includes('?email') && !ev.includes('stu_123'), 'la URL va sin parámetros ni identificadores');
ok(!/"user"|cookie|authorization|"headers"/i.test(ev), 'no lleva usuario, cookies ni cabeceras');
ok(parseDsn('https://abc123@o1.ingest.sentry.io/4507')?.endpoint === 'https://o1.ingest.sentry.io/api/4507/envelope/' && parseDsn('basura') === null, 'se interpreta el DSN');
let sent = ''; const sentOk = await sendError('https://abc123@o1.ingest.sentry.io/4507', { error: e, where: 'browser' }, (async (u: string, init?: RequestInit) => { sent = u + '\n' + String(init?.body); return new Response('{}', { status: 200 }); }) as unknown as typeof fetch);
ok(sentOk && sent.includes('sentry_key=abc123') && sent.split('\n').length >= 4 && !sent.includes('maria.lopez'), 'se envía como «envelope» a Sentry sin datos de personas');
ok(!(await sendError(null, { error: e, where: 'server' })), 'sin DSN no se envía nada');
ok(scrubText('sin datos') === 'sin datos', 'el texto normal no se toca');
console.log(fails ? `${fails} FALLOS` : 'TODO OK'); process.exit(fails ? 1 : 0);
