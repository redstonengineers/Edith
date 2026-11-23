import { Link } from 'react-router-dom';
import { AlertTriangle, Car, CheckCircle2, Clock, Plus, Users } from 'lucide-react';
import { Panel, Badge } from '@/components/ui/primitives';
import { useNow, useSnapshot, useUser } from '@/hooks';
import { daysTo, hoursOf, studentProgress, fmtHours } from '@/lib/practices';
import { fmtLongToday, greeting, todayISO } from '@/utils/format';
import { addDays, format, startOfWeek } from 'date-fns';

const Kpi = ({ icon: I, value, label, sub, to }: { icon: typeof Car; value: string; label: string; sub?: string; to: string }) => (
  <Link to={to} className="panel block p-3 transition hover:border-brand/50 sm:p-4"><I size={16} className="text-brand-text" aria-hidden /><p className="tnum mt-1 text-2xl font-semibold sm:mt-2 sm:text-3xl">{value}</p><p className="text-xs text-muted">{label}</p>{sub && <p className="mt-1 text-xs text-muted">{sub}</p>}</Link>
);

/** Portada de la autoescuela: prácticas de hoy, horas de la semana, coches y avisos. */
export default function DashboardAutoescuela() {
  const snap = useSnapshot(); const user = useUser(); const now = useNow(30_000); const today = todayISO(now); const week0 = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'); const week1 = format(addDays(startOfWeek(now, { weekStartsOn: 1 }), 6), 'yyyy-MM-dd');
  const live = snap.practices.filter((p) => p.status !== 'cancelada'); const todays = live.filter((p) => p.date === today).sort((a, b) => a.start.localeCompare(b.start));
  const weekHours = live.filter((p) => p.date >= week0 && p.date <= week1).reduce((a, p) => a + hoursOf(p), 0); const weekDone = live.filter((p) => p.date >= week0 && p.date <= week1 && p.status === 'hecha').reduce((a, p) => a + hoursOf(p), 0);
  const active = snap.students.filter((s) => s.status === 'activo' || s.status === 'nuevo'); const cars = snap.vehicles.filter((v) => v.status !== 'baja'); const ready = cars.filter((v) => v.status === 'activo').length;
  const alerts: { id: string; text: string; bad?: boolean; to: string }[] = [];
  for (const v of cars) { if (v.status === 'taller') alerts.push({ id: `t${v.id}`, text: `${v.model} (${v.plate}) está en el taller`, to: '/coches' }); for (const [k, lab] of [['itvDue', 'ITV'], ['insuranceDue', 'Seguro']] as const) { const n = daysTo(v[k], now); if (n !== null && n <= 30) alerts.push({ id: `${v.id}${k}`, bad: n < 0, text: `${lab} de ${v.model}: ${n < 0 ? `vencida hace ${-n} d` : n === 0 ? 'vence hoy' : `vence en ${n} d`}`, to: '/coches' }); } }
  const planned = new Set(live.filter((p) => p.status === 'programada' && p.date >= today && p.date <= format(addDays(now, 14), 'yyyy-MM-dd')).map((p) => p.studentId));
  const idle = active.filter((s) => !planned.has(s.id) && studentProgress(s, snap.practices).pct < 100);
  const finished = active.filter((s) => studentProgress(s, snap.practices).pct >= 100);
  const stuName = (id: string) => { const s = snap.students.find((x) => x.id === id); return s ? `${s.firstName} ${s.lastName}` : ''; };
  return (
    <div className="space-y-6">
      <div><p className="text-xs text-muted first-letter:">{fmtLongToday(now)}</p><h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">{greeting(now)}, {user.name.split(' ')[0]}.</h1>
        <p className="mt-1 text-[15px] text-muted">{todays.length ? `Hoy tienes ${todays.length} ${todays.length === 1 ? 'práctica' : 'prácticas'}.` : 'Hoy no hay prácticas.'}</p></div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={Clock} value={`${todays.filter((p) => p.status === 'hecha').length}/${todays.length}`} label="Prácticas hoy" sub="hechas / programadas" to="/practicas" />
        <Kpi icon={CheckCircle2} value={fmtHours(weekHours)} label="Horas esta semana" sub={`${fmtHours(weekDone)} ya hechas`} to="/practicas" />
        <Kpi icon={Users} value={String(active.length)} label="Alumnos activos" sub={finished.length ? `${finished.length} con las horas cumplidas` : undefined} to="/alumnos" />
        <Kpi icon={Car} value={`${ready}/${cars.length}`} label="Coches disponibles" sub={cars.length - ready ? `${cars.length - ready} en el taller` : undefined} to="/coches" />
      </div>
      <div className="flex flex-wrap gap-2"><Link to="/practicas?nueva=1" className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-3.5 text-sm font-medium text-on-brand"><Plus size={15} aria-hidden />Apuntar práctica</Link><Link to="/alumnos" className="inline-flex h-9 items-center gap-2 rounded-lg border border-line px-3.5 text-sm hover:bg-surface-2">Ver alumnos</Link></div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2"><Panel title="Agenda de hoy" action={<Link to="/practicas" className="text-xs text-muted hover:text-fg">Ver calendario</Link>}>
          {todays.length === 0 ? <p className="py-6 text-center text-sm text-muted">Hoy no hay prácticas. Disfruta del día o revisa la agenda de mañana.</p> : (
            <ul className="divide-y divide-line">{todays.map((p) => { const t = snap.teachers.find((x) => x.id === p.teacherId); const v = snap.vehicles.find((x) => x.id === p.vehicleId); return (
              <li key={p.id} className="flex items-center gap-3 py-2.5 text-sm"><span className="tnum w-24 flex-none text-muted">{p.start}–{p.end}</span><Link to={`/alumnos/${p.studentId}`} className="min-w-0 flex-1 truncate font-medium hover:text-brand-text">{stuName(p.studentId)}</Link>
                <span className="hidden text-muted sm:inline">{t?.firstName}{v ? ` · ${v.plate}` : ''}</span><Badge tone={p.status === 'hecha' ? 'ok' : 'brand'}>{p.status === 'hecha' ? 'hecha' : 'programada'}</Badge></li>); })}</ul>)}
        </Panel></div>
        <Panel title="Requiere atención">
          {alerts.length === 0 && idle.length === 0 ? <p className="py-6 text-center text-sm text-muted">Todo en orden.</p> : (
            <ul className="space-y-2 text-sm">{alerts.map((a) => <li key={a.id}><Link to={a.to} className={`flex items-start gap-2 hover:underline ${a.bad ? 'font-semibold text-bad' : 'text-warn'}`}><AlertTriangle size={14} className="mt-0.5 flex-none" aria-hidden />{a.text}</Link></li>)}
              {idle.length > 0 && <li className="flex items-start gap-2 text-muted"><Users size={14} className="mt-0.5 flex-none" aria-hidden /><span><b className="text-fg">{idle.length}</b> {idle.length === 1 ? 'alumno sin' : 'alumnos sin'} práctica en los próximos 14 días: {idle.slice(0, 3).map((s) => s.firstName).join(', ')}{idle.length > 3 ? '…' : ''}</span></li>}</ul>)}
        </Panel>
      </div>
    </div>
  );
}
