import { useMemo, useState } from 'react';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/form';
import { FormModal } from '@/components/ui/FormModal';
import { useAction, useLabels, useSnapshot, useUser } from '@/hooks';
import { DAYS, groupConflicts } from '@/lib/conflicts';
import { fieldErrors, groupSchema } from '@/lib/schemas';
import { fullName } from '@/lib/people';
import { createGroup, updateGroup } from '@/services/mutations';
import type { Group, ScheduleSlot } from '@/types';

export function GroupForm({ open, onClose, group, onCreated }: { open: boolean; onClose: () => void; group?: Group; onCreated?: (id: string) => void }) {
  const snap = useSnapshot(); const user = useUser(); const L = useLabels(); const run = useAction();
  const [f, setF] = useState({ name: group?.name ?? '', subjectId: group?.subjectId ?? '', teacherId: group?.teacherId ?? '', classroomId: group?.classroomId ?? '', capacity: String(group?.capacity ?? 10) });
  const [slots, setSlots] = useState<ScheduleSlot[]>(group?.slots ?? [{ weekday: 1, start: '17:00', end: '18:30' }]);
  const [err, setErr] = useState<Record<string, string>>({}); const [top, setTop] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const upd = (i: number, patch: Partial<ScheduleSlot>) => setSlots((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const conflicts = useMemo(() => {
    if (!f.teacherId || !f.classroomId) return [];
    const t = snap.teachers.find((x) => x.id === f.teacherId); const r = snap.classrooms.find((x) => x.id === f.classroomId);
    return groupConflicts({ id: group?.id ?? 'new', teacherId: f.teacherId, classroomId: f.classroomId, slots: slots.filter((s) => s.start < s.end) }, snap.groups, { teacher: t ? fullName(t) : '', classroom: r?.name ?? '' });
  }, [f.teacherId, f.classroomId, slots, snap, group?.id]);

  const submit = async () => {
    setTop(null);
    const p = groupSchema.safeParse({ ...f, slots });
    if (!p.success) return setErr(fieldErrors(p.error));
    setErr({});
    try {
      const r = group ? await run(() => updateGroup(user, group.id, p.data), `${L.group.singular} actualizado`) : await run(() => createGroup(user, p.data), `${L.group.singular} creado`);
      if (r) { onClose(); if (!group) onCreated?.((r as Group).id); }
    } catch (e) { setTop((e as Error).message); }
  };
  return (
    <FormModal open={open} onClose={onClose} title={group ? `Editar ${L.group.singular.toLowerCase()}` : `Nuevo ${L.group.singular.toLowerCase()}`} onSubmit={submit} error={top} wide>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" required error={err.name} className="sm:col-span-2">{(p) => <Input {...p} data-autofocus value={f.name} onChange={set('name')} placeholder="Inglés B2 · Grupo A" />}</Field>
        <Field label={L.subject.singular} required error={err.subjectId}>{(p) => <Select {...p} value={f.subjectId} onChange={set('subjectId')}><option value="">Seleccionar…</option>{snap.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>}</Field>
        <Field label={L.teacher.singular} required error={err.teacherId}>{(p) => <Select {...p} value={f.teacherId} onChange={set('teacherId')}><option value="">Seleccionar…</option>{snap.teachers.filter((t) => t.active).map((t) => <option key={t.id} value={t.id}>{fullName(t)}</option>)}</Select>}</Field>
        <Field label={L.classroom.singular} required error={err.classroomId}>{(p) => <Select {...p} value={f.classroomId} onChange={set('classroomId')}><option value="">Seleccionar…</option>{snap.classrooms.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.capacity})</option>)}</Select>}</Field>
        <Field label="Capacidad" required error={err.capacity}>{(p) => <Input {...p} type="number" min={1} value={f.capacity} onChange={set('capacity')} />}</Field>
      </div>
      <fieldset>
        <legend className="mb-2 text-[13px] font-medium">Horario semanal</legend>
        <div className="space-y-2">
          {slots.map((s, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <Select aria-label={`Día ${i + 1}`} value={s.weekday} onChange={(e) => upd(i, { weekday: Number(e.target.value) })} className="w-36">{[1, 2, 3, 4, 5, 6, 7].map((d) => <option key={d} value={d}>{DAYS[d][0].toUpperCase() + DAYS[d].slice(1)}</option>)}</Select>
              <Input aria-label={`Inicio ${i + 1}`} type="time" value={s.start} onChange={(e) => upd(i, { start: e.target.value })} className="w-28" />
              <span className="text-muted">–</span>
              <Input aria-label={`Fin ${i + 1}`} type="time" value={s.end} onChange={(e) => upd(i, { end: e.target.value })} className="w-28" />
              <button type="button" disabled={slots.length === 1} onClick={() => setSlots(slots.filter((_, j) => j !== i))} aria-label={`Quitar horario ${i + 1}`} className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-bad disabled:opacity-30"><Trash2 size={15} /></button>
            </div>))}
        </div>
        <Button size="sm" className="mt-2" onClick={() => setSlots([...slots, { weekday: 3, start: '17:00', end: '18:30' }])}><Plus size={14} />Añadir horario</Button>
        {err.slots && <p role="alert" className="mt-1 text-xs text-bad">{err.slots}</p>}
      </fieldset>
      {conflicts.length > 0 && (
        <div role="alert" className="rounded-xl border border-warn/40 bg-warn/10 p-3.5 text-sm">
          <p className="flex items-center gap-2 font-semibold text-warn"><AlertTriangle size={16} aria-hidden />CONFLICTO</p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-[13px]">{conflicts.map((c, i) => <li key={i}>{c.message}</li>)}</ul>
          <p className="mt-1.5 text-xs text-muted">No se podrá guardar hasta resolverlo.</p>
        </div>)}
    </FormModal>
  );
}
