import { useState } from 'react';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import { FormModal } from '@/components/ui/FormModal';
import { useAction, useLabels, useSnapshot, useUser } from '@/hooks';
import { examSchema, fieldErrors } from '@/lib/schemas';
import { fullName } from '@/lib/people';
import { createExam, updateExam } from '@/services/mutations';
import type { Exam } from '@/types';
import { format } from 'date-fns';

export function ExamForm({ open, onClose, exam, onCreated }: { open: boolean; onClose: () => void; exam?: Exam; onCreated?: (id: string) => void }) {
  const snap = useSnapshot(); const user = useUser(); const L = useLabels(); const run = useAction();
  const g0 = snap.groups.find((g) => g.active);
  const [f, setF] = useState({ title: exam?.title ?? '', groupId: exam?.groupId ?? g0?.id ?? '', teacherId: exam?.teacherId ?? g0?.teacherId ?? '', classroomId: exam?.classroomId ?? g0?.classroomId ?? '', date: exam?.date ?? format(new Date(Date.now() + 7 * 864e5), 'yyyy-MM-dd'), start: exam?.start ?? '17:00', durationMin: String(exam?.durationMin ?? 60), description: exam?.description ?? '' });
  const [err, setErr] = useState<Record<string, string>>({}); const [top, setTop] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const onGroup = (id: string) => { const g = snap.groups.find((x) => x.id === id); setF((x) => ({ ...x, groupId: id, teacherId: g?.teacherId ?? x.teacherId, classroomId: g?.classroomId ?? x.classroomId })); };
  const submit = async () => {
    const p = examSchema.safeParse(f); if (!p.success) return setErr(fieldErrors(p.error)); setErr({}); setTop(null);
    try { const r = exam ? await run(() => updateExam(user, exam.id, p.data), `${L.exam.singular} actualizado`) : await run(() => createExam(user, p.data), `${L.exam.singular} creado`); if (r) { onClose(); if (!exam) onCreated?.((r as Exam).id); } } catch (e) { setTop((e as Error).message); }
  };
  return (
    <FormModal open={open} onClose={onClose} title={exam ? `Editar ${L.exam.singular.toLowerCase()}` : `Nuevo ${L.exam.singular.toLowerCase()}`} onSubmit={submit} error={top} wide>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Título" required error={err.title} className="sm:col-span-2">{(p) => <Input {...p} data-autofocus value={f.title} onChange={set('title')} placeholder="Examen parcial · Matemáticas" />}</Field>
        <Field label={L.group.singular} required error={err.groupId}>{(p) => <Select {...p} value={f.groupId} onChange={(e) => onGroup(e.target.value)}>{snap.groups.filter((g) => g.active).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</Select>}</Field>
        <Field label={L.teacher.singular} required error={err.teacherId}>{(p) => <Select {...p} value={f.teacherId} onChange={set('teacherId')}>{snap.teachers.filter((t) => t.active).map((t) => <option key={t.id} value={t.id}>{fullName(t)}</option>)}</Select>}</Field>
        <Field label="Fecha" required error={err.date}>{(p) => <Input {...p} type="date" value={f.date} onChange={set('date')} />}</Field>
        <div className="grid grid-cols-2 gap-3"><Field label="Hora" required error={err.start}>{(p) => <Input {...p} type="time" value={f.start} onChange={set('start')} />}</Field><Field label="Duración (min)" required error={err.durationMin}>{(p) => <Input {...p} type="number" min={10} step={5} value={f.durationMin} onChange={set('durationMin')} />}</Field></div>
        <Field label={L.classroom.singular} required error={err.classroomId} className="sm:col-span-2">{(p) => <Select {...p} value={f.classroomId} onChange={set('classroomId')}>{snap.classrooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</Select>}</Field>
        <Field label="Descripción" error={err.description} className="sm:col-span-2">{(p) => <Textarea {...p} value={f.description} onChange={set('description')} />}</Field>
      </div>
    </FormModal>
  );
}
