import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { FilterSelect } from '@/components/ui/FilterSelect';
import { LoadingState } from '@/components/ui/primitives';
import { useLabels, useSnapshot } from '@/hooks';
import { fetchAccessLog, type AccessEntry, type AccessLogData } from '@/services/accessLog';
import { ROLE_LABELS } from '@/lib/permissions';
import type { RoleId } from '@/types';

const ACTION: Record<AccessEntry['action'], string> = { view: 'Abrió la ficha', export: 'Exportó a CSV', report: 'Abrió un informe' };
const fmt = (iso: string) => new Date(iso).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });

/** Registro de accesos: quién consultó o exportó datos de las personas del negocio. Solo para el administrador. */
export default function AccessLogPage() {
  const snap = useSnapshot(); const L = useLabels(); const [user, setUser] = useState(''); const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [data, setData] = useState<AccessLogData | null>(null); const [err, setErr] = useState('');
  const people = useMemo(() => snap.users.filter((u) => u.role !== 'ALUMNO' && u.role !== 'TUTOR').map((u) => ({ id: u.id, name: u.name })), [snap.users]);
  useEffect(() => { let on = true; setData(null); fetchAccessLog({ user: user || undefined, from: from || undefined, to: to || undefined }, people).then((d) => on && setData(d), (e) => on && setErr(e.message)); return () => { on = false; }; }, [user, from, to, people]);
  const cols: Column<AccessEntry>[] = [
    { key: 'ts', header: 'Fecha y hora', cell: (r) => <span className="tabular-nums">{fmt(r.ts)}</span>, sort: (a, b) => a.ts.localeCompare(b.ts) },
    { key: 'user', header: 'Usuario', cell: (r) => <span className="font-medium">{r.userName}</span>, sort: (a, b) => a.userName.localeCompare(b.userName) },
    { key: 'role', header: 'Rol', cell: (r) => ROLE_LABELS[r.role as RoleId] ?? r.role, hide: 'md' },
    { key: 'action', header: 'Acción', cell: (r) => ACTION[r.action] },
    { key: 'what', header: 'Persona o informe', cell: (r) => r.subject ?? r.detail ?? '—' },
  ];
  return (
    <>
      <PageHeader title="Registro de accesos" description={`Quién consulta o exporta datos de ${L.student.plural.toLowerCase()}: fichas abiertas, exportaciones e informes.`} />
      <div className="mb-4 flex flex-wrap items-end gap-3" role="group" aria-label="Filtros">
        <FilterSelect label="Usuario" value={user} onChange={setUser} options={[{ value: '', label: 'Todos' }, ...people.map((p) => ({ value: p.id, label: p.name }))]} />
        <label className="grid gap-1 text-xs text-muted">Desde<input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="h-10 rounded-lg border border-line bg-surface px-3 text-sm text-fg" /></label>
        <label className="grid gap-1 text-xs text-muted">Hasta<input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="h-10 rounded-lg border border-line bg-surface px-3 text-sm text-fg" /></label>
      </div>
      {err ? <p role="alert" className="text-sm text-bad">{err}</p> : !data ? <LoadingState /> : (
        <DataTable label="Registro de accesos" rows={data.entries} columns={cols} rowKey={(r) => String(r.id)} pageSize={15} defaultSort={{ key: 'ts', dir: 'desc' }}
          empty={{ icon: ShieldCheck, title: 'Sin accesos registrados', description: 'Aquí aparecerá quién abre fichas, exporta datos o abre informes.' }} />
      )}
    </>
  );
}
