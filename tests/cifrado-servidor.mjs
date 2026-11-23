// Con el servidor real: la base queda cifrada en disco, un reinicio la lee bien, sin clave no arranca y la rotación de clave funciona.
// Arranca sus propios servidores compilados (npm run build:server). Uso: node tests/cifrado-servidor.mjs
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const dir = mkdtempSync(join(tmpdir(), 'cifsrv-')); const DB = join(dir, 'a.db'); const K1 = randomBytes(32).toString('base64'); const K2 = randomBytes(32).toString('base64');
const start = (port, env) => { const p = spawn('node', ['dist-server/index.js'], { env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), DB_PATH: DB, BACKUP_HOURS: '0', NODE_ENV: 'production', COOKIE_SECURE: '0', TENANTS: '1', PROVISION_ACADEMY_NAME: 'Autoescuela Atlanta', PROVISION_ADMIN_EMAIL: 'a@b.es', ...env }, stdio: ['ignore', 'pipe', 'pipe'] }); let out = ''; p.stdout.on('data', (d) => (out += d)); p.stderr.on('data', (d) => (out += d)); return { p, out: () => out, exited: new Promise((r) => p.on('close', r)) }; };
const up = async (u) => { for (let i = 0; i < 80; i++) { try { const r = await fetch(u); if (r.ok) return true; } catch { /* aún no */ } await sleep(300); } return false; };
const stop = async (s) => { s.p.kill('SIGTERM'); await Promise.race([s.exited, sleep(4000)]); if (s.p.exitCode === null) s.p.kill('SIGKILL'); await sleep(300); };
const H = { 'content-type': 'application/json', 'x-requested-with': 'edith' };
const students = async (port) => { const r = await fetch(`http://127.0.0.1:${port}/api/auth/demo`, { method: 'POST', headers: H, body: JSON.stringify({ academy: 'atlanta', profile: 'director' }) }); const ck = r.headers.getSetCookie().find((c) => c.startsWith('ac_session=')).split(';')[0]; return (await (await fetch(`http://127.0.0.1:${port}/api/snapshot`, { headers: { ...H, cookie: ck } })).json()).students; };
const raw = () => { const d = new DatabaseSync(DB, { readOnly: true }); const rows = d.prepare('SELECT body FROM entities').all().map((r) => r.body).join('\n'); d.close(); return rows; };

// 1. Primer arranque con clave: crea Atlanta con 46 alumnos con correo y teléfono
let s = start(4801, { DATA_ENCRYPTION_KEY: K1 }); ok(await up('http://127.0.0.1:4801/api/health'), 'arranca en producción con clave');
const first = await students(4801); ok(first.length > 30 && first.every((x) => x.email && x.phone), `Atlanta tiene ${first.length} alumnos con correo y teléfono (leídos con la clave)`); await stop(s);
let dump = raw(); const sample = first.slice(0, 40); ok(sample.every((x) => !dump.includes(x.email) && !dump.includes(x.phone)), 'volcado de la base en bruto: ningún correo ni teléfono de alumno en claro');
ok(!/"birthDate":"\d{4}-/.test(dump.split('\n').filter((l) => l.includes('"firstName"') && l.includes('"groupIds"')).join('\n')), 'ni fechas de nacimiento de los alumnos');
ok(dump.includes('enc:v1:'), 'los campos aparecen cifrados («enc:v1:»)');

// 2. Reinicio: lee la base cifrada y devuelve lo mismo
s = start(4802, { DATA_ENCRYPTION_KEY: K1 }); ok(await up('http://127.0.0.1:4802/api/health'), 'reinicio con la misma clave: arranca');
const again = await students(4802); ok(JSON.stringify(again.map((x) => [x.id, x.email, x.phone, x.birthDate, x.notes])) === JSON.stringify(first.map((x) => [x.id, x.email, x.phone, x.birthDate, x.notes])), 'tras reiniciar, los datos descifrados son idénticos'); await stop(s);

// 3. Sin clave o con otra: no arranca ni lee
s = start(4803, {}); ok((await s.exited) === 1 && /DATA_ENCRYPTION_KEY/.test(s.out()), 'sin clave en producción no arranca');
s = start(4804, { DATA_ENCRYPTION_KEY: K2 }); const code = await Promise.race([s.exited, sleep(8000).then(() => 'vivo')]); ok(code !== 'vivo' && code !== 0 && !/listening/.test(s.out()), 'con otra clave no arranca (no puede descifrar)'); if (code === 'vivo') await stop(s);

// 4. Rotación: clave nueva + anterior; luego basta la nueva
s = start(4805, { DATA_ENCRYPTION_KEY: K2, DATA_ENCRYPTION_KEY_PREVIOUS: K1 }); ok(await up('http://127.0.0.1:4805/api/health'), 'rotación: arranca con la clave nueva y la anterior'); ok(/Cifrado: \d+ registros/.test(s.out()), 'y re-cifra los registros con la nueva (lo dice el log)'); await stop(s);
s = start(4806, { DATA_ENCRYPTION_KEY: K2 }); ok(await up('http://127.0.0.1:4806/api/health'), 'después de rotar basta la clave nueva'); const rot = await students(4806); ok(rot.length === first.length && rot[0].email === first[0].email, 'y los datos siguen intactos'); await stop(s);
dump = raw(); ok(sample.every((x) => !dump.includes(x.email)), 'tras rotar la base sigue sin datos en claro');
rmSync(dir, { recursive: true, force: true }); console.log(fails ? `${fails} FALLOS` : 'TODO OK'); process.exit(fails ? 1 : 0);
