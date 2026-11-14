import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Clock, DoorOpen, Pencil, User } from 'lucide-react';
import { AttendanceCell, StudentStatusBadge } from '@/components/domain/badges';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/controls';
import { Field, Select } from '@/components/ui/form';
import { Avatar, Badge, EmptyState, Panel } from '@/components/ui/primitives';
import { useAction, useCan, useLabels, useSnapshot, useUser } from '@/hooks';
import { attendanceRates } from '@/lib/metrics';
import { fullName, groupStats } from '@/lib/people';
import { addStudentToGroup, removeStudentFromGroup } from '@/services/mutations';
import { fmtDate } from '@/utils/format';
import { ForbiddenPage } from '../Status';
import { GroupForm } from './GroupForm';
import { scheduleText } from './GroupList';

export default function GroupDetail() {
  const { id } = useParams(); const snap = useSnapshot(); const L = useLabels(); const can = useCan(); const user = useUser(); const run = useAction();
  const [edit, setEdit] = useState(false); const [pick, setPick] = useState('');
  const g = snap.groups.find((x) => x.id === id);
  if (!g) return <ForbiddenPage reason="denied" />;
  const st = groupStats(snap, g); const rates = attendanceRates(snap);
  const teacher = snap.teachers.find((t) => t.id === g.teacherId); const room = snap.classrooms.find((r) => r.id === g.classroomId); const subj = snap.subjects.find((s) => s.id === g.subjectId);
  const candidates = snap.students.filter((s) => (s.status === 'activo' || s.status === 'nuevo' || s.status === 'inactivo') && !s.groupIds.includes(g.id));
  const full = st.members.length >= g.capacity;
  const incidents = snap.incidents.filter((i) => st.members.some((m) => m.id === i.relatedStudentId));
  return (
    <>
      <PageHeader breadcrumbs={[{ label: L.group.plural, to: '/grupos' }, { label: g.name }]} title={<span className="flex items-center gap-3"><span aria-hidden className="h-3 w-3 rounded-full" style={{ background: subj?.color }} />{g.name}{full && <Badge tone="warn">Completo</Badge>}</span>}
        description={<span className="flex flex-wrap items-center gap-x-5 gap-y-1"><span className="flex items-center gap-1.5"><User size={14} aria-hidden />{teacher ? <Link to={`/profesores/${teacher.id}`} className="hover:text-brand-text">{fullName(teacher)}</Link> : '—'}</span><span className="flex items-center gap-1.5"><Clock size={14} aria-hidden /><span className="tnum">{scheduleText(g)}</span></span><span className="flex items-center gap-1.5"><DoorOpen size={14} aria-hidden />{room?.name}</span></span>}
        actions={can('groups:write') && <Button onClick={() => setEdit(true)}><Pencil size={15} />Editar</Button>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <div className="panel p-4"><p className="text-[11px] tracking-[0.12em] text-muted uppercase">{L.student.plural}</p><p className="tnum mt-1 text-2xl font-semibold">{st.members.length}<span className="text-base text-muted"> / {g.capacity}</span></p><div className="mt-2"><ProgressBar pct={st.pct} tone={full ? 'warn' : 'brand'} label="Ocupación" /></div></div>
        <div className="panel p-4"><p className="text-[11px] tracking-[0.12em] text-muted uppercase">Asistencia</p><p className="tnum mt-1 text-2xl font-semibold">{st.attendancePct === null ? '—' : `${Math.round(st.attendancePct)} %`}</p></div>
        <div className="panel p-4"><p className="text-[11px] tracking-[0.12em] text-muted uppercase">Nota media</p><p className="tnum mt-1 text-2xl font-semibold">{st.avgGrade === null ? '—' : st.avgGrade.toFixed(1)}</p></div>
        <div className="panel p-4"><p className="text-[11px] tracking-[0.12em] text-muted uppercase">{L.incident.plural}</p><p className="tnum mt-1 text-2xl font-semibold">{incidents.length}</p></div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Panel title={L.student.plural} bodyClassName="px-0 pb-1">
          {st.members.length === 0 ? <EmptyState title={`Sin ${L.student.plural.toLowerCase()}`} description="Añade el primero desde el selector." /> : (
            <ul className="divide-y divide-line">{st.members.map((s) => { const r = rates.get(s.id); const low = !!r && r.total >= 5 && r.pct < snap.settings.attendanceAlertThreshold; return (
              <li key={s.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                <Avatar name={fullName(s)} hue={s.avatarHue} size={28} /><Link to={`/alumnos/${s.id}`} className="flex-1 font-medium hover:text-brand-text">{fullName(s)}</Link>
                <span className="hidden sm:block"><StudentStatusBadge status={s.status} /></span><AttendanceCell pct={r && r.total >= 3 ? r.pct : null} low={low} />
                {can('groups:write') && <button onClick={() => void run(() => removeStudentFromGroup(user, s.id, g.id), 'Quitado del grupo')} aria-label={`Quitar a ${fullName(s)}`} className="text-xs text-muted hover:text-bad">Quitar</button>}
              </li>); })}</ul>)}
          {can('groups:write') && (
            <form className="flex items-end gap-2 border-t border-line px-5 pt-4 pb-4" onSubmit={async (e) => { e.preventDefault(); if (pick) { await run(() => addStudentToGroup(user, pick, g.id), 'Añadido al grupo'); setPick(''); } }}>
              <div className="flex-1"><Field label={`Añadir ${L.student.singular.toLowerCase()}`} hint={full ? 'El grupo está completo.' : undefined}>{(p) => <Select {...p} disabled={full} value={pick} onChange={(e) => setPick(e.target.value)}><option value="">Seleccionar…</option>{candidates.map((s) => <option key={s.id} value={s.id}>{fullName(s)}</option>)}</Select>}</Field></div>
              <Button type="submit" variant="primary" disabled={!pick || full}>Añadir</Button>
            </form>)}
        </Panel>
        <div className="space-y-6">
          <Panel title={L.exam.plural}>{st.exams.length === 0 ? <p className="text-sm text-muted">Sin {L.exam.plural.toLowerCase()}.</p> : <ul className="space-y-2.5">{st.exams.sort((a, b) => b.date.localeCompare(a.date)).map((e) => <li key={e.id} className="flex items-center justify-between gap-2 text-sm"><div><p className="font-medium">{e.title}</p><p className="text-xs text-muted">{fmtDate(e.date)} · {e.start}</p></div><Badge tone={e.status === 'pendiente' ? 'brand' : e.status === 'realizado' ? 'warn' : 'ok'}>{e.status}</Badge></li>)}</ul>}</Panel>
          {incidents.length > 0 && <Panel title={L.incident.plural}><ul className="space-y-2 text-sm">{incidents.map((i) => <li key={i.id}>{i.title} <span className="text-xs text-muted">· {i.status}</span></li>)}</ul></Panel>}
        </div>
      </div>
      {edit && <GroupForm open group={g} onClose={() => setEdit(false)} />}
    </>
  );
}
