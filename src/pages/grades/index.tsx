import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Award } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Badge, EmptyState, Panel } from '@/components/ui/primitives';
import { useLabels, useSnapshot } from '@/hooks';
import { fullName } from '@/lib/people';
import type { Student } from '@/types';
import { fmtDate } from '@/utils/format';

export default function GradesPage() {
  const snap = useSnapshot(); const L = useLabels();
  const queue = snap.exams.filter((e) => e.status === 'realizado').sort((a, b) => a.date.localeCompare(b.date));
  type R = { s: Student; avg: number; n: number; failed: number };
  const rows: R[] = useMemo(() => snap.students.map((s) => { const gs = snap.grades.filter((g) => g.studentId === s.id && g.score !== null); return { s, n: gs.length, avg: gs.length ? gs.reduce((a, g) => a + (g.score ?? 0), 0) / gs.length : NaN, failed: gs.filter((g) => (g.score ?? 0) < 5).length }; }).filter((r) => r.n > 0), [snap]);
  const cols: Column<R>[] = [
    { key: 'n', header: L.student.singular, sort: (a, b) => fullName(a.s).localeCompare(fullName(b.s), 'es'), cell: (r) => <Link to={`/alumnos/${r.s.id}`} className="font-medium hover:text-brand-text">{fullName(r.s)}</Link> },
    { key: 'g', header: L.group.singular, hide: 'md', cell: (r) => <span className="text-muted">{snap.groups.find((g) => r.s.groupIds.includes(g.id))?.name ?? '—'}</span> },
    { key: 'avg', header: 'Nota media', sort: (a, b) => a.avg - b.avg, cell: (r) => <span className={`tnum font-semibold ${r.avg < 5 ? 'text-bad' : ''}`}>{r.avg.toFixed(1)}</span> },
    { key: 'c', header: L.exam.plural, hide: 'md', sort: (a, b) => a.n - b.n, cell: (r) => <span className="tnum text-muted">{r.n}</span> },
    { key: 'f', header: 'Suspensos', sort: (a, b) => a.failed - b.failed, cell: (r) => r.failed ? <Badge tone="bad">{r.failed}</Badge> : <span className="text-muted">—</span> },
  ];
  return (
    <>
      <PageHeader title="Calificaciones" description="Pendientes de corrección y rendimiento por alumno." />
      <div className="space-y-6">
        <Panel title="Pendientes de calificar" action={queue.length ? <Badge tone="warn">{queue.length}</Badge> : undefined}>
          {queue.length === 0 ? <EmptyState icon={Award} title="Todo calificado" description={`No hay ${L.exam.plural.toLowerCase()} pendientes de corrección.`} /> : (
            <ul className="divide-y divide-line">{queue.map((e) => { const gs = snap.grades.filter((g) => g.examId === e.id); return (
              <li key={e.id}><Link to={`/examenes/${e.id}`} className="flex items-center justify-between py-2.5 text-sm hover:text-brand-text"><span><span className="font-medium">{e.title}</span> <span className="text-muted">· {fmtDate(e.date)}</span></span><span className="tnum text-xs text-muted">{gs.filter((g) => g.score !== null).length} / {gs.length} notas</span></Link></li>); })}</ul>)}
        </Panel>
        <DataTable label="Rendimiento por alumno" rows={rows} columns={cols} rowKey={(r) => r.s.id} defaultSort={{ key: 'avg', dir: 'asc' }} empty={{ icon: Award, title: 'Sin calificaciones todavía' }} />
      </div>
    </>
  );
}
