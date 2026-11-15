import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Plus, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge, EmptyState } from '@/components/ui/primitives';
import { ConfirmDialog } from '@/components/ui/Overlay';
import { useAction, useCan, useLabels, useSnapshot, useUser } from '@/hooks';
import { enrollmentName } from '@/lib/people';
import { advanceEnrollment, rejectEnrollment } from '@/services/mutations';
import type { Enrollment, EnrollmentStatus } from '@/types';
import { fmtDate } from '@/utils/format';
import { ApplicationForm } from './ApplicationsPage';
import { AssignGroupModal } from './shared';
import { PublicFormCard } from './PublicFormCard';

export const STAGES: { id: EnrollmentStatus; label: string; next?: string; hint: string }[] = [
  { id: 'solicitud', label: 'Solicitud', next: 'Pasar a revisión', hint: 'Recibida' },
  { id: 'revision', label: 'Revisión', next: 'Aceptar', hint: 'En estudio' },
  { id: 'aceptada', label: 'Aceptación', next: 'Matricular', hint: 'Aprobada' },
  { id: 'matriculada', label: 'Matrícula', next: 'Asignar grupo y activar', hint: 'Ficha creada, falta grupo' },
  { id: 'activa', label: 'Activo', hint: 'Alumno en clase' },
];

export function useEnrollmentActions() {
  const user = useUser(); const run = useAction(); const L = useLabels();
  return {
    advance: (e: Enrollment, groupId?: string) => run(() => advanceEnrollment(user, e.id, { groupId }), e.status === 'matriculada' ? `${L.student.singular} activado` : 'Avanzado'),
    reject: (e: Enrollment) => run(() => rejectEnrollment(user, e.id), 'Solicitud rechazada'),
  };
}

export default function EnrollmentsPage() {
  const snap = useSnapshot(); const L = useLabels(); const can = useCan(); const act = useEnrollmentActions();
  const [adding, setAdding] = useState(false); const [assign, setAssign] = useState<Enrollment | null>(null); const [rej, setRej] = useState<Enrollment | null>(null);
  const write = can('enrollments:write');
  const by = (s: EnrollmentStatus) => snap.enrollments.filter((e) => e.status === s).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return (
    <>
      <PageHeader title={L.enrollment.plural} description="Del primer contacto al alumno activo, sin reescribir datos."
        actions={can('applications:write') && <Button variant="primary" onClick={() => setAdding(true)}><Plus size={16} />Nueva solicitud</Button>} />
      <PublicFormCard />
      <ol aria-label="Etapas" className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
        {STAGES.map((s, i) => <li key={s.id} className="flex items-center gap-2">{i > 0 && <ArrowRight size={12} aria-hidden />}{s.label}</li>)}
      </ol>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {STAGES.map((st) => {
          const items = by(st.id); const shown = st.id === 'activa' ? items.slice(0, 6) : items;
          return (
            <section key={st.id} aria-label={st.label} className="panel flex min-h-40 flex-col">
              <header className="flex items-center justify-between border-b border-line px-4 py-3"><div><h2 className="text-sm font-semibold">{st.label}</h2><p className="text-[11px] text-muted">{st.hint}</p></div><Badge>{items.length}</Badge></header>
              <ul className="flex-1 space-y-2 p-3">
                {shown.length === 0 && <li className="px-1 py-6 text-center text-xs text-muted">Vacío</li>}
                {shown.map((e) => (
                  <li key={e.id} className="rounded-lg border border-line bg-surface-2/50 p-3">
                    <p className="text-sm font-medium">{e.studentId ? <Link to={`/alumnos/${e.studentId}`} className="hover:text-brand-text">{enrollmentName(snap, e)}</Link> : enrollmentName(snap, e)}</p>
                    <p className="text-xs text-muted">{e.applicant?.course ?? snap.groups.find((g) => g.id === e.groupId)?.name ?? ''} · {fmtDate(e.createdAt)}{e.applicant?.source === 'web' && <Badge className="ml-1.5">Web</Badge>}{e.applicant?.whatsappConsent && <Badge className="ml-1.5">WhatsApp ✓</Badge>}</p>
                    {e.applicant?.message && <p className="mt-1 line-clamp-2 text-xs text-muted" title={e.applicant.message}>«{e.applicant.message}»</p>}
                    {e.applicant?.guardianName && <p className="mt-1 text-[11px] text-muted">Tutor: {e.applicant.guardianName} · {e.applicant.guardianPhone}</p>}
                    {write && st.next && (
                      <div className="mt-2.5 flex gap-1.5">
                        <Button size="sm" variant="primary" onClick={() => (e.status === 'matriculada' ? setAssign(e) : void act.advance(e))}>{st.next}</Button>
                        {e.status !== 'matriculada' && <Button size="sm" variant="ghost" aria-label={`Rechazar a ${enrollmentName(snap, e)}`} onClick={() => setRej(e)}><XCircle size={14} /></Button>}
                      </div>)}
                  </li>))}
                {st.id === 'activa' && items.length > shown.length && <li className="text-center text-xs text-muted">+{items.length - shown.length} más · <Link to="/alumnos" className="hover:text-fg">ver {L.student.plural.toLowerCase()}</Link></li>}
              </ul>
            </section>);
        })}
      </div>
      {by('rechazada').length > 0 && <p className="mt-4 text-xs text-muted">{by('rechazada').length} solicitudes rechazadas (no se muestran).</p>}
      {snap.enrollments.length === 0 && <div className="panel mt-4"><EmptyState title="Sin matrículas" /></div>}
      {adding && <ApplicationForm onClose={() => setAdding(false)} />}
      {assign && <AssignGroupModal title={`Activar a ${enrollmentName(snap, assign)}`} course={snap.students.find((s) => s.id === assign.studentId)?.notes ? undefined : undefined} onClose={() => setAssign(null)} onConfirm={async (g) => { if (await act.advance(assign, g)) setAssign(null); }} />}
      <ConfirmDialog open={!!rej} danger title="¿Rechazar la solicitud?" description={rej ? `Se descartará la solicitud de ${enrollmentName(snap, rej)}.` : undefined} confirmLabel="Rechazar" onClose={() => setRej(null)} onConfirm={() => rej && void act.reject(rej)} />
    </>
  );
}
