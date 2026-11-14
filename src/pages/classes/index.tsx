import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarDays, Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { FilterChips, SearchInput } from '@/components/ui/controls';
import { Badge } from '@/components/ui/primitives';
import { useCan, useLabels, usePersistentState, useSnapshot } from '@/hooks';
import { fullName } from '@/lib/people';
import type { ClassSession } from '@/types';
import { fmtDate, norm, todayISO } from '@/utils/format';
import { ClassForm } from '../schedule/ClassForm';

type F = 'proximas' | 'hoy' | 'pasadas' | 'canceladas';
export default function ClassesPage() {
  const snap = useSnapshot(); const L = useLabels(); const can = useCan(); const [sp, setSp] = useSearchParams();
  const [f, setF] = usePersistentState<F>('ac.classes.f', 'proximas'); const [q, setQ] = usePersistentState('ac.classes.q', '');
  const [open, setOpen] = useState<string | 'new' | null>(sp.get('nuevo') === '1' ? 'new' : null);
  const today = todayISO();
  const preds: Record<F, (c: ClassSession) => boolean> = { proximas: (c) => c.date > today && c.status !== 'cancelada', hoy: (c) => c.date === today && c.status !== 'cancelada', pasadas: (c) => c.date < today && c.status !== 'cancelada', canceladas: (c) => c.status === 'cancelada' };
  const name = (c: ClassSession) => snap.groups.find((g) => g.id === c.groupId)?.name ?? '';
  const nq = norm(q).split(/\s+/).filter(Boolean);
  const rows = snap.classes.filter(preds[f]).filter((c) => { const h = norm(`${name(c)} ${snap.teachers.find((t) => t.id === c.teacherId)?.lastName ?? ''}`); return nq.every((t) => h.includes(t)); });
  const cols: Column<ClassSession>[] = [
    { key: 'date', header: 'Fecha', sort: (a, b) => (a.date + a.start).localeCompare(b.date + b.start), cell: (c) => <button onClick={() => setOpen(c.id)} className="tnum text-left font-medium hover:text-brand-text">{fmtDate(c.date, 'EEE d MMM')} · {c.start}–{c.end}</button> },
    { key: 'group', header: L.group.singular, cell: (c) => name(c) },
    { key: 'teacher', header: L.teacher.singular, hide: 'md', cell: (c) => { const t = snap.teachers.find((x) => x.id === c.teacherId); return <span className="text-muted">{t ? fullName(t) : ''}</span>; } },
    { key: 'room', header: L.classroom.singular, hide: 'lg', cell: (c) => <span className="text-muted">{snap.classrooms.find((r) => r.id === c.classroomId)?.name}</span> },
    { key: 'st', header: 'Estado', cell: (c) => <Badge tone={c.status === 'cancelada' ? 'bad' : c.status === 'impartida' ? 'ok' : 'brand'}>{c.status}</Badge> },
  ];
  const opt = (id: F, label: string) => ({ id, label, count: snap.classes.filter(preds[id]).length });
  const close = () => { setOpen(null); if (sp.has('nuevo')) { sp.delete('nuevo'); setSp(sp, { replace: true }); } };
  return (
    <>
      <PageHeader title={L.class.plural} description="Sesiones programadas, impartidas y canceladas." actions={can('classes:write') && <Button variant="primary" onClick={() => setOpen('new')}><Plus size={16} />Nueva {L.class.singular.toLowerCase()}</Button>} />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterChips<F> label="Filtrar" value={f} onChange={setF} options={[opt('hoy', 'Hoy'), opt('proximas', 'Próximas'), opt('pasadas', 'Pasadas'), opt('canceladas', 'Canceladas')]} />
        <SearchInput value={q} onChange={setQ} placeholder="Buscar…" label={`Buscar ${L.class.plural.toLowerCase()}`} />
      </div>
      <DataTable label={L.class.plural} rows={rows} columns={cols} rowKey={(c) => c.id} onRowClick={(c) => setOpen(c.id)} defaultSort={{ key: 'date', dir: f === 'pasadas' ? 'desc' : 'asc' }} empty={{ icon: CalendarDays, title: 'Sin clases en esta vista' }} />
      {open && <ClassForm key={open} open session={open === 'new' ? undefined : snap.classes.find((c) => c.id === open)} onClose={close} />}
    </>
  );
}
