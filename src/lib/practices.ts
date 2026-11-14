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

/** Exámenes de conducir: aprobados / presentados (los pendientes no cuentan). */
export function examStats(exams: { result: string }[]) {
  const done = exams.filter((e) => e.result !== 'pendiente'); const ok = done.filter((e) => e.result === 'aprobado').length;
  return { total: exams.length, done: done.length, ok, pct: done.length ? Math.round((ok / done.length) * 100) : null };
}

/** CSV sencillo (coma o punto y coma, comillas dobles). Devuelve filas de celdas. */
export function parseCsv(text: string): string[][] {
  const t = text.replace(/^﻿/, ''); const first = t.split(/\r?\n/, 1)[0] ?? ''; const sep = (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some((x) => x.trim())) rows.push(row); row = []; }
    else cell += c;
  }
  row.push(cell); if (row.some((x) => x.trim())) rows.push(row);
  return rows.map((r) => r.map((x) => x.trim()));
}

/** dd/mm/aaaa o aaaa-mm-dd → aaaa-mm-dd ('' si no es válida). */
export function normDate(s: string): string {
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/); const iso = m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : s;
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(Date.parse(iso)) ? iso : '';
}
