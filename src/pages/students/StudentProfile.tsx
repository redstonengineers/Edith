import { useState } from 'react';
import { recordAccess } from '@/services/accessLog';
import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Mail, Pencil, Phone, ShieldAlert, UserMinus, UserX } from 'lucide-react';
import { AttendanceCell, PayBadge, StudentStatusBadge } from '@/components/domain/badges';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Tabs, ProgressBar } from '@/components/ui/controls';
import { Field, Select, Textarea } from '@/components/ui/form';
import { Badge, Avatar, EmptyState, Panel } from '@/components/ui/primitives';
import { ConfirmDialog } from '@/components/ui/Overlay';
import { useAction, useCan, useLabels, useSnapshot, useUser } from '@/hooks';
import { attendanceRates } from '@/lib/metrics';
import { fmtEventDate, studentRows, studentTimeline } from '@/lib/people';
import { addStudentToGroup, removeStudentFromGroup, setStudentStatus, updateStudent } from '@/services/mutations';
import { fmtMoney, fmtDate } from '@/utils/format';
import { cn } from '@/utils/cn';
import { StudentForm } from './StudentForm';
import { NoticePref } from './NoticePref';
import { Training } from './Training';
import { ForbiddenPage } from '../Status';

const toneDot = { neutral: 'bg-line-strong', ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad' } as const;

export default function StudentProfile() {
  const { id } = useParams(); const snap = useSnapshot(); const L = useLabels(); const user = useUser(); const can = useCan(); const run = useAction(); const nav = useNavigate();
  const s = snap.students.find((x) => x.id === id);
  const [edit, setEdit] = useState(false); const [confirm, setConfirm] = useState<null | 'baja' | 'inactivo'>(null);
  const [notes, setNotes] = useState(s?.notes ?? ''); const [pick, setPick] = useState('');
  useEffect(() => { if (s) recordAccess({ action: 'view', entity: 'student', id: s.id, subject: `${s.firstName} ${s.lastName}`, who: { id: user.id, name: user.name, role: user.role } }); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [s?.id]);
  if (!s) return <ForbiddenPage reason="denied" />;

  const row = studentRows(snap).find((r) => r.student.id === s.id)!;
  const guardian = snap.guardians.find((g) => g.id === s.guardianId);
  const write = can('students:write');
  const rate = attendanceRates(snap).get(s.id);
  const grades = snap.grades.filter((g) => g.studentId === s.id);
  const pays = snap.payments.filter((p) => p.studentId === s.id).sort((a, b) => b.dueDate.localeCompare(a.dueDate));
  const incidents = snap.incidents.filter((i) => i.relatedStudentId === s.id);
  const docs = snap.documents.filter((d) => d.ownerType === 'student' && d.ownerId === s.id);
  const timeline = studentTimeline(snap, s);
  const free = snap.groups.filter((g) => g.active && !s.groupIds.includes(g.id));

  return (
    <>
      <PageHeader breadcrumbs={[{ label: L.student.plural, to: '/alumnos' }, { label: row.name }]} title={<span className="flex items-center gap-3"><Avatar name={row.name} hue={s.avatarHue} size={44} />{row.name}<StudentStatusBadge status={s.status} /></span>}
        description={`${row.age} años · alta el ${fmtDate(s.enrolledAt, "d 'de' MMMM 'de' yyyy")}`}
        actions={write && <><Button onClick={() => setEdit(true)}><Pencil size={15} />Editar</Button>
          {s.status !== 'inactivo' && s.status !== 'baja' && <Button onClick={() => setConfirm('inactivo')}><UserMinus size={15} />Desactivar</Button>}
          {(s.status === 'inactivo' || s.status === 'baja') && <Button variant="primary" onClick={() => void run(() => setStudentStatus(user, s.id, 'activo'), 'Reactivado')}>Reactivar</Button>}
          {s.status !== 'baja' && <Button variant="danger" onClick={() => setConfirm('baja')}><UserX size={15} />Dar de baja</Button>}</>} />

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-6">
          <Panel title="Contacto">
            <ul className="space-y-2.5 text-sm">
              <li className="flex items-center gap-2.5"><Mail size={15} className="text-muted" aria-hidden /><a className="hover:text-brand-text" href={`mailto:${s.email}`}>{s.email}</a></li>
              <li className="flex items-center gap-2.5"><Phone size={15} className="text-muted" aria-hidden /><a className="hover:text-brand-text" href={`tel:${s.phone.replace(/\s/g, '')}`}>{s.phone}</a></li>
            </ul>
            {guardian ? (
              <div className="mt-4 border-t border-line pt-4 text-sm"><p className="mb-1 text-xs font-semibold text-muted">Tutor legal</p>
                <p className="font-medium">{guardian.name} <span className="font-normal text-muted">· {guardian.relation}</span></p><p className="text-muted">{guardian.phone}</p><p className="text-muted">{guardian.email}</p></div>
            ) : row.age < 18 && <p className="mt-4 flex items-center gap-2 border-t border-line pt-4 text-[13px] text-warn"><ShieldAlert size={15} aria-hidden />Menor sin tutor registrado</p>}
          </Panel>
          {snap.settings.modules.practicas && <Training student={s} />}
          {snap.settings.modules.avisos && !snap.settings.modules.practicas && <NoticePref student={s} />}
          {snap.settings.modules.groups !== false && !(snap.settings.modules.practicas && !snap.settings.modules.groups) && <Panel title={`${L.group.plural} y ${L.teacher.plural.toLowerCase()}`}>
            {row.groups.length === 0 ? <p className="text-sm text-muted">Sin {L.group.plural.toLowerCase()} asignados.</p> : (
              <ul className="space-y-3">{row.groups.map((g) => { const t = snap.teachers.find((x) => x.id === g.teacherId); return (
                <li key={g.id} className="flex items-start justify-between gap-2 text-sm">
                  <div><Link to={`/grupos/${g.id}`} className="font-medium hover:text-brand-text">{g.name}</Link><p className="text-xs text-muted">{t ? `${t.firstName} ${t.lastName}` : ''}</p></div>
                  {can('groups:write') && <button onClick={() => void run(() => removeStudentFromGroup(user, s.id, g.id), `Quitado de ${g.name}`)} className="text-xs text-muted hover:text-bad" aria-label={`Quitar de ${g.name}`}>Quitar</button>}
                </li>); })}</ul>)}
            {can('groups:write') && s.status !== 'baja' && free.length > 0 && (
              <form className="mt-4 flex gap-2 border-t border-line pt-4" onSubmit={async (e) => { e.preventDefault(); if (pick) { await run(() => addStudentToGroup(user, s.id, pick), 'Añadido al grupo'); setPick(''); } }}>
                <div className="flex-1"><Field label={`Añadir a ${L.group.singular.toLowerCase()}`}>{(p) => <Select {...p} value={pick} onChange={(e) => setPick(e.target.value)}><option value="">Seleccionar…</option>{free.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</Select>}</Field></div>
                <Button type="submit" variant="primary" className="mt-[26px]" disabled={!pick}>Añadir</Button>
              </form>)}
          </Panel>}
          <Panel title="Notas internas">
            <label htmlFor="notes" className="sr-only">Notas internas</label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!write} placeholder="Solo visibles para el equipo." />
            {write && <Button className="mt-2" size="sm" disabled={notes === s.notes} onClick={() => void run(() => updateStudent(user, s.id, { notes }), 'Notas guardadas')}>Guardar notas</Button>}
          </Panel>
        </div>

        <Tabs tabs={[
          { id: 'resumen', label: 'Resumen', content: (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="panel p-4"><p className="text-xs text-muted">Asistencia</p><p className="mt-1 text-2xl font-semibold"><AttendanceCell pct={row.attendancePct} low={row.lowAttendance} /></p>{rate && <div className="mt-2"><ProgressBar pct={rate.pct} tone={row.lowAttendance ? 'warn' : 'ok'} label="Asistencia" /></div>}{row.lowAttendance && <p className="mt-2 text-xs text-warn">Inferior al {snap.settings.attendanceAlertThreshold} %.</p>}</div>
                <div className="panel p-4"><p className="text-xs text-muted">Nota media</p><p className="tnum mt-1 text-2xl font-semibold">{grades.filter((g) => g.score !== null).length ? (grades.reduce((a, g) => a + (g.score ?? 0), 0) / grades.filter((g) => g.score !== null).length).toFixed(1) : '—'}</p></div>
                {can('payments:read') && <div className="panel p-4"><p className="text-xs text-muted">Pagos</p><div className="mt-1.5"><PayBadge pay={row.pay} /></div>{row.overdueAmount > 0 && <p className="mt-2 text-xs text-bad">{fmtMoney(row.overdueAmount, snap.settings.currency)} vencidos</p>}</div>}
              </div>
              <Panel title="Historial de actividad">
                <ol className="space-y-3.5">{timeline.map((e) => (<li key={e.id} className="flex gap-3 text-sm"><span aria-hidden className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', toneDot[e.tone])} /><div><span className="tnum text-muted">{fmtEventDate(e.date)}</span> — {e.text}</div></li>))}</ol>
              </Panel>
            </div>) },
          { id: 'asistencia', label: 'Asistencia', badge: rate ? <Badge>{rate.total}</Badge> : undefined, content: <AttendanceList studentId={s.id} /> },
          { id: 'notas', label: 'Calificaciones', badge: <Badge>{grades.length}</Badge>, content: grades.length === 0 ? <div className="panel"><EmptyState title="Sin calificaciones" /></div> : (
            <ul className="panel divide-y divide-line">{grades.map((g) => { const ex = snap.exams.find((e) => e.id === g.examId); return (<li key={g.id} className="flex items-center justify-between px-5 py-3 text-sm"><div><p className="font-medium">{ex?.title}</p><p className="text-xs text-muted">{ex && fmtDate(ex.date)}</p></div>{g.score === null ? <Badge tone="warn">Pendiente</Badge> : <span className={cn('tnum text-lg font-semibold', g.score < 5 && 'text-bad')}>{g.score.toFixed(1)}</span>}</li>); })}</ul>) },
          ...(can('payments:read') ? [{ id: 'pagos', label: 'Pagos', badge: <Badge>{pays.length}</Badge>, content: pays.length === 0 ? <div className="panel"><EmptyState title="Sin pagos" /></div> : (
            <ul className="panel divide-y divide-line">{pays.map((p) => (<li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm"><div><p className="font-medium capitalize">{p.concept}</p><p className="text-xs text-muted">Vence {fmtDate(p.dueDate)}</p></div><div className="flex items-center gap-3"><span className="tnum">{fmtMoney(p.amount, snap.settings.currency)}</span><Badge tone={p.status === 'pagado' ? 'ok' : p.status === 'vencido' ? 'bad' : 'warn'}>{p.status}</Badge></div></li>))}</ul>) }] : []),
          { id: 'incidencias', label: L.incident.plural, badge: <Badge>{incidents.length}</Badge>, content: incidents.length === 0 ? <div className="panel"><EmptyState title="Sin incidencias" /></div> : <ul className="panel divide-y divide-line">{incidents.map((i) => <li key={i.id} className="px-5 py-3 text-sm"><p className="font-medium">{i.title}</p><p className="text-xs text-muted">{i.type} · {i.priority} · {i.status}</p></li>)}</ul> },
          { id: 'docs', label: L.document.plural, badge: <Badge>{docs.length}</Badge>, content: docs.length === 0 ? <div className="panel"><EmptyState title="Sin documentos" /></div> : <ul className="panel divide-y divide-line">{docs.map((d) => <li key={d.id} className="flex justify-between px-5 py-3 text-sm"><span>{d.name}</span><span className="text-xs text-muted">{d.sizeKb} KB · {fmtDate(d.uploadedAt)}</span></li>)}</ul> },
        ]} />
      </div>

      {edit && <StudentForm open student={s} onClose={() => setEdit(false)} />}
      <ConfirmDialog open={confirm !== null} danger onClose={() => setConfirm(null)} title={confirm === 'baja' ? `¿Dar de baja a ${row.name}?` : `¿Desactivar a ${row.name}?`}
        description="Se le quitará de todos los grupos y dejará de contar como alumno activo. Podrás reactivarlo más tarde." confirmLabel={confirm === 'baja' ? 'Dar de baja' : 'Desactivar'}
        onConfirm={() => { if (confirm) void run(() => setStudentStatus(user, s.id, confirm), 'Estado actualizado').then(() => confirm === 'baja' && nav('/alumnos')); }} />
    </>
  );
}

function AttendanceList({ studentId }: { studentId: string }) {
  const snap = useSnapshot();
  const rows = snap.attendance.filter((a) => a.studentId === studentId).map((a) => ({ a, c: snap.classes.find((c) => c.id === a.classId) })).filter((x) => x.c).sort((x, y) => y.c!.date.localeCompare(x.c!.date)).slice(0, 20);
  if (!rows.length) return <div className="panel"><EmptyState title="Sin registros de asistencia" /></div>;
  const tone = { presente: 'ok', retraso: 'warn', justificado: 'info', ausente: 'bad' } as const;
  return <ul className="panel divide-y divide-line">{rows.map(({ a, c }) => (<li key={a.id} className="flex items-center justify-between px-5 py-2.5 text-sm"><span>{fmtDate(c!.date)} · <span className="text-muted">{snap.groups.find((g) => g.id === c!.groupId)?.name}</span></span><Badge tone={tone[a.status]}>{a.status}</Badge></li>))}</ul>;
}
