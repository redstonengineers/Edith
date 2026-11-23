import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, ClipboardCheck, Pencil } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Avatar, Badge, EmptyState, Panel } from '@/components/ui/primitives';
import { useAction, useCan, useLabels, useSnapshot, useUser } from '@/hooks';
import { fullName } from '@/lib/people';
import { openGrading, setExamStatus, setGrade } from '@/services/mutations';
import { fmtDate } from '@/utils/format';
import { cn } from '@/utils/cn';
import { ForbiddenPage } from '../Status';
import { ExamForm } from './ExamForm';
import { examLabel, examTone } from './ExamList';

function GradeInput({ examId, studentId, score, disabled }: { examId: string; studentId: string; score: number | null; disabled: boolean }) {
  const user = useUser(); const run = useAction(); const [v, setV] = useState(score === null ? '' : String(score)); const [bad, setBad] = useState(false);
  const commit = async () => {
    const n = v.trim() === '' ? null : Number(v.replace(',', '.'));
    if (n === score) return setBad(false);
    if (n !== null && (Number.isNaN(n) || n < 0 || n > 10)) return setBad(true);
    setBad(false); await run(() => setGrade(user, examId, studentId, n), 'Nota guardada');
  };
  return <input aria-label="Nota" aria-invalid={bad || undefined} inputMode="decimal" disabled={disabled} value={v} placeholder="—" onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    className={cn('tnum h-9 w-20 rounded-lg border bg-bg px-2 text-center text-sm outline-none focus:border-brand disabled:opacity-60', bad ? 'border-bad' : 'border-line')} />;
}

export default function ExamDetail() {
  const { id } = useParams(); const snap = useSnapshot(); const L = useLabels(); const can = useCan(); const user = useUser(); const run = useAction(); const [edit, setEdit] = useState(false);
  const e = snap.exams.find((x) => x.id === id);
  if (!e) return <ForbiddenPage reason="denied" />;
  const group = snap.groups.find((g) => g.id === e.groupId); const t = snap.teachers.find((x) => x.id === e.teacherId); const room = snap.classrooms.find((r) => r.id === e.classroomId);
  const members = snap.students.filter((s) => s.groupIds.includes(e.groupId) && s.status !== 'baja').sort((a, b) => a.lastName.localeCompare(b.lastName, 'es'));
  const grades = new Map(snap.grades.filter((g) => g.examId === e.id).map((g) => [g.studentId, g.score]));
  const scored = [...grades.values()].filter((x): x is number => x !== null);
  const avg = scored.length ? scored.reduce((a, b) => a + b, 0) / scored.length : null;
  const pass = scored.filter((x) => x >= 5).length;
  const gradeWrite = can('grades:write') && (user.role !== 'PROFESOR' || e.teacherId === user.teacherId);
  return (
    <>
      <PageHeader breadcrumbs={[{ label: L.exam.plural, to: '/examenes' }, { label: e.title }]} title={<span className="flex flex-wrap items-center gap-3">{e.title}<Badge tone={examTone[e.status]}>{examLabel[e.status]}</Badge></span>}
        description={`${fmtDate(e.date, "EEEE d 'de' MMMM")} · ${e.start} · ${e.durationMin} min · ${room?.name ?? ''}`}
        actions={<>{can('exams:write') && <Button onClick={() => setEdit(true)}><Pencil size={15} />Editar</Button>}
          {gradeWrite && e.status === 'pendiente' && <Button variant="primary" onClick={() => void run(() => openGrading(user, e.id), 'Marcado como realizado')}><ClipboardCheck size={15} />Marcar realizado y calificar</Button>}
          {can('exams:write') && e.status === 'corregido' && <Button onClick={() => void run(() => setExamStatus(user, e.id, 'realizado'), 'Reabierto')}>Reabrir corrección</Button>}</>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        {[[L.group.singular, group?.name ?? '—'], [L.teacher.singular, t ? fullName(t) : '—'], ['Nota media', avg === null ? '—' : avg.toFixed(1)], ['Aprobados', scored.length ? `${pass} / ${scored.length}` : '—']].map(([k, v]) => <div key={k} className="panel p-4"><p className="text-xs text-muted">{k}</p><p className="mt-1 truncate text-lg font-semibold">{v}</p></div>)}
      </div>
      {e.description && <p className="mb-6 text-sm text-muted">{e.description}</p>}
      <Panel title={`Calificaciones · ${members.length} ${L.student.plural.toLowerCase()}`} bodyClassName="px-0 pb-1">
        {e.status === 'pendiente' ? <EmptyState icon={ClipboardCheck} title="Examen aún no realizado" description="Márcalo como realizado para empezar a introducir notas." /> : members.length === 0 ? <EmptyState title={`Sin ${L.student.plural.toLowerCase()}`} /> : (
          <ul className="divide-y divide-line">{members.map((s) => { const sc = grades.get(s.id) ?? null; return (
            <li key={s.id} className="flex items-center gap-3 px-5 py-2.5"><Avatar name={fullName(s)} hue={s.avatarHue} size={28} /><Link to={`/alumnos/${s.id}`} className="flex-1 text-sm font-medium hover:text-brand-text">{fullName(s)}</Link>
              {sc !== null && sc < 5 && <Badge tone="bad">Suspenso</Badge>}{sc !== null && sc >= 5 && <CheckCircle2 size={15} className="text-ok" aria-label="Aprobado" />}
              <GradeInput key={`${s.id}-${sc}`} examId={e.id} studentId={s.id} score={sc} disabled={!gradeWrite} /></li>); })}</ul>)}
      </Panel>
      {edit && <ExamForm open exam={e} onClose={() => setEdit(false)} />}
    </>
  );
}
