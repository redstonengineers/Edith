import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, Plus } from 'lucide-react';
import { Calendar, CalendarToolbar, type CalEvent, type CalView } from '@/components/calendar/Calendar';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/form';
import { useAction, useCan, useLabels, usePersistentState, useSnapshot, useUser } from '@/hooks';
import { conflictMap } from '@/lib/classes';
import { fullName } from '@/lib/people';
import { updateClass } from '@/services/mutations';
import { ClassForm, useNames, type ClassDefaults } from './ClassForm';
import { fmtDate } from '@/utils/format';

export default function SchedulePage() {
  const snap = useSnapshot(); const L = useLabels(); const can = useCan(); const user = useUser(); const run = useAction(); const names = useNames(); const [sp, setSp] = useSearchParams();
  const [view, setView] = usePersistentState<CalView>('ac.cal.view', typeof window !== 'undefined' && window.innerWidth < 768 ? 'day' : 'week');
  const [cursor, setCursor] = useState(new Date());
  const [fTeacher, setFTeacher] = usePersistentState('ac.cal.teacher', ''); const [fGroup, setFGroup] = usePersistentState('ac.cal.group', ''); const [fRoom, setFRoom] = usePersistentState('ac.cal.room', '');
  const [open, setOpen] = useState<{ id?: string; defaults?: ClassDefaults } | null>(sp.get('nuevo') === '1' ? {} : null);
  const write = can('classes:write');

  const conflicts = useMemo(() => conflictMap(snap.classes, names), [snap.classes, names]);
  const events: CalEvent[] = useMemo(() => snap.classes.filter((c) => (!fTeacher || c.teacherId === fTeacher) && (!fGroup || c.groupId === fGroup) && (!fRoom || c.classroomId === fRoom)).map((c) => {
    const g = snap.groups.find((x) => x.id === c.groupId); const subj = snap.subjects.find((s) => s.id === g?.subjectId); const t = snap.teachers.find((x) => x.id === c.teacherId);
    return { id: c.id, date: c.date, start: c.start, end: c.end, title: g?.name ?? 'Clase', subtitle: `${t ? fullName(t) : ''} · ${names.classroom(c.classroomId)}`, color: subj?.color ?? 'var(--brand)', cancelled: c.status === 'cancelada', conflict: conflicts.get(c.id)?.[0]?.message, draggable: write };
  }), [snap, fTeacher, fGroup, fRoom, conflicts, names, write]);
  const visibleConflicts = events.filter((e) => e.conflict);

  const onMove = (id: string, date: string, start: string) => {
    const c = snap.classes.find((x) => x.id === id); if (!c) return;
    const dur = (h: string) => { const [a, b] = h.split(':').map(Number); return a * 60 + b; };
    const len = dur(c.end) - dur(c.start); const e = dur(start) + len; const end = `${String(Math.floor(e / 60)).padStart(2, '0')}:${String(e % 60).padStart(2, '0')}`;
    if (c.date === date && c.start === start) return;
    void run(() => updateClass(user, id, { groupId: c.groupId, teacherId: c.teacherId, classroomId: c.classroomId, date, start, end, topic: c.topic }), `Clase movida al ${fmtDate(date)} a las ${start}`);
  };
  const close = () => { setOpen(null); if (sp.has('nuevo')) { sp.delete('nuevo'); setSp(sp, { replace: true }); } };
  const session = open?.id ? snap.classes.find((c) => c.id === open.id) : undefined;

  return (
    <>
      <PageHeader title="Horarios" description={write ? 'Arrastra una clase para moverla. Haz clic en un hueco para crear una nueva.' : 'Tu calendario de clases.'} actions={write && <Button variant="primary" onClick={() => setOpen({})}><Plus size={16} />Nueva {L.class.singular.toLowerCase()}</Button>} />
      <CalendarToolbar view={view} setView={setView} cursor={cursor} setCursor={setCursor} extra={<>
        <Select aria-label={`Filtrar por ${L.teacher.singular.toLowerCase()}`} value={fTeacher} onChange={(e) => setFTeacher(e.target.value)} className="h-9 w-52"><option value="">Todos: {L.teacher.plural.toLowerCase()}</option>{snap.teachers.map((t) => <option key={t.id} value={t.id}>{fullName(t)}</option>)}</Select>
        <Select aria-label={`Filtrar por ${L.group.singular.toLowerCase()}`} value={fGroup} onChange={(e) => setFGroup(e.target.value)} className="h-9 w-52"><option value="">Todos: {L.group.plural.toLowerCase()}</option>{snap.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</Select>
        <Select aria-label={`Filtrar por ${L.classroom.singular.toLowerCase()}`} value={fRoom} onChange={(e) => setFRoom(e.target.value)} className="h-9 w-44"><option value="">Todas: {L.classroom.plural.toLowerCase()}</option>{snap.classrooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</Select></>} />
      {visibleConflicts.length > 0 && <p role="status" className="mb-3 flex items-center gap-2 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-warn"><AlertTriangle size={15} aria-hidden />{visibleConflicts.length} {visibleConflicts.length === 1 ? 'clase con conflicto' : 'clases con conflicto'} (marcadas en rojo).</p>}
      <Calendar view={view} cursor={cursor} events={events} onSelect={(id) => setOpen({ id })} onCreate={write ? (date, start) => setOpen({ defaults: { date, start } }) : undefined} onMove={write ? onMove : undefined}
        onPickDay={(d) => { const [y, m, dd] = d.split('-').map(Number); setCursor(new Date(y, m - 1, dd)); setView('day'); }} />
      {open && <ClassForm key={open.id ?? 'new'} open session={session} defaults={open.defaults} onClose={close} />}
    </>
  );
}
