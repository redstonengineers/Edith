import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/controls';
import { Input, Select } from '@/components/ui/form';
import { Panel } from '@/components/ui/primitives';
import { useAction, useCan, useSnapshot, useUser } from '@/hooks';
import { fullName } from '@/lib/people';
import { fmtHours, studentProgress } from '@/lib/practices';
import { setStudentTraining } from '@/services/mutations';
import type { Student } from '@/types';
import { fmtDate } from '@/utils/format';
import { PracticeForm } from '../practicas/PracticeForm';

/** Autoescuela: horas de prácticas hechas frente al objetivo, profesor asignado y próximas prácticas. */
export function Training({ student: s }: { student: Student }) {
  const snap = useSnapshot(); const user = useUser(); const can = useCan(); const run = useAction(); const [open, setOpen] = useState(false); const [target, setTarget] = useState(String(s.targetHours ?? 20));
  const pr = studentProgress(s, snap.practices); const mine = snap.practices.filter((p) => p.studentId === s.id && p.status !== 'cancelada').sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  const today = new Date().toISOString().slice(0, 10); const next = mine.filter((p) => p.status === 'programada' && p.date >= today).slice(0, 4); const last = [...mine].filter((p) => p.status === 'hecha').reverse().slice(0, 3);
  const edit = can('students:write');
  return (
    <Panel title="Prácticas" action={can('practicas:write') && s.status !== 'baja' ? <Button onClick={() => setOpen(true)}><Plus size={14} />Apuntar</Button> : undefined}>
      <div className="mb-1 flex items-baseline justify-between text-sm"><span><b className="tnum text-base">{fmtHours(pr.done)}</b> <span className="text-muted">de {fmtHours(pr.target)}</span></span><span className="text-xs text-muted">{pr.left > 0 ? `Faltan ${fmtHours(pr.left)}` : 'Objetivo cumplido'}</span></div>
      <ProgressBar pct={pr.pct} tone={pr.pct >= 100 ? 'ok' : 'brand'} label="Progreso de horas de prácticas" />
      <p className="mt-1.5 text-xs text-muted">{fmtHours(pr.planned)} programadas · {pr.km.toLocaleString('es-ES')} km hechos</p>
      {next.length > 0 && <div className="mt-4"><p className="mb-1.5 text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">Próximas</p><ul className="space-y-1 text-sm">{next.map((p) => <li key={p.id} className="tnum flex justify-between"><span>{fmtDate(p.date, 'EEE d MMM')} · {p.start}</span><span className="text-muted">{snap.teachers.find((t) => t.id === p.teacherId)?.firstName}</span></li>)}</ul></div>}
      {last.length > 0 && <div className="mt-4"><p className="mb-1.5 text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">Últimas hechas</p><ul className="space-y-1 text-sm text-muted">{last.map((p) => <li key={p.id} className="tnum flex justify-between"><span>{fmtDate(p.date, 'd MMM')} · {p.start}–{p.end}</span><span>{p.km ? `${p.km} km` : ''}</span></li>)}</ul></div>}
      {edit && (
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4">
          <label className="block text-xs text-muted">Horas objetivo<Input type="number" min={1} max={200} value={target} onChange={(e) => setTarget(e.target.value)} onBlur={() => { const n = Number(target); if (n >= 1 && n !== (s.targetHours ?? 20)) void run(() => setStudentTraining(user, s.id, { targetHours: n }), 'Objetivo actualizado'); }} className="mt-1" /></label>
          <label className="block text-xs text-muted">Profesor asignado<Select value={s.assignedTeacherId ?? ''} onChange={(e) => e.target.value && void run(() => setStudentTraining(user, s.id, { assignedTeacherId: e.target.value }), 'Profesor asignado')} className="mt-1"><option value="">Sin asignar</option>{snap.teachers.filter((t) => t.active).map((t) => <option key={t.id} value={t.id}>{fullName(t)}</option>)}</Select></label>
        </div>)}
      {open && <PracticeForm open defaults={{ studentId: s.id }} onClose={() => setOpen(false)} />}
    </Panel>
  );
}
