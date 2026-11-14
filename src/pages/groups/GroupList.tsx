import { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, UsersRound } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { FilterChips, ProgressBar, SearchInput } from '@/components/ui/controls';
import { Badge } from '@/components/ui/primitives';
import { useCan, useLabels, usePersistentState, useSnapshot } from '@/hooks';
import { DAYS } from '@/lib/conflicts';
import { groupStats, fullName } from '@/lib/people';
import type { Group } from '@/types';
import { norm } from '@/utils/format';
import { GroupForm } from './GroupForm';

export const scheduleText = (g: Group) => g.slots.map((s) => `${DAYS[s.weekday].slice(0, 3)} ${s.start}–${s.end}`).join(' · ');

export default function GroupList() {
  const snap = useSnapshot(); const L = useLabels(); const can = useCan(); const nav = useNavigate(); const [sp, setSp] = useSearchParams();
  const [q, setQ] = usePersistentState('ac.groups.q', ''); const [f, setF] = usePersistentState<'todos' | 'completos' | 'disponibles'>('ac.groups.f', 'todos');
  const rows = useMemo(() => snap.groups.filter((g) => g.active).map((g) => ({ g, ...groupStats(snap, g), teacher: snap.teachers.find((t) => t.id === g.teacherId), subject: snap.subjects.find((s) => s.id === g.subjectId), room: snap.classrooms.find((r) => r.id === g.classroomId) })), [snap]);
  type R = (typeof rows)[number];
  const nq = norm(q).split(/\s+/).filter(Boolean);
  const view = rows.filter((r) => f === 'todos' || (f === 'completos') === (r.members.length >= r.g.capacity)).filter((r) => { const h = norm(`${r.g.name} ${r.teacher ? fullName(r.teacher) : ''}`); return nq.every((x) => h.includes(x)); });
  const cols: Column<R>[] = [
    { key: 'name', header: L.group.singular, sort: (a, b) => a.g.name.localeCompare(b.g.name, 'es'), cell: (r) => <Link to={`/grupos/${r.g.id}`} className="flex items-center gap-2.5 font-medium hover:text-brand-text"><span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: r.subject?.color }} />{r.g.name}</Link> },
    { key: 'teacher', header: L.teacher.singular, hide: 'md', cell: (r) => <span className="text-muted">{r.teacher ? fullName(r.teacher) : '—'}</span> },
    { key: 'sched', header: 'Horario', hide: 'lg', cell: (r) => <span className="tnum text-[13px] text-muted">{scheduleText(r.g)}</span> },
    { key: 'room', header: L.classroom.singular, hide: 'xl', cell: (r) => <span className="text-muted">{r.room?.name}</span> },
    { key: 'occ', header: 'Ocupación', sort: (a, b) => a.pct - b.pct, cell: (r) => <div className="w-32"><p className="tnum mb-1 flex items-center gap-2 text-xs">{r.members.length} / {r.g.capacity}{r.members.length >= r.g.capacity && <Badge tone="warn">Completo</Badge>}</p><ProgressBar pct={r.pct} tone={r.pct >= 100 ? 'warn' : 'brand'} label="Ocupación" /></div> },
    { key: 'att', header: 'Asistencia', sort: (a, b) => (a.attendancePct ?? 0) - (b.attendancePct ?? 0), hide: 'md', cell: (r) => <span className="tnum">{r.attendancePct === null ? '—' : `${Math.round(r.attendancePct)} %`}</span> },
  ];
  return (
    <>
      <PageHeader title={L.group.plural} description={`${rows.length} ${L.group.plural.toLowerCase()} activos`} actions={can('groups:write') && <Button variant="primary" onClick={() => setSp({ nuevo: '1' })}><Plus size={16} />Nuevo {L.group.singular.toLowerCase()}</Button>} />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterChips label="Ocupación" value={f} onChange={setF} options={[{ id: 'todos', label: 'Todos' }, { id: 'completos', label: 'Completos' }, { id: 'disponibles', label: 'Con plazas' }]} />
        <SearchInput value={q} onChange={setQ} placeholder={`Buscar ${L.group.plural.toLowerCase()}…`} label={`Buscar ${L.group.plural.toLowerCase()}`} />
      </div>
      <DataTable label={L.group.plural} rows={view} columns={cols} rowKey={(r) => r.g.id} onRowClick={(r) => nav(`/grupos/${r.g.id}`)} defaultSort={{ key: 'name', dir: 'asc' }} empty={{ icon: UsersRound, title: 'Ningún resultado' }} />
      {sp.get('nuevo') === '1' && <GroupForm open onClose={() => { sp.delete('nuevo'); setSp(sp, { replace: true }); }} onCreated={(id) => nav(`/grupos/${id}`)} />}
    </>
  );
}
