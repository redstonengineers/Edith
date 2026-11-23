// Lanza TODAS las pruebas: unitarias (tsx), API (seguridad, acceso) y e2e con Playwright (modo API con servidor real y modo local con Vite).
// Uso: node tests/run-all.mjs [--only a,b] [--skip-mock]      (requiere haber compilado antes: npm run build:api)
// Cada prueba e2e de API arranca su propio servidor con base nueva, así no se contaminan entre sí.
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2); const only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null; const skipMock = args.includes('--skip-mock');
const tmp = mkdtempSync(join(tmpdir(), 'edith-tests-')); let port = 4600; const results = [];
const PW = 'testpw-123'; const PLAT = { email: 'owner@platform.test', pw: 'Plat2026okok' };
const BASE = { HOST: '127.0.0.1', BACKUP_HOURS: '0', PERSONAL_PASSWORD: PW, DEMO_RATE_PER_HOUR: '1000', API_RATE_PER_MINUTE: '100000', LOGIN_FAILS_PER_IP: '1000' };
const TENANTS = { TENANTS: '1', PROVISION_ACADEMY_NAME: 'Autoescuela Atlanta', PROVISION_ADMIN_EMAIL: 'a@b.es' };
const OWNER = { BOOTSTRAP_ADMIN_EMAIL: PLAT.email, BOOTSTRAP_ADMIN_PASSWORD: PLAT.pw };
const TENV = { PERSONAL_TEST_PASSWORD: PW, ATLANTA_ADMIN_EMAIL: 'a@b.es', PLATFORM_EMAIL: PLAT.email, PLATFORM_PASSWORD: PLAT.pw };
const PROV = { RESEND_API_KEY: 'k-mail', MAIL_API_BASE: 'http://127.0.0.1:4021', WHATSAPP_TOKEN: 't', WHATSAPP_PHONE_ID: 'PHONEID', WHATSAPP_TEMPLATE: 'aviso', WHATSAPP_API_BASE: 'http://127.0.0.1:4022', NOTIFY_WEBHOOK_URL: 'http://127.0.0.1:4023/hook', NOTIFY_WEBHOOK_SECRET: 'hook-secret', NOTICES_TICK_MS: '1000' };

// [nombre, comando, tipo, entorno del servidor, entorno de la prueba, tiempo máximo (s)]
const SUITES = [
  ['cifrado', ['npx', 'tsx', 'tests/cifrado.ts'], 'unit'], ['colas', ['npx', 'tsx', 'tests/colas.ts'], 'unit'], ['planes', ['npx', 'tsx', 'tests/planes.ts'], 'unit'],
  ['monitorizacion', ['npx', 'tsx', 'tests/monitorizacion.ts'], 'unit'], ['acceso-migracion', ['npx', 'tsx', 'tests/acceso-migracion.ts'], 'unit'],
  ['acceso', ['node', 'tests/acceso.mjs'], 'self', {}, {}, 300],
  ['api-security', ['node', 'tests/api-security.mjs'], 'api', { SEED_DEMO: '1', ...OWNER }, TENV],
  ['seguridad', ['node', 'tests/seguridad.mjs'], 'self', {}, {}, 200], ['cifrado-servidor', ['node', 'tests/cifrado-servidor.mjs'], 'self', {}, {}, 300],
  ['snapshot-partes', ['node', 'tests/e2e/snapshot-partes.cjs'], 'api', TENANTS, TENV],
  ['nuevo-cliente', ['node', 'tests/e2e/nuevo-cliente.cjs'], 'api', TENANTS, TENV], ['clientes-personal', ['node', 'tests/e2e/clientes-personal.cjs'], 'api', TENANTS, TENV],
  ['tenants', ['node', 'tests/e2e/tenants.cjs'], 'api', TENANTS, TENV], ['matricula-publica', ['node', 'tests/e2e/matricula-publica.cjs'], 'api', TENANTS, TENV],
  ['recordar-sesion', ['node', 'tests/e2e/recordar-sesion.cjs'], 'api', TENANTS, TENV], ['offline', ['node', 'tests/e2e/offline.cjs'], 'api', TENANTS, TENV],
  ['personal', ['node', 'tests/e2e/personal.cjs'], 'api', TENANTS, TENV], ['personal-mobile', ['node', 'tests/e2e/personal-mobile.cjs'], 'api', TENANTS, TENV],
  ['tier-estilo', ['node', 'tests/e2e/tier-estilo.cjs'], 'api', TENANTS, TENV], ['interacciones', ['node', 'tests/e2e/interacciones.cjs'], 'api', TENANTS, TENV],
  ['clase-nombre', ['node', 'tests/e2e/clase-nombre.cjs'], 'api', TENANTS, TENV], ['registro-accesos', ['node', 'tests/e2e/registro-accesos.cjs'], 'api', TENANTS, TENV],
  ['autoescuela', ['node', 'tests/e2e/autoescuela.cjs'], 'api', { SEED_DEMO: '1' }, TENV], ['avisos-ui', ['node', 'tests/e2e/avisos-ui.cjs'], 'api', TENANTS, TENV],
  ['avisos-infra', ['node', 'tests/e2e/avisos-infra.cjs'], 'api', { ...TENANTS, ...PROV }, TENV], ['avisos', ['node', 'tests/e2e/avisos.cjs'], 'api', { ...TENANTS, ...PROV }, { ...TENV, MODE: 'auto' }],
  ['wa-contador', ['node', 'tests/e2e/wa-contador.cjs'], 'api', { ...TENANTS, ...OWNER, WHATSAPP_TOKEN: 't', WHATSAPP_PHONE_ID: 'p', WHATSAPP_TEMPLATE: 'Atlanta', WHATSAPP_API_BASE: 'http://127.0.0.1:4998', NOTICES_TICK_MS: '1000' }, TENV],
  ...['phase2-people', 'phase3-operations', 'phase4-admin', 'phase5-analytics', 'phase6-ai', 'phase7-9-platform', 'functions-gap', 'verticals'].map((n) => [n, ['node', `tests/e2e/${n}.cjs`], 'mock', {}, {}, 300]),
  ['modules', ['node', 'tests/e2e/modules.cjs'], 'api', TENANTS, TENV], ['personal-voice', ['node', 'tests/e2e/personal-voice.cjs'], 'api', TENANTS, TENV],
  ['smoke-all', ['node', 'tests/e2e/smoke-all.cjs'], 'mock', {}, {}, 900], ['axe', ['node', 'tests/axe.cjs'], 'mock', {}, {}, 600],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waitUp = async (url) => { for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).status < 500) return true; } catch { /* aún no */ } await sleep(500); } return false; };
const run = (cmd, env, timeout) => new Promise((res) => {
  const p = spawn(cmd[0], cmd.slice(1), { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] }); let out = ''; p.stdout.on('data', (d) => (out += d)); p.stderr.on('data', (d) => (out += d));
  const t = setTimeout(() => { out += '\n[TIEMPO AGOTADO]'; p.kill('SIGKILL'); }, (timeout ?? 280) * 1000); p.on('close', (code) => { clearTimeout(t); res({ code, out }); });
});
const stop = async (p) => { if (!p || p.exitCode !== null) return; p.kill('SIGTERM'); await sleep(300); if (p.exitCode === null) p.kill('SIGKILL'); };
const server = (env) => { const prt = port++; const p = spawn('node', ['dist-server/index.js'], { env: { ...process.env, ...BASE, PORT: String(prt), DB_PATH: join(tmp, `db-${prt}.db`), NODE_ENV: 'development', ...env }, stdio: 'ignore' }); return { p, url: `http://127.0.0.1:${prt}` }; };

console.log('Compilando el servidor…'); const b = spawnSync('npm', ['run', 'build:server'], { stdio: 'inherit' }); if (b.status !== 0) process.exit(1);
let vite = null; let viteUrl = null;
for (const [name, cmd, kind, senv = {}, tenv = {}, timeout] of SUITES) {
  if (only && !only.includes(name)) continue; if (skipMock && kind === 'mock') continue; const t0 = Date.now(); let r;
  if (kind === 'unit' || kind === 'self') r = await run(cmd, {}, timeout);
  else if (kind === 'api') { const s = server(senv); if (!(await waitUp(s.url + '/api/health'))) r = { code: 1, out: 'el servidor no arrancó' }; else r = await run(cmd, { APP_URL: s.url, API_URL: s.url, ...tenv }, timeout); await stop(s.p); }
  else { if (!vite) { vite = spawn('npx', ['vite', '--port', '5199', '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' }); viteUrl = 'http://127.0.0.1:5199'; await waitUp(viteUrl); } r = await run(cmd, { APP_URL: viteUrl }, timeout); }
  const ok = r.code === 0; results.push({ name, ok, s: Math.round((Date.now() - t0) / 1000) }); console.log(`${ok ? '✔' : '✖'} ${name} (${results.at(-1).s} s)`);
  if (!ok) console.log(r.out.split('\n').filter((l) => !/^PASS/.test(l)).slice(-25).join('\n'));
}
await stop(vite); rmSync(tmp, { recursive: true, force: true });
const bad = results.filter((x) => !x.ok); console.log(`\n${results.length - bad.length}/${results.length} pruebas correctas${bad.length ? ' · fallan: ' + bad.map((x) => x.name).join(', ') : ''}`); process.exit(bad.length ? 1 : 0);
