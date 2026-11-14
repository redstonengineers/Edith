import { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { nuevo } from '@/lib/labels';
import { AlertTriangle, Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { FilterChips, SearchInput } from '@/components/ui/controls';
import { Badge } from '@/components/ui/primitives';
import { useCan, useLabels, usePersistentState, useSnapshot } from '@/hooks';
import type { Incident } from '@/types';
import { fmtDate, norm } from '@/utils/format';
import { IncidentForm, prioLabel, prioTone, statusLabel, statusTone } from './IncidentForm';

type F = 'abiertas' | 'pendiente' | 'en_proceso' | 'resuelto' | 'todas';
const ORDER = { critica: 0, alta: 1, media: 2, baja: 3 } as const;
export default function IncidentList() {
  const snap = useSnapshot(); const L = useLabels(); const can = useCan(); const nav = useNavigate(); const [sp, setSp] = useSearchParams();
  const [f, setF] = usePersistentState<F>('ac.inc.f', 'abiertas'); const [q, setQ] = usePersistentState('ac.inc.q', ''); const [prio, setPrio] = usePersistentState('ac.inc.p', '');
  const preds: Record<F, (i: Incident) => boolean> = { abiertas: (i) => i.status !== 'resuelto', pendiente: (i) => i.status === 'pendiente', en_proceso: (i) => i.status === 'en_proceso', resuelto: (i) => i.status === 'resuelto', todas: () => true };
  const nq = norm(q).split(/\s+/).filter(Boolean);
  const rows = useMemo(() => snap.incidents.filter(preds[f]).filter((i) => !prio || i.priority === prio).filter((i) => nq.every((t) => norm(`${i.title} ${i.type}`).includes(t))), [snap.incidents, f, prio, nq.join(' ')]); // eslint-disable-line
  const cols: Column<Incident>[] = [
    { key: 't', header: 'Título', sort: (a, b) => a.title.localeCompare(b.title, 'es'), cell: (i) => <Link to={`/incidencias/${i.id}`} className="font-medium hover:text-brand-text">{i.title}</Link> },
    { key: 'ty', header: 'Tipo', hide: 'md', cell: (i) => <span className="text-muted">{i.type}</span> },
    { key: 'p', header: 'Prioridad', sort: (a, b) => ORDER[a.priority] - ORDER[b.priority], cell: (i) => <Badge tone={prioTone[i.priority]}>{prioLabel[i.priority]}</Badge> },
    { key: 's', header: 'Estado', cell: (i) => <Badge tone={statusTone[i.status]}>{statusLabel[i.status]}</Badge> },
    { key: 'r', header: 'Responsable', hide: 'lg', cell: (i) => <span className="text-muted">{snap.users.find((u) => u.id === i.assigneeId)?.name ?? 'Sin asignar'}</span> },
    { key: 'd', header: 'Fecha', hide: 'md', sort: (a, b) => a.createdAt.localeCompare(b.createdAt), cell: (i) => <span className="tnum text-muted">{fmtDate(i.createdAt)}</span> },
  ];
  const opt = (id: F, label: string) => ({ id, label, count: snap.incidents.filter(preds[id]).length });
  return (
    <>
      <PageHeader title={L.incident.plural} description="Seguimiento por prioridad y responsable." actions={can('incidents:write') && <Button variant="primary" onClick={() => setSp({ nuevo: '1' })}><Plus size={16} />{nuevo(L.incident)}</Button>} />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FilterChips<F> label="Estado" value={f} onChange={setF} options={[opt('abiertas', 'Abiertas'), opt('pendiente', 'Pendientes'), opt('en_proceso', 'En proceso'), opt('resuelto', 'Resueltas'), opt('todas', 'Todas')]} />
        <div className="flex items-center gap-2"><select aria-label="Prioridad" value={prio} onChange={(e) => setPrio(e.target.value)} className="h-10 rounded-lg border border-line bg-bg px-3 text-sm"><option value="">Toda prioridad</option>{(['critica', 'alta', 'media', 'baja'] as const).map((p) => <option key={p} value={p}>{prioLabel[p]}</option>)}</select><SearchInput value={q} onChange={setQ} placeholder="Buscar…" label="Buscar incidencias" /></div>
      </div>
      <DataTable label={L.incident.plural} rows={rows} columns={cols} rowKey={(i) => i.id} onRowClick={(i) => nav(`/incidencias/${i.id}`)} defaultSort={{ key: 'p', dir: 'asc' }} empty={{ icon: AlertTriangle, title: 'Sin incidencias', description: 'Nada con este filtro.' }} />
      {sp.get('nuevo') === '1' && <IncidentForm onClose={() => { sp.delete('nuevo'); setSp(sp, { replace: true }); }} onCreated={(id) => nav(`/incidencias/${id}`)} />}
    </>
  );
}
