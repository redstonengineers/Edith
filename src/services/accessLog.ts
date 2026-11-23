import { IS_API } from './mode';
import { get, post } from './http';

/** Registro de accesos a fichas, exportaciones e informes con datos de personas. En modo API lo guarda el servidor; en modo local, en este navegador. */
export interface AccessEntry { id: number; ts: string; userId: string; userName: string; role: string; action: 'view' | 'export' | 'report'; entity: string; entityId: string | null; subject: string | null; detail: string | null }
export interface AccessFilter { user?: string; from?: string; to?: string }
export interface AccessLogData { entries: AccessEntry[]; users: { id: string; name: string }[] }

const KEY = 'edith.accesslog.v1';
const local = (): AccessEntry[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as AccessEntry[]; } catch { return []; } };

export interface AccessEvent { action: AccessEntry['action']; entity: 'student' | 'report'; id?: string; subject?: string; detail?: string; who?: { id: string; name: string; role: string } }

/** Anota un acceso (sin esperar ni molestar si falla). */
export function recordAccess(e: AccessEvent) {
  if (IS_API) { void post('/access-log', { action: e.action, entity: e.entity, id: e.id, detail: e.detail }).catch(() => undefined); return; }
  if (!e.who || e.who.role === 'ALUMNO' || e.who.role === 'TUTOR') return;
  const all = local(); all.unshift({ id: Date.now() + all.length, ts: new Date().toISOString(), userId: e.who.id, userName: e.who.name, role: e.who.role, action: e.action, entity: e.entity, entityId: e.id ?? null, subject: e.subject ?? null, detail: e.detail ?? null });
  try { localStorage.setItem(KEY, JSON.stringify(all.slice(0, 500))); } catch { /* sin espacio */ }
}

export async function fetchAccessLog(f: AccessFilter, people: { id: string; name: string }[] = []): Promise<AccessLogData> {
  if (IS_API) { const q = new URLSearchParams(); if (f.user) q.set('user', f.user); if (f.from) q.set('from', f.from); if (f.to) q.set('to', f.to); return get<AccessLogData>(`/access-log?${q}`); }
  const entries = local().filter((x) => (!f.user || x.userId === f.user) && (!f.from || x.ts.slice(0, 10) >= f.from) && (!f.to || x.ts.slice(0, 10) <= f.to));
  return { entries, users: people };
}
