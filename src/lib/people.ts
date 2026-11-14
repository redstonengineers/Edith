import { differenceInYears, parseISO } from 'date-fns';
import type { Group, Student, Subject, Teacher } from '@/types';
import type { Snapshot } from '@/services/repositories';
import { fmtDate } from '@/utils/format';
import { attendanceRates } from './metrics';

export const ageOf = (birth: string, now = new Date()) => differenceInYears(now, parseISO(birth));
export const fullName = (p: { firstName: string; lastName: string }) => `${p.firstName} ${p.lastName}`;

export type PayState = 'al_dia' | 'pendiente' | 'moroso' | 'sin_datos';
export interface StudentRow {
  student: Student; name: string; age: number; groups: Group[]; subjects: Subject[]; teachers: Teacher[];
  attendancePct: number | null; lowAttendance: boolean; pay: PayState; overdueAmount: number;
}

export function studentRows(snap: Snapshot): StudentRow[] {
  const rates = attendanceRates(snap);
  const th = snap.settings.attendanceAlertThreshold;
  return snap.students.map((s) => {
    const groups = snap.groups.filter((g) => s.groupIds.includes(g.id));
    const subjects = [...new Set(groups.map((g) => g.subjectId))].map((id) => snap.subjects.find((x) => x.id === id)).filter(Boolean) as Subject[];
    const teachers = [...new Set(groups.map((g) => g.teacherId))].map((id) => snap.teachers.find((x) => x.id === id)).filter(Boolean) as Teacher[];
    const r = rates.get(s.id);
    const pays = snap.payments.filter((p) => p.studentId === s.id);
    const overdue = pays.filter((p) => p.status === 'vencido');
    const pay: PayState = !pays.length ? 'sin_datos' : overdue.length ? 'moroso' : pays.some((p) => p.status === 'pendiente') ? 'pendiente' : 'al_dia';
    return { student: s, name: fullName(s), age: ageOf(s.birthDate), groups, subjects, teachers, attendancePct: r && r.total >= 3 ? r.pct : null, lowAttendance: !!r && r.total >= 5 && r.pct < th, pay, overdueAmount: overdue.reduce((a, p) => a + p.amount, 0) };
  });
}

export interface TimelineEvent { id: string; date: string; text: string; tone: 'neutral' | 'ok' | 'warn' | 'bad' }

export function studentTimeline(snap: Snapshot, s: Student): TimelineEvent[] {
  const ev: TimelineEvent[] = [{ id: 'enr', date: s.enrolledAt, text: 'Alta como alumno', tone: 'ok' }];
  for (const p of snap.payments.filter((x) => x.studentId === s.id)) {
    if (p.status === 'pagado' && p.paidAt) ev.push({ id: `p${p.id}`, date: p.paidAt, text: `Pago recibido · ${p.concept}`, tone: 'ok' });
    if (p.status === 'vencido') ev.push({ id: `p${p.id}`, date: p.dueDate, text: `Pago vencido · ${p.concept}`, tone: 'bad' });
  }
  const classDate = new Map(snap.classes.map((c) => [c.id, c.date]));
  for (const a of snap.attendance.filter((x) => x.studentId === s.id && (x.status === 'ausente' || x.status === 'retraso'))) {
    const d = classDate.get(a.classId); if (d) ev.push({ id: `a${a.id}`, date: d, text: a.status === 'ausente' ? 'Falta registrada' : 'Retraso registrado', tone: 'warn' });
  }
  for (const l of snap.activity.filter((x) => x.entityId === s.id)) ev.push({ id: l.id, date: l.at.slice(0, 10), text: l.summary, tone: 'neutral' });
  for (const i of snap.incidents.filter((x) => x.relatedStudentId === s.id)) ev.push({ id: i.id, date: i.createdAt, text: `Incidencia: ${i.title}`, tone: 'warn' });
  return ev.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 25);
}
export const fmtEventDate = (d: string) => fmtDate(d, "d 'de' MMMM");

export function teacherStats(snap: Snapshot, t: Teacher, todayISO: string) {
  const groups = snap.groups.filter((g) => g.teacherId === t.id && g.active);
  const mine = snap.classes.filter((c) => c.teacherId === t.id);
  const hours = (cs: typeof mine) => cs.reduce((a, c) => { const [h1, m1] = c.start.split(':').map(Number); const [h2, m2] = c.end.split(':').map(Number); return a + (h2 * 60 + m2 - h1 * 60 - m1) / 60; }, 0);
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const ws = weekStart.toISOString().slice(0, 10); const we = new Date(weekStart.getTime() + 6 * 864e5).toISOString().slice(0, 10);
  const students = new Set(snap.students.filter((s) => s.groupIds.some((g) => groups.some((x) => x.id === g))).map((s) => s.id));
  return {
    groups, students: students.size,
    taughtHours: hours(mine.filter((c) => c.status === 'impartida')),
    weekHours: hours(mine.filter((c) => c.date >= ws && c.date <= we && c.status !== 'cancelada')),
    upcoming: mine.filter((c) => c.date >= todayISO && c.status === 'programada').sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)).slice(0, 8),
    incidents: snap.incidents.filter((i) => i.relatedTeacherId === t.id),
  };
}

export function groupStats(snap: Snapshot, g: Group) {
  const members = snap.students.filter((s) => s.groupIds.includes(g.id) && s.status !== 'baja');
  const classIds = new Set(snap.classes.filter((c) => c.groupId === g.id && c.status === 'impartida').map((c) => c.id));
  const att = snap.attendance.filter((a) => classIds.has(a.classId));
  const attendancePct = att.length ? (att.filter((a) => a.status === 'presente' || a.status === 'retraso').length / att.length) * 100 : null;
  const exams = snap.exams.filter((e) => e.groupId === g.id);
  const scores = snap.grades.filter((gr) => exams.some((e) => e.id === gr.examId) && gr.score !== null).map((gr) => gr.score as number);
  return { members, attendancePct, exams, avgGrade: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null, pct: g.capacity ? (members.length / g.capacity) * 100 : 0 };
}

export function enrollmentName(snap: Snapshot, e: { applicant?: { name: string }; studentId?: string }) {
  if (e.applicant) return e.applicant.name;
  const s = snap.students.find((x) => x.id === e.studentId);
  return s ? fullName(s) : 'Alumno';
}
