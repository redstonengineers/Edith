import { CalendarDays, FileText, GraduationCap } from 'lucide-react';
import { AttendanceCell, PayBadge } from '@/components/domain/badges';
import { Badge, EmptyState, Panel } from '@/components/ui/primitives';
import { useCan, useLabels, useNow, useSnapshot, useUser } from '@/hooks';
import { fullName, studentRows } from '@/lib/people';
import { hoursOf } from '@/lib/practices';
import { fmtDate, fmtLongToday, fmtMoney, greeting, todayISO } from '@/utils/format';

/** "Mi espacio": vista de alumno y tutor. Solo ven a sus hijos / a sí mismos. */
export default function PortalDashboard() {
  const snap = useSnapshot(); const user = useUser(); const L = useLabels(); const can = useCan(); const now = useNow(60_000); const today = todayISO(now);
  const rows = studentRows(snap);
  return (
    <div className="space-y-6">
      <div><p className="text-xs tracking-[0.14em] text-muted uppercase first-letter:uppercase">{fmtLongToday(now)}</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">{greeting(now)}, {user.name.split(' ')[0]}.</h1><p className="mt-1 text-[15px] text-muted">{user.role === 'TUTOR' ? 'Resumen de la actividad académica.' : 'Tu actividad académica de un vistazo.'}</p></div>
      {rows.length === 0 && <div className="panel"><EmptyState icon={GraduationCap} title="Aún no hay información vinculada a tu cuenta" description="Pide a la academia que vincule tu usuario con tu ficha." /></div>}
      {rows.map((r) => {
        const classes = snap.classes.filter((c) => r.student.groupIds.includes(c.groupId) && c.date >= today && c.status === 'programada').sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)).slice(0, 4);
        const exams = snap.exams.filter((e) => r.student.groupIds.includes(e.groupId) && e.status === 'pendiente' && e.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
        const drv = r.student.targetHours !== undefined || (r.student.driving?.length ?? 0) > 0 || snap.practices.some((p) => p.studentId === r.student.id);
        const prac = snap.practices.filter((p) => p.studentId === r.student.id && p.status === 'programada' && p.date >= today).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)).slice(0, 4);
        const doneH = snap.practices.filter((p) => p.studentId === r.student.id && p.status === 'hecha').reduce((a, p) => a + hoursOf(p), 0);
        const dgt = (r.student.driving ?? []).filter((e) => e.result === 'pendiente' && e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
        const grades = snap.grades.filter((g) => g.studentId === r.student.id && g.score !== null).slice(-4);
        const pend = snap.payments.filter((p) => p.studentId === r.student.id && p.status !== 'pagado');
        return (
          <section key={r.student.id} aria-label={r.name} className="space-y-4">
            <div className="flex flex-wrap items-center gap-3"><h2 className="text-lg font-semibold">{r.name}</h2>{r.groups.map((g) => <Badge key={g.id}>{g.name}</Badge>)}</div>
            <div className="grid gap-4 sm:grid-cols-3">
              {drv ? <div className="panel p-4"><p className="text-[11px] tracking-[0.12em] text-muted uppercase">Horas de prácticas</p><p className="tnum mt-1 text-2xl font-semibold">{Math.round(doneH * 10) / 10}{r.student.targetHours ? <span className="text-base font-normal text-muted"> / {r.student.targetHours} h</span> : ' h'}</p>{!!r.student.targetHours && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, (doneH / r.student.targetHours) * 100)}%` }} /></div>}</div>
              : <div className="panel p-4"><p className="text-[11px] tracking-[0.12em] text-muted uppercase">Asistencia</p><p className="mt-1 text-2xl font-semibold"><AttendanceCell pct={r.attendancePct} low={r.lowAttendance} /></p></div>}
              {drv ? <div className="panel p-4"><p className="text-[11px] tracking-[0.12em] text-muted uppercase">Exámenes DGT</p><p className="mt-1 text-sm">{(r.student.driving ?? []).length === 0 ? <span className="text-muted">Aún sin exámenes</span> : (['teorico', 'practico'] as const).map((k) => { const last = [...(r.student.driving ?? [])].reverse().find((e) => e.kind === k); return <span key={k} className="mr-3 inline-block">{k === 'teorico' ? 'Teórico' : 'Práctico'}: <b className={last?.result === 'aprobado' ? 'text-ok' : last?.result === 'suspendido' ? 'text-bad' : ''}>{last ? last.result : '—'}</b></span>; })}</p></div>
              : <div className="panel p-4"><p className="text-[11px] tracking-[0.12em] text-muted uppercase">Nota media</p><p className="tnum mt-1 text-2xl font-semibold">{grades.length ? (grades.reduce((a, g) => a + (g.score ?? 0), 0) / grades.length).toFixed(1) : '—'}</p></div>}
              {can('payments:read') && <div className="panel p-4"><p className="text-[11px] tracking-[0.12em] text-muted uppercase">Pagos</p><div className="mt-1.5 flex items-center gap-2"><PayBadge pay={r.pay} />{pend.length > 0 && <span className="tnum text-sm">{fmtMoney(pend.reduce((a, p) => a + p.amount, 0), snap.settings.currency)}</span>}</div></div>}
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title={drv ? 'Próximas prácticas' : `Próximas ${L.class.plural.toLowerCase()}`}>{drv ? (prac.length === 0 ? <EmptyState icon={CalendarDays} title="Sin prácticas próximas" /> : <ul className="divide-y divide-line">{prac.map((c) => <li key={c.id} className="flex justify-between py-2 text-sm"><span>Práctica de {hoursOf(c)} h{snap.teachers.find((t) => t.id === c.teacherId) ? ` · ${snap.teachers.find((t) => t.id === c.teacherId)!.firstName}` : ''}</span><span className="tnum text-muted">{fmtDate(c.date, 'EEE d MMM')} · {c.start}</span></li>)}</ul>) : classes.length === 0 ? <EmptyState icon={CalendarDays} title="Sin clases próximas" /> : <ul className="divide-y divide-line">{classes.map((c) => <li key={c.id} className="flex justify-between py-2 text-sm"><span>{snap.groups.find((g) => g.id === c.groupId)?.name}</span><span className="tnum text-muted">{fmtDate(c.date, 'EEE d MMM')} · {c.start}</span></li>)}</ul>}</Panel>
              <Panel title={drv ? 'Próximos exámenes de la DGT' : `Próximos ${L.exam.plural.toLowerCase()}`}>{drv ? (dgt.length === 0 ? <EmptyState icon={FileText} title="Sin exámenes próximos" /> : <ul className="divide-y divide-line">{dgt.map((e) => <li key={e.id} className="flex justify-between py-2 text-sm"><span>Examen {e.kind === 'teorico' ? 'teórico' : 'práctico'}</span><span className="tnum text-muted">{fmtDate(e.date, 'EEE d MMM')}</span></li>)}</ul>) : exams.length === 0 ? <EmptyState icon={FileText} title="Sin exámenes próximos" /> : <ul className="divide-y divide-line">{exams.map((e) => <li key={e.id} className="flex justify-between py-2 text-sm"><span>{e.title}</span><span className="tnum text-muted">{fmtDate(e.date, 'EEE d MMM')} · {e.start}</span></li>)}</ul>}</Panel>
            </div>
          </section>);
      })}
      <p className="text-xs text-muted">{rows.length > 0 && `Datos de ${rows.map((r) => fullName(r.student)).join(', ')}.`}</p>
    </div>
  );
}
