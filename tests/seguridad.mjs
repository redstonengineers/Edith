// Cabeceras de seguridad, arranque en producción (clave de cifrado obligatoria), límite global de intentos por IP y /api/health.
// Arranca sus propios servidores compilados (npm run build:server). Uso: node tests/seguridad.mjs
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const tmp = mkdtempSync(join(tmpdir(), 'seg-'));
const start = (port, env) => { const p = spawn('node', ['dist-server/index.js'], { env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), DB_PATH: join(tmp, `d${port}.db`), BACKUP_HOURS: '0', ...env }, stdio: ['ignore', 'pipe', 'pipe'] }); let out = ''; p.stdout.on('data', (d) => (out += d)); p.stderr.on('data', (d) => (out += d)); return { p, out: () => out }; };
const up = async (u) => { for (let i = 0; i < 60; i++) { try { await fetch(u); return true; } catch { await sleep(300); } } return false; };
const H = { 'content-type': 'application/json', 'x-requested-with': 'edith' };

// 1. Producción sin clave: no arranca
const a = start(4701, { NODE_ENV: 'production' }); const code = await new Promise((r) => a.p.on('close', r)); await sleep(100);
ok(code === 1 && /DATA_ENCRYPTION_KEY/.test(a.out()), 'producción sin DATA_ENCRYPTION_KEY: el servidor no arranca y lo explica');
const bad = start(4702, { NODE_ENV: 'production', DATA_ENCRYPTION_KEY: 'corta' }); const code2 = await new Promise((r) => bad.p.on('close', r)); ok(code2 !== 0, 'con una clave que no son 32 bytes tampoco arranca');
const dev = start(4703, { NODE_ENV: 'development', LOGIN_FAILS_PER_IP: '5' }); ok(await up('http://127.0.0.1:4703/api/health'), 'en desarrollo arranca sin clave'); ok(/DATA_ENCRYPTION_KEY no definida/.test(dev.out()), 'y avisa de que guarda sin cifrar');

// 2. Producción con clave: cabeceras, salud y cifrado activo
const prod = start(4704, { NODE_ENV: 'production', DATA_ENCRYPTION_KEY: randomBytes(32).toString('base64'), COOKIE_SECURE: '0' }); ok(await up('http://127.0.0.1:4704/api/health'), 'producción con clave: arranca');
const r = await fetch('http://127.0.0.1:4704/api/health'); const h = r.headers; const j = await r.json();
ok(/max-age=\d{7,}/.test(h.get('strict-transport-security') ?? ''), 'Strict-Transport-Security en producción');
const csp = h.get('content-security-policy') ?? ''; ok(/script-src 'self'(;|$)/.test(csp) && /object-src 'none'/.test(csp) && /base-uri 'self'/.test(csp) && /frame-ancestors 'none'/.test(csp) && !/unsafe-eval/.test(csp) && !/script-src[^;]*unsafe-inline/.test(csp), 'CSP: script-src \'self\', object-src \'none\', base-uri \'self\', sin eval ni scripts en línea');
const pp = h.get('permissions-policy') ?? ''; ok(/camera=\(\)/.test(pp) && /geolocation=\(\)/.test(pp) && /payment=\(\)/.test(pp), 'Permissions-Policy restrictiva');
ok(h.get('x-content-type-options') === 'nosniff' && h.get('x-frame-options') === 'DENY' && h.get('referrer-policy') === 'no-referrer', 'resto de cabeceras (nosniff, DENY, no-referrer)');
ok(j.ok === true && j.db === true && j.encrypted === true && 'backup' in j, '/api/health comprueba la base de datos, informa del cifrado y de la última copia');
const hd = await fetch('http://127.0.0.1:4703/api/health'); ok(!hd.headers.get('strict-transport-security'), 'sin HSTS en desarrollo (http local)');
const page = await fetch('http://127.0.0.1:4704/'); ok((page.headers.get('content-security-policy') ?? '').includes("script-src 'self'"), 'la CSP también acompaña a las páginas');

// 3. Límite global de intentos por IP (5 en este servidor): cuentas distintas, cada una con pocos fallos
const codes = []; for (let i = 0; i < 8; i++) codes.push((await fetch('http://127.0.0.1:4703/api/auth/login', { method: 'POST', headers: H, body: JSON.stringify({ email: `persona${i}@x.test`, password: 'mala-contraseña' }) })).status);
ok(codes.slice(0, 5).every((c) => c === 401) && codes.slice(5).every((c) => c === 429), `tras 5 fallos desde una IP con cuentas distintas se bloquea (${codes.join(',')}), aunque ninguna cuenta llegó a su límite propio`);

for (const s of [dev, prod]) s.p.kill('SIGKILL'); rmSync(tmp, { recursive: true, force: true });
console.log(fails ? `${fails} FALLOS` : 'TODO OK'); process.exit(fails ? 1 : 0);
