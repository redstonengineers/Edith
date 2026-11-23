// Cifrado de datos personales y de salud (AES-256-GCM), migración, rotación de clave, copia de seguridad y subida a S3.
// Uso: npx tsx tests/cifrado.ts
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { generateDatabase } from '../src/data/seed';
import { Store } from '../server/store';
import { FieldCipher } from '../server/fieldcrypto';
import { runBackup, s3Put, verifyBackup } from '../server/backup';

let fails = 0; const ok = (c: boolean, m: string) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const throws = (f: () => unknown) => { try { f(); return false; } catch { return true; } };
const dir = mkdtempSync(join(tmpdir(), 'cifrado-')); const K1 = randomBytes(32).toString('base64'); const K2 = randomBytes(32).toString('base64');
const dump = (path: string) => { const d = new DatabaseSync(path, { readOnly: true }); const rows = d.prepare('SELECT body FROM entities').all() as { body: string }[]; const per = d.prepare('SELECT body FROM personal').all() as { body: string }[]; d.close(); return rows.map((r) => r.body).concat(per.map((r) => r.body)).join('\n'); };
const fileBytes = (path: string) => readdirSync(dir).filter((f) => f.startsWith(path.split('/').pop()!)).map((f) => readFileSync(join(dir, f)).toString('latin1')).join('');

const src = generateDatabase(new Date()); const sample = src.students.slice(0, 40);
const sensitive = [...sample.map((s) => s.email), ...sample.map((s) => s.phone), ...sample.filter((s) => s.notes).map((s) => s.notes), ...src.guardians.slice(0, 10).map((g) => g.email)].filter((x) => x && x.length > 5);
const hasPlain = (text: string) => sensitive.filter((v) => text.includes(v)).length;

// 1. Con clave: el volcado en bruto no muestra datos de personas y un reinicio los lee bien
const p1 = join(dir, 'a.db'); let st = new Store(p1, new FieldCipher(K1)); st.load(); st.flush(src); st.personalPut('gazael', JSON.stringify({ nota: 'dato muy personal 600123456' }), 0); st.close();
const raw = dump(p1); ok(hasPlain(raw) === 0, 'volcado en bruto: ningún correo, teléfono ni nota de alumnos/tutores en claro'); ok(!raw.includes('dato muy personal'), 'el estado del modo personal también va cifrado');
ok(raw.includes('"firstName"') && raw.includes('enc:v1:'), 'los campos no sensibles (nombre, estado) siguen legibles y los sensibles llevan «enc:v1:»');
ok(hasPlain(fileBytes(p1)) === 0, 'tampoco aparecen en el archivo de la base (ni en el WAL)');
st = new Store(p1, new FieldCipher(K1)); const back = st.load();
ok(JSON.stringify(back.students) === JSON.stringify(src.students) && JSON.stringify(back.guardians) === JSON.stringify(src.guardians) && JSON.stringify(back.enrollments) === JSON.stringify(src.enrollments), 'reinicio con la clave: alumnos, tutores y matrículas idénticos');
ok(st.migrated === 0 && JSON.parse(st.personalGet('gazael')!.body).nota.includes('600123456'), 'reinicio: nada que migrar y el estado personal se descifra');
st.flush(back); ok(dump(p1) === raw || hasPlain(dump(p1)) === 0, 'volver a volcar sin cambios no deja datos en claro'); st.close();

// 2. Clave ausente o equivocada
ok(throws(() => new Store(p1, null).load()), 'sin clave la base cifrada NO se lee (falla con mensaje claro)');
ok(throws(() => new Store(p1, new FieldCipher(K2)).load()), 'con otra clave tampoco');
ok(throws(() => new FieldCipher('corta')), 'una clave que no son 32 bytes se rechaza');

// 3. Migración idempotente: base antigua en claro → cifrada
const p2 = join(dir, 'b.db'); let old = new Store(p2, null); old.load(); old.flush(src); old.personalPut('gazael', JSON.stringify({ x: 'privado 611223344' }), 0); old.close();
ok(hasPlain(dump(p2)) > 0, 'base antigua: los datos están en claro (punto de partida)');
let mig = new Store(p2, new FieldCipher(K1)); const d2 = mig.load(); const n1 = mig.migrated; const pn = mig.encryptPersonal(); mig.flush(d2); mig.close();
ok(n1 > 0 && pn === 1, `migración: ${n1} registros y ${pn} estado personal cifrados`); ok(hasPlain(dump(p2)) === 0 && !dump(p2).includes('611223344'), 'tras migrar no queda nada en claro');
mig = new Store(p2, new FieldCipher(K1)); mig.load(); ok(mig.migrated === 0 && mig.encryptPersonal() === 0, 'segunda ejecución: idempotente (nada que migrar)'); mig.close();

// 4. Rotación de clave
const p3 = join(dir, 'c.db'); let r = new Store(p3, new FieldCipher(K1)); r.load(); r.flush(src); r.close();
r = new Store(p3, new FieldCipher(K2, [K1])); const d3 = r.load(); ok(r.migrated > 0 && JSON.stringify(d3.students) === JSON.stringify(src.students), 'rotación: con la clave nueva + la anterior se lee todo y se marca para re-cifrar'); r.flush(d3); r.close();
r = new Store(p3, new FieldCipher(K2)); const d4 = r.load(); ok(r.migrated === 0 && JSON.stringify(d4.students) === JSON.stringify(src.students), 'después de rotar basta la clave nueva'); r.close();
ok(throws(() => new Store(p3, new FieldCipher(K1)).load()), 'la clave antigua sola ya no abre los datos');

// 5. Copia de seguridad: comprobación de restauración y subida a S3 (simulada, firmada SigV4)
const puts: { url: string; auth: string; size: number }[] = []; const fake = (async (url: URL | string, init?: RequestInit) => { puts.push({ url: String(url), auth: String((init!.headers as Record<string, string>).authorization), size: (init!.body as Uint8Array).length }); return new Response('', { status: 200 }); }) as unknown as typeof fetch;
const s3 = { endpoint: 'https://s3.example.test', bucket: 'copias', key: 'AKIATEST', secret: 'secreto', region: 'eu-west-1' };
r = new Store(p3, new FieldCipher(K2)); r.load(); const bk = await runBackup(r, join(dir, 'bk'), 3, s3, fake);
ok(bk.verified && bk.entities > 100 && bk.uploaded && !bk.error, `copia local comprobada (${bk.entities} registros) y subida`);
ok(puts.length === 1 && puts[0].url.startsWith('https://s3.example.test/copias/edith/academy-') && /^AWS4-HMAC-SHA256 Credential=AKIATEST\/\d{8}\/eu-west-1\/s3\/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/.test(puts[0].auth) && puts[0].size > 1000, 'la subida va a la ruta del bucket con firma SigV4');
ok(r.getMeta('backup_last_ok') === '1' && !!r.getMeta('backup_last_at'), 'queda registrada la fecha y el resultado de la última copia (para /api/health)');
ok(hasPlain(dump(bk.file)) === 0, 'la copia conserva el cifrado (no contiene datos en claro)');
const bad = join(dir, 'roto.db'); await import('node:fs').then((fs) => fs.writeFileSync(bad, 'esto no es una base de datos')); ok(!verifyBackup(bad).ok, 'una copia corrupta se detecta');
const failing = (async () => new Response('no', { status: 403 })) as unknown as typeof fetch; const bk2 = await runBackup(r, join(dir, 'bk'), 3, s3, failing);
ok(bk2.verified && !bk2.uploaded && /S3/.test(bk2.error ?? '') && r.getMeta('backup_last_ok') === '0', 'si la subida falla se avisa y /api/health lo verá'); r.close();
void s3Put;
rmSync(dir, { recursive: true, force: true });
console.log(fails ? `${fails} FALLOS` : 'TODO OK'); process.exit(fails ? 1 : 0);
