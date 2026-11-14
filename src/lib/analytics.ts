import { addDays, endOfMonth, format, startOfMonth, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Snapshot } from '@/services/repositories';
import { fullName } from './people';
import { attendanceRates, groupOccupancy } from './metrics';

const iso = (d: Date) => format(d, 'yyyy-MM-dd');
const rate = (xs: { status: string }[]) => (xs.length ? (xs.filter((a) => a.status === 'presente' || a.status === 'retraso').length / xs.length) * 100 : null);

export function computeAnalytics(snap: Snapshot, now = new Date(), months = 6) {
  const today = iso(now);
  const keys = Array.from({ length: months }, (_, i) => subMonths(startOfMonth(now), months - 1 - i));
  const monthly = keys.map((m) => {
    const from = iso(startOfMonth(m)), to = iso(endOfMonth(m));
    const enrolled = snap.students.filter((s) => s.enrolledAt <= to && !(s.leftAt && s.leftAt <= to)).length;
    return {
      key: format(m, 'yyyy-MM'), label: format(m, 'MMM', { locale: es }), full: format(m, 'MMMM yyyy', { locale: es }),
      enrolled, altas: snap.students.filter((s) => s.enrolledAt >= from && s.enrolledAt <= to).length,
      bajas: snap.students.filter((s) => s.leftAt && s.leftAt >= from && s.leftAt <= to).length,
      revenue: snap.payments.filter((p) => p.status === 'pagado' && p.paidAt && p.paidAt >= from && p.paidAt <= to).reduce((a, p) => a + p.amount, 0),
    };
  });
  const cur = monthly[monthly.length - 1], prev = monthly[monthly.length - 2];

  // Asistencia semanal (últimas 6 semanas, lunes-domingo)
  const classDate = new Map(snap.classes.filter((c) => c.status === 'impartida').map((c) => [c.id, c.date]));
  const monday = addDays(now, -((now.getDay() + 6) % 7));
  const weekly = Array.from({ length: 6 }, (_, i) => {
    const start = addDays(monday, -7 * (5 - i)), end = addDays(start, 6);
    const recs = snap.attendance.filter((a) => { const d = classDate.get(a.classId); return d && d >= iso(start) && d <= iso(end); });
    return { label: format(start, 'd MMM', { locale: es }), pct: rate(recs), n: recs.length };
  });
  const last30 = snap.attendance.filter((a) => { const d = classDate.get(a.classId); return d && d >= iso(addDays(now, -30)) && d <= today; });
  const prev30 = snap.attendance.filter((a) => { const d = classDate.get(a.classId); return d && d >= iso(addDays(now, -60)) && d < iso(addDays(now, -30)); });

  const occupancy = groupOccupancy(snap).sort((a, b) => b.pct - a.pct);
  const seats = occupancy.reduce((a, o) => a + o.group.capacity, 0), taken = occupancy.reduce((a, o) => a + o.count, 0);

  const ws = iso(monday), we = iso(addDays(monday, 6));
  const hrs = (cs: { start: string; end: string }[]) => cs.reduce((a, c) => { const [h1, m1] = c.start.split(':').map(Number), [h2, m2] = c.end.split(':').map(Number); return a + (h2 * 60 + m2 - h1 * 60 - m1) / 60; }, 0);
  const teachers = snap.teachers.filter((t) => t.active).map((t) => {
    const mine = snap.classes.filter((c) => c.teacherId === t.id && c.status !== 'cancelada');
    return { id: t.id, name: fullName(t), week: hrs(mine.filter((c) => c.date >= ws && c.date <= we)), target: t.weeklyHoursTarget, taught: snap.classes.filter((c) => c.teacherId === t.id && c.status === 'impartida').length };
  }).sort((a, b) => b.week - a.week);

  const wl = (['pendiente', 'contactado', 'aceptado', 'matriculado', 'rechazado'] as const).map((s) => ({ status: s, n: snap.waitlist.filter((w) => w.status === s).length }));
  const rates = attendanceRates(snap);
  const avgAtt = rate(last30), avgPrev = rate(prev30);
  return {
    monthly, weekly, occupancy, teachers, waitlist: wl,
    kpis: {
      active: snap.students.filter((s) => s.status === 'activo' || s.status === 'nuevo').length, newCur: cur.altas, newPrev: prev.altas, bajasCur: cur.bajas, bajasPrev: prev.bajas,
      att: avgAtt, attPrev: avgPrev, revenue: cur.revenue, revenuePrev: prev.revenue, pending: snap.payments.filter((p) => p.status !== 'pagado').reduce((a, p) => a + p.amount, 0),
      occupancy: seats ? (taken / seats) * 100 : 0, waitlistOpen: snap.waitlist.filter((w) => w.status === 'pendiente' || w.status === 'contactado').length, classesTaught: snap.classes.filter((c) => c.status === 'impartida').length,
      lowAttendance: [...rates.values()].filter((r) => r.total >= 5 && r.pct < snap.settings.attendanceAlertThreshold).length,
    },
  };
}
