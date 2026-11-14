import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { nuevo } from '@/lib/labels';
import { FileText, Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { FilterChips, ProgressBar } from '@/components/ui/controls';
import { Badge } from '@/components/ui/primitives';
import { useCan, useLabels, usePersistentState, useSnapshot } from '@/hooks';
import { fullName } from '@/lib/people';
import type { Exam } from '@/types';
import { fmtDate } from '@/utils/format';
import { ExamForm } from './ExamForm';

type F = 'proximos' | 'realizados' | 'por_calificar' | 'corregidos' | 'todos';
export const examTone = { pendiente: 'brand', realizado: 'warn', corregido: 'ok' } as const;
export const examLabel = { pendiente: 'Pendiente', realizado: 'Por calificar', corregido: 'Corregido' } as const;

export default function ExamList() {
  const snap = useSnapshot(); const L = useLabels(); const can = useCan(); const nav = useNavigate(); const [sp, setSp] = useSearchParams();
  const [f, setF] = usePersistentState<F>('ac.exams.f', 'proximos'); const [, force] = useState(0); void force;
  const preds: Record<F, (e: Exam) => boolean> = { proximos: (e) => e.status === 'pendiente', realizados: (e) => e.status !== 'pendiente', por_calificar: (e) => e.status === 'realizado', corregidos: (e) => e.status === 'corregido', todos: () => true };
  const progress = (e: Exam) => { const gs = snap.grades.filter((g) => g.examId === e.id); return gs.length ? (gs.filter((g) => g.score !== null).length / gs.length) * 100 : 0; };
  const rows = snap.exams.filter(preds[f]);
  const opt = (id: F, label: string) => ({ id, label, count: snap.exams.filter(preds[id]).length });
  const cols: Column<Exam>[] = [
    { key: 't', header: L.exam.singular, sort: (a, b) => a.title.localeCompare(b.title, 'es'), cell: (e) => <Link to={`/examenes/${e.id}`} className="font-medium hover:text-brand-text">{e.title}</Link> },
    { key: 'g', header: L.group.singular, hide: 'md', cell: (e) => <span className="text-muted">{snap.groups.find((g) => g.id === e.groupId)?.name}</span> },
    { key: 'd', header: 'Fecha', sort: (a, b) => (a.date + a.start).localeCompare(b.date + b.start), cell: (e) => <span className="tnum">{fmtDate(e.date, 'EEE d MMM')} · {e.start}</span> },
    { key: 'r', header: L.classroom.singular, hide: 'xl', cell: (e) => <span className="text-muted">{snap.classrooms.find((r) => r.id === e.classroomId)?.name}</span> },
    { key: 'p', header: L.teacher.singular, hide: 'lg', cell: (e) => { const t = snap.teachers.find((x) => x.id === e.teacherId); return <span className="text-muted">{t ? fullName(t) : ''}</span>; } },
    { key: 's', header: 'Estado', cell: (e) => <Badge tone={examTone[e.status]}>{examLabel[e.status]}</Badge> },
    { key: 'c', header: 'Corrección', hide: 'md', cell: (e) => e.status === 'pendiente' ? <span className="text-muted">—</span> : <div className="w-24"><ProgressBar pct={progress(e)} tone="ok" label="Corrección" /></div> },
  ];
  const close = () => { sp.delete('nuevo'); setSp(sp, { replace: true }); };
  return (
    <>
      <PageHeader title={L.exam.plural} description="Convocatorias, realización y corrección." actions={can('exams:write') && <Button variant="primary" onClick={() => setSp({ nuevo: '1' })}><Plus size={16} />{nuevo(L.exam)}</Button>} />
      <div className="mb-4"><FilterChips<F> label="Filtrar" value={f} onChange={setF} options={[opt('proximos', 'Próximos'), opt('por_calificar', 'Por calificar'), opt('corregidos', 'Corregidos'), opt('realizados', 'Realizados'), opt('todos', 'Todos')]} /></div>
      <DataTable label={L.exam.plural} rows={rows} columns={cols} rowKey={(e) => e.id} onRowClick={(e) => nav(`/examenes/${e.id}`)} defaultSort={{ key: 'd', dir: f === 'proximos' ? 'asc' : 'desc' }} empty={{ icon: FileText, title: 'Sin resultados' }} />
      {sp.get('nuevo') === '1' && <ExamForm open onClose={close} onCreated={(id) => nav(`/examenes/${id}`)} />}
    </>
  );
}
