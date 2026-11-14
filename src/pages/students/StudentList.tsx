import { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Hourglass, UserPlus, Users } from 'lucide-react';
import { AttendanceCell, PayBadge, StudentStatusBadge } from '@/components/domain/badges';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { FilterChips, SearchInput } from '@/components/ui/controls';
import { Avatar } from '@/components/ui/primitives';
import { useCan, useLabels, usePersistentState, useSnapshot, useVisibleModules } from '@/hooks';
import { studentRows, type StudentRow } from '@/lib/people';
import { norm, fmtAgo } from '@/utils/format';
import { StudentForm } from './StudentForm';

type Filter = 'todos' | 'activos' | 'inactivos' | 'nuevos' | 'morosos' | 'baja_asistencia';

export default function StudentList() {
  const snap = useSnapshot(); const L = useLabels(); const can = useCan(); const nav = useNavigate();
  const hasWaitlist = useVisibleModules().some((m) => m.id === 'waitlist');
  const [filter, setFilter] = usePersistentState<Filter>('ac.students.filter', 'todos');
  const [q, setQ] = usePersistentState('ac.students.q', '');
  const [sp, setSp] = useSearchParams();
  const rows = useMemo(() => studentRows(snap), [snap]);

  const preds: Record<Filter, (r: StudentRow) => boolean> = {
    todos: (r) => r.student.status !== 'baja', activos: (r) => r.student.status === 'activo', inactivos: (r) => r.student.status === 'inactivo' || r.student.status === 'baja',
    nuevos: (r) => r.student.status === 'nuevo', morosos: (r) => r.pay === 'moroso', baja_asistencia: (r) => r.lowAttendance,
  };
  const nq = norm(q).split(/\s+/).filter(Boolean);
  const view = rows.filter(preds[filter]).filter((r) => { const h = norm(`${r.name} ${r.student.email} ${r.groups.map((g) => g.name).join(' ')}`); return nq.every((t) => h.includes(t)); });
  const opt = (id: Filter, label: string) => ({ id, label, count: rows.filter(preds[id]).length });

  const cols: Column<StudentRow>[] = [
    { key: 'name', header: 'Alumno', sort: (a, b) => a.name.localeCompare(b.name, 'es'), cell: (r) => (
      <Link to={`/alumnos/${r.student.id}`} className="flex items-center gap-3 font-medium hover:text-brand-text"><Avatar name={r.name} hue={r.student.avatarHue} size={30} /><span>{r.name}</span></Link>) },
    { key: 'age', header: 'Edad', sort: (a, b) => a.age - b.age, hide: 'md', cell: (r) => <span className="tnum">{r.age}</span> },
    { key: 'group', header: L.group.singular, hide: 'lg', cell: (r) => <span className="text-muted">{r.groups[0]?.name ?? '—'}{r.groups.length > 1 && <span className="ml-1 text-xs">+{r.groups.length - 1}</span>}</span> },
    { key: 'subjects', header: L.subject.plural, hide: 'xl', cell: (r) => <span className="text-muted">{r.subjects.map((s) => s.name).join(', ') || '—'}</span> },
    { key: 'status', header: 'Estado', sort: (a, b) => a.student.status.localeCompare(b.student.status), cell: (r) => <StudentStatusBadge status={r.student.status} /> },
    { key: 'att', header: 'Asistencia', sort: (a, b) => (a.attendancePct ?? 101) - (b.attendancePct ?? 101), hide: 'md', cell: (r) => <AttendanceCell pct={r.attendancePct} low={r.lowAttendance} /> },
    ...(can('payments:read') ? [{ key: 'pay', header: 'Pago', hide: 'lg', cell: (r: StudentRow) => <PayBadge pay={r.pay} /> } as Column<StudentRow>] : []),
    { key: 'last', header: 'Última actividad', sort: (a, b) => a.student.lastActivityAt.localeCompare(b.student.lastActivityAt), hide: 'xl', cell: (r) => <span className="text-muted">{fmtAgo(r.student.lastActivityAt)}</span> },
  ];
  const creating = sp.get('nuevo') === '1';
  const closeForm = () => { sp.delete('nuevo'); setSp(sp, { replace: true }); };

  return (
    <>
      <PageHeader title={L.student.plural} description={`${rows.filter((r) => r.student.status === 'activo' || r.student.status === 'nuevo').length} activos · ${rows.length} en total`}
        actions={can('students:write') && <Button variant="primary" onClick={() => setSp({ nuevo: '1' })}><UserPlus size={16} />Nuevo {L.student.singular.toLowerCase()}</Button>} />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FilterChips<Filter> label="Filtrar" value={filter} onChange={setFilter} options={[opt('todos', 'Todos'), opt('activos', 'Activos'), opt('nuevos', 'Nuevos'), opt('inactivos', 'Inactivos'), ...(can('payments:read') ? [opt('morosos', 'Morosos')] : []), opt('baja_asistencia', 'Asistencia baja')]} />
        <div className="flex items-center gap-2">
          {hasWaitlist && <Link to="/lista-espera" className="flex h-10 items-center gap-1.5 rounded-lg border border-line px-3 text-[13px] text-muted hover:text-fg"><Hourglass size={14} />Lista de espera ({snap.waitlist.filter((w) => w.status === 'pendiente' || w.status === 'contactado').length})</Link>}
          <SearchInput value={q} onChange={setQ} placeholder={`Buscar ${L.student.plural.toLowerCase()}…`} label={`Buscar ${L.student.plural.toLowerCase()}`} />
        </div>
      </div>
      <DataTable label={L.student.plural} rows={view} columns={cols} rowKey={(r) => r.student.id} onRowClick={(r) => nav(`/alumnos/${r.student.id}`)} defaultSort={{ key: 'name', dir: 'asc' }}
        empty={{ icon: Users, title: 'Ningún resultado', description: 'Prueba a cambiar el filtro o la búsqueda.', action: (q || filter !== 'todos') ? <Button onClick={() => { setQ(''); setFilter('todos'); }}>Limpiar filtros</Button> : undefined }} />
      {creating && <StudentForm open onClose={closeForm} onCreated={(id) => nav(`/alumnos/${id}`)} />}
    </>
  );
}
