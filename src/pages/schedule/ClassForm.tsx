import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Ban, CheckSquare, Copy, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/form';
import { FormModal } from '@/components/ui/FormModal';
import { ConfirmDialog } from '@/components/ui/Overlay';
import { useAction, useCan, useLabels, useSnapshot, useUser } from '@/hooks';
import { classSchema, fieldErrors } from '@/lib/schemas';
import { sessionConflicts, type Names } from '@/lib/classes';
import { fullName } from '@/lib/people';
import { cancelClass, createClass, duplicateClass, updateClass } from '@/services/mutations';
import type { ClassSession } from '@/types';
import { format, addDays, parseISO } from 'date-fns';

export interface ClassDefaults { date?: string; start?: string; groupId?: string }

export function useNames(): Names {
  const snap = useSnapshot();
  return useMemo(() => ({
    teacher: (id) => { const t = snap.teachers.find((x) => x.id === id); return t ? fullName(t) : 'El profesor'; },
    classroom: (id) => snap.classrooms.find((x) => x.id === id)?.name ?? 'El aula',
    group: (id) => snap.groups.find((x) => x.id === id)?.name ?? 'el grupo',
  }), [snap]);
}

export function ClassForm({ open, onClose, session, defaults }: { open: boolean; onClose: () => void; session?: ClassSession; defaults?: ClassDefaults }) {
  const snap = useSnapshot(); const user = useUser(); const L = useLabels(); const can = useCan(); const run = useAction(); const names = useNames();
  const write = can('classes:write');
  const firstGroup = snap.groups.find((g) => g.id === defaults?.groupId) ?? snap.groups.find((g) => g.active);
  const [f, setF] = useState({
    groupId: session?.groupId ?? firstGroup?.id ?? '', teacherId: session?.teacherId ?? firstGroup?.teacherId ?? '', classroomId: session?.classroomId ?? firstGroup?.classroomId ?? '',
    date: session?.date ?? defaults?.date ?? format(new Date(), 'yyyy-MM-dd'), start: session?.start ?? defaults?.start ?? '17:00', end: session?.end ?? (defaults?.start ? addMin(defaults.start, 90) : '18:30'), topic: session?.topic ?? '',
  });
  const [err, setErr] = useState<Record<string, string>>({}); const [top, setTop] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false); const [dupDate, setDupDate] = useState(format(addDays(parseISO(f.date), 7), 'yyyy-MM-dd'));
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const onGroup = (id: string) => { const g = snap.groups.find((x) => x.id === id); setF((x) => ({ ...x, groupId: id, teacherId: g?.teacherId ?? x.teacherId, classroomId: g?.classroomId ?? x.classroomId })); };

  const conflicts = useMemo(() => (f.groupId && f.teacherId && f.classroomId && f.start < f.end ? sessionConflicts({ id: session?.id ?? 'new', ...f }, snap.classes, names) : []), [f, snap.classes, names, session?.id]);

  const submit = async () => {
    setTop(null); const p = classSchema.safeParse(f); if (!p.success) return setErr(fieldErrors(p.error)); setErr({});
    try { const r = session ? await run(() => updateClass(user, session.id, p.data), 'Clase actualizada') : await run(() => createClass(user, p.data), 'Clase creada'); if (r) onClose(); } catch (e) { setTop((e as Error).message); }
  };
  const title = session ? `${session.status === 'cancelada' ? 'Clase cancelada' : 'Editar'} ${L.class.singular.toLowerCase()}` : `Nueva ${L.class.singular.toLowerCase()}`;
  return (
    <>
      <FormModal open={open} onClose={onClose} title={title} onSubmit={submit} error={top} wide submitLabel={write ? 'Guardar' : 'Cerrar'}>
        <fieldset disabled={!write || session?.status === 'cancelada'} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={L.group.singular} required error={err.groupId} className="sm:col-span-2">{(p) => <Select {...p} data-autofocus value={f.groupId} onChange={(e) => onGroup(e.target.value)}><option value="">Seleccionar…</option>{snap.groups.filter((g) => g.active).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</Select>}</Field>
            <Field label="Fecha" required error={err.date}>{(p) => <Input {...p} type="date" value={f.date} onChange={set('date')} />}</Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Inicio" required error={err.start}>{(p) => <Input {...p} type="time" value={f.start} onChange={set('start')} />}</Field>
              <Field label="Fin" required error={err.end}>{(p) => <Input {...p} type="time" value={f.end} onChange={set('end')} />}</Field>
            </div>
            <Field label={L.teacher.singular} required error={err.teacherId}>{(p) => <Select {...p} value={f.teacherId} onChange={set('teacherId')}>{snap.teachers.filter((t) => t.active).map((t) => <option key={t.id} value={t.id}>{fullName(t)}</option>)}</Select>}</Field>
            <Field label={L.classroom.singular} required error={err.classroomId}>{(p) => <Select {...p} value={f.classroomId} onChange={set('classroomId')}>{snap.classrooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</Select>}</Field>
            <Field label="Tema (opcional)" className="sm:col-span-2" error={err.topic}>{(p) => <Input {...p} value={f.topic} onChange={set('topic')} />}</Field>
          </div>
        </fieldset>
        {conflicts.length > 0 && (
          <div role="alert" className="rounded-xl border border-warn/40 bg-warn/10 p-3.5 text-sm">
            <p className="flex items-center gap-2 font-semibold text-warn"><AlertTriangle size={16} aria-hidden />CONFLICTO</p>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-[13px]">{conflicts.map((c, i) => <li key={i}>{c.message}</li>)}</ul>
          </div>)}
        {session && write && (
          <div className="flex flex-wrap items-end gap-2 border-t border-line pt-4">
            <Link to={`/asistencia?clase=${session.id}`} onClick={onClose} className="inline-flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-sm hover:bg-surface-2"><CheckSquare size={15} />Pasar lista</Link>
            {session.status === 'cancelada'
              ? <Button onClick={() => void run(() => cancelClass(user, session.id, false), 'Clase restaurada').then((r) => r && onClose())}><RotateCcw size={15} />Restaurar</Button>
              : <Button variant="danger" onClick={() => setConfirmCancel(true)}><Ban size={15} />Cancelar clase</Button>}
            <div className="ml-auto flex items-end gap-2"><Input aria-label="Fecha del duplicado" type="date" value={dupDate} onChange={(e) => setDupDate(e.target.value)} className="w-40" />
              <Button onClick={() => void run(() => duplicateClass(user, session.id, dupDate), 'Clase duplicada').then((r) => r && onClose())}><Copy size={15} />Duplicar</Button></div>
          </div>)}
      </FormModal>
      <ConfirmDialog open={confirmCancel} danger title="¿Cancelar esta clase?" description="Quedará marcada como cancelada y dejará de ocupar profesor y aula. Podrás restaurarla." confirmLabel="Cancelar clase" onClose={() => setConfirmCancel(false)}
        onConfirm={() => session && void run(() => cancelClass(user, session.id), 'Clase cancelada').then((r) => r && onClose())} />
    </>
  );
}
function addMin(t: string, m: number) { const [h, mm] = t.split(':').map(Number); const x = h * 60 + mm + m; return `${String(Math.floor(x / 60) % 24).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`; }
