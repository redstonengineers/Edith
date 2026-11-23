import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { createHash, createHmac } from 'node:crypto';
import type { Store } from './store';

export interface S3Config { endpoint: string; bucket: string; key: string; secret: string; region: string }
export const s3FromEnv = (env = process.env): S3Config | null => env.BACKUP_S3_ENDPOINT && env.BACKUP_S3_BUCKET && env.BACKUP_S3_KEY && env.BACKUP_S3_SECRET
  ? { endpoint: env.BACKUP_S3_ENDPOINT.replace(/\/+$/, ''), bucket: env.BACKUP_S3_BUCKET, key: env.BACKUP_S3_KEY, secret: env.BACKUP_S3_SECRET, region: env.BACKUP_S3_REGION ?? 'us-east-1' } : null;

const sha = (d: string | Buffer) => createHash('sha256').update(d).digest('hex');
const hmac = (k: string | Buffer, d: string) => createHmac('sha256', k).update(d).digest();

/** Sube un archivo a un almacenamiento compatible con S3 (AWS, Cloudflare R2, Backblaze, MinIO…) con firma SigV4 y direcciones tipo ruta. */
export async function s3Put(c: S3Config, objectKey: string, body: Buffer, fetchImpl: typeof fetch = fetch): Promise<void> {
  const url = new URL(`${c.endpoint}/${c.bucket}/${objectKey.split('/').map(encodeURIComponent).join('/')}`);
  const now = new Date(); const amz = now.toISOString().replace(/[:-]|\.\d{3}/g, ''); const date = amz.slice(0, 8); const payload = sha(body);
  const headers: Record<string, string> = { host: url.host, 'x-amz-content-sha256': payload, 'x-amz-date': amz };
  const signed = Object.keys(headers).sort(); const canonical = ['PUT', url.pathname, '', ...signed.map((h) => `${h}:${headers[h]}`), '', signed.join(';'), payload].join('\n');
  const scope = `${date}/${c.region}/s3/aws4_request`; const sts = ['AWS4-HMAC-SHA256', amz, scope, sha(canonical)].join('\n');
  const sig = createHmac('sha256', hmac(hmac(hmac(hmac('AWS4' + c.secret, date), c.region), 's3'), 'aws4_request')).update(sts).digest('hex');
  const res = await fetchImpl(url, { method: 'PUT', body: new Uint8Array(body), headers: { ...headers, authorization: `AWS4-HMAC-SHA256 Credential=${c.key}/${scope}, SignedHeaders=${signed.join(';')}, Signature=${sig}` }, signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`S3 respondió ${res.status}`);
}

/** Comprueba que una copia se puede abrir y restaurar: integridad de SQLite y tablas con datos (si la base viva los tenía). */
export function verifyBackup(file: string, liveEntities?: number): { ok: boolean; entities: number; error?: string } {
  let db: DatabaseSync | null = null;
  try {
    db = new DatabaseSync(file, { readOnly: true });
    const ic = (db.prepare('PRAGMA integrity_check').get() as { integrity_check: string }).integrity_check; if (ic !== 'ok') return { ok: false, entities: 0, error: `integrity_check: ${ic}` };
    const entities = (db.prepare('SELECT COUNT(*) AS n FROM entities').get() as { n: number }).n;
    for (const t of ['entities', 'sessions', 'personal', 'meta']) db.prepare(`SELECT 1 FROM ${t} LIMIT 1`).get();
    if (liveEntities && liveEntities > 0 && entities === 0) return { ok: false, entities, error: 'la copia está vacía' };
    return { ok: true, entities };
  } catch (e) { return { ok: false, entities: 0, error: (e as Error).message }; } finally { db?.close(); }
}

export interface BackupResult { file: string; verified: boolean; entities: number; uploaded: boolean; error?: string }

/** Copia local + comprobación + subida opcional a S3. Deja el resultado en `meta` para /api/health. */
export async function runBackup(store: Store, dir: string, keep: number, s3: S3Config | null, fetchImpl: typeof fetch = fetch): Promise<BackupResult> {
  const file = store.backup(dir, keep); const v = verifyBackup(file, store.countEntities()); let uploaded = false; let error = v.ok ? undefined : v.error;
  if (v.ok && s3) { try { await s3Put(s3, `edith/${basename(file)}`, readFileSync(file), fetchImpl); uploaded = true; } catch (e) { error = `subida a S3: ${(e as Error).message}`; } }
  store.setMeta('backup_last_at', new Date().toISOString()); store.setMeta('backup_last_ok', v.ok && !error ? '1' : '0'); store.setMeta('backup_last_s3', uploaded ? '1' : '0'); if (error) store.setMeta('backup_last_error', error);
  return { file, verified: v.ok, entities: v.entities, uploaded, error };
}
