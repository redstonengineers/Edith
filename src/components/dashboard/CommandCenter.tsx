import { Link } from 'react-router-dom';
import { StatusIndicator } from '@/components/ui/primitives';
import { useCountUp, useLabels, useSettings, useVisibleModules } from '@/hooks';
import type { Dashboard } from '@/lib/metrics';
import { fmtMoney, plural } from '@/utils/format';
import { cn } from '@/utils/cn';
import type { ModuleId } from '@/types';

function Ring({ pct }: { pct: number }) {
  const r = 54, len = 2 * Math.PI * r, off = len * (1 - Math.min(100, pct) / 100);
  const shown = useCountUp(Math.round(pct));
  return (
    <div className="relative grid h-[148px] w-[148px] shrink-0 place-items-center" role="img" aria-label={`Ocupación de plazas ${Math.round(pct)} por ciento`}>
      <svg viewBox="0 0 128 128" className="absolute inset-0 -rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" stroke="var(--line)" strokeWidth="6" />
        <circle cx="64" cy="64" r={r} fill="none" stroke="url(#ring)" strokeWidth="6" strokeLinecap="round" strokeDasharray={len} strokeDashoffset={off} className="ring-draw" style={{ ['--len' as string]: len, ['--off' as string]: off }} />
        <defs><linearGradient id="ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="var(--brand)" /><stop offset="1" stopColor="var(--brand-2)" /></linearGradient></defs>
      </svg>
      <div className="text-center"><p className="tnum text-3xl font-semibold leading-none">{shown}<span className="text-base text-muted"> %</span></p><p className="mt-1 text-[10px] tracking-[0.14em] text-muted uppercase">Ocupación</p></div>
    </div>
  );
}

interface Cell { id: ModuleId; to: string; label: string; value: string; sub?: string; tone?: 'bad' | 'warn' }

export function CommandCenter({ d }: { d: Dashboard }) {
  const labels = useLabels();
  const settings = useSettings();
  const modules = useVisibleModules();
  const students = useCountUp(d.activeStudents);
  const has = (id: ModuleId) => modules.some((m) => m.id === id);

  const cells: Cell[] = ([
    { id: 'schedule', to: '/horarios', label: `${labels.class.plural} hoy`, value: String(d.todayClasses.length), sub: d.classesNoAttendance ? `${d.classesNoAttendance} sin asistencia` : undefined, tone: d.classesNoAttendance ? 'warn' : undefined },
    { id: 'teachers', to: '/profesores', label: `${labels.teacher.plural} hoy`, value: `${d.teachersToday}`, sub: `de ${d.totalTeachers}` },
    { id: 'exams', to: '/examenes', label: `${labels.exam.plural} · 7 días`, value: String(d.upcomingExams.length), sub: d.examsToGrade.length ? `${d.examsToGrade.length} por calificar` : undefined },
    { id: 'waitlist', to: '/lista-espera', label: 'Lista de espera', value: String(d.waitlistOpen) },
    { id: 'incidents', to: '/incidencias', label: `${labels.incident.plural} abiertas`, value: String(d.incidentsOpen), sub: d.criticalIncidents ? `${d.criticalIncidents} alta/crítica` : undefined, tone: d.criticalIncidents ? 'bad' : undefined },
    { id: 'payments', to: '/pagos', label: 'Pendiente de cobro', value: fmtMoney(d.pendingAmount, settings.currency), sub: d.overdueCount ? `${d.overdueCount} vencidos` : undefined, tone: d.overdueCount ? 'bad' : undefined },
  ] as Cell[]).filter((c) => has(c.id));

  return (
    <section aria-labelledby="cc-title" className="panel relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full opacity-70 blur-3xl" style={{ background: 'radial-gradient(circle, var(--glow), transparent 70%)' }} />
      <div className="relative flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <div className="flex items-center gap-4"><h2 id="cc-title" className="text-[11px] font-semibold tracking-[0.2em] text-muted uppercase">Academy Command Center</h2><StatusIndicator label="System online" /></div>
          <p className="tnum mt-4 text-6xl leading-none font-semibold tracking-tight sm:text-7xl" aria-label={`${d.activeStudents} ${labels.student.plural} activos`}>{students}</p>
          <p className="mt-2 text-sm tracking-[0.14em] text-muted uppercase">{labels.student.plural} activos</p>
          <p className="mt-3 text-sm text-muted">{d.newStudents > 0 && <>{plural(d.newStudents, 'nuevo', 'nuevos')} este mes · </>}{d.fullGroups.length} {(d.fullGroups.length === 1 ? labels.group.singular : labels.group.plural).toLowerCase()} {d.fullGroups.length === 1 ? 'completo' : 'completos'}</p>
        </div>
        <div className="flex items-center justify-center gap-7">
          <div className="hidden space-y-4 sm:block">
            {d.attendance7 !== null && <div><p className="tnum text-2xl font-semibold">{Math.round(d.attendance7)} %</p><p className="text-xs text-muted">Asistencia · 7 días</p></div>}
            {has('payments') && <div><p className="tnum text-2xl font-semibold">{fmtMoney(d.revenueMonth, settings.currency)}</p><p className="text-xs text-muted">Ingresos del mes</p></div>}
          </div>
          <Ring pct={d.occupancyPct} />
        </div>
      </div>
      {cells.length > 0 && (
        <ul className="relative -mb-px grid grid-cols-2 overflow-hidden border-t border-line md:grid-cols-3 xl:grid-cols-6">
          {cells.map((c) => (
            <li key={c.id} className="shadow-[1px_0_0_0_var(--line),0_1px_0_0_var(--line)]">
              <Link to={c.to} className="group block h-full px-5 py-4 transition-colors hover:bg-surface-2">
                <p className={cn('tnum text-2xl font-semibold', c.tone === 'bad' && 'text-bad', c.tone === 'warn' && 'text-warn')}>{c.value}</p>
                <p className="mt-0.5 text-xs text-muted group-hover:text-fg">{c.label}</p>
                {c.sub && <p className={cn('mt-1 text-[11px]', c.tone === 'bad' ? 'text-bad' : c.tone === 'warn' ? 'text-warn' : 'text-muted')}>{c.sub}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
