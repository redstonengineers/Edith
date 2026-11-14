import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Inbox, Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { FilterChips } from '@/components/ui/controls';
import { Field, Input } from '@/components/ui/form';
import { FormModal } from '@/components/ui/FormModal';
import { Badge } from '@/components/ui/primitives';
import { useAction, useCan, usePersistentState, useSnapshot, useUser } from '@/hooks';
import { applicationSchema, fieldErrors } from '@/lib/schemas';
import { enrollmentName } from '@/lib/people';
import { createApplication } from '@/services/mutations';
import type { Enrollment } from '@/types';
import { fmtDate } from '@/utils/format';
import { STAGES, useEnrollmentActions } from './EnrollmentsPage';
import { AssignGroupModal } from './shared';

export function ApplicationForm({ onClose }: { onClose: () => void }) {
  const user = useUser(); const run = useAction();
  const [f, setF] = useState({ name: '', email: '', phone: '', birthDate: '', course: '' }); const [err, setErr] = useState<Record<string, string>>({});
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = async () => { const p = applicationSchema.safeParse(f); if (!p.success) return setErr(fieldErrors(p.error)); if (await run(() => createApplication(user, p.data), 'Solicitud registrada')) onClose(); };
  return (
    <FormModal open onClose={onClose} title="Nueva solicitud" description="Registra los datos básicos; el resto se completa al matricular." onSubmit={submit} wide>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre completo" required error={err.name} className="sm:col-span-2">{(p) => <Input {...p} data-autofocus value={f.name} onChange={set('name')} />}</Field>
        <Field label="Correo" required error={err.email}>{(p) => <Input {...p} type="email" value={f.email} onChange={set('email')} />}</Field>
        <Field label="Teléfono" required error={err.phone}>{(p) => <Input {...p} type="tel" value={f.phone} onChange={set('phone')} />}</Field>
        <Field label="Curso / asignatura de interés" required error={err.course}>{(p) => <Input {...p} value={f.course} onChange={set('course')} />}</Field>
        <Field label="Fecha de nacimiento" error={err.birthDate}>{(p) => <Input {...p} type="date" value={f.birthDate} onChange={set('birthDate')} />}</Field>
      </div>
    </FormModal>
  );
}

type F = 'abiertas' | 'rechazada' | 'todas';
export default function ApplicationsPage() {
  const snap = useSnapshot(); const can = useCan(); const act = useEnrollmentActions(); const [f, setF] = usePersistentState<F>('ac.apps.f', 'abiertas');
  const [adding, setAdding] = useState(false); const [assign, setAssign] = useState<Enrollment | null>(null);
  const pre = (e: Enrollment) => ['solicitud', 'revision', 'aceptada', 'matriculada'].includes(e.status);
  const all = snap.enrollments.filter((e) => e.applicant || pre(e) || e.status === 'rechazada');
  const rows = all.filter((e) => (f === 'abiertas' ? pre(e) : f === 'rechazada' ? e.status === 'rechazada' : true));
  const write = can('enrollments:write');
  const cols: Column<Enrollment>[] = [
    { key: 'n', header: 'Solicitante', sort: (a, b) => enrollmentName(snap, a).localeCompare(enrollmentName(snap, b), 'es'), cell: (e) => <div><p className="font-medium">{e.studentId ? <Link to={`/alumnos/${e.studentId}`} className="hover:text-brand-text">{enrollmentName(snap, e)}</Link> : enrollmentName(snap, e)}</p>{e.applicant && <p className="text-xs text-muted">{e.applicant.email} · {e.applicant.phone}</p>}</div> },
    { key: 'c', header: 'Interés', hide: 'md', cell: (e) => <span className="text-muted">{e.applicant?.course ?? '—'}</span> },
    { key: 'd', header: 'Recibida', hide: 'md', sort: (a, b) => a.createdAt.localeCompare(b.createdAt), cell: (e) => <span className="tnum text-muted">{fmtDate(e.createdAt)}</span> },
    { key: 's', header: 'Etapa', cell: (e) => <Badge tone={e.status === 'rechazada' ? 'bad' : e.status === 'aceptada' ? 'ok' : 'brand'}>{e.status === 'rechazada' ? 'Rechazada' : STAGES.find((s) => s.id === e.status)?.label}</Badge> },
    ...(write ? [{ key: 'a', header: 'Acción', align: 'right', cell: (e: Enrollment) => { const st = STAGES.find((s) => s.id === e.status); return st?.next ? (
      <div className="flex justify-end gap-1.5"><Button size="sm" variant="primary" onClick={() => (e.status === 'matriculada' ? setAssign(e) : void act.advance(e))}>{st.next}</Button>{e.status !== 'matriculada' && <Button size="sm" variant="ghost" onClick={() => void act.reject(e)}>Rechazar</Button>}</div>) : null; } } as Column<Enrollment>] : []),
  ];
  return (
    <>
      <PageHeader title="Solicitudes" description="Bandeja de admisión. Avanza cada solicitud etapa por etapa." actions={can('applications:write') && <Button variant="primary" onClick={() => setAdding(true)}><Plus size={16} />Nueva solicitud</Button>} />
      <div className="mb-4"><FilterChips<F> label="Filtrar" value={f} onChange={setF} options={[{ id: 'abiertas', label: 'En curso', count: all.filter(pre).length }, { id: 'rechazada', label: 'Rechazadas', count: all.filter((e) => e.status === 'rechazada').length }, { id: 'todas', label: 'Todas' }]} /></div>
      <DataTable label="Solicitudes" rows={rows} columns={cols} rowKey={(e) => e.id} defaultSort={{ key: 'd', dir: 'desc' }} empty={{ icon: Inbox, title: 'Bandeja vacía', description: 'No hay solicitudes con este filtro.' }} />
      {adding && <ApplicationForm onClose={() => setAdding(false)} />}
      {assign && <AssignGroupModal title={`Activar a ${enrollmentName(snap, assign)}`} onClose={() => setAssign(null)} onConfirm={async (g) => { if (await act.advance(assign, g)) setAssign(null); }} />}
    </>
  );
}
