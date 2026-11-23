import { recordAccess } from '@/services/accessLog';
import { useSession } from '@/store/session';
import type { Snapshot } from '@/services/repositories';
import { attendanceRates, groupOccupancy } from './metrics';
import { ageOf, fullName, studentRows } from './people';
import { computeAnalytics } from './analytics';

export interface ReportData { columns: string[]; rows: (string | number)[][] }
export interface ReportDef { id: string; title: string; description: string; needs?: 'payments:read'; build(snap: Snapshot): ReportData }

export const REPORTS: ReportDef[] = [
  { id: 'students', title: 'Listado de alumnos activos', description: 'Datos de contacto, grupos y estado de cada alumno.', build: (s) => ({ columns: ['Nombre', 'Edad', 'Email', 'Teléfono', 'Grupos', 'Estado'], rows: studentRows(s).filter((r) => r.student.status === 'activo' || r.student.status === 'nuevo').map((r) => [r.name, r.age, r.student.email, r.student.phone, r.groups.map((g) => g.name).join(' / '), r.student.status]) }) },
  { id: 'attendance', title: 'Asistencia por alumno', description: 'Porcentaje de asistencia y alertas bajo el umbral.', build: (s) => { const rt = attendanceRates(s); return { columns: ['Alumno', 'Clases registradas', 'Asistencia %', 'Alerta'], rows: s.students.filter((x) => rt.has(x.id)).map((x) => { const r = rt.get(x.id)!; return [fullName(x), r.total, Math.round(r.pct), r.total >= 5 && r.pct < s.settings.attendanceAlertThreshold ? 'Bajo umbral' : '']; }).sort((a, b) => Number(a[2]) - Number(b[2])) }; } },
  { id: 'debt', title: 'Morosidad', description: 'Recibos vencidos por alumno e importe.', needs: 'payments:read', build: (s) => ({ columns: ['Alumno', 'Concepto', 'Importe (€)', 'Vencimiento'], rows: s.payments.filter((p) => p.status === 'vencido').map((p) => { const st = s.students.find((x) => x.id === p.studentId); return [st ? fullName(st) : '—', p.concept, p.amount, p.dueDate]; }).sort((a, b) => String(a[3]).localeCompare(String(b[3]))) }) },
  { id: 'occupancy', title: 'Ocupación de grupos', description: 'Plazas ocupadas y libres por grupo.', build: (s) => ({ columns: ['Grupo', 'Profesor', 'Ocupados', 'Capacidad', 'Ocupación %'], rows: groupOccupancy(s).map((o) => [o.group.name, (() => { const t = s.teachers.find((x) => x.id === o.group.teacherId); return t ? fullName(t) : ''; })(), o.count, o.group.capacity, Math.round(o.pct)]) }) },
  { id: 'grades', title: 'Rendimiento académico', description: 'Nota media y suspensos por alumno.', build: (s) => ({ columns: ['Alumno', 'Exámenes', 'Nota media', 'Suspensos'], rows: s.students.map((x) => { const g = s.grades.filter((y) => y.studentId === x.id && y.score !== null); return g.length ? [fullName(x), g.length, Math.round((g.reduce((a, y) => a + (y.score ?? 0), 0) / g.length) * 10) / 10, g.filter((y) => (y.score ?? 0) < 5).length] : null; }).filter(Boolean) as (string | number)[][] }) },
  { id: 'teachers', title: 'Carga docente', description: 'Horas de la semana, objetivo y clases impartidas.', build: (s) => ({ columns: ['Profesor', 'Horas semana', 'Objetivo', 'Clases impartidas'], rows: computeAnalytics(s).teachers.map((t) => [t.name, Math.round(t.week * 10) / 10, t.target, t.taught]) }) },
  { id: 'monthly', title: 'Evolución mensual', description: 'Altas, bajas y matriculados por mes (6 meses).', build: (s) => ({ columns: ['Mes', 'Matriculados', 'Altas', 'Bajas'], rows: computeAnalytics(s).monthly.map((m) => [m.full, m.enrolled, m.altas, m.bajas]) }) },
  { id: 'ages', title: 'Distribución por edad', description: 'Alumnos por tramo de edad.', build: (s) => { const b: Record<string, number> = { '<12': 0, '12–15': 0, '16–17': 0, '18–25': 0, '26+': 0 }; for (const x of s.students.filter((y) => y.status !== 'baja')) { const a = ageOf(x.birthDate); b[a < 12 ? '<12' : a < 16 ? '12–15' : a < 18 ? '16–17' : a < 26 ? '18–25' : '26+']++; } return { columns: ['Tramo', 'Alumnos'], rows: Object.entries(b) }; } },
];

/** CSV seguro: escapa comillas y neutraliza fórmulas (=,+,-,@) para evitar CSV injection al abrir en Excel. */
export function toCsv(d: ReportData): string {
  const cell = (v: string | number) => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s) && typeof v === 'string') s = `'${s}`; return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return '﻿' + [d.columns, ...d.rows].map((r) => r.map(cell).join(';')).join('\n');
}
export function downloadCsv(name: string, d: ReportData) {
  const u = useSession.getState().user; recordAccess({ action: 'export', entity: 'report', detail: name, who: u ? { id: u.id, name: u.name, role: u.role } : undefined });
  const url = URL.createObjectURL(new Blob([toCsv(d)], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
}
