import { useMemo } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { BarChart, ChartCard, LineChart, RankBars, StackedBar } from '@/components/charts/charts';
import { PageHeader } from '@/components/layout/PageHeader';
import { useCan, useLabels, useSettings, useSnapshot } from '@/hooks';
import { computeAnalytics } from '@/lib/analytics';
import { fmtMoney } from '@/utils/format';
import { cn } from '@/utils/cn';

function Kpi({ label, value, delta, goodWhenUp = true, suffix = '', sub }: { label: string; value: string; delta?: number | null; goodWhenUp?: boolean; suffix?: string; sub?: string }) {
  const up = (delta ?? 0) > 0, flat = !delta; const good = flat ? null : up === goodWhenUp;
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="panel p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="tnum mt-1 text-2xl font-semibold">{value}</p>
      {delta !== undefined && delta !== null ? <p className={cn('mt-1 flex items-center gap-1 text-xs', good === null ? 'text-muted' : good ? 'text-ok' : 'text-bad')}><Icon size={13} aria-hidden /><span className="tnum">{flat ? 'Sin cambios' : `${up ? '+' : ''}${Math.round(delta! * 10) / 10}${suffix}`}</span>{!flat && <span className="text-muted">vs. anterior</span>}</p> : sub ? <p className="mt-1 text-xs text-muted">{sub}</p> : null}
    </div>
  );
}

export default function StatisticsPage() {
  const snap = useSnapshot(); const L = useLabels(); const { currency } = useSettings(); const can = useCan();
  const a = useMemo(() => computeAnalytics(snap), [snap]); const k = a.kpis; const money = can('payments:read');
  const eur = (v: number) => fmtMoney(v, currency); const pct = (v: number) => `${Math.round(v)} %`;
  const labels = a.monthly.map((m) => m.label);
  const wlColors: Record<string, string> = { pendiente: 'var(--warn)', contactado: 'var(--info)', aceptado: 'var(--brand)', matriculado: 'var(--ok)', rechazado: 'var(--line-strong)' };
  const attWeeks = a.weekly.filter((w) => w.pct !== null);

  return (
    <>
      <PageHeader title="Estadísticas" description="Evolución de los últimos 6 meses y estado actual." />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi label={`${L.student.plural} activos`} value={String(k.active)} sub={`${k.occupancy.toFixed(0)} % ocupación`} />
        <Kpi label="Nuevas matrículas" value={String(k.newCur)} delta={k.newCur - k.newPrev} />
        <Kpi label="Bajas" value={String(k.bajasCur)} delta={k.bajasCur - k.bajasPrev} goodWhenUp={false} />
        <Kpi label="Asistencia media · 30 d" value={k.att === null ? '—' : pct(k.att)} delta={k.att !== null && k.attPrev !== null ? k.att - k.attPrev : null} suffix=" pp" />
        {money ? <Kpi label="Ingresos del mes" value={eur(k.revenue)} delta={k.revenue - k.revenuePrev} suffix=" €" /> : <Kpi label="Lista de espera" value={String(k.waitlistOpen)} />}
        {money ? <Kpi label="Pendiente de cobro" value={eur(k.pending)} /> : <Kpi label={`${L.class.plural} impartidas`} value={String(k.classesTaught)} />}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title={`Evolución de ${L.student.plural.toLowerCase()}`} subtitle="Matriculados a final de cada mes" table={{ columns: ['Mes', 'Matriculados'], rows: a.monthly.map((m) => [m.full, m.enrolled]) }}>
          <LineChart ariaLabel={`Evolución mensual de ${L.student.plural.toLowerCase()}`} labels={labels} area series={[{ id: 'e', label: L.student.plural, color: 'var(--brand)', values: a.monthly.map((m) => m.enrolled) }]} />
        </ChartCard>
        <ChartCard title="Altas y bajas" subtitle="Por mes" legend={[{ label: 'Altas', color: 'var(--s1)' }, { label: 'Bajas', color: 'var(--s2)' }]} table={{ columns: ['Mes', 'Altas', 'Bajas'], rows: a.monthly.map((m) => [m.full, m.altas, m.bajas]) }}>
          <BarChart ariaLabel="Altas y bajas por mes" labels={labels} series={[{ id: 'a', label: 'Altas', color: 'var(--s1)', values: a.monthly.map((m) => m.altas) }, { id: 'b', label: 'Bajas', color: 'var(--s2)', values: a.monthly.map((m) => m.bajas) }]} />
        </ChartCard>
        {money && (
          <ChartCard title="Ingresos mensuales" subtitle="Cobros registrados · el mes en curso destacado" table={{ columns: ['Mes', 'Ingresos'], rows: a.monthly.map((m) => [m.full, eur(m.revenue)]) }}>
            <BarChart ariaLabel="Ingresos por mes" labels={labels} highlightLast format={(v) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(v))} series={[{ id: 'r', label: 'Ingresos', color: 'var(--brand)', values: a.monthly.map((m) => m.revenue) }]} />
          </ChartCard>)}
        <ChartCard title="Asistencia semanal" subtitle="% de presentes y retrasos" table={{ columns: ['Semana del', 'Asistencia', 'Registros'], rows: a.weekly.map((w) => [w.label, w.pct === null ? '—' : pct(w.pct), w.n]) }}>
          {attWeeks.length ? <LineChart ariaLabel="Asistencia semanal" labels={a.weekly.map((w) => w.label)} max={100} format={(v) => `${v}`} series={[{ id: 'a', label: 'Asistencia %', color: 'var(--brand)', values: a.weekly.map((w) => (w.pct === null ? null : Math.round(w.pct * 10) / 10)) }]} /> : <p className="py-10 text-center text-sm text-muted">Aún no hay registros de asistencia.</p>}
        </ChartCard>
        <ChartCard title={`Ocupación de ${L.group.plural.toLowerCase()}`} subtitle="Plazas ocupadas sobre capacidad" table={{ columns: [L.group.singular, 'Ocupados', 'Capacidad'], rows: a.occupancy.map((o) => [o.group.name, o.count, o.group.capacity]) }}>
          <RankBars max={100} format={pct} items={a.occupancy.slice(0, 8).map((o) => ({ id: o.group.id, label: o.group.name, value: o.pct, sub: `${o.count}/${o.group.capacity}` }))} />
        </ChartCard>
        <ChartCard title={`Carga de ${L.teacher.plural.toLowerCase()}`} subtitle="Horas esta semana · marca = objetivo" table={{ columns: [L.teacher.singular, 'Horas semana', 'Objetivo', `${L.class.plural} impartidas`], rows: a.teachers.map((t) => [t.name, t.week.toFixed(1), t.target, t.taught]) }}>
          <RankBars warnOver format={(v) => `${v.toFixed(1)} h`} items={a.teachers.slice(0, 8).map((t) => ({ id: t.id, label: t.name, value: t.week, marker: t.target, sub: `${t.taught} impartidas` }))} />
        </ChartCard>
        {snap.waitlist.length > 0 && (
          <ChartCard title="Lista de espera" subtitle="Por estado" className="lg:col-span-2" table={{ columns: ['Estado', 'Personas'], rows: a.waitlist.map((w) => [w.status, w.n]) }}>
            <StackedBar ariaLabel="Lista de espera por estado" parts={a.waitlist.map((w) => ({ label: w.status[0].toUpperCase() + w.status.slice(1), value: w.n, color: wlColors[w.status] }))} />
          </ChartCard>)}
      </div>
    </>
  );
}
