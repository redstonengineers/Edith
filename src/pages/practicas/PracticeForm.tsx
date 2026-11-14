import { useMemo, useState } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { AlertTriangle, Ban, CheckCircle2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import { FormModal } from '@/components/ui/FormModal';
import { ConfirmDialog } from '@/components/ui/Overlay';
import { useAction, useCan, useSnapshot, useUser } from '@/hooks';
import { fullName } from '@/lib/people';
import { practiceConflicts, type PracticeNames } from '@/lib/practices';
import { fieldErrors, practiceSchema } from '@/lib/schemas';
import { cancelPractice, completePractice, createPractice, createPracticeSeries, updatePractice } from '@/services/mutations';
import type { Practice } from '@/types';
import { hhmmToMin, norm } from '@/utils/format';

export interface PracticeDefaults { date?: string; start?: string; studentId?: string }
const DURATIONS = [30, 45, 60, 90, 120];
const addMin = (t: string, m: number) => { const x = hhmmToMin(t) + m; return `${String(Math.floor(x / 60) % 24).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`; };

export function usePracticeNames(): PracticeNames {
  const snap = useSnapshot();
  return useMemo(() => ({
    student: (id) => { const s = snap.students.find((x) => x.id === id); return s ? `${s.firstName} ${s.lastName}` : 'El alumno'; },
    teacher: (id) => { const t = snap.teachers.find((x) => x.id === id); return t ? fullName(t) : 'El profesor'; },
    vehicle: (id) => { const v = snap.vehicles.find((x) => x.id === id); return v ? `${v.model} (${v.plate})` : 'El coche'; },
  }), [snap]);
}

export function PracticeForm({ open, onClose, practice, defaults }: { open: boolean; onClose: () => void; practice?: Practice; defaults?: PracticeDefaults }) {
  const snap = useSnapshot(); const user = useUser(); const can = useCan(); const run = useAction(); const names = usePracticeNames(); const write = can('practicas:write');
  const students = useMemo(() => snap.students.filter((s) => s.status !== 'baja' && s.status !== 'inactivo').sort((a, b) => a.firstName.localeCompare(b.firstName)), [snap.students]);
  const myTeacher = user.teacherId ?? snap.teachers.find((t) => t.active)?.id ?? '';
  const initStu = practice?.studentId ?? defaults?.studentId ?? '';
  const lastEnd = (date: string) => snap.practices.filter((p) => p.date === date && p.status !== 'cancelada' && (user.role !== 'PROFESOR' || p.teacherId === user.teacherId)).map((p) => p.end).sort().pop();
  const date0 = practice?.date ?? defaults?.date ?? format(new Date(), 'yyyy-MM-dd'); const start0 = practice?.start ?? defaults?.start ?? lastEnd(date0) ?? '17:00';
  const [f, setF] = useState({ date: date0, start: start0, dur: practice ? hhmmToMin(practice.end) - hhmmToMin(practice.start) : 60, teacherId: practice?.teacherId ?? snap.students.find((s) => s.id === initStu)?.assignedTeacherId ?? myTeacher, vehicleId: practice?.vehicleId ?? snap.vehicles.find((v) => v.status === 'activo')?.id ?? '', notes: practice?.notes ?? '' });
  const [q, setQ] = useState(initStu ? names.student(initStu) : ''); const [studentId, setStudentId] = useState(initStu);
  const [repeat, setRepeat] = useState(false); const [weeks, setWeeks] = useState(8); const [err, setErr] = useState<Record<string, string>>({}); const [top, setTop] = useState<string | null>(null);
  const [km, setKm] = useState(practice?.km ? String(practice.km) : ''); const [confirmCancel, setConfirmCancel] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: k === 'dur' ? Number(e.target.value) : e.target.value }));
  const pickStudent = (text: string) => { setQ(text); const m = students.find((s) => norm(`${s.firstName} ${s.lastName}`) === norm(text.trim())); setStudentId(m?.id ?? ''); if (m?.assignedTeacherId && !practice) setF((x) => ({ ...x, teacherId: m.assignedTeacherId! })); };
  const matches = q && !studentId ? students.filter((s) => norm(`${s.firstName} ${s.lastName}`).includes(norm(q))).slice(0, 5) : [];
  const end = addMin(f.start, f.dur);
  const conflicts = useMemo(() => (studentId && f.teacherId ? practiceConflicts({ id: practice?.id ?? 'new', studentId, teacherId: f.teacherId, vehicleId: f.vehicleId || undefined, date: f.date, start: f.start, end }, snap.practices, snap.vehicles, names) : []), [studentId, f, end, snap.practices, snap.vehicles, names, practice?.id]);
  const hard = conflicts.find((c) => c.hard); const soft = conflicts.filter((c) => !c.hard);
  const done = practice?.status === 'hecha'; const cancelled = practice?.status === 'cancelada';

  const submit = async () => {
    setTop(null); if (hard) return setTop(hard.message);
    const p = practiceSchema.safeParse({ studentId, teacherId: f.teacherId, vehicleId: f.vehicleId, date: f.date, start: f.start, end, notes: f.notes }); if (!p.success) return setErr(fieldErrors(p.error)); setErr({});
    try {
      if (practice) { if (await run(() => updatePractice(user, practice.id, p.data, soft.length > 0), 'Práctica actualizada')) onClose(); }
      else if (repeat) { const r = await run(() => createPracticeSeries(user, p.data, weeks, soft.length > 0), 'Prácticas apuntadas'); if (r) onClose(); }
      else if (await run(() => createPractice(user, p.data, soft.length > 0), 'Práctica apuntada')) onClose();
    } catch (e) { setTop((e as Error).message); }
  };
  return (
    <>
      <FormModal open={open} onClose={onClose} title={practice ? (cancelled ? 'Práctica cancelada' : done ? 'Práctica hecha' : 'Editar práctica') : 'Apuntar práctica'} onSubmit={submit} error={top} wide
        submitLabel={!write || cancelled ? 'Cerrar' : soft.length ? 'Guardar igualmente' : 'Guardar'}>
        <fieldset disabled={!write || cancelled} className="space-y-4">
          <Field label="Alumno" required error={err.studentId}>{(p) => (
            <div className="relative"><Input {...p} data-autofocus value={q} onChange={(e) => pickStudent(e.target.value)} placeholder="Escribe el nombre y toca la sugerencia" autoComplete="off" />
              {matches.length > 0 && <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-line bg-surface shadow-lg">{matches.map((s) => <li key={s.id}><button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-surface-2" onClick={() => { setStudentId(s.id); setQ(`${s.firstName} ${s.lastName}`); if (s.assignedTeacherId && !practice) setF((x) => ({ ...x, teacherId: s.assignedTeacherId! })); }}>{s.firstName} {s.lastName}</button></li>)}</ul>}</div>)}</Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Día" required error={err.date}>{(p) => <Input {...p} type="date" value={f.date} onChange={set('date')} />}</Field>
            <Field label="Hora" required error={err.start}>{(p) => <Input {...p} type="time" value={f.start} onChange={set('start')} />}</Field>
            <Field label="Duración">{(p) => <Select {...p} value={f.dur} onChange={set('dur')}>{DURATIONS.map((d) => <option key={d} value={d}>{d} min · hasta {addMin(f.start, d)}</option>)}</Select>}</Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Profesor" required error={err.teacherId}>{(p) => <Select {...p} value={f.teacherId} disabled={user.role === 'PROFESOR'} onChange={set('teacherId')}>{snap.teachers.filter((t) => t.active).map((t) => <option key={t.id} value={t.id}>{fullName(t)}</option>)}</Select>}</Field>
            <Field label="Coche">{(p) => <Select {...p} value={f.vehicleId} onChange={set('vehicleId')}><option value="">Sin coche</option>{snap.vehicles.map((v) => <option key={v.id} value={v.id} disabled={v.status !== 'activo'}>{v.model} · {v.plate}{v.status !== 'activo' ? ` (${v.status})` : ''}</option>)}</Select>}</Field>
          </div>
          {!practice && <div className="rounded-lg border border-line p-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} />Repetir cada semana</label>
            {repeat && <div className="mt-2 flex items-center gap-2 text-sm text-muted">durante <Input aria-label="Semanas" type="number" min={2} max={26} value={weeks} onChange={(e) => setWeeks(Math.max(2, Math.min(26, Number(e.target.value) || 2)))} className="w-20" /> semanas · hasta el {format(addDays(parseISO(f.date), 7 * (weeks - 1)), 'dd/MM/yyyy')}</div>}</div>}
          <Field label="Notas (opcional)" error={err.notes}>{(p) => <Textarea {...p} value={f.notes} onChange={set('notes')} rows={2} />}</Field>
        </fieldset>
        {conflicts.length > 0 && (
          <div role="alert" className={`rounded-xl border p-3.5 text-sm ${hard ? 'border-bad/40 bg-bad/10' : 'border-warn/40 bg-warn/10'}`}>
            <p className={`flex items-center gap-2 font-semibold ${hard ? 'text-bad' : 'text-warn'}`}><AlertTriangle size={16} aria-hidden />{hard ? 'No se puede usar ese coche' : 'Hay un choque'}</p>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-[13px]">{conflicts.map((c, i) => <li key={i}>{c.message}</li>)}</ul>
            {!hard && <p className="mt-2 text-[12px] text-muted">Puedes guardar igualmente si es intencionado.</p>}
          </div>)}
        {practice && write && !cancelled && (
          <div className="space-y-3 border-t border-line pt-4">
            <p className="text-sm font-medium">{done ? 'Kilómetros de la práctica' : 'Terminar práctica'}</p>
            <div className="flex flex-wrap items-end gap-2"><Field label="Kilómetros">{(p) => <Input {...p} type="number" min={0} value={km} onChange={(e) => setKm(e.target.value)} className="w-28" />}</Field>
              <Button onClick={() => void run(() => completePractice(user, practice.id, { km: km ? Number(km) : undefined, notes: f.notes }), 'Práctica terminada').then((r) => r && onClose())}><CheckCircle2 size={15} />{done ? 'Guardar km' : 'Marcar como hecha'}</Button>
              {!done && <Button variant="danger" onClick={() => setConfirmCancel(true)}><Ban size={15} />Cancelar práctica</Button>}</div>
          </div>)}
        {practice && write && cancelled && <Button onClick={() => void run(() => cancelPractice(user, practice.id, false), 'Práctica restaurada').then((r) => r && onClose())}><RotateCcw size={15} />Restaurar</Button>}
      </FormModal>
      <ConfirmDialog open={confirmCancel} danger title="¿Cancelar esta práctica?" description="Dejará de ocupar al profesor y al coche. Podrás restaurarla." confirmLabel="Cancelar práctica" onClose={() => setConfirmCancel(false)}
        onConfirm={() => practice && void run(() => cancelPractice(user, practice.id), 'Práctica cancelada').then((r) => r && onClose())} />
    </>
  );
}
