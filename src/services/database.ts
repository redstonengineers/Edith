import { generateDatabase } from '@/data/seed';
import type { Database } from '@/data/db';
import { todayISO } from '@/utils/format';
import { registerPermissionOverrides } from '@/lib/permissions';

function syncOverrides(d: Database) { for (const st of d.settings) registerPermissionOverrides(st.academyId, st.permissionOverrides); }

const KEY = 'ac.db.v4';
let db: Database | null = null;
let persistHook: (() => void) | null = null;

/** El servidor instala su propia base (cargada de SQLite) y un gancho de persistencia; el navegador usa localStorage. */
export function installDatabase(d: Database, hook: () => void) { db = d; persistHook = hook; syncOverrides(d); }

/** Singleton de la base. En el navegador (modo demo) se persiste en localStorage y se regenera cada día. */
export function getDatabase(): Database {
  if (db) return db;
  if (typeof localStorage === 'undefined') throw new Error('Base de datos no inicializada');
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const s = JSON.parse(raw) as { day: string; db: Database }; if (s.day === todayISO()) { db = s.db; syncOverrides(db); return db; } }
  } catch { /* datos corruptos: se regenera */ }
  db = generateDatabase(new Date());
  syncOverrides(db);
  persist();
  return db;
}

export { syncOverrides };
export function persist() {
  if (persistHook) return persistHook();
  if (!db || typeof localStorage === 'undefined') return;
  try { localStorage.setItem(KEY, JSON.stringify({ day: todayISO(), db })); } catch { /* cuota llena: se sigue en memoria */ }
}

export function resetDatabase() { localStorage.removeItem(KEY); db = null; getDatabase(); }
