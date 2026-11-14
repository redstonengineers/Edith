import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { addDays, format, parseISO } from 'date-fns';
import { AlertTriangle, CalendarX, CheckCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Tabs, FilterChips } from '@/components/ui/controls';
import { Input } from '@/components/ui/form';
import { Avatar, Badge, EmptyState } from '@/components/ui/primitives';
import { useAction, useCan, useLabels, useSnapshot, useUser } from '@/hooks';
import { attendanceRates } from '@/lib/metrics';
import { fullName } from '@/lib/people';
import { markAllPresent, setAttendance } from '@/services/mutations';
import type { AttendanceStatus, Student } from '@/types';
import { cn } from '@/utils/cn';
import { fmtDate, todayISO } from '@/utils/format';

const OPTS: { id: AttendanceStatus; label: string; short: string; on: string }[] = [
  { id: 'presente', label: 'Presente', short: 'P', on: 'bg-ok/20 text-ok border-ok/50' },
  { id: 'retraso', label: 'Retraso', short: 'R', on: 'bg-warn/20 text-warn border-warn/50' },
  { id: 'justificado', label: 'Justificado', short: 'J', on: 'bg-info/20 text-info border-info/50' },
  { id: 'ausente', label: 'Ausente', short: 'A', on: 'bg-bad/20 text-bad border-bad/50' },
];

function Register() {
  const snap = useSnapshot(); const L = useLabels(); const can = useCan(); const user = useUser(); const run = useAction(); const [sp, setSp] = useSearchParams();
  const preset = sp.get('clase') ? snap.classes.find((c) => c.id === sp.get('clase')) : undefined;
  // Sin clases hoy (fin de semana, festivo), se abre el último día con clases en vez de una pantalla vacía.
  const [date, setDate] = useState(() => {
    if (preset) return preset.date; const t = todayISO(); const live = snap.classes.filter((c) => c.status !== 'cancelada');
    if (live.some((c) => c.date === t)) return t;
    return live.map((c) => c.date).filter((d) => d < t).sort().pop() ?? t;
  });
  const [sel, setSel] = useState<string | null>(preset?.id ?? null);
  const write = can('attendance:write');
  const classes = useMemo(() => snap.classes.filter((c) => c.date === date && c.status !== 'cancelada').sort((a, b) => a.start.localeCompare(b.start)), [snap.classes, date]);
  const cls = classes.find((c) => c.id === sel) ?? classes[0];
  const roster: Student[] = useMemo(() => (cls ? snap.students.filter((s) => s.groupIds.includes(cls.groupId) && s.status !== 'baja').sort((a, b) => a.lastName.localeCompare(b.lastName, 'es')) : []), [cls, snap.students]);
  const recs = new Map(snap.attendance.filter((a) => a.classId === cls?.id).map((a) => [a.studentId, a.status]));
  const counts = OPTS.map((o) => ({ ...o, n: [...recs.values()].filter((v) => v === o.id).length }));
  const rates = useMemo(() => attendanceRates(snap), [snap]);
  const th = snap.settings.attendanceAlertThreshold;
  const move = (d: number) => { setDate(format(addDays(parseISO(date), d), 'yyyy-MM-dd')); setSel(null); sp.delete('clase'); setSp(sp, { replace: true }); };
  const nameOf = (id: string) => snap.groups.find((g) => g.id === id)?.name ?? '';

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      <div>
        <div className="mb-3 flex items-center gap-2">
          <button className="grid h-9 w-9 place-items-center rounded-lg border border-line hover:bg-surface-2" aria-label="Día anterior" onClick={() => move(-1)}><ChevronLeft size={16} /></button>
          <Input aria-label="Fecha" type="date" value={date} onChange={(e) => { setDate(e.target.value); setSel(null); }} className="flex-1" />
          <button className="grid h-9 w-9 place-items-center rounded-lg border border-line hover:bg-surface-2" aria-label="Día siguiente" onClick={() => move(1)}><ChevronRight size={16} /></button>
        </div>
        {classes.length === 0 ? <div className="panel"><EmptyState icon={CalendarX} title={`Sin ${L.class.plural.toLowerCase()} este día`} description={fmtDate(date, "EEEE d 'de' MMMM")} /></div> : (
          <ul className="space-y-2" aria-label={L.class.plural}>
            {classes.map((c) => { const n = snap.attendance.filter((a) => a.classId === c.id).length; const total = snap.students.filter((s) => s.groupIds.includes(c.groupId) && s.status !== 'baja').length; const active = c.id === cls?.id; return (
              <li key={c.id}><button onClick={() => setSel(c.id)} aria-pressed={active} className={cn('panel w-full p-3.5 text-left transition-colors', active ? 'border-brand/60 bg-brand/8' : 'hover:border-line-strong')}>
                <p className="tnum text-xs text-muted">{c.start}–{c.end} · {snap.classrooms.find((r) => r.id === c.classroomId)?.name}</p>
                <p className="mt-0.5 text-sm font-medium">{nameOf(c.groupId)}</p>
                <p className="mt-1.5 text-xs">{n >= total && total > 0 ? <Badge tone="ok">Completa</Badge> : <span className="text-muted">{n} / {total} registrados</span>}</p>
              </button></li>); })}
          </ul>)}
      </div>

      <div>
        {!cls ? <div className="panel"><EmptyState title="Selecciona una clase" description="Aparecerán los alumnos para pasar lista con un clic." /></div> : (
          <div className="panel">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
              <div><h2 className="font-semibold">{nameOf(cls.groupId)}</h2><p className="tnum text-xs text-muted">{fmtDate(cls.date, "EEEE d 'de' MMMM")} · {cls.start}–{cls.end}</p></div>
              <div className="flex flex-wrap items-center gap-2">
                {counts.map((c) => <Badge key={c.id} tone={c.id === 'presente' ? 'ok' : c.id === 'ausente' ? 'bad' : c.id === 'retraso' ? 'warn' : 'info'}>{c.label} {c.n}</Badge>)}
                {write && roster.length > 0 && <Button size="sm" onClick={() => void run(() => markAllPresent(user, cls.id, roster.map((s) => s.id)), 'Todos marcados como presentes')}><CheckCheck size={14} />Marcar todos presentes</Button>}
              </div>
            </div>
            {roster.length === 0 ? <EmptyState title={`Sin ${L.student.plural.toLowerCase()} en este ${L.group.singular.toLowerCase()}`} /> : (
              <ul className="divide-y divide-line">
                {roster.map((s) => { const cur = recs.get(s.id); const r = rates.get(s.id); const low = !!r && r.total >= 5 && r.pct < th; return (
                  <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                    <Avatar name={fullName(s)} hue={s.avatarHue} size={32} />
                    <div className="min-w-0 flex-1"><Link to={`/alumnos/${s.id}`} className="text-sm font-medium hover:text-brand-text">{fullName(s)}</Link>
                      {low && <p className="flex items-center gap-1 text-xs text-warn"><AlertTriangle size={12} aria-hidden />Asistencia {Math.round(r!.pct)} %, inferior al {th} %</p>}</div>
                    <div role="radiogroup" aria-label={`Asistencia de ${fullName(s)}`} className="flex gap-1.5">
                      {OPTS.map((o) => (
                        <button key={o.id} role="radio" aria-checked={cur === o.id} disabled={!write} title={o.label} aria-label={o.label}
                          onClick={() => void run(() => setAttendance(user, cls.id, s.id, cur === o.id ? null : o.id), cur === o.id ? 'Registro quitado' : `${fullName(s)}: ${o.label.toLowerCase()}`)}
                          className={cn('h-9 min-w-9 rounded-lg border px-2.5 text-[13px] font-semibold transition-colors disabled:opacity-60', cur === o.id ? o.on : 'border-line text-muted hover:border-line-strong hover:text-fg')}>
                          <span className="sm:hidden">{o.short}</span><span className="hidden sm:inline">{o.label}</span>
                        </button>))}
                    </div>
                  </li>); })}
              </ul>)}
          </div>)}
      </div>
    </div>
  );
}

function Stats() {
  const snap = useSnapshot(); const L = useLabels(); const [g, setG] = useState('todos'); const [low, setLow] = useState<'todos' | 'baja'>('todos');
  const th = snap.settings.attendanceAlertThreshold; const rates = useMemo(() => attendanceRates(snap), [snap]);
  type R = { s: Student; pct: number; total: number };
  const rows: R[] = snap.students.filter((s) => s.status !== 'baja' && rates.has(s.id) && (g === 'todos' || s.groupIds.includes(g))).map((s) => ({ s, pct: rates.get(s.id)!.pct, total: rates.get(s.id)!.total })).filter((r) => low === 'todos' || (r.total >= 5 && r.pct < th));
  const cols: Column<R>[] = [
    { key: 'n', header: L.student.singular, sort: (a, b) => fullName(a.s).localeCompare(fullName(b.s), 'es'), cell: (r) => <Link to={`/alumnos/${r.s.id}`} className="font-medium hover:text-brand-text">{fullName(r.s)}</Link> },
    { key: 'p', header: 'Asistencia', sort: (a, b) => a.pct - b.pct, cell: (r) => <span className={cn('tnum font-semibold', r.total >= 5 && r.pct < th && 'text-warn')}>{Math.round(r.pct)} %</span> },
    { key: 't', header: 'Clases registradas', hide: 'md', sort: (a, b) => a.total - b.total, cell: (r) => <span className="tnum text-muted">{r.total}</span> },
    { key: 'a', header: 'Alerta', cell: (r) => r.total >= 5 && r.pct < th ? <Badge tone="warn"><AlertTriangle size={11} aria-hidden />Inferior al {th} %</Badge> : <span className="text-muted">—</span> },
  ];
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <FilterChips value={low} onChange={setLow} label="Alertas" options={[{ id: 'todos', label: 'Todos' }, { id: 'baja', label: `Bajo el ${th} %` }]} />
        <select aria-label={`Filtrar por ${L.group.singular.toLowerCase()}`} value={g} onChange={(e) => setG(e.target.value)} className="h-9 rounded-lg border border-line bg-bg px-3 text-sm"><option value="todos">{L.group.plural}: todos</option>{snap.groups.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
      </div>
      <DataTable label="Estadísticas de asistencia" rows={rows} columns={cols} rowKey={(r) => r.s.id} defaultSort={{ key: 'p', dir: 'asc' }} empty={{ title: 'Sin datos' }} />
    </>
  );
}

export default function AttendancePage() {
  const can = useCan();
  return (
    <>
      <PageHeader title="Asistencia" description={can('attendance:write') ? 'Elige la clase y pasa lista con un clic por alumno.' : 'Consulta de asistencia.'} />
      <Tabs tabs={[{ id: 'registro', label: 'Pasar lista', content: <Register /> }, { id: 'stats', label: 'Estadísticas', content: <Stats /> }]} />
    </>
  );
}
