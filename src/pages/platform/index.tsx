import { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/primitives';
import { useAction, useUser } from '@/hooks';
import { PLANS, PLAN_IDS, type PlanId } from '@/config/plans';
import { PRESETS } from '@/config/presets';
import { platformOverview, setAcademyPlan, setAcademyStatus } from '@/services/mutations';
import { useSession } from '@/store/session';
import { fmtAgo, fmtMoney } from '@/utils/format';

/** Precios orientativos para la estimación de ingresos recurrentes (el cobro real de suscripciones llegará con el backend). */
/** Uso razonable de WhatsApp: por encima de esto por alumno activo y mes, conviene hablar con el cliente (no se bloquea nada). */
const WA_FAIR_PER_STUDENT = 8;
export default function PlatformPage() {
  const user = useUser(); const run = useAction(); const data = useSession((s) => s.data);
  type R = Awaited<ReturnType<typeof platformOverview>>[number];
  const [rows, setRows] = useState<R[]>([]);
  useEffect(() => { let off = false; void Promise.resolve(platformOverview(user)).then((r) => { if (!off) setRows(r as R[]); }); return () => { off = true; }; }, [user, data]);
  const mrr = rows.filter((r) => r.academy.status === 'active').reduce((a, r) => a + PLANS[r.academy.plan].price, 0);
  const cols: Column<R>[] = [
    { key: 'n', header: 'Academia', sort: (a, b) => a.academy.name.localeCompare(b.academy.name, 'es'), cell: (r) => <div><p className="font-medium">{r.academy.name}</p><p className="text-xs text-muted">{PRESETS[r.academy.type].label} · {r.academy.id}</p></div> },
    { key: 'p', header: 'Plan', cell: (r) => <select aria-label={`Plan de ${r.academy.name}`} value={r.academy.plan} onChange={(e) => void run(() => setAcademyPlan(user, r.academy.id, e.target.value as PlanId), 'Plan actualizado')} className="h-8 rounded-md border border-line bg-bg px-1.5 text-xs">{PLAN_IDS.map((id) => <option key={id} value={id}>{PLANS[id].label}</option>)}</select> },
    { key: 's', header: 'Estado', cell: (r) => <Badge tone={r.academy.status === 'active' ? 'ok' : 'bad'}>{r.academy.status === 'active' ? 'Activa' : 'Suspendida'}</Badge> },
    { key: 'u', header: 'Usuarios', hide: 'md', sort: (a, b) => a.users - b.users, cell: (r) => <span className="tnum">{r.users}</span> },
    { key: 'st', header: 'Alumnos', hide: 'md', sort: (a, b) => a.students - b.students, cell: (r) => <span className="tnum">{r.students}</span> },
    { key: 'w', header: 'WhatsApp (mes)', hide: 'md', sort: (a, b) => a.waMonth - b.waMonth, cell: (r) => { const high = r.waMonth > Math.max(100, r.students * WA_FAIR_PER_STUDENT); return <span className="tnum" title={`Mes anterior: ${r.waPrev}`}>{r.waMonth}{high && <Badge tone="warn" className="ml-1.5">Uso alto</Badge>}<span className="ml-1.5 text-xs text-muted">({r.waPrev} mes ant.)</span></span>; } },
    { key: 'm', header: 'Módulos', hide: 'lg', cell: (r) => <span className="tnum">{r.modules}</span> },
    { key: 'k', header: 'Almacenamiento', hide: 'xl', cell: (r) => <span className="tnum text-muted">{r.storageKb >= 1024 ? `${(r.storageKb / 1024).toFixed(1)} MB` : `${r.storageKb} KB`}</span> },
    { key: 'l', header: 'Última actividad', hide: 'lg', cell: (r) => <span className="text-muted">{r.lastActivity ? fmtAgo(r.lastActivity) : '—'}</span> },
    { key: 'a', header: '', align: 'right', cell: (r) => r.academy.id === user.academyId ? <span className="text-xs text-muted">Tu academia</span> : <button onClick={() => void run(() => setAcademyStatus(user, r.academy.id, r.academy.status === 'active' ? 'suspended' : 'active'), r.academy.status === 'active' ? 'Academia suspendida' : 'Academia reactivada')} className="text-xs text-brand-text hover:underline">{r.academy.status === 'active' ? 'Suspender' : 'Reactivar'}</button> },
  ];
  const kpi = [['Academias', String(rows.length)], ['Activas', String(rows.filter((r) => r.academy.status === 'active').length)], ['Alumnos totales', String(rows.reduce((a, r) => a + r.students, 0))], ['MRR estimado', fmtMoney(mrr)]];
  return (
    <>
      <PageHeader title="Plataforma" description="Panel del propietario del SaaS. Solo ves cifras de uso, nunca los datos personales de cada academia." />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">{kpi.map(([k, v]) => <div key={k} className="panel p-4"><p className="text-xs text-muted">{k}</p><p className="tnum mt-1 text-2xl font-semibold">{v}</p></div>)}</div>
      <DataTable label="Academias" rows={rows} columns={cols} rowKey={(r) => r.academy.id} defaultSort={{ key: 'n', dir: 'asc' }} empty={{ icon: Building2, title: 'Sin academias' }} />
      <p className="mt-3 text-xs text-muted">MRR estimado con los precios de cada plan (Esencial 39 €, Profesional 69 €, Premium 99 €). WhatsApp (mes) cuenta los avisos automáticos enviados; «Uso alto» es solo un aviso para ti (más de {WA_FAIR_PER_STUDENT} por alumno activo y mes), no limita nada. La facturación real de suscripciones se conectará con el backend.</p>
    </>
  );
}
