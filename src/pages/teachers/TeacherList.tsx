import { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { GraduationCap, UserPlus } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { FilterChips, ProgressBar, SearchInput } from '@/components/ui/controls';
import { Avatar, Badge } from '@/components/ui/primitives';
import { useCan, useLabels, usePersistentState, useSnapshot } from '@/hooks';
import { fullName, teacherStats } from '@/lib/people';
import type { Teacher } from '@/types';
import { norm, todayISO } from '@/utils/format';
import { TeacherForm } from './TeacherForm';

interface Row { t: Teacher; name: string; groups: number; students: number; week: number }
export default function TeacherList() {
  const snap = useSnapshot(); const L = useLabels(); const can = useCan(); const nav = useNavigate(); const [sp, setSp] = useSearchParams();
  const [q, setQ] = usePersistentState('ac.teachers.q', ''); const [f, setF] = usePersistentState<'todos' | 'activos' | 'inactivos'>('ac.teachers.f', 'activos');
  const rows: Row[] = useMemo(() => snap.teachers.map((t) => { const s = teacherStats(snap, t, todayISO()); return { t, name: fullName(t), groups: s.groups.length, students: s.students, week: s.weekHours }; }), [snap]);
  const nq = norm(q).split(/\s+/).filter(Boolean);
  const view = rows.filter((r) => f === 'todos' || (f === 'activos') === r.t.active).filter((r) => { const h = norm(`${r.name} ${r.t.specialty}`); return nq.every((x) => h.includes(x)); });
  const cols: Column<Row>[] = [
    { key: 'name', header: L.teacher.singular, sort: (a, b) => a.name.localeCompare(b.name, 'es'), cell: (r) => <Link to={`/profesores/${r.t.id}`} className="flex items-center gap-3 font-medium hover:text-brand-text"><Avatar name={r.name} hue={r.t.avatarHue} size={30} />{r.name}</Link> },
    { key: 'spec', header: 'Especialidad', hide: 'md', cell: (r) => <span className="text-muted">{r.t.specialty}</span> },
    { key: 'groups', header: L.group.plural, sort: (a, b) => a.groups - b.groups, cell: (r) => <span className="tnum">{r.groups}</span> },
    { key: 'students', header: L.student.plural, sort: (a, b) => a.students - b.students, hide: 'lg', cell: (r) => <span className="tnum">{r.students}</span> },
    { key: 'hours', header: 'Horas esta semana', sort: (a, b) => a.week - b.week, hide: 'md', cell: (r) => <div className="w-32"><p className="tnum mb-1 text-xs">{r.week.toFixed(1)} / {r.t.weeklyHoursTarget} h</p><ProgressBar pct={(r.week / r.t.weeklyHoursTarget) * 100} tone={r.week > r.t.weeklyHoursTarget ? 'warn' : 'brand'} label="Carga semanal" /></div> },
    { key: 'st', header: 'Estado', cell: (r) => <Badge tone={r.t.active ? 'ok' : 'neutral'}>{r.t.active ? 'Activo' : 'Inactivo'}</Badge> },
  ];
  return (
    <>
      <PageHeader title={L.teacher.plural} description={`${rows.filter((r) => r.t.active).length} activos`} actions={can('teachers:write') && <Button variant="primary" onClick={() => setSp({ nuevo: '1' })}><UserPlus size={16} />Nuevo {L.teacher.singular.toLowerCase()}</Button>} />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterChips label="Estado" value={f} onChange={setF} options={[{ id: 'activos', label: 'Activos' }, { id: 'inactivos', label: 'Inactivos' }, { id: 'todos', label: 'Todos' }]} />
        <SearchInput value={q} onChange={setQ} placeholder={`Buscar ${L.teacher.plural.toLowerCase()}…`} label={`Buscar ${L.teacher.plural.toLowerCase()}`} />
      </div>
      <DataTable label={L.teacher.plural} rows={view} columns={cols} rowKey={(r) => r.t.id} onRowClick={(r) => nav(`/profesores/${r.t.id}`)} defaultSort={{ key: 'name', dir: 'asc' }} empty={{ icon: GraduationCap, title: 'Ningún resultado' }} />
      {sp.get('nuevo') === '1' && <TeacherForm open onClose={() => { sp.delete('nuevo'); setSp(sp, { replace: true }); }} onCreated={(id) => nav(`/profesores/${id}`)} />}
    </>
  );
}
