import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Calendar, CalendarToolbar, type CalEvent, type CalView } from '@/components/calendar/Calendar';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/form';
import { ConfirmDialog } from '@/components/ui/Overlay';
import { useAction, useCan, usePersistentState, useSnapshot, useUser } from '@/hooks';
import { fullName } from '@/lib/people';
import { practiceConflicts } from '@/lib/practices';
import { updatePractice } from '@/services/mutations';
import { hhmmToMin } from '@/utils/format';
import { PracticeForm, usePracticeNames, type PracticeDefaults } from './PracticeForm';

const addMin = (t: string, m: number) => { const x = hhmmToMin(t) + m; return `${String(Math.floor(x / 60) % 24).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`; };

export default function PracticasPage() {
  const snap = useSnapshot(); const can = useCan(); const user = useUser(); const run = useAction(); const names = usePracticeNames(); const write = can('practicas:write');
  const [view, setView] = usePersistentState<CalView>('ac.prc.view', typeof window !== 'undefined' && window.innerWidth < 768 ? 'day' : 'week'); const [cursor, setCursor] = useState(new Date());
  const [fTeacher, setFTeacher] = usePersistentState('ac.prc.teacher', ''); const [sp, setSp] = useSearchParams(); const [open, setOpenRaw] = useState<{ id?: string; defaults?: PracticeDefaults } | null>(sp.get('nueva') === '1' ? {} : null);
  const setOpen = (v: { id?: string; defaults?: PracticeDefaults } | null) => { setOpenRaw(v); if (!v && sp.has('nueva')) { sp.delete('nueva'); setSp(sp, { replace: true }); } };
  const [move, setMove] = useState<{ id: string; date: string; start: string; msg: string } | null>(null);
  const hue = (id: string) => snap.teachers.find((t) => t.id === id)?.avatarHue ?? 220;
  const events: CalEvent[] = useMemo(() => snap.practices.filter((p) => !fTeacher || p.teacherId === fTeacher).map((p) => {
    const t = snap.teachers.find((x) => x.id === p.teacherId); const v = snap.vehicles.find((x) => x.id === p.vehicleId);
    return { id: p.id, date: p.date, start: p.start, end: p.end, title: names.student(p.studentId), subtitle: `${t ? t.firstName : ''}${v ? ` · ${v.plate}` : ''}${p.status === 'hecha' ? ' · ✓ hecha' : ''}`, color: `hsl(${hue(p.teacherId)} 70% 58%)`, cancelled: p.status === 'cancelada', draggable: write && p.status === 'programada' };
  }), [snap, fTeacher, names, write]);
  const cancelled = snap.practices.filter((p) => p.status === 'cancelada').length;

  const doMove = (id: string, date: string, start: string, force: boolean) => {
    const p = snap.practices.find((x) => x.id === id); if (!p) return; const len = hhmmToMin(p.end) - hhmmToMin(p.start);
    void run(() => updatePractice(user, id, { studentId: p.studentId, teacherId: p.teacherId, vehicleId: p.vehicleId, date, start, end: addMin(start, len), notes: p.notes }, force), `Práctica movida al ${date} a las ${start}`);
  };
  const onMove = (id: string, date: string, start: string) => {
    const p = snap.practices.find((x) => x.id === id); if (!p || (p.date === date && p.start === start)) return; const len = hhmmToMin(p.end) - hhmmToMin(p.start);
    const cs = practiceConflicts({ ...p, date, start, end: addMin(start, len) }, snap.practices, snap.vehicles, names);
    if (cs.length) setMove({ id, date, start, msg: cs.map((c) => c.message).join(' ') }); else doMove(id, date, start, false);
  };
  return (
    <>
      <PageHeader title="Prácticas" description={write ? 'Arrastra una práctica para moverla. Toca un hueco para apuntar una nueva.' : 'Calendario de prácticas.'} actions={write && <Button variant="primary" onClick={() => setOpen({})}><Plus size={16} />Apuntar práctica</Button>} />
      <CalendarToolbar view={view} setView={setView} cursor={cursor} setCursor={setCursor} extra={snap.teachers.length > 1 && user.role !== 'PROFESOR' ? <Select aria-label="Filtrar por profesor" value={fTeacher} onChange={(e) => setFTeacher(e.target.value)} className="h-9 w-52"><option value="">Todos los profesores</option>{snap.teachers.map((t) => <option key={t.id} value={t.id}>{fullName(t)}</option>)}</Select> : undefined} />
      <Calendar view={view} cursor={cursor} events={events} onSelect={(id) => setOpen({ id })} onCreate={write ? (date, start) => setOpen({ defaults: { date, start } }) : undefined} onMove={write ? onMove : undefined}
        onPickDay={(d) => { const [y, m, dd] = d.split('-').map(Number); setCursor(new Date(y, m - 1, dd)); setView('day'); }} />
      {cancelled > 0 && <p className="mt-3 text-xs text-muted">{cancelled} {cancelled === 1 ? 'práctica cancelada' : 'prácticas canceladas'} (aparecen atenuadas en el calendario).</p>}
      {open && <PracticeForm key={open.id ?? 'new'} open practice={open.id ? snap.practices.find((p) => p.id === open.id) : undefined} defaults={open.defaults} onClose={() => setOpen(null)} />}
      <ConfirmDialog open={!!move} title="Hay un choque" description={`${move?.msg ?? ''} ¿Mover igualmente?`} confirmLabel="Mover igualmente" onClose={() => setMove(null)} onConfirm={() => move && doMove(move.id, move.date, move.start, true)} />
    </>
  );
}
