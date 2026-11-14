import { useState } from 'react';
import { Field, Input } from '@/components/ui/form';
import { FormModal } from '@/components/ui/FormModal';
import { useAction, useLabels, useSnapshot, useUser } from '@/hooks';
import { DAYS } from '@/lib/conflicts';
import { fieldErrors, teacherSchema } from '@/lib/schemas';
import { createTeacher, updateTeacher } from '@/services/mutations';
import type { Teacher } from '@/types';
import { cn } from '@/utils/cn';

export function TeacherForm({ open, onClose, teacher, onCreated }: { open: boolean; onClose: () => void; teacher?: Teacher; onCreated?: (id: string) => void }) {
  const snap = useSnapshot(); const user = useUser(); const L = useLabels(); const run = useAction();
  const [f, setF] = useState({ firstName: teacher?.firstName ?? '', lastName: teacher?.lastName ?? '', email: teacher?.email ?? '', phone: teacher?.phone ?? '', specialty: teacher?.specialty ?? '', weeklyHoursTarget: String(teacher?.weeklyHoursTarget ?? 20) });
  const [subjects, setSubjects] = useState<string[]>(teacher?.subjectIds ?? []);
  const [days, setDays] = useState<number[]>(teacher?.availability ?? [1, 2, 3, 4, 5]);
  const [err, setErr] = useState<Record<string, string>>({}); const [top, setTop] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const submit = async () => {
    setTop(null);
    const p = teacherSchema.safeParse({ ...f, subjectIds: subjects, availability: days });
    if (!p.success) return setErr(fieldErrors(p.error));
    setErr({});
    try {
      const r = teacher ? await run(() => updateTeacher(user, teacher.id, p.data), `${L.teacher.singular} actualizado`) : await run(() => createTeacher(user, p.data), `${L.teacher.singular} creado`);
      if (r) { onClose(); if (!teacher) onCreated?.((r as Teacher).id); }
    } catch (e) { setTop((e as Error).message); }
  };
  const chip = (on: boolean) => cn('h-8 rounded-full border px-3 text-[13px]', on ? 'border-brand/50 bg-brand/12' : 'border-line text-muted hover:text-fg');
  return (
    <FormModal open={open} onClose={onClose} title={teacher ? `Editar ${L.teacher.singular.toLowerCase()}` : `Nuevo ${L.teacher.singular.toLowerCase()}`} onSubmit={submit} error={top} wide>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" required error={err.firstName}>{(p) => <Input {...p} data-autofocus value={f.firstName} onChange={set('firstName')} />}</Field>
        <Field label="Apellidos" required error={err.lastName}>{(p) => <Input {...p} value={f.lastName} onChange={set('lastName')} />}</Field>
        <Field label="Correo" required error={err.email}>{(p) => <Input {...p} type="email" value={f.email} onChange={set('email')} />}</Field>
        <Field label="Teléfono" required error={err.phone}>{(p) => <Input {...p} type="tel" value={f.phone} onChange={set('phone')} />}</Field>
        <Field label="Especialidad" required error={err.specialty}>{(p) => <Input {...p} value={f.specialty} onChange={set('specialty')} />}</Field>
        <Field label="Horas semanales objetivo" required error={err.weeklyHoursTarget}>{(p) => <Input {...p} type="number" min={1} max={40} value={f.weeklyHoursTarget} onChange={set('weeklyHoursTarget')} />}</Field>
      </div>
      <fieldset><legend className="mb-1.5 text-[13px] font-medium">{L.subject.plural} que imparte</legend>
        <div className="flex flex-wrap gap-1.5">{snap.subjects.map((s) => <button type="button" key={s.id} aria-pressed={subjects.includes(s.id)} onClick={() => setSubjects(toggle(subjects, s.id))} className={chip(subjects.includes(s.id))}>{s.name}</button>)}</div></fieldset>
      <fieldset><legend className="mb-1.5 text-[13px] font-medium">Disponibilidad</legend>
        <div className="flex flex-wrap gap-1.5">{[1, 2, 3, 4, 5, 6, 7].map((d) => <button type="button" key={d} aria-pressed={days.includes(d)} onClick={() => setDays(toggle(days, d))} className={chip(days.includes(d))}>{DAYS[d][0].toUpperCase() + DAYS[d].slice(1, 3)}</button>)}</div>
        {err.availability && <p role="alert" className="mt-1 text-xs text-bad">{err.availability}</p>}</fieldset>
    </FormModal>
  );
}
