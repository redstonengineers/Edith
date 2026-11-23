import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Mail, Pencil, Phone } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/controls';
import { Avatar, Badge, EmptyState, Panel } from '@/components/ui/primitives';
import { useAction, useCan, useLabels, useSnapshot, useUser } from '@/hooks';
import { DAYS } from '@/lib/conflicts';
import { fullName, teacherStats } from '@/lib/people';
import { updateTeacher } from '@/services/mutations';
import { fmtDate, todayISO } from '@/utils/format';
import { ForbiddenPage } from '../Status';
import { TeacherForm } from './TeacherForm';

export default function TeacherProfile() {
  const { id } = useParams(); const snap = useSnapshot(); const L = useLabels(); const can = useCan(); const user = useUser(); const run = useAction();
  const [edit, setEdit] = useState(false);
  const t = snap.teachers.find((x) => x.id === id);
  if (!t) return <ForbiddenPage reason="denied" />;
  const st = teacherStats(snap, t, todayISO()); const name = fullName(t);
  const write = can('teachers:write');
  return (
    <>
      <PageHeader breadcrumbs={[{ label: L.teacher.plural, to: '/profesores' }, { label: name }]} title={<span className="flex items-center gap-3"><Avatar name={name} hue={t.avatarHue} size={44} />{name}<Badge tone={t.active ? 'ok' : 'neutral'}>{t.active ? 'Activo' : 'Inactivo'}</Badge></span>} description={t.specialty}
        actions={write && <><Button onClick={() => setEdit(true)}><Pencil size={15} />Editar</Button><Button onClick={() => void run(() => updateTeacher(user, t.id, { active: !t.active }), t.active ? 'Desactivado' : 'Activado')}>{t.active ? 'Desactivar' : 'Activar'}</Button></>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        {[['Horas esta semana', `${st.weekHours.toFixed(1)} / ${t.weeklyHoursTarget} h`], [`${L.group.plural}`, String(st.groups.length)], [L.student.plural, String(st.students)], ['Horas impartidas', `${st.taughtHours.toFixed(0)} h`]].map(([k, v]) => (
          <div key={k} className="panel p-4"><p className="text-xs text-muted">{k}</p><p className="tnum mt-1 text-2xl font-semibold">{v}</p></div>))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-6">
          <Panel title="Contacto y disponibilidad">
            <ul className="space-y-2.5 text-sm"><li className="flex items-center gap-2.5"><Mail size={15} className="text-muted" aria-hidden />{t.email}</li><li className="flex items-center gap-2.5"><Phone size={15} className="text-muted" aria-hidden />{t.phone}</li></ul>
            <div className="mt-4 flex flex-wrap gap-1.5 border-t border-line pt-4">{[1, 2, 3, 4, 5, 6, 7].map((d) => <Badge key={d} tone={t.availability.includes(d) ? 'brand' : 'neutral'} className={t.availability.includes(d) ? '' : 'opacity-50'}>{DAYS[d].slice(0, 3)}</Badge>)}</div>
            <div className="mt-4"><p className="mb-1 text-xs text-muted">Carga semanal</p><ProgressBar pct={(st.weekHours / t.weeklyHoursTarget) * 100} label="Carga semanal" tone={st.weekHours > t.weeklyHoursTarget ? 'warn' : 'brand'} /></div>
          </Panel>
          <Panel title={L.subject.plural}>{t.subjectIds.length ? <div className="flex flex-wrap gap-1.5">{t.subjectIds.map((sid) => <Badge key={sid}>{snap.subjects.find((s) => s.id === sid)?.name}</Badge>)}</div> : <p className="text-sm text-muted">Sin asignar.</p>}</Panel>
        </div>
        <div className="space-y-6">
          <Panel title={L.group.plural}>{st.groups.length === 0 ? <EmptyState title="Sin grupos" /> : (
            <ul className="divide-y divide-line">{st.groups.map((g) => <li key={g.id} className="flex items-center justify-between py-2.5 text-sm"><Link to={`/grupos/${g.id}`} className="font-medium hover:text-brand-text">{g.name}</Link><span className="text-xs text-muted">{g.slots.map((s) => `${DAYS[s.weekday].slice(0, 3)} ${s.start}`).join(' · ')}</span></li>)}</ul>)}</Panel>
          <Panel title="Próximas clases">{st.upcoming.length === 0 ? <EmptyState title="Sin clases programadas" /> : (
            <ul className="divide-y divide-line">{st.upcoming.map((c) => <li key={c.id} className="flex items-center justify-between py-2.5 text-sm"><span>{snap.groups.find((g) => g.id === c.groupId)?.name}</span><span className="tnum text-muted">{fmtDate(c.date, 'EEE d MMM')} · {c.start}–{c.end}</span></li>)}</ul>)}</Panel>
          {st.incidents.length > 0 && <Panel title={L.incident.plural}><ul className="divide-y divide-line">{st.incidents.map((i) => <li key={i.id} className="py-2.5 text-sm">{i.title} <span className="text-xs text-muted">· {i.status}</span></li>)}</ul></Panel>}
        </div>
      </div>
      {edit && <TeacherForm open teacher={t} onClose={() => setEdit(false)} />}
    </>
  );
}
