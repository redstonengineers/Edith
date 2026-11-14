import type { Group, ScheduleSlot } from '@/types';
import { hhmmToMin } from '@/utils/format';

const overlap = (a: ScheduleSlot, b: ScheduleSlot) => a.weekday === b.weekday && hhmmToMin(a.start) < hhmmToMin(b.end) && hhmmToMin(b.start) < hhmmToMin(a.end);
const DAYS = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

export interface Conflict { kind: 'teacher' | 'classroom'; withGroup: string; message: string }

/** Detecta solapes de profesor y aula entre un grupo candidato y el resto. Reutilizable en el calendario (Fase 3). */
export function groupConflicts(candidate: Pick<Group, 'id' | 'teacherId' | 'classroomId' | 'slots'>, others: Group[], names: { teacher: string; classroom: string }): Conflict[] {
  const out: Conflict[] = [];
  for (const g of others) {
    if (g.id === candidate.id || !g.active) continue;
    for (const a of candidate.slots) for (const b of g.slots) {
      if (!overlap(a, b)) continue;
      const when = `${DAYS[a.weekday]} ${a.start}–${a.end}`;
      if (g.teacherId === candidate.teacherId) out.push({ kind: 'teacher', withGroup: g.name, message: `${names.teacher} ya imparte «${g.name}» el ${when}.` });
      if (g.classroomId === candidate.classroomId) out.push({ kind: 'classroom', withGroup: g.name, message: `${names.classroom} está ocupada por «${g.name}» el ${when}.` });
    }
  }
  return out;
}
export { DAYS };
