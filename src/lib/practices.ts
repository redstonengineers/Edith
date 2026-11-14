import type { ID, Practice, Student, Vehicle } from '@/types';
import { hhmmToMin } from '@/utils/format';

export interface PracticeLike { id: ID; studentId: ID; teacherId: ID; vehicleId?: ID; date: string; start: string; end: string }
export interface PracticeNames { student: (id: ID) => string; teacher: (id: ID) => string; vehicle: (id: ID) => string }
export interface PracticeConflict { kind: 'taller' | 'vehiculo' | 'profesor' | 'alumno'; message: string; /** Bloqueante: no se puede guardar ni forzando. */ hard?: boolean }

const overlap = (a: PracticeLike, b: PracticeLike) => a.date === b.date && hhmmToMin(a.start) < hhmmToMin(b.end) && hhmmToMin(b.start) < hhmmToMin(a.end);
export const minutesOf = (p: { start: string; end: string }) => Math.max(0, hhmmToMin(p.end) - hhmmToMin(p.start));
export const hoursOf = (p: { start: string; end: string }) => minutesOf(p) / 60;

/** Choques de una práctica con las demás: coche, profesor y alumno ocupados, y coche en el taller o dado de baja. */
export function practiceConflicts(p: PracticeLike, all: Practice[], vehicles: Vehicle[], n: PracticeNames): PracticeConflict[] {
  const out: PracticeConflict[] = []; const veh = p.vehicleId ? vehicles.find((v) => v.id === p.vehicleId) : undefined;
  if (veh && veh.status !== 'activo') out.push({ kind: 'taller', hard: true, message: `${veh.model} (${veh.plate}) ${veh.status === 'taller' ? 'está en el taller' : 'está dado de baja'}: no se puede usar en prácticas nuevas.` });
  for (const o of all) {
    if (o.id === p.id || o.status === 'cancelada' || !overlap(p, o)) continue;
    if (p.vehicleId && o.vehicleId === p.vehicleId) out.push({ kind: 'vehiculo', message: `${n.vehicle(o.vehicleId!)} ya está ocupado ese día de ${o.start} a ${o.end} con ${n.student(o.studentId)}.` });
    if (o.teacherId === p.teacherId) out.push({ kind: 'profesor', message: `${n.teacher(o.teacherId)} ya tiene otra práctica de ${o.start} a ${o.end} con ${n.student(o.studentId)}.` });
    if (o.studentId === p.studentId) out.push({ kind: 'alumno', message: `${n.student(o.studentId)} ya tiene otra práctica de ${o.start} a ${o.end}.` });
  }
  return out;
}

/** Horas hechas y programadas de un alumno, frente a su objetivo. */
export function studentProgress(s: Pick<Student, 'id' | 'targetHours'>, practices: Practice[]) {
  const mine = practices.filter((p) => p.studentId === s.id);
  const done = mine.filter((p) => p.status === 'hecha').reduce((a, p) => a + hoursOf(p), 0);
  const planned = mine.filter((p) => p.status === 'programada').reduce((a, p) => a + hoursOf(p), 0);
  const target = s.targetHours ?? 20;
  return { done, planned, target, left: Math.max(0, target - done), pct: Math.min(100, (done / target) * 100), km: mine.filter((p) => p.status === 'hecha').reduce((a, p) => a + (p.km ?? 0), 0) };
}
export const fmtHours = (h: number) => `${(Math.round(h * 10) / 10).toString().replace('.', ',')} h`;

/** Aviso de vencimiento: días hasta la fecha (negativo = vencido). */
export const daysTo = (iso: string | undefined, today = new Date()) => iso ? Math.round((new Date(iso + 'T00:00:00').getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86_400_000) : null;
