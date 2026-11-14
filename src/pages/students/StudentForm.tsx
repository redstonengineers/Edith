import { useMemo, useState } from 'react';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import { nuevo } from '@/lib/labels';
import { FormModal } from '@/components/ui/FormModal';
import { useAction, useLabels, useSnapshot, useUser } from '@/hooks';
import { ageOf } from '@/lib/people';
import { fieldErrors, studentSchema } from '@/lib/schemas';
import { createStudent, updateStudent } from '@/services/mutations';
import type { Student } from '@/types';
import { groupOccupancy } from '@/lib/metrics';

type F = { firstName: string; lastName: string; birthDate: string; email: string; phone: string; groupId: string; notes: string; gName: string; gPhone: string; gEmail: string; gRel: string };
const empty: F = { firstName: '', lastName: '', birthDate: '', email: '', phone: '', groupId: '', notes: '', gName: '', gPhone: '', gEmail: '', gRel: 'Madre' };

export function StudentForm({ open, onClose, student, onCreated }: { open: boolean; onClose: () => void; student?: Student; onCreated?: (id: string) => void }) {
  const snap = useSnapshot(); const user = useUser(); const L = useLabels(); const run = useAction();
  const [f, setF] = useState<F>(student ? { ...empty, firstName: student.firstName, lastName: student.lastName, birthDate: student.birthDate, email: student.email, phone: student.phone, notes: student.notes } : empty);
  const [err, setErr] = useState<Record<string, string>>({});
  const [top, setTop] = useState<string | null>(null);
  const set = (k: keyof F) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const minor = f.birthDate ? ageOf(f.birthDate) < 18 : false;
  const occ = useMemo(() => groupOccupancy(snap), [snap]);

  const submit = async () => {
    setTop(null);
    const parsed = studentSchema.safeParse({ ...f, groupId: f.groupId || undefined, guardian: minor && !student ? { name: f.gName, phone: f.gPhone, email: f.gEmail, relation: f.gRel } : undefined });
    if (!parsed.success) { const e = fieldErrors(parsed.error); setErr(Object.fromEntries(Object.entries(e).map(([k, v]) => [k.replace('guardian.', 'g_'), v]))); return; }
    setErr({});
    try {
      const res = student ? await run(() => updateStudent(user, student.id, parsed.data), `${L.student.singular} actualizado`) : await run(() => createStudent(user, parsed.data), `${L.student.singular} creado`);
      if (res) { onClose(); if (!student) onCreated?.((res as Student).id); }
    } catch (e) { setTop((e as Error).message); }
  };

  return (
    <FormModal open={open} onClose={onClose} title={student ? `Editar ${L.student.singular.toLowerCase()}` : `${nuevo(L.student)}`} description={student ? undefined : 'Se creará la ficha y la matrícula. Podrás completar el resto desde el perfil.'} onSubmit={submit} error={top} wide>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" required error={err.firstName}>{(p) => <Input {...p} data-autofocus value={f.firstName} onChange={set('firstName')} autoComplete="off" />}</Field>
        <Field label="Apellidos" required error={err.lastName}>{(p) => <Input {...p} value={f.lastName} onChange={set('lastName')} autoComplete="off" />}</Field>
        <Field label="Fecha de nacimiento" required error={err.birthDate}>{(p) => <Input {...p} type="date" value={f.birthDate} onChange={set('birthDate')} />}</Field>
        <Field label="Teléfono" required error={err.phone}>{(p) => <Input {...p} type="tel" value={f.phone} onChange={set('phone')} placeholder="600 123 456" />}</Field>
        <Field label="Correo electrónico" required error={err.email} className="sm:col-span-2">{(p) => <Input {...p} type="email" value={f.email} onChange={set('email')} />}</Field>
        {!student && (
          <Field label={`${L.group.singular} inicial`} hint="Opcional. Los completos no se pueden seleccionar." className="sm:col-span-2" error={err.groupId}>
            {(p) => (
              <Select {...p} value={f.groupId} onChange={set('groupId')}>
                <option value="">Sin asignar</option>
                {occ.map((o) => <option key={o.group.id} value={o.group.id} disabled={o.full}>{o.group.name} — {o.full ? 'completo' : `${o.group.capacity - o.count} plazas`}</option>)}
              </Select>)}
          </Field>)}
      </div>
      {minor && !student && (
        <fieldset className="rounded-xl border border-line p-4">
          <legend className="px-2 text-xs font-semibold tracking-[0.1em] text-muted uppercase">Tutor legal (menor de edad)</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre del tutor" required error={err.g_name}>{(p) => <Input {...p} value={f.gName} onChange={set('gName')} />}</Field>
            <Field label="Parentesco" required error={err.g_relation}>{(p) => <Select {...p} value={f.gRel} onChange={set('gRel')}><option>Madre</option><option>Padre</option><option>Tutor legal</option></Select>}</Field>
            <Field label="Teléfono" required error={err.g_phone}>{(p) => <Input {...p} type="tel" value={f.gPhone} onChange={set('gPhone')} />}</Field>
            <Field label="Correo" required error={err.g_email}>{(p) => <Input {...p} type="email" value={f.gEmail} onChange={set('gEmail')} />}</Field>
          </div>
        </fieldset>)}
      <Field label="Notas internas" error={err.notes}>{(p) => <Textarea {...p} value={f.notes} onChange={set('notes')} />}</Field>
    </FormModal>
  );
}
