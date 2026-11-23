import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Database } from '../src/data/db';
import { decryptBlob, decryptRow, encryptBlob, encryptRow, isBlob, type FieldCipher } from './fieldcrypto';

type Row = { academyId?: string; id?: string };
export interface AccessRecord { academyId: string; userId: string; userName: string; role: string; action: 'view' | 'export' | 'report'; entity: string; entityId?: string; subject?: string; detail?: string }
export interface AccessEntry { id: number; ts: string; userId: string; userName: string; role: string; action: 'view' | 'export' | 'report'; entity: string; entityId: string | null; subject: string | null; detail: string | null }
const TABLES = ['academies', 'settings', 'users', 'students', 'guardians', 'teachers', 'subjects', 'classrooms', 'groups', 'classes', 'enrollments', 'waitlist', 'attendance', 'exams', 'grades', 'payments', 'incidents', 'documents', 'notifications', 'messages', 'activity', 'vehicles', 'practices', 'outbox'] as const;
const rowKey = (t: string, r: Row) => (t === 'academies' ? r.id! : t === 'settings' ? r.academyId! : r.id!);
const tenantOf = (t: string, r: Row) => (t === 'academies' ? r.id! : r.academyId!);

/**
 * Persistencia SQLite. Cada entidad se guarda con su (tabla, id, academy_id) como columnas indexadas y el cuerpo en JSON.
 * Es el puente hacia PostgreSQL: mismas claves, y academy_id listo para Row Level Security.
 * El servidor mantiene el dominio en memoria y vuelca a disco solo las filas que cambian (en una transacción).
 */
export class Store {
  private db: DatabaseSync;
  private shadow = new Map<string, string>();

  /** Filas leídas que deben reescribirse (migración a cifrado o rotación de clave): no entran en `shadow`, así el siguiente volcado las guarda. */
  migrated = 0;

  constructor(path: string, private cipher: FieldCipher | null = null) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS entities (tbl TEXT NOT NULL, id TEXT NOT NULL, academy_id TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY (tbl, id));
      CREATE INDEX IF NOT EXISTS idx_entities_tenant ON entities (academy_id, tbl);
      CREATE TABLE IF NOT EXISTS personal (profile TEXT PRIMARY KEY, rev INTEGER NOT NULL, body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, academy_id TEXT NOT NULL, expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS access_log (id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL, academy_id TEXT NOT NULL, user_id TEXT NOT NULL, user_name TEXT NOT NULL, role TEXT NOT NULL, action TEXT NOT NULL, entity TEXT NOT NULL, entity_id TEXT, subject TEXT, detail TEXT);
      CREATE INDEX IF NOT EXISTS idx_access_log ON access_log (academy_id, ts);`);
  }

  getMeta(k: string): string | null { return (this.db.prepare('SELECT v FROM meta WHERE k = ?').get(k) as { v: string } | undefined)?.v ?? null; }
  setMeta(k: string, v: string) { this.db.prepare('INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v').run(k, v); }

  personalGet(profile: string): { rev: number; body: string } | null {
    const r = (this.db.prepare('SELECT rev, body FROM personal WHERE profile = ?').get(profile) as { rev: number; body: string } | undefined) ?? null;
    return r ? { rev: r.rev, body: decryptBlob(this.cipher, r.body) } : null;
  }
  private personalRaw(profile: string) { return (this.db.prepare('SELECT rev FROM personal WHERE profile = ?').get(profile) as { rev: number } | undefined) ?? null; }
  /** Cifra el estado personal que aún esté en claro (migración idempotente). */
  encryptPersonal() {
    if (!this.cipher) return 0; let n = 0;
    for (const r of this.db.prepare('SELECT profile, body FROM personal').all() as { profile: string; body: string }[]) {
      const plain = decryptBlob(this.cipher, r.body); if (isBlob(r.body) && this.cipher.isCurrent(r.body)) continue;
      this.db.prepare('UPDATE personal SET body = ? WHERE profile = ?').run(encryptBlob(this.cipher, plain), r.profile); n++;
    }
    return n;
  }
  /** Guarda el estado personal con control de versión (rev): devuelve null si otro dispositivo escribió antes. */
  personalPut(profile: string, body: string, baseRev: number): number | null {
    const cur = this.personalRaw(profile); const rev = cur?.rev ?? 0; if (baseRev !== rev) return null;
    this.db.prepare('INSERT INTO personal (profile, rev, body) VALUES (?, ?, ?) ON CONFLICT(profile) DO UPDATE SET rev = excluded.rev, body = excluded.body').run(profile, rev + 1, this.cipher ? encryptBlob(this.cipher, body) : body); return rev + 1;
  }

  /** Copia consistente de toda la base (VACUUM INTO) en `dir`; conserva solo las últimas `keep`. Devuelve la ruta creada. */
  backup(dir: string, keep = 7): string {
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `academy-${new Date().toISOString().replace(/[:.]/g, '-')}.db`);
    this.db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
    const old = readdirSync(dir).filter((f) => /^academy-.*\.db$/.test(f)).sort().slice(0, -keep);
    for (const f of old) rmSync(join(dir, f), { force: true });
    return file;
  }

  countEntities() { return (this.db.prepare('SELECT COUNT(*) AS n FROM entities').get() as { n: number }).n; }
  /** Comprobación mínima de que la base responde (para /api/health). */
  ping() { return (this.db.prepare('SELECT 1 AS ok').get() as { ok: number }).ok === 1; }
  isEmpty() { return (this.db.prepare('SELECT COUNT(*) AS n FROM entities').get() as { n: number }).n === 0; }
  wipe() { this.db.exec('DELETE FROM entities; DELETE FROM sessions;'); this.shadow.clear(); }

  load(): Database {
    this.shadow.clear(); this.migrated = 0;
    const db = Object.fromEntries(TABLES.map((t) => [t, [] as unknown[]])) as unknown as Database;
    for (const r of this.db.prepare('SELECT tbl, id, body FROM entities').all() as { tbl: string; id: string; body: string }[]) {
      const row = JSON.parse(r.body) as Record<string, unknown>; const rewrite = decryptRow(this.cipher, r.tbl, row);
      (db as unknown as Record<string, unknown[]>)[r.tbl]?.push(row);
      if (rewrite) this.migrated++; else this.shadow.set(`${r.tbl}/${r.id}`, JSON.stringify(row));
    }
    return db;
  }

  /**
   * Deshace en memoria los cambios sin guardar de UN negocio: sustituye sus filas por las del disco, en sitio (las referencias a los arrays
   * siguen valiendo) y sin tocar a los demás negocios. Sirve para revertir una operación fallida sin afectar a operaciones de otros negocios.
   */
  rollbackAcademy(live: Database, academyId: string) {
    const fresh: Record<string, unknown[]> = Object.fromEntries(TABLES.map((t) => [t, []]));
    for (const r of this.db.prepare('SELECT tbl, body FROM entities WHERE academy_id = ?').all(academyId) as { tbl: string; body: string }[]) {
      const row = JSON.parse(r.body) as Record<string, unknown>; decryptRow(this.cipher, r.tbl, row); fresh[r.tbl]?.push(row);
    }
    for (const t of TABLES) { const arr = (live as unknown as Record<string, Row[]>)[t]; arr.splice(0, arr.length, ...arr.filter((x) => tenantOf(t, x) !== academyId), ...(fresh[t] as Row[])); }
  }

  /** Vuelca los cambios respecto a lo ya guardado. */
  flush(db: Database) {
    const seen = new Set<string>(); const up = this.db.prepare('INSERT INTO entities (tbl, id, academy_id, body) VALUES (?, ?, ?, ?) ON CONFLICT(tbl, id) DO UPDATE SET body = excluded.body, academy_id = excluded.academy_id');
    const del = this.db.prepare('DELETE FROM entities WHERE tbl = ? AND id = ?');
    this.db.exec('BEGIN');
    try {
      for (const t of TABLES) for (const r of (db as unknown as Record<string, Row[]>)[t]) {
        const id = rowKey(t, r); const k = `${t}/${id}`; const body = JSON.stringify(r); seen.add(k);
        if (this.shadow.get(k) !== body) { up.run(t, id, tenantOf(t, r), this.cipher ? JSON.stringify(encryptRow(this.cipher, t, r)) : body); this.shadow.set(k, body); }
      }
      for (const k of [...this.shadow.keys()]) if (!seen.has(k)) { const [t, ...rest] = k.split('/'); del.run(t, rest.join('/')); this.shadow.delete(k); }
      this.db.exec('COMMIT');
    } catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }

  // ── registro de accesos a fichas de pacientes/alumnos (quién consulta o exporta qué) ──
  /** Anota un acceso. El nombre de la persona consultada se guarda cifrado si hay clave. */
  logAccess(r: AccessRecord) {
    this.db.prepare('INSERT INTO access_log (ts, academy_id, user_id, user_name, role, action, entity, entity_id, subject, detail) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(new Date().toISOString(), r.academyId, r.userId, r.userName, r.role, r.action, r.entity, r.entityId ?? null, r.subject ? (this.cipher ? encryptBlob(this.cipher, r.subject) : r.subject) : null, r.detail ?? null);
  }
  listAccess(academyId: string, f: { userId?: string; from?: string; to?: string; limit?: number }): AccessEntry[] {
    const where = ['academy_id = ?']; const args: (string | number)[] = [academyId];
    if (f.userId) { where.push('user_id = ?'); args.push(f.userId); } if (f.from) { where.push('ts >= ?'); args.push(f.from); } if (f.to) { where.push('ts <= ?'); args.push(f.to); }
    const rows = this.db.prepare(`SELECT id, ts, user_id AS userId, user_name AS userName, role, action, entity, entity_id AS entityId, subject, detail FROM access_log WHERE ${where.join(' AND ')} ORDER BY id DESC LIMIT ?`).all(...args, Math.min(f.limit ?? 200, 1000)) as unknown as (AccessEntry & { subject: string | null })[];
    return rows.map((r) => ({ ...r, subject: r.subject ? decryptBlob(this.cipher, r.subject) : null }));
  }
  /** Borra los accesos anteriores a `beforeIso` (retención). */
  purgeAccess(beforeIso: string) { this.db.prepare('DELETE FROM access_log WHERE ts < ?').run(beforeIso); }

  // ── sesiones (solo el hash del token) ──
  saveSession(hash: string, userId: string, academyId: string, expiresAt: number) { this.db.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?)').run(hash, userId, academyId, expiresAt); }
  findSession(hash: string) { return this.db.prepare('SELECT user_id AS userId, academy_id AS academyId, expires_at AS expiresAt FROM sessions WHERE token_hash = ?').get(hash) as { userId: string; academyId: string; expiresAt: number } | undefined; }
  deleteSession(hash: string) { this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hash); }
  deleteAcademySessions(academyId: string) { this.db.prepare('DELETE FROM sessions WHERE academy_id = ?').run(academyId); }
  deleteUserSessions(userId: string) { this.db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId); }
  purgeSessions(now: number) { this.db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now); }
  close() { this.db.close(); }
}
