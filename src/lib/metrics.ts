import { addDays, format, parseISO } from 'date-fns';
import type { Snapshot } from '@/services/repositories';
import { hhmmToMin, todayISO } from '@/utils/format';

export type Rates = Map<string, { total: number; ok: number; pct: number }>;

/** % de asistencia por alumno = (presentes + retrasos) / registros. */
export function attendanceRates(snap: Snapshot): Rates {
  const m: Rates = new Map();
  for (const a of snap.attendance) {
    const r = m.get(a.studentId) ?? { total: 0, ok: 0, pct: 0 };
    r.total++;
    if (a.status === 'presente' || a.status === 'retraso') r.ok++;
    m.set(a.studentId, r);
  }
  for (const r of m.values()) r.pct = r.total ? (r.ok / r.total) * 100 : 100;
  return m;
}

export function lowAttendanceStudents(snap: Snapshot, minRecords = 5) {
  const th = snap.settings.attendanceAlertThreshold;
  const rates = attendanceRates(snap);
  return snap.students
    .filter((s) => s.status === 'activo' || s.status === 'nuevo')
    .map((s) => ({ student: s, rate: rates.get(s.id) }))
    .filter((x) => x.rate && x.rate.total >= minRecords && x.rate.pct < th)
    .sort((a, b) => a.rate!.pct - b.rate!.pct);
}

export function groupOccupancy(snap: Snapshot) {
  return snap.groups.filter((g) => g.active).map((g) => {
    const n = snap.students.filter((s) => s.groupIds.includes(g.id) && s.status !== 'baja').length;
    return { group: g, count: n, pct: g.capacity ? (n / g.capacity) * 100 : 0, full: n >= g.capacity };
  });
}

export interface AgendaItem {
  id: string; start: string; end: string; title: string; subtitle: string; room: string; status: 'done' | 'live' | 'next' | 'later' | 'cancelled'; color: string; groupId: string;
}

export function todayAgenda(snap: Snapshot, now = new Date(), dateISO = todayISO(now)): AgendaItem[] {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const isToday = dateISO === todayISO(now);
  const sorted = snap.classes.filter((c) => c.date === dateISO).sort((a, b) => a.start.localeCompare(b.start));
  let nextAssigned = false;
  return sorted.map((c) => {
    const g = snap.groups.find((x) => x.id === c.groupId);
    const subj = snap.subjects.find((s) => s.id === g?.subjectId);
    const t = snap.teachers.find((x) => x.id === c.teacherId);
    const room = snap.classrooms.find((r) => r.id === c.classroomId);
    let status: AgendaItem['status'] = 'later';
    if (c.status === 'cancelada') status = 'cancelled';
    else if (isToday) {
      if (nowMin >= hhmmToMin(c.end)) status = 'done';
      else if (nowMin >= hhmmToMin(c.start)) { status = 'live'; nextAssigned = true; }
      else if (!nextAssigned) { status = 'next'; nextAssigned = true; }
    }
    return {
      id: c.id, start: c.start, end: c.end, groupId: c.groupId, title: c.topic?.trim() || g?.name || 'Clase', color: subj?.color ?? 'var(--brand)',
      subtitle: t ? `${t.firstName} ${t.lastName}` : '', room: room?.name ?? '', status,
    };
  });
}

export interface Alert { id: string; level: 'warning' | 'danger' | 'info'; text: string; href: string }

export function computeDashboard(snap: Snapshot, now = new Date()) {
  const today = todayISO(now);
  const tomorrow = format(addDays(now, 1), 'yyyy-MM-dd');
  const in7 = format(addDays(now, 7), 'yyyy-MM-dd');
  const monthStart = format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd');

  const activeStudents = snap.students.filter((s) => s.status === 'activo' || s.status === 'nuevo');
  const newStudents = snap.students.filter((s) => s.status === 'nuevo');
  const agenda = todayAgenda(snap, now);
  const todayClasses = agenda.filter((a) => a.status !== 'cancelled');
  const teachersToday = new Set(snap.classes.filter((c) => c.date === today && c.status !== 'cancelada').map((c) => c.teacherId));

  const upcomingExams = snap.exams.filter((e) => e.date >= today && e.date <= in7 && e.status === 'pendiente').sort((a, b) => a.date.localeCompare(b.date));
  const examsTomorrow = snap.exams.filter((e) => e.date === tomorrow && e.status === 'pendiente');
  const examsToGrade = snap.exams.filter((e) => e.status === 'realizado');

  const waitlistOpen = snap.waitlist.filter((w) => w.status === 'pendiente' || w.status === 'contactado');
  const incidentsOpen = snap.incidents.filter((i) => i.status !== 'resuelto');
  const criticalIncidents = incidentsOpen.filter((i) => i.priority === 'critica' || i.priority === 'alta');

  const overdue = snap.payments.filter((p) => p.status === 'vencido');
  const pending = snap.payments.filter((p) => p.status === 'pendiente' || p.status === 'vencido');
  const sum = (xs: { amount: number }[]) => xs.reduce((a, p) => a + p.amount, 0);
  const paidThisMonth = snap.payments.filter((p) => p.status === 'pagado' && p.paidAt && p.paidAt >= monthStart && p.paidAt <= today);
  const dueThisMonth = snap.payments.filter((p) => p.dueDate >= monthStart && p.dueDate <= format(new Date(now.getFullYear(), now.getMonth() + 1, 0), 'yyyy-MM-dd'));
  const collectedPct = dueThisMonth.length ? (dueThisMonth.filter((p) => p.status === 'pagado').length / dueThisMonth.length) * 100 : 100;

  // Asistencia media de los últimos 7 días
  const last7 = format(addDays(now, -7), 'yyyy-MM-dd');
  const recentClassIds = new Set(snap.classes.filter((c) => c.date >= last7 && c.date < today && c.status === 'impartida').map((c) => c.id));
  const recent = snap.attendance.filter((a) => recentClassIds.has(a.classId));
  const attendance7 = recent.length ? (recent.filter((a) => a.status === 'presente' || a.status === 'retraso').length / recent.length) * 100 : null;

  const low = lowAttendanceStudents(snap);
  const occ = groupOccupancy(snap);
  const seats = occ.reduce((a, o) => a + o.group.capacity, 0);
  const taken = occ.reduce((a, o) => a + o.count, 0);
  const occupancyPct = seats ? (taken / seats) * 100 : 0;
  const fullGroups = occ.filter((o) => o.full);

  // Clases de hoy ya terminadas sin asistencia registrada
  const classesNoAttendance = snap.classes.filter((c) => c.date === today && c.status !== 'cancelada' && hhmmToMin(c.end) <= now.getHours() * 60 + now.getMinutes()
    && !snap.attendance.some((a) => a.classId === c.id));

  const LB = snap.settings.labels;
  const noun = (k: 'student' | 'group' | 'class' | 'exam' | 'incident', n: number) => (n === 1 ? LB[k].singular : LB[k].plural).toLowerCase();
  const alerts: Alert[] = [];
  if (overdue.length) alerts.push({ id: 'overdue', level: 'danger', text: `${new Set(overdue.map((p) => p.studentId)).size} ${noun('student', new Set(overdue.map((p) => p.studentId)).size)} con pagos vencidos (${Math.round(sum(overdue))} €)`, href: '/pagos' });
  if (examsTomorrow.length) alerts.push({ id: 'exam-tmrw', level: 'warning', text: examsTomorrow.length === 1 ? `${LB.exam.singular} mañana` : `${examsTomorrow.length} ${noun('exam', 2)} mañana`, href: '/examenes' });
  if (examsToGrade.length) alerts.push({ id: 'grade', level: 'warning', text: `${examsToGrade.length} ${noun('exam', examsToGrade.length)} ${examsToGrade.length === 1 ? 'pendiente' : 'pendientes'} de calificar`, href: '/calificaciones' });
  if (low.length) alerts.push({ id: 'low-att', level: 'warning', text: `${low.length} ${noun('student', low.length)} con asistencia inferior al ${snap.settings.attendanceAlertThreshold}\u00a0%`, href: '/asistencia' });
  if (criticalIncidents.length) alerts.push({ id: 'inc', level: 'danger', text: `${criticalIncidents.length} ${noun('incident', criticalIncidents.length)} de prioridad alta o crítica`, href: '/incidencias' });
  if (waitlistOpen.length) alerts.push({ id: 'wl', level: 'info', text: waitlistOpen.length === 1 ? '1 persona en lista de espera' : `${waitlistOpen.length} personas en lista de espera`, href: '/lista-espera' });
  if (fullGroups.length) alerts.push({ id: 'full', level: 'info', text: `${fullGroups.length} ${noun('group', fullGroups.length)} ${fullGroups.length === 1 ? 'completo' : 'completos'}`, href: '/grupos' });

  const tasks: { id: string; text: string; href: string }[] = [];
  if (classesNoAttendance.length) tasks.push({ id: 't-att', text: `Registrar asistencia de ${classesNoAttendance.length} ${noun('class', classesNoAttendance.length)} de hoy`, href: '/asistencia' });
  if (examsToGrade.length) tasks.push({ id: 't-grade', text: `Calificar ${examsToGrade.length} ${noun('exam', examsToGrade.length)}`, href: '/calificaciones' });
  if (waitlistOpen.some((w) => w.status === 'pendiente')) tasks.push({ id: 't-wl', text: `Contactar con ${waitlistOpen.filter((w) => w.status === 'pendiente').length} personas de la lista de espera`, href: '/lista-espera' });
  if (overdue.length) tasks.push({ id: 't-pay', text: 'Reclamar recibos vencidos', href: '/pagos' });
  if (incidentsOpen.some((i) => i.status === 'pendiente')) tasks.push({ id: 't-inc', text: `Revisar ${incidentsOpen.filter((i) => i.status === 'pendiente').length} ${noun('incident', 2)} pendientes`, href: '/incidencias' });

  return {
    today, tomorrow, agenda, todayClasses, teachersToday: teachersToday.size, totalTeachers: snap.teachers.filter((t) => t.active).length,
    activeStudents: activeStudents.length, newStudents: newStudents.length, upcomingExams, examsTomorrow, examsToGrade,
    waitlistOpen: waitlistOpen.length, incidentsOpen: incidentsOpen.length, criticalIncidents: criticalIncidents.length,
    overdueCount: overdue.length, overdueAmount: sum(overdue), pendingAmount: sum(pending), revenueMonth: sum(paidThisMonth), collectedPct,
    attendance7, lowAttendance: low, occupancyPct, fullGroups, alerts, tasks, classesNoAttendance: classesNoAttendance.length,
  };
}
export type Dashboard = ReturnType<typeof computeDashboard>;

/** Mensaje contextual de cabecera. */
export function contextMessage(d: Dashboard, labels: Snapshot['settings']['labels']): string {
  const parts: string[] = [];
  const nc = d.todayClasses.length;
  if (nc) parts.push(`${nc} ${nc === 1 ? labels.class.singular.toLowerCase() : labels.class.plural.toLowerCase()}`);
  const ne = d.examsTomorrow.length + d.upcomingExams.filter((e) => e.date === d.today).length;
  if (ne) parts.push(`${ne} ${ne === 1 ? `${labels.exam.singular.toLowerCase()} próximo` : `${labels.exam.plural.toLowerCase()} próximos`}`);
  if (d.incidentsOpen) parts.push(`${d.incidentsOpen} ${d.incidentsOpen === 1 ? 'incidencia pendiente' : 'incidencias pendientes'}`);
  if (!parts.length) return 'Todo bajo control.';
  const last = parts.pop()!;
  return `Hoy tienes ${parts.length ? `${parts.join(', ')} y ${last}` : last}.`;
}

export { parseISO };
