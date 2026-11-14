import { useEffect, useRef, useState, type PointerEvent as RPE } from 'react';
import { addDays, format, parseISO, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, MapPin, RotateCcw } from 'lucide-react';
import { Modal } from '@/components/ui/Overlay';
import { uid, usePersonal, type PData, type SlotEx } from '@/store/personal';
import { Bar, COLORS, Empty, F, Panel, todayISO } from './shared';

/** Una clase concreta de una semana: viene del horario recurrente (con su posible excepción) o es una clase suelta. */
export interface Occ { key: string; slotId?: string; exId?: string; title: string; color: string; day: number; start: string; end: string; place?: string; cancelled?: boolean; moved?: boolean; extra?: boolean }
export const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export const mins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
export const hhmm = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
export const weekOf = (d: Date | string) => format(startOfWeek(typeof d === 'string' ? parseISO(d) : d, { weekStartsOn: 1 }), 'yyyy-MM-dd');
const byStart = (a: Occ, b: Occ) => a.start.localeCompare(b.start);

export function weekOccs(d: PData, week: string): Occ[] {
  const ex = d.schedEx.filter((e) => e.week === week);
  const out: Occ[] = d.schedule.map((s) => {
    const e = ex.find((x) => x.slotId === s.id && x.kind !== 'extra'); const base: Occ = { key: `${s.id}|${week}`, slotId: s.id, title: s.title, color: s.color, day: s.day, start: s.start, end: s.end, place: s.place };
    if (e?.kind === 'cancel') return { ...base, exId: e.id, cancelled: true };
    if (e?.kind === 'move') return { ...base, exId: e.id, moved: true, day: e.day ?? s.day, start: e.start ?? s.start, end: e.end ?? s.end, place: e.place ?? s.place };
    return base;
  });
  ex.filter((e) => e.kind === 'extra').forEach((e) => out.push({ key: e.id, exId: e.id, title: e.title ?? 'Clase', color: e.color ?? COLORS[0], day: e.day ?? 1, start: e.start ?? '09:00', end: e.end ?? '10:00', place: e.place, extra: true }));
  return out;
}
/** Clases (no canceladas) de un día concreto, ya con las excepciones de esa semana aplicadas. */
export const classesOn = (d: PData, iso: string): Occ[] => { const day = parseISO(iso).getDay() || 7; return weekOccs(d, weekOf(iso)).filter((o) => !o.cancelled && o.day === day).sort(byStart); };

/* ── Operaciones sobre el horario ── */
type Fields = { day: number; start: string; end: string; place?: string };
const exOf = (d: PData, slotId: string, week: string) => d.schedEx.find((e) => e.slotId === slotId && e.week === week && e.kind !== 'extra');
function setWeek(d: PData, slotId: string, week: string, f: Fields): PData {
  const s = d.schedule.find((x) => x.id === slotId); if (!s) return d; const cur = exOf(d, slotId, week); const rest = d.schedEx.filter((e) => e.id !== cur?.id);
  if (f.day === s.day && f.start === s.start && f.end === s.end && (f.place ?? undefined) === (s.place ?? undefined)) return { ...d, schedEx: rest };
  return { ...d, schedEx: [...rest, { id: cur?.id ?? uid(), kind: 'move', slotId, week, day: f.day, start: f.start, end: f.end, place: f.place }] };
}
const setAll = (d: PData, slotId: string, f: Fields & { title?: string; color?: string }, week: string): PData => ({ ...d, schedule: d.schedule.map((s) => s.id === slotId ? { ...s, ...f, title: f.title ?? s.title, color: f.color ?? s.color } : s), schedEx: d.schedEx.filter((e) => !(e.slotId === slotId && e.week === week && e.kind === 'move')) });
const cancelWeek = (d: PData, slotId: string, week: string): PData => ({ ...d, schedEx: [...d.schedEx.filter((e) => !(e.slotId === slotId && e.week === week && e.kind !== 'extra')), { id: uid(), kind: 'cancel', slotId, week }] });
const dropEx = (d: PData, exId: string): PData => ({ ...d, schedEx: d.schedEx.filter((e) => e.id !== exId) });
const delSlot = (d: PData, slotId: string): PData => ({ ...d, schedule: d.schedule.filter((s) => s.id !== slotId), schedEx: d.schedEx.filter((e) => e.slotId !== slotId) });
const delEx = dropEx;
const nextColor = (d: PData) => COLORS[new Set(d.schedule.map((x) => x.title.toLowerCase())).size % COLORS.length];

/* ── Cuadrícula semanal ── */
const HOUR = 54; const SNAP = 15;
type Dlg = { kind: 'new'; day: number; start: string } | { kind: 'edit'; occ: Occ } | null;
interface Pending { occ: Occ; day: number; start: string; end: string }

export function Schedule() {
  const { data, update } = usePersonal(); const [wk, setWk] = useState(() => parseISO(weekOf(new Date()))); const week = format(wk, 'yyyy-MM-dd'); const [dlg, setDlg] = useState<Dlg>(null); const [pending, setPending] = useState<Pending | null>(null);
  const [drag, setDrag] = useState<{ key: string; day: number; start: number; end: number } | null>(null); const grid = useRef<HTMLDivElement>(null); const st = useRef<{ o: Occ; mode: 'move' | 'resize'; x: number; y: number; moved: boolean; rect: DOMRect } | null>(null);
  const occs = weekOccs(data, week); const today = todayISO(); const nowD = new Date();
  const H0 = Math.min(7, ...occs.map((o) => Math.floor(mins(o.start) / 60))); const H1 = Math.max(21, ...occs.map((o) => Math.ceil(mins(o.end) / 60))); const span = H1 - H0;
  const exCount = data.schedEx.filter((e) => e.week === week).length;
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && pending) { e.stopPropagation(); setPending(null); } }; window.addEventListener('keydown', k, true); return () => window.removeEventListener('keydown', k, true); }, [pending]);

  const down = (e: RPE<HTMLElement>, o: Occ, mode: 'move' | 'resize') => { if (e.button !== 0 || !grid.current) return; e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); st.current = { o, mode, x: e.clientX, y: e.clientY, moved: false, rect: grid.current.getBoundingClientRect() }; };
  const move = (e: RPE<HTMLElement>) => {
    const s = st.current; if (!s) return; if (!s.moved && Math.hypot(e.clientX - s.x, e.clientY - s.y) < 5) return; s.moved = true; if (s.o.cancelled) return;
    const dm = Math.round(((e.clientY - s.y) / HOUR) * 60 / SNAP) * SNAP; const len = mins(s.o.end) - mins(s.o.start);
    if (s.mode === 'resize') setDrag({ key: s.o.key, day: s.o.day, start: mins(s.o.start), end: Math.max(mins(s.o.start) + SNAP, Math.min(H1 * 60, mins(s.o.end) + dm)) });
    else { const start = Math.max(H0 * 60, Math.min(H1 * 60 - len, mins(s.o.start) + dm)); const day = Math.max(1, Math.min(7, Math.floor(((e.clientX - s.rect.left) / s.rect.width) * 7) + 1)); setDrag({ key: s.o.key, day, start, end: start + len }); }
  };
  const up = () => {
    const s = st.current; st.current = null; if (!s) return; const d = drag; setDrag(null);
    if (!s.moved || !d) { setDlg({ kind: 'edit', occ: s.o }); return; }
    if (s.o.cancelled || (d.day === s.o.day && d.start === mins(s.o.start) && d.end === mins(s.o.end))) return;
    if (s.o.extra) { update((x) => ({ ...x, schedEx: x.schedEx.map((e) => e.id === s.o.exId ? { ...e, day: d.day, start: hhmm(d.start), end: hhmm(d.end) } : e) })); return; }
    setPending({ occ: s.o, day: d.day, start: hhmm(d.start), end: hhmm(d.end) });
  };
  const apply = (scope: 'week' | 'all') => { if (!pending?.occ.slotId) return; const { occ, day, start, end } = pending; const f = { day, start, end, place: occ.place }; update((d) => scope === 'week' ? setWeek(d, occ.slotId!, week, f) : setAll(d, occ.slotId!, f, week)); setPending(null); };
  const emptyClick = (e: React.MouseEvent<HTMLDivElement>, day: number) => { if (e.target !== e.currentTarget) return; const r = e.currentTarget.getBoundingClientRect(); const m = Math.round((((e.clientY - r.top) / HOUR) * 60 + H0 * 60) / 30) * 30; setDlg({ kind: 'new', day, start: hhmm(Math.min(m, 22 * 60)) }); };

  const lanes = (day: number) => { const l = occs.filter((o) => o.day === day).sort(byStart); const ends: number[] = []; const out = new Map<string, number>(); l.forEach((o) => { let i = ends.findIndex((e) => e <= mins(o.start)); if (i < 0) { i = ends.length; ends.push(0); } ends[i] = mins(o.end); out.set(o.key, i); }); return { out, n: Math.max(1, ends.length) }; };
  const label = `${format(wk, 'd', { locale: es })}–${format(addDays(wk, 6), 'd MMM yyyy', { locale: es })}`; const thisWeek = week === weekOf(new Date());
  const nowTop = ((nowD.getHours() * 60 + nowD.getMinutes() - H0 * 60) / 60) * HOUR;

  return (<>
    <div className="mb-3 flex flex-wrap items-center gap-3">
      <span className="flex items-center gap-1"><button className="hud-icon" aria-label="Semana anterior" onClick={() => setWk(addDays(wk, -7))}><ChevronLeft size={16} aria-hidden /></button><button className="hud-btn" onClick={() => setWk(parseISO(weekOf(new Date())))} aria-label="Ir a esta semana">{thisWeek ? 'Esta semana' : 'Volver a hoy'}</button><button className="hud-icon" aria-label="Semana siguiente" onClick={() => setWk(addDays(wk, 7))}><ChevronRight size={16} aria-hidden /></button></span>
      <b className="hud-val capitalize">{label}</b>
      {exCount > 0 && <span className="hud-chip !border-warn !text-warn">{exCount} {exCount === 1 ? 'excepción' : 'excepciones'} esta semana</span>}
      <span className="ml-auto text-[11px] text-muted">Se repite cada semana · arrastra para mover · tira del borde inferior para cambiar la duración · pulsa un hueco para añadir</span>
    </div>
    {pending && (
      <div role="alert" className="hud-alert !static mb-3 !w-full !max-w-none !translate-x-0 flex-wrap !animate-none">
        <div className="min-w-0 flex-1"><p className="hud-sub">Mover clase</p><p className="font-semibold">{pending.occ.title} → {DAYS[pending.day - 1]} {pending.start}–{pending.end}</p></div>
        <button className="hud-btn" onClick={() => apply('week')}>Solo esta semana</button><button className="hud-btn" onClick={() => apply('all')}>Todas las semanas</button><button className="hud-ghost" onClick={() => setPending(null)}>Cancelar</button>
      </div>)}
    <div className="tt" role="group" aria-label="Horario semanal">
      <div className="tt-head"><span />{DAYS.map((n, i) => { const d = addDays(wk, i); const iso = format(d, 'yyyy-MM-dd'); return <span key={n} className={iso === today ? 'on' : ''}><small>{n.slice(0, 3)}</small> {format(d, 'd')}</span>; })}</div>
      <div className="tt-body" style={{ height: span * HOUR }}>
        <div className="relative">{Array.from({ length: span }, (_, i) => <span key={i} className="tt-hour" style={{ top: i * HOUR }}>{String(H0 + i).padStart(2, '0')}:00</span>)}</div>
        <div className="tt-cols" ref={grid} style={{ backgroundSize: `100% ${HOUR}px` }}>
          {DAYS.map((_, di) => { const ln = lanes(di + 1); const iso = format(addDays(wk, di), 'yyyy-MM-dd'); return (
            <div key={di} className={`tt-col ${iso === today ? 'today' : ''}`} onClick={(e) => emptyClick(e, di + 1)}>
              {iso === today && nowTop > 0 && nowTop < span * HOUR && <i className="tt-now" style={{ top: nowTop }} aria-hidden />}
              {occs.filter((o) => o.day === di + 1).map((o) => <Block key={o.key} o={o} lane={ln.out.get(o.key) ?? 0} n={ln.n} H0={H0} down={down} move={move} up={up} dim={drag?.key === o.key} />)}
            </div>); })}
          {drag && (() => { const o = occs.find((x) => x.key === drag.key)!; return <Block key="ghost" o={{ ...o, day: drag.day, start: hhmm(drag.start), end: hhmm(drag.end) }} lane={0} n={1} H0={H0} ghost down={down} move={move} up={up} cols />; })()}
          {pending && <Block key="pend" o={{ ...pending.occ, day: pending.day, start: pending.start, end: pending.end }} lane={0} n={1} H0={H0} ghost down={down} move={move} up={up} cols />}
        </div>
      </div>
    </div>
    {data.schedule.length === 0 && <div className="mt-3"><Empty text="Aún no hay clases. Pulsa un hueco del horario para crear la primera: se repetirá todas las semanas." /></div>}
    {dlg && <ClassDialog key={dlg.kind === 'edit' ? dlg.occ.key : 'new'} dlg={dlg} week={week} onClose={() => setDlg(null)} />}
  </>);
}

function Block({ o, lane, n, H0, down, move, up, ghost, cols, dim }: { o: Occ; lane: number; n: number; H0: number; down: (e: RPE<HTMLElement>, o: Occ, m: 'move' | 'resize') => void; move: (e: RPE<HTMLElement>) => void; up: () => void; ghost?: boolean; cols?: boolean; dim?: boolean }) {
  const top = ((mins(o.start) - H0 * 60) / 60) * HOUR; const h = Math.max(18, ((mins(o.end) - mins(o.start)) / 60) * HOUR - 2);
  const w = cols ? 100 / 7 : 100 / n; const left = cols ? ((o.day - 1) * 100) / 7 : lane * w;
  return (
    <div role="button" tabIndex={ghost ? -1 : 0} aria-label={`${o.title}, ${DAYS[o.day - 1]} ${o.start} a ${o.end}${o.cancelled ? ', cancelada esta semana' : ''}${o.moved ? ', excepción de esta semana' : ''}`}
      onKeyDown={(e) => { if (e.key === 'Enter' && !ghost) { e.preventDefault(); (e.currentTarget as HTMLElement).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 })); } }}
      className={`tt-block ${o.cancelled ? 'off' : ''} ${o.moved || o.extra ? 'ex' : ''} ${ghost ? 'ghost' : ''} ${dim ? 'dim' : ''}`} style={{ top, height: h, left: `calc(${left}% + 2px)`, width: `calc(${w}% - 4px)`, ['--c' as string]: o.color, pointerEvents: ghost ? 'none' : 'auto', position: 'absolute' }}
      onPointerDown={(e) => down(e, o, 'move')} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <b>{o.title}</b><span>{o.start}–{o.end}{o.place ? ` · ${o.place}` : ''}</span>
      {(o.moved || o.extra) && <em>{o.extra ? 'solo esta semana' : 'excepción'}</em>}{o.cancelled && <em>cancelada</em>}
      {!o.cancelled && !ghost && <i className="tt-grip" onPointerDown={(e) => down(e, o, 'resize')} aria-hidden />}
    </div>
  );
}

function ClassDialog({ dlg, week, onClose }: { dlg: NonNullable<Dlg>; week: string; onClose: () => void }) {
  const { data, update } = usePersonal(); const occ = dlg.kind === 'edit' ? dlg.occ : null;
  const [title, setTitle] = useState(occ?.title ?? ''); const [day, setDay] = useState(String(occ?.day ?? (dlg.kind === 'new' ? dlg.day : 1))); const [start, setStart] = useState(occ?.start ?? (dlg.kind === 'new' ? dlg.start : '09:00')); const [end, setEnd] = useState(occ?.end ?? (dlg.kind === 'new' ? hhmm(Math.min(mins(dlg.start) + 60, 23 * 60 + 45)) : '10:00'));
  const [place, setPlace] = useState(occ?.place ?? ''); const [color, setColor] = useState(occ?.color ?? nextColor(data)); const [scope, setScope] = useState<'all' | 'week'>(occ?.moved ? 'week' : 'all'); const [err, setErr] = useState('');
  const recurring = !!occ?.slotId; const isNew = !occ;
  const save = () => {
    if (!title.trim()) return setErr('Escribe el nombre de la clase.'); if (mins(end) <= mins(start)) return setErr('La hora de fin debe ser posterior a la de inicio.');
    const f = { day: Number(day), start, end, place: place.trim() || undefined };
    if (isNew) update((d) => scope === 'all' ? { ...d, schedule: [...d.schedule, { id: uid(), title: title.trim(), color, ...f }] } : { ...d, schedEx: [...d.schedEx, { id: uid(), kind: 'extra', week, title: title.trim(), color, ...f } as SlotEx] });
    else if (occ!.extra) update((d) => ({ ...d, schedEx: d.schedEx.map((e) => e.id === occ!.exId ? { ...e, title: title.trim(), color, ...f } : e) }));
    else update((d) => scope === 'week' ? setWeek(d, occ!.slotId!, week, f) : setAll(d, occ!.slotId!, { ...f, title: title.trim(), color }, week));
    onClose();
  };
  const run = (fn: (d: PData) => PData) => () => { update(fn); onClose(); };
  const title2 = isNew ? 'Nueva clase' : occ!.cancelled ? 'Clase cancelada esta semana' : 'Editar clase';
  return (
    <Modal open onClose={onClose} label={title2} className="max-w-lg">
      <div className="p-5">
        <h2 className="hud-title mb-4 text-lg">{title2.toUpperCase()}</h2>
        <div className="flex flex-wrap gap-3">
          <F label="Nombre" w="w-full"><input className="hud-input" autoFocus value={title} onChange={(e) => { setTitle(e.target.value); setErr(''); }} placeholder="Cálculo I" /></F>
          <F label="Día"><select className="hud-input" value={day} onChange={(e) => setDay(e.target.value)}>{DAYS.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}</select></F>
          <F label="Inicio" w="w-28"><input className="hud-input" type="time" value={start} onChange={(e) => setStart(e.target.value)} /></F><F label="Fin" w="w-28"><input className="hud-input" type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></F>
          <F label="Aula / lugar" w="w-full"><input className="hud-input" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Aula 3.2" /></F>
          <div className="w-full"><span className="hud-sub mb-1 block">Color</span><div className="flex gap-2">{COLORS.map((c) => <button key={c} type="button" aria-label={`Color ${c}`} aria-pressed={color === c} className="theme-dot !h-7 !w-7" style={{ background: c, ['--c' as string]: c }} onClick={() => setColor(c)} />)}</div></div>
          {!occ?.extra && !occ?.cancelled && <div className="w-full"><span className="hud-sub mb-1 block">{isNew ? 'Se repite' : 'Aplicar el cambio a'}</span>
            <div className="hud-seg" role="group" aria-label="Alcance"><button type="button" aria-pressed={scope === 'all'} onClick={() => setScope('all')}>Todas las semanas</button><button type="button" aria-pressed={scope === 'week'} onClick={() => setScope('week')}>Solo esta semana</button></div>
            <p className="mt-1 text-[11px] text-muted">{scope === 'all' ? 'Se repetirá cada semana.' : isNew ? 'Una clase suelta solo en la semana que estás viendo.' : 'Excepción: el resto de semanas queda como está.'}</p></div>}
        </div>
        {err && <p role="alert" className="mt-3 text-sm text-bad">{err}</p>}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {!occ?.cancelled && <button className="hud-btn" onClick={save}>Guardar</button>}
          {recurring && occ!.cancelled && <button className="hud-btn" onClick={run((d) => dropEx(d, occ!.exId!))}><RotateCcw size={13} className="mr-1.5 inline" aria-hidden />Restaurar esta semana</button>}
          {recurring && occ!.moved && <button className="hud-btn" onClick={run((d) => dropEx(d, occ!.exId!))}>Volver al horario normal</button>}
          {recurring && !occ!.cancelled && <button className="hud-btn" onClick={run((d) => cancelWeek(d, occ!.slotId!, week))}>Cancelar solo esta semana</button>}
          {recurring && <button className="hud-ghost ml-auto !text-bad" onClick={run((d) => delSlot(d, occ!.slotId!))}>Eliminar de todas las semanas</button>}
          {occ?.extra && <button className="hud-ghost ml-auto !text-bad" onClick={run((d) => delEx(d, occ.exId!))}>Eliminar clase</button>}
          <button className="hud-ghost" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </Modal>
  );
}

/* ── Panel de portada: lo de hoy ── */
export function SchedulePanel({ now, onOpen }: { now: Date; onOpen: () => void }) {
  const data = usePersonal((s) => s.data); const nowM = now.getHours() * 60 + now.getMinutes(); const today = classesOn(data, format(now, 'yyyy-MM-dd'));
  const cur = today.find((s) => mins(s.start) <= nowM && nowM < mins(s.end)); const next = today.find((s) => mins(s.start) > nowM); const fm = (n: number) => n < 60 ? `${n} min` : `${Math.floor(n / 60)} h ${n % 60 ? `${n % 60} min` : ''}`;
  let right = <span className="hud-sub">sin clases</span>;
  if (cur) right = <span className="hud-val">en clase · {fm(mins(cur.end) - nowM)}</span>; else if (next) right = <span className="hud-val">siguiente en {fm(mins(next.start) - nowM)}</span>; else if (today.length) right = <span className="hud-sub">terminaste por hoy</span>;
  let after: { o: Occ; k: number } | undefined; if (!next && !cur) for (let k = 1; k <= 14 && !after; k++) { const c = classesOn(data, format(addDays(now, k), 'yyyy-MM-dd'))[0]; if (c) after = { o: c, k }; }
  const any = data.schedule.length + data.schedEx.length > 0;
  return (
    <Panel title="Horario de hoy" right={right} onOpen={onOpen} grow={1.4}>
      {!any ? <Empty text="Pulsa + y crea tu horario semanal: se repetirá cada semana y podrás mover las clases con el ratón." /> : <>
        {today.length === 0 && <Empty text="Hoy no tienes clase." />}
        {today.map((s) => { const on = s === cur; const past = mins(s.end) <= nowM; return (
          <div key={s.key} className={`hud-row ${past ? 'opacity-40' : ''}`} style={on ? { background: 'rgb(var(--h) / .12)', borderRadius: 6, padding: '8px 6px' } : undefined}>
            <i className="h-7 w-1 flex-none rounded" style={{ background: s.color, boxShadow: on ? `0 0 10px ${s.color}` : 'none' }} /><span className="hud-val w-[84px] flex-none text-xs">{s.start}–{s.end}</span>
            <div className="min-w-0 flex-1"><p className="truncate">{s.title}{(s.moved || s.extra) && <em className="ml-2 text-[10px] text-warn not-italic">esta semana</em>}</p>{on && <div className="mt-1"><Bar pct={((nowM - mins(s.start)) / (mins(s.end) - mins(s.start))) * 100} /></div>}</div>
            {s.place && <span className="hud-sub flex flex-none items-center gap-1"><MapPin size={10} aria-hidden />{s.place}</span>}</div>); })}
        {after && <p className="mt-2 text-xs text-muted">{after.k === 1 ? 'Mañana' : DAYS[after.o.day - 1]}: <b className="text-fg">{after.o.title}</b> a las {after.o.start}</p>}
      </>}
    </Panel>
  );
}
