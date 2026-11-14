import { useState } from 'react';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import { FormModal } from '@/components/ui/FormModal';
import { useAction, useLabels, useSnapshot, useUser } from '@/hooks';
import { fieldErrors, incidentSchema } from '@/lib/schemas';
import { fullName } from '@/lib/people';
import { createIncident } from '@/services/mutations';
import type { Incident } from '@/types';

export const INCIDENT_TYPES = ['Asistencia', 'Instalaciones', 'Horarios', 'Evaluación', 'Material', 'Convivencia', 'Administrativa', 'Otra'];
export const PRIORITIES = ['baja', 'media', 'alta', 'critica'] as const;
export const prioTone = { baja: 'neutral', media: 'info', alta: 'warn', critica: 'bad' } as const;
export const prioLabel = { baja: 'Baja', media: 'Media', alta: 'Alta', critica: 'Crítica' } as const;
export const statusLabel = { pendiente: 'Pendiente', en_proceso: 'En proceso', resuelto: 'Resuelto' } as const;
export const statusTone = { pendiente: 'warn', en_proceso: 'info', resuelto: 'ok' } as const;

export function IncidentForm({ onClose, onCreated }: { onClose: () => void; onCreated?: (id: string) => void }) {
  const snap = useSnapshot(); const user = useUser(); const L = useLabels(); const run = useAction();
  const [f, setF] = useState({ title: '', type: '', priority: 'media', assigneeId: user.id, description: '', relatedStudentId: '', relatedTeacherId: '' }); const [err, setErr] = useState<Record<string, string>>({});
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = async () => { const p = incidentSchema.safeParse(f); if (!p.success) return setErr(fieldErrors(p.error)); const r = await run(() => createIncident(user, p.data), `${L.incident.singular} creada`); if (r) { onClose(); onCreated?.((r as Incident).id); } };
  return (
    <FormModal open onClose={onClose} title={`Nueva ${L.incident.singular.toLowerCase()}`} onSubmit={submit} wide>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Título" required error={err.title} className="sm:col-span-2">{(p) => <Input {...p} data-autofocus value={f.title} onChange={set('title')} placeholder="Alumno con problemas de asistencia" />}</Field>
        <Field label="Tipo" required error={err.type}>{(p) => <Select {...p} value={f.type} onChange={set('type')}><option value="">Seleccionar…</option>{INCIDENT_TYPES.map((t) => <option key={t}>{t}</option>)}</Select>}</Field>
        <Field label="Prioridad" required>{(p) => <Select {...p} value={f.priority} onChange={set('priority')}>{PRIORITIES.map((x) => <option key={x} value={x}>{prioLabel[x]}</option>)}</Select>}</Field>
        <Field label="Responsable">{(p) => <Select {...p} value={f.assigneeId} onChange={set('assigneeId')}><option value="">Sin asignar</option>{snap.users.filter((u) => u.role !== 'SUPER_ADMIN').map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select>}</Field>
        <Field label={`${L.student.singular} relacionado`}>{(p) => <Select {...p} value={f.relatedStudentId} onChange={set('relatedStudentId')}><option value="">Ninguno</option>{snap.students.map((s) => <option key={s.id} value={s.id}>{fullName(s)}</option>)}</Select>}</Field>
        <Field label="Descripción" required error={err.description} className="sm:col-span-2">{(p) => <Textarea {...p} value={f.description} onChange={set('description')} />}</Field>
      </div>
    </FormModal>
  );
}
