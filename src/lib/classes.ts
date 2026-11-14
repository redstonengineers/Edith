import type { ClassSession } from '@/types';
import { hhmmToMin } from '@/utils/format';

export const minToHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const overlap = (a: Pick<ClassSession, 'start' | 'end'>, b: Pick<ClassSession, 'start' | 'end'>) => hhmmToMin(a.start) < hhmmToMin(b.end) && hhmmToMin(b.start) < hhmmToMin(a.end);

export interface SessionConflict { kind: 'teacher' | 'classroom' | 'group'; otherId: string; message: string }
type Cand = Pick<ClassSession, 'id' | 'date' | 'start' | 'end' | 'teacherId' | 'classroomId' | 'groupId'>;
export interface Names { teacher: (id: string) => string; classroom: (id: string) => string; group: (id: string) => string }

/** Solapes de profesor, aula o grupo con otras sesiones no canceladas del mismo día. */
export function sessionConflicts(c: Cand, all: ClassSession[], n: Names): SessionConflict[] {
  const out: SessionConflict[] = [];
  for (const o of all) {
    if (o.id === c.id || o.date !== c.date || o.status === 'cancelada' || !overlap(c, o)) continue;
    const when = `${o.start}–${o.end}`;
    if (o.teacherId === c.teacherId) out.push({ kind: 'teacher', otherId: o.id, message: `${n.teacher(c.teacherId)} tiene dos clases simultáneas (${n.group(o.groupId)}, ${when}).` });
    if (o.classroomId === c.classroomId) out.push({ kind: 'classroom', otherId: o.id, message: `${n.classroom(c.classroomId)} está ocupada por ${n.group(o.groupId)} (${when}).` });
    if (o.groupId === c.groupId) out.push({ kind: 'group', otherId: o.id, message: `${n.group(c.groupId)} ya tiene otra clase a esa hora (${when}).` });
  }
  return out;
}

/** Mapa id → conflictos para pintar avisos en el calendario. */
export function conflictMap(sessions: ClassSession[], n: Names): Map<string, SessionConflict[]> {
  const m = new Map<string, SessionConflict[]>();
  const byDate = new Map<string, ClassSession[]>();
  for (const s of sessions) if (s.status !== 'cancelada') (byDate.get(s.date) ?? byDate.set(s.date, []).get(s.date)!).push(s);
  for (const list of byDate.values()) for (const s of list) { const c = sessionConflicts(s, list, n); if (c.length) m.set(s.id, c); }
  return m;
}

/** Reparte eventos solapados en columnas (lanes) para que no se pisen visualmente. */
export function layoutLanes<T extends { id: string; start: string; end: string }>(events: T[]): Map<string, { lane: number; lanes: number }> {
  const sorted = [...events].sort((a, b) => hhmmToMin(a.start) - hhmmToMin(b.start) || hhmmToMin(b.end) - hhmmToMin(a.end));
  const res = new Map<string, { lane: number; lanes: number }>();
  let cluster: T[] = []; let clusterEnd = -1;
  const flush = () => {
    const ends: number[] = []; const assign = new Map<string, number>();
    for (const e of cluster) { let l = ends.findIndex((x) => x <= hhmmToMin(e.start)); if (l < 0) { l = ends.length; ends.push(0); } ends[l] = hhmmToMin(e.end); assign.set(e.id, l); }
    for (const e of cluster) res.set(e.id, { lane: assign.get(e.id)!, lanes: ends.length });
    cluster = [];
  };
  for (const e of sorted) { if (cluster.length && hhmmToMin(e.start) >= clusterEnd) flush(); cluster.push(e); clusterEnd = Math.max(clusterEnd, hhmmToMin(e.end)); }
  if (cluster.length) flush();
  return res;
}
