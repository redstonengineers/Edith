import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Database } from '../src/data/db';

type Row = { academyId?: string; id?: string };
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

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS entities (tbl TEXT NOT NULL, id TEXT NOT NULL, academy_id TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY (tbl, id));
      CREATE INDEX IF NOT EXISTS idx_entities_tenant ON entities (academy_id, tbl);
      CREATE TABLE IF NOT EXISTS personal (profile TEXT PRIMARY KEY, rev INTEGER NOT NULL, body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, academy_id TEXT NOT NULL, expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL);`);
  }

  getMeta(k: string): string | null { return (this.db.prepare('SELECT v FROM meta WHERE k = ?').get(k) as { v: string } | undefined)?.v ?? null; }
  setMeta(k: string, v: string) { this.db.prepare('INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v').run(k, v); }

  personalGet(profile: string): { rev: number; body: string } | null { return (this.db.prepare('SELECT rev, body FROM personal WHERE profile = ?').get(profile) as { rev: number; body: string } | undefined) ?? null; }
  /** Guarda el estado personal con control de versión (rev): devuelve null si otro dispositivo escribió antes. */
  personalPut(profile: string, body: string, baseRev: number): number | null {
    const cur = this.personalGet(profile); const rev = cur?.rev ?? 0; if (baseRev !== rev) return null;
    this.db.prepare('INSERT INTO personal (profile, rev, body) VALUES (?, ?, ?) ON CONFLICT(profile) DO UPDATE SET rev = excluded.rev, body = excluded.body').run(profile, rev + 1, body); return rev + 1;
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

  isEmpty() { return (this.db.prepare('SELECT COUNT(*) AS n FROM entities').get() as { n: number }).n === 0; }
  wipe() { this.db.exec('DELETE FROM entities; DELETE FROM sessions;'); this.shadow.clear(); }

  load(): Database {
    this.shadow.clear();
    const db = Object.fromEntries(TABLES.map((t) => [t, [] as unknown[]])) as unknown as Database;
    for (const r of this.db.prepare('SELECT tbl, id, body FROM entities').all() as { tbl: string; id: string; body: string }[]) {
      (db as unknown as Record<string, unknown[]>)[r.tbl]?.push(JSON.parse(r.body));
      this.shadow.set(`${r.tbl}/${r.id}`, r.body);
    }
    return db;
  }

  /** Vuelca los cambios respecto a lo ya guardado. */
  flush(db: Database) {
    const seen = new Set<string>(); const up = this.db.prepare('INSERT INTO entities (tbl, id, academy_id, body) VALUES (?, ?, ?, ?) ON CONFLICT(tbl, id) DO UPDATE SET body = excluded.body, academy_id = excluded.academy_id');
    const del = this.db.prepare('DELETE FROM entities WHERE tbl = ? AND id = ?');
    this.db.exec('BEGIN');
    try {
      for (const t of TABLES) for (const r of (db as unknown as Record<string, Row[]>)[t]) {
        const id = rowKey(t, r); const k = `${t}/${id}`; const body = JSON.stringify(r); seen.add(k);
        if (this.shadow.get(k) !== body) { up.run(t, id, tenantOf(t, r), body); this.shadow.set(k, body); }
      }
      for (const k of [...this.shadow.keys()]) if (!seen.has(k)) { const [t, ...rest] = k.split('/'); del.run(t, rest.join('/')); this.shadow.delete(k); }
      this.db.exec('COMMIT');
    } catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }

  // ── sesiones (solo el hash del token) ──
  saveSession(hash: string, userId: string, academyId: string, expiresAt: number) { this.db.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?)').run(hash, userId, academyId, expiresAt); }
  findSession(hash: string) { return this.db.prepare('SELECT user_id AS userId, academy_id AS academyId, expires_at AS expiresAt FROM sessions WHERE token_hash = ?').get(hash) as { userId: string; academyId: string; expiresAt: number } | undefined; }
  deleteSession(hash: string) { this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hash); }
  deleteAcademySessions(academyId: string) { this.db.prepare('DELETE FROM sessions WHERE academy_id = ?').run(academyId); }
  deleteUserSessions(userId: string) { this.db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId); }
  purgeSessions(now: number) { this.db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now); }
  close() { this.db.close(); }
}
