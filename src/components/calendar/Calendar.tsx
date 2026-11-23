import { useMemo, useState } from 'react';
import { addDays, addMonths, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { layoutLanes, minToHHMM } from '@/lib/classes';
import { hhmmToMin, todayISO } from '@/utils/format';
import { cn } from '@/utils/cn';

export type CalView = 'day' | 'week' | 'month';
export interface CalEvent { id: string; date: string; start: string; end: string; title: string; subtitle?: string; color: string; cancelled?: boolean; conflict?: string; draggable?: boolean }

const HOUR = 56, SNAP = 15;
const iso = (d: Date) => format(d, 'yyyy-MM-dd');
const parse = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };

export function calendarTitle(view: CalView, cursor: Date) {
  if (view === 'month') return format(cursor, 'LLLL yyyy', { locale: es });
  if (view === 'day') return format(cursor, "EEEE d 'de' MMMM", { locale: es });
  const s = startOfWeek(cursor, { weekStartsOn: 1 }), e = endOfWeek(cursor, { weekStartsOn: 1 });
  return `${format(s, 'd MMM', { locale: es })} – ${format(e, 'd MMM yyyy', { locale: es })}`;
}
export function shiftCursor(view: CalView, cursor: Date, dir: 1 | -1) { return view === 'month' ? addMonths(cursor, dir) : addDays(cursor, dir * (view === 'week' ? 7 : 1)); }

interface Props {
  view: CalView; cursor: Date; events: CalEvent[];
  /** Franja horaria visible [desde, hasta] en horas; por defecto 8–20. */ hours?: [number, number];
  onSelect: (id: string) => void; onCreate?: (date: string, start: string) => void; onMove?: (id: string, date: string, start: string) => void; onPickDay?: (date: string) => void;
}

export function Calendar({ view, cursor, events, hours, onSelect, onCreate, onMove, onPickDay }: Props) {
  const [dragOver, setDragOver] = useState<string | null>(null); const [H0, H1] = hours ?? [8, 20];
  const today = todayISO();
  if (view === 'month') return <MonthGrid {...{ cursor, events, today, onSelect, onMove, onPickDay, onCreate, dragOver, setDragOver }} />;

  const days = view === 'day' ? [cursor] : Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor, { weekStartsOn: 1 }), i));
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const dropAt = (e: React.DragEvent<HTMLDivElement>, date: string) => {
    e.preventDefault(); setDragOver(null);
    const [id, grab] = e.dataTransfer.getData('text/plain').split('|'); if (!id || !onMove) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const raw = ((e.clientY - rect.top) / HOUR) * 60 + H0 * 60 - Number(grab || 0);
    const snapped = Math.min((H1 - 1) * 60, Math.max(H0 * 60, Math.round(raw / SNAP) * SNAP));
    onMove(id, date, minToHHMM(snapped));
  };
  const clickSlot = (e: React.MouseEvent<HTMLDivElement>, date: string) => {
    if (!onCreate || e.target !== e.currentTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const m = Math.floor((((e.clientY - rect.top) / HOUR) * 60 + H0 * 60) / 30) * 30;
    onCreate(date, minToHHMM(m));
  };

  return (
    <div className="panel overflow-hidden">
      <div className="overflow-auto" style={{ maxHeight: 'min(72vh, 760px)' }}>
        <div style={{ minWidth: view === 'week' ? 760 : 0 }}>
          <div className="sticky top-0 z-20 grid border-b border-line bg-surface" style={{ gridTemplateColumns: `52px repeat(${days.length}, 1fr)` }}>
            <div />
            {days.map((d) => (
              <button key={iso(d)} onClick={() => onPickDay?.(iso(d))} className={cn('border-l border-line px-2 py-2.5 text-center text-xs', iso(d) === today && 'text-brand-text')}>
                <span className="block text-xs text-muted">{format(d, 'EEE', { locale: es })}</span>
                <span className={cn('tnum mt-0.5 inline-grid h-7 min-w-7 place-items-center rounded-full text-sm font-semibold', iso(d) === today && 'bg-brand text-on-brand')}>{format(d, 'd')}</span>
              </button>))}
          </div>
          <div className="grid" style={{ gridTemplateColumns: `52px repeat(${days.length}, 1fr)` }}>
            <div className="relative" style={{ height: (H1 - H0) * HOUR }}>
              {Array.from({ length: H1 - H0 }, (_, i) => <span key={i} className="tnum absolute right-2 -translate-y-1/2 text-xs text-muted" style={{ top: i * HOUR }}>{i === 0 ? '' : `${String(H0 + i).padStart(2, '0')}:00`}</span>)}
            </div>
            {days.map((d) => {
              const date = iso(d); const evs = events.filter((e) => e.date === date); const lanes = layoutLanes(evs);
              return (
                <div key={date} role="group" aria-label={format(d, "EEEE d 'de' MMMM", { locale: es })} onDragOver={(e) => { if (onMove) { e.preventDefault(); setDragOver(date); } }} onDragLeave={() => setDragOver(null)} onDrop={(e) => dropAt(e, date)} onClick={(e) => clickSlot(e, date)}
                  data-h0={H0} className={cn('relative border-l border-line', dragOver === date && 'bg-brand/6', onCreate && 'cursor-cell')} style={{ height: (H1 - H0) * HOUR, backgroundImage: `repeating-linear-gradient(to bottom, var(--line) 0, var(--line) 1px, transparent 1px, transparent ${HOUR}px)` }}>
                  {date === today && nowMin >= H0 * 60 && nowMin < H1 * 60 && <div aria-hidden className="pointer-events-none absolute right-0 left-0 z-10 h-px bg-bad" style={{ top: ((nowMin - H0 * 60) / 60) * HOUR }}><span className="absolute -top-[3px] -left-[3px] h-[7px] w-[7px] rounded-full bg-bad" /></div>}
                  {evs.map((ev) => {
                    const top = ((hhmmToMin(ev.start) - H0 * 60) / 60) * HOUR; const h = Math.max(22, ((hhmmToMin(ev.end) - hhmmToMin(ev.start)) / 60) * HOUR - 2);
                    const l = lanes.get(ev.id)!;
                    return (
                      <button key={ev.id} draggable={!!onMove && ev.draggable !== false && !ev.cancelled}
                        onDragStart={(e) => { const r = e.currentTarget.getBoundingClientRect(); e.dataTransfer.setData('text/plain', `${ev.id}|${Math.round(((e.clientY - r.top) / HOUR) * 60)}`); e.dataTransfer.effectAllowed = 'move'; }}
                        onClick={(e) => { e.stopPropagation(); onSelect(ev.id); }}
                        aria-label={`${ev.title}, ${ev.start} a ${ev.end}${ev.cancelled ? ', cancelada' : ''}${ev.conflict ? `, conflicto: ${ev.conflict}` : ''}`}
                        title={`${ev.title} · ${ev.start}–${ev.end}${ev.subtitle ? ` · ${ev.subtitle}` : ''}`}
                        className={cn('absolute z-[5] overflow-hidden rounded-lg border-l-[3px] px-2 py-1 text-left text-xs leading-tight transition-shadow hover:z-10 hover:shadow-lg', ev.cancelled && 'opacity-50 [&_.t]:line-through', ev.conflict && 'ring-1 ring-bad')}
                        style={{ top, height: h, left: `calc(${(l.lane / l.lanes) * 100}% + 2px)`, width: `calc(${100 / l.lanes}% - 4px)`, borderLeftColor: ev.color, background: `color-mix(in oklab, ${ev.color} 18%, var(--surface))` }}>
                        <span className="t flex items-start gap-1 font-semibold">{ev.conflict && <AlertTriangle size={11} className="mt-0.5 shrink-0 text-bad" aria-hidden />}<span className="break-words">{ev.title}</span></span>
                        {h > 34 && <span className="tnum block truncate text-muted">{ev.start}–{ev.end}</span>}
                        {h > 50 && ev.subtitle && <span className="block truncate text-muted">{ev.subtitle}</span>}
                      </button>);
                  })}
                </div>);
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function MonthGrid({ cursor, events, today, onSelect, onMove, onPickDay, onCreate, dragOver, setDragOver }: { cursor: Date; events: CalEvent[]; today: string; onSelect: (id: string) => void; onMove?: Props['onMove']; onPickDay?: (d: string) => void; onCreate?: Props['onCreate']; dragOver: string | null; setDragOver: (d: string | null) => void }) {
  const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }); const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
  const days = useMemo(() => { const out: Date[] = []; for (let d = start; d <= end; d = addDays(d, 1)) out.push(d); return out; }, [start, end]);
  return (
    <div className="panel overflow-hidden">
      <div className="overflow-x-auto"><div style={{ minWidth: 640 }}>
        <div className="grid grid-cols-7 border-b border-line text-center text-xs text-muted">{['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'].map((d) => <div key={d} className="py-2.5">{d}</div>)}</div>
        <div className="grid grid-cols-7">
          {days.map((d) => {
            const date = iso(d); const evs = events.filter((e) => e.date === date).sort((a, b) => a.start.localeCompare(b.start));
            return (
              <div key={date} onDragOver={(e) => { if (onMove) { e.preventDefault(); setDragOver(date); } }} onDragLeave={() => setDragOver(null)}
                onDrop={(e) => { e.preventDefault(); setDragOver(null); const id = e.dataTransfer.getData('text/plain').split('|')[0]; const ev = events.find((x) => x.id === id); if (ev && onMove) onMove(id, date, ev.start); }}
                className={cn('min-h-[104px] border-r border-b border-line p-1.5 [&:nth-child(7n)]:border-r-0', !isSameMonth(d, cursor) && 'bg-bg/40 text-muted', dragOver === date && 'bg-brand/8')}>
                <div className="mb-1 flex items-center justify-between">
                  <button onClick={() => onPickDay?.(date)} aria-label={`Ver ${format(d, "d 'de' MMMM", { locale: es })}`} className={cn('tnum grid h-6 min-w-6 place-items-center rounded-full px-1 text-xs hover:bg-surface-2', date === today && 'bg-brand font-semibold text-on-brand hover:bg-brand')}>{format(d, 'd')}</button>
                  {onCreate && isSameMonth(d, cursor) && <button onClick={() => onCreate(date, '17:00')} aria-label={`Nueva clase el ${format(d, "d 'de' MMMM", { locale: es })}`} className="text-xs text-muted opacity-0 hover:text-fg focus:opacity-100 [div:hover>div>&]:opacity-100">+</button>}
                </div>
                <div className="space-y-0.5">
                  {evs.slice(0, 3).map((ev) => (
                    <button key={ev.id} draggable={!!onMove && ev.draggable !== false && !ev.cancelled} onDragStart={(e) => { e.dataTransfer.setData('text/plain', `${ev.id}|0`); }} onClick={() => onSelect(ev.id)} title={`${ev.title} · ${ev.start}–${ev.end}`}
                      className={cn('flex w-full items-start gap-1 rounded px-1.5 py-0.5 text-left text-xs', ev.cancelled && 'line-through opacity-50', ev.conflict && 'ring-1 ring-bad')} style={{ background: `color-mix(in oklab, ${ev.color} 20%, var(--surface))` }}>
                      {ev.conflict && <AlertTriangle size={10} className="shrink-0 text-bad" aria-hidden />}<span className="tnum shrink-0 text-muted">{ev.start}</span><span className="break-words">{ev.title}</span>
                    </button>))}
                  {evs.length > 3 && <button onClick={() => onPickDay?.(date)} className="px-1.5 text-xs text-muted hover:text-fg">+{evs.length - 3} más</button>}
                </div>
              </div>);
          })}
        </div>
      </div></div>
    </div>
  );
}

export function CalendarToolbar({ view, setView, cursor, setCursor, extra }: { view: CalView; setView: (v: CalView) => void; cursor: Date; setCursor: (d: Date) => void; extra?: React.ReactNode }) {
  const btn = 'grid h-9 w-9 place-items-center rounded-lg border border-line hover:bg-surface-2';
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1.5">
        <button className={btn} aria-label="Anterior" onClick={() => setCursor(shiftCursor(view, cursor, -1))}><ChevronLeft size={16} /></button>
        <button className="h-9 rounded-lg border border-line px-3 text-sm hover:bg-surface-2" onClick={() => setCursor(new Date())}>Hoy</button>
        <button className={btn} aria-label="Siguiente" onClick={() => setCursor(shiftCursor(view, cursor, 1))}><ChevronRight size={16} /></button>
      </div>
      <h2 aria-live="polite" className="text-lg font-semibold capitalize">{calendarTitle(view, cursor)}</h2>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {extra}
        <div role="group" aria-label="Vista" className="flex rounded-lg border border-line p-0.5">
          {(['day', 'week', 'month'] as const).map((v) => <button key={v} aria-pressed={view === v} onClick={() => setView(v)} className={cn('h-8 rounded-md px-3 text-[13px]', view === v ? 'bg-brand/15 text-fg' : 'text-muted hover:text-fg')}>{{ day: 'Día', week: 'Semana', month: 'Mes' }[v]}</button>)}
        </div>
      </div>
    </div>
  );
}
export { parse as parseDate, iso as isoDate };
