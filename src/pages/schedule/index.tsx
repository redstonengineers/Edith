import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { nuevo } from '@/lib/labels';
import { AlertTriangle, Plus } from 'lucide-react';
import { FilterSelect } from '@/components/ui/FilterSelect';
import { businessHours } from '@/lib/businessHours';
import { Calendar, CalendarToolbar, type CalEvent, type CalView } from '@/components/calendar/Calendar';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
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
    return { id: c.id, date: c.date, start: c.start, end: c.end, title: c.topic?.trim() || g?.name || 'Clase', subtitle: `${t ? fullName(t) : ''} · ${names.classroom(c.classroomId)}`, color: subj?.color ?? 'var(--brand)', cancelled: c.status === 'cancelada', conflict: conflicts.get(c.id)?.[0]?.message, draggable: write };
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
      <PageHeader title="Horarios" description={write ? 'Arrastra una clase para moverla. Haz clic en un hueco para crear una nueva.' : 'Tu calendario de clases.'} actions={write && <Button variant="primary" onClick={() => setOpen({})}><Plus size={16} />{nuevo(L.class)}</Button>} />
      <CalendarToolbar view={view} setView={setView} cursor={cursor} setCursor={setCursor} extra={<>
        <FilterSelect label={L.teacher.singular} value={fTeacher} onChange={setFTeacher} options={[{ value: '', label: 'Todos' }, ...snap.teachers.map((t) => ({ value: t.id, label: fullName(t) }))]} />
        <FilterSelect label={L.group.singular} value={fGroup} onChange={setFGroup} options={[{ value: '', label: 'Todos' }, ...snap.groups.map((g) => ({ value: g.id, label: g.name }))]} />
        <FilterSelect label={L.classroom.singular} value={fRoom} onChange={setFRoom} options={[{ value: '', label: 'Todas' }, ...snap.classrooms.map((r) => ({ value: r.id, label: r.name }))]} /></>} />
      {visibleConflicts.length > 0 && <p role="status" className="mb-3 flex items-center gap-2 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-warn"><AlertTriangle size={15} aria-hidden />{visibleConflicts.length} {visibleConflicts.length === 1 ? 'clase con conflicto' : 'clases con conflicto'} (marcadas en rojo).</p>}
      <Calendar hours={businessHours(snap)} view={view} cursor={cursor} events={events} onSelect={(id) => setOpen({ id })} onCreate={write ? (date, start) => setOpen({ defaults: { date, start } }) : undefined} onMove={write ? onMove : undefined}
        onPickDay={(d) => { const [y, m, dd] = d.split('-').map(Number); setCursor(new Date(y, m - 1, dd)); setView('day'); }} />
      {open && <ClassForm key={open.id ?? 'new'} open session={session} defaults={open.defaults} onClose={close} />}
    </>
  );
}
