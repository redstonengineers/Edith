import { useEffect, useRef, useState, type FormEvent } from 'react';
import { addDays, addMonths, differenceInCalendarDays, format, parseISO, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { Bell, BellRing, CalendarDays, CheckSquare, MapPin, Plus, TrendingDown, TrendingUp, X } from 'lucide-react';
import { uid, usePersonal, type PData, type Reminder, type Repeat, type Slot } from '@/store/personal';
import { Bar, COLORS, Empty, F, AddForm, Row, Panel, eur, todayISO } from './shared';
import { blip, hudBus } from './fx';
import { useHud } from './themes';

type Update = (fn: (d: PData) => PData) => void;
const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const mins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const hhmm = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
const isoDay = (d: Date) => d.getDay() || 7;

/* ───────────── Horario ───────────── */
export function Schedule() {
  const { data, update } = usePersonal(); const [title, setTitle] = useState(''); const [day, setDay] = useState(String(isoDay(new Date()))); const [start, setStart] = useState('09:00'); const [end, setEnd] = useState('10:00'); const [place, setPlace] = useState('');
  const sl = data.schedule; const from = Math.floor(Math.min(8 * 60, ...sl.map((s) => mins(s.start))) / 60) * 60; const to = Math.ceil(Math.max(15 * 60, ...sl.map((s) => mins(s.end))) / 60) * 60; const span = to - from; const today = isoDay(new Date());
  const hours = Array.from({ length: (to - from) / 60 + 1 }, (_, i) => from + i * 60);
  const add = () => { if (!title.trim() || mins(end) <= mins(start)) return false; update((d) => ({ ...d, schedule: [...d.schedule, { id: uid(), title: title.trim(), day: Number(day), start, end, place: place.trim() || undefined, color: COLORS[new Set(d.schedule.map((x) => x.title.toLowerCase())).size % COLORS.length] }] })); setTitle(''); setPlace(''); };
  return (<>
    <AddForm onAdd={add} label="Añadir clase">
      <F label="Asignatura o actividad" w="w-full"><input className="hud-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Cálculo I" /></F>
      <F label="Día"><select className="hud-input" value={day} onChange={(e) => setDay(e.target.value)}>{DAYS.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}</select></F>
      <F label="Inicio" w="w-28"><input className="hud-input" type="time" value={start} onChange={(e) => setStart(e.target.value)} /></F><F label="Fin" w="w-28"><input className="hud-input" type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></F>
      <F label="Aula / lugar"><input className="hud-input" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Aula 3.2" /></F>
    </AddForm>
    {sl.length === 0 ? <Empty text="Añade tus clases y verás aquí tu semana completa." /> : (
      <div className="mb-5" role="img" aria-label="Horario semanal">
        <div className="grid grid-cols-[34px_repeat(7,1fr)] gap-px text-center text-[10px]">
          <span />{DAYS.map((d, i) => <span key={d} className={i + 1 === today ? 'hud-val' : 'text-muted'}>{d.slice(0, 1)}</span>)}
        </div>
        <div className="relative grid grid-cols-[34px_repeat(7,1fr)] gap-px" style={{ height: Math.max(220, span * .62) }}>
          <div className="relative">{hours.map((h) => <span key={h} className="absolute -translate-y-1/2 text-[9px] text-muted" style={{ top: `${((h - from) / span) * 100}%` }}>{hhmm(h).slice(0, 2)}</span>)}</div>
          {DAYS.map((_, i) => (
            <div key={i} className="relative rounded-sm border border-line/50" style={{ background: i + 1 === today ? 'rgb(var(--h) / .07)' : 'transparent' }}>
              {sl.filter((s) => s.day === i + 1).map((s) => <div key={s.id} title={`${s.title} ${s.start}-${s.end}`} className="absolute inset-x-px overflow-hidden rounded-sm px-0.5 text-[9px] leading-tight text-black" style={{ top: `${((mins(s.start) - from) / span) * 100}%`, height: `${((mins(s.end) - mins(s.start)) / span) * 100}%`, background: s.color }}>{s.title}</div>)}
            </div>))}
        </div>
      </div>)}
    {DAYS.map((dn, i) => { const list = sl.filter((s) => s.day === i + 1).sort((a, b) => a.start.localeCompare(b.start)); if (!list.length) return null; return (
      <div key={dn} className="mb-3"><p className="hud-sub mb-1">{dn}</p>
        {list.map((s) => <Row key={s.id} label={s.title} onDelete={() => update((d) => ({ ...d, schedule: d.schedule.filter((x) => x.id !== s.id) }))}><span style={{ color: s.color }}>●</span><span className="hud-val w-24 text-xs">{s.start}–{s.end}</span><span>{s.title}</span>{s.place && <span className="hud-sub">{s.place}</span>}</Row>)}</div>); })}
  </>);
}

export function SchedulePanel({ now, onOpen }: { now: Date; onOpen: () => void }) {
  const sl = usePersonal((s) => s.data.schedule); const nowM = now.getHours() * 60 + now.getMinutes(); const d0 = isoDay(now);
  const today = sl.filter((s) => s.day === d0).sort((a, b) => a.start.localeCompare(b.start));
  const cur = today.find((s) => mins(s.start) <= nowM && nowM < mins(s.end)); const next = today.find((s) => mins(s.start) > nowM);
  let right = <span className="hud-sub">sin clases</span>;
  const fm = (n: number) => n < 60 ? `${n} min` : `${Math.floor(n / 60)} h ${n % 60 ? `${n % 60} min` : ''}`;
  if (cur) right = <span className="hud-val">en clase · {fm(mins(cur.end) - nowM)}</span>; else if (next) right = <span className="hud-val">siguiente en {fm(mins(next.start) - nowM)}</span>; else if (today.length) right = <span className="hud-sub">terminaste por hoy</span>;
  let after: Slot | undefined; let afterDay = 0; if (!today.length || !next) for (let k = 1; k <= 7 && !after; k++) { const dd = ((d0 - 1 + k) % 7) + 1; after = sl.filter((s) => s.day === dd).sort((a, b) => a.start.localeCompare(b.start))[0]; afterDay = k; }
  return (
    <Panel title="Horario de hoy" right={right} onOpen={onOpen} grow={1.4}>
      {sl.length === 0 ? <Empty text="Pulsa + y añade tus clases: aquí verás qué toca ahora y qué viene después." /> : <>
        {today.length === 0 && <Empty text="Hoy no tienes clase." />}
        {today.map((s) => { const on = s === cur; const past = mins(s.end) <= nowM; return (
          <div key={s.id} className={`hud-row ${past ? 'opacity-40' : ''}`} style={on ? { background: 'rgb(var(--h) / .12)', borderRadius: 6, padding: '8px 6px' } : undefined}>
            <i className="h-7 w-1 flex-none rounded" style={{ background: s.color, boxShadow: on ? `0 0 10px ${s.color}` : 'none' }} /><span className="hud-val w-[84px] flex-none text-xs">{s.start}–{s.end}</span>
            <div className="min-w-0 flex-1"><p className="truncate">{s.title}</p>{on && <div className="mt-1"><Bar pct={((nowM - mins(s.start)) / (mins(s.end) - mins(s.start))) * 100} /></div>}</div>
            {s.place && <span className="hud-sub flex flex-none items-center gap-1"><MapPin size={10} aria-hidden />{s.place}</span>}</div>); })}
        {after && (!today.length || !next) && <p className="mt-2 text-xs text-muted">{afterDay === 1 ? 'Mañana' : DAYS[after.day - 1]}: <b className="text-fg">{after.title}</b> a las {after.start}</p>}
      </>}
    </Panel>
  );
}

/* ───────────── Recordatorios ───────────── */
export const dueAt = (r: Reminder) => parseISO(`${r.date}T${r.time ?? '09:00'}`);
export function whenLabel(date: string, time?: string) {
  const n = differenceInCalendarDays(parseISO(date), new Date()); const day = n === 0 ? 'Hoy' : n === 1 ? 'Mañana' : n === -1 ? 'Ayer' : format(parseISO(date), 'EEE d MMM', { locale: es });
  return time ? `${day} ${time}` : day;
}
export function completeReminder(update: Update, r: Reminder) {
  update((d) => ({ ...d, reminders: d.reminders.map((x) => {
    if (x.id !== r.id) return x; if (x.repeat === 'no') return { ...x, done: true };
    const step = (dt: Date) => x.repeat === 'diario' ? addDays(dt, 1) : x.repeat === 'semanal' ? addDays(dt, 7) : addMonths(dt, 1);
    let n = dueAt(x); do { n = step(n); } while (n.getTime() <= Date.now()); return { ...x, date: format(n, 'yyyy-MM-dd') };
  }) }));
}
/** «llamar al médico mañana a las 10:30», «tomar pastilla en 20 min», «entregar práctica hoy 18h». */
export function parseQuick(raw: string, now = new Date()): { title: string; date: string; time?: string; label: string } {
  let t = ` ${raw} `; let date = format(now, 'yyyy-MM-dd'); let time: string | undefined; let explicit = false;
  const rel = t.match(/\ben (\d{1,3}) ?(minutos?|min|horas?|h)\b/i);
  if (rel) { const d = new Date(now.getTime() + Number(rel[1]) * (/^m/i.test(rel[2]) ? 60_000 : 3_600_000)); date = format(d, 'yyyy-MM-dd'); time = format(d, 'HH:mm'); t = t.replace(rel[0], ' '); explicit = true; }
  else {
    if (/\bmañana\b/i.test(t)) { date = format(addDays(now, 1), 'yyyy-MM-dd'); t = t.replace(/\bmañana\b/i, ' '); explicit = true; } else if (/\bhoy\b/i.test(t)) { t = t.replace(/\bhoy\b/i, ' '); explicit = true; }
    const hm = t.match(/\b(?:a las )?(\d{1,2})[:.h](\d{2})\b/i) ?? t.match(/\b(?:a las )(\d{1,2})(?:h)?\b/i) ?? t.match(/\b(\d{1,2}) ?h\b/i);
    if (hm) { const h = Number(hm[1]); const m = Number(hm[2] ?? 0); if (h < 24 && m < 60) { time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; t = t.replace(hm[0], ' '); } }
    if (time && !explicit && date === format(now, 'yyyy-MM-dd') && mins(time) <= now.getHours() * 60 + now.getMinutes()) date = format(addDays(now, 1), 'yyyy-MM-dd');
  }
  const title = t.replace(/\s+/g, ' ').trim().replace(/^(recuérdame|recuerdame|recordar)\s+/i, '');
  return { title, date, time, label: whenLabel(date, time) };
}

export function Reminders() {
  const { data, update } = usePersonal(); const [title, setTitle] = useState(''); const [date, setDate] = useState(todayISO()); const [time, setTime] = useState(''); const [rep, setRep] = useState<Repeat>('no');
  const [perm, setPerm] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'denied');
  const list = [...data.reminders].sort((a, b) => Number(a.done) - Number(b.done) || dueAt(a).getTime() - dueAt(b).getTime());
  return (<>
    {perm === 'default' && <button className="hud-btn mb-4 w-full" onClick={() => void Notification.requestPermission().then(setPerm)}><BellRing size={14} className="mr-2 inline" aria-hidden />Activar avisos del navegador</button>}
    <AddForm onAdd={() => { if (!title.trim()) return false; update((d) => ({ ...d, reminders: [...d.reminders, { id: uid(), title: title.trim(), date, time: time || undefined, done: false, repeat: rep }] })); setTitle(''); }}>
      <F label="Recordatorio" w="w-full"><input className="hud-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Llamar al médico" /></F>
      <F label="Día"><input className="hud-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></F><F label="Hora" w="w-28"><input className="hud-input" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></F>
      <F label="Repetir" w="w-32"><select className="hud-input" value={rep} onChange={(e) => setRep(e.target.value as Repeat)}><option value="no">No</option><option value="diario">Cada día</option><option value="semanal">Cada semana</option><option value="mensual">Cada mes</option></select></F>
    </AddForm>
    {list.length === 0 && <Empty text="Sin recordatorios." />}
    {list.map((r) => <Row key={r.id} label={r.title} onDelete={() => update((d) => ({ ...d, reminders: d.reminders.filter((x) => x.id !== r.id) }))}>
      <input type="checkbox" className="hud-check" checked={r.done} aria-label={`Completar ${r.title}`} onChange={() => r.done ? update((d) => ({ ...d, reminders: d.reminders.map((x) => x.id === r.id ? { ...x, done: false } : x) })) : completeReminder(update, r)} />
      <span className={r.done ? 'text-muted line-through' : ''}>{r.title}</span>{r.repeat !== 'no' && <span className="hud-sub">↻ {r.repeat}</span>}
      <span className={`ml-auto text-xs ${!r.done && dueAt(r).getTime() < Date.now() ? 'text-bad' : 'text-muted'}`}>{whenLabel(r.date, r.time)}</span></Row>)}
  </>);
}

export function RemindersPanel({ onOpen }: { onOpen: () => void }) {
  const { data, update } = usePersonal(); const sound = useHud((s) => s.sound); const [q, setQ] = useState('');
  const pending = data.reminders.filter((r) => !r.done).sort((a, b) => dueAt(a).getTime() - dueAt(b).getTime()); const parsed = q.trim() ? parseQuick(q) : null;
  const add = (e: FormEvent) => { e.preventDefault(); if (!parsed?.title) return; update((d) => ({ ...d, reminders: [...d.reminders, { id: uid(), title: parsed.title, date: parsed.date, time: parsed.time, done: false, repeat: 'no' }] })); setQ(''); blip('tick', sound); hudBus.emit('pulse'); };
  return (
    <Panel title="Recordatorios" right={<span className="hud-sub">{pending.length} pendientes</span>} onOpen={onOpen} grow={1.2}>
      <form onSubmit={add} className="mb-2 flex gap-2"><input className="hud-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Recuérdame… ej: llamar al médico mañana 10:30" aria-label="Nuevo recordatorio" maxLength={140} /><button className="hud-btn !px-3" type="submit" disabled={!parsed?.title} aria-label="Añadir recordatorio"><Plus size={15} aria-hidden /></button></form>
      {parsed?.title && <p className="mb-2 text-[11px] text-muted"><Bell size={10} className="mr-1 inline" aria-hidden />{parsed.title} → <b className="hud-val">{parsed.label}</b></p>}
      {pending.length === 0 ? <Empty text="Todo al día. Escribe arriba y pulsa Intro: entiendo «mañana», «hoy», «a las 18:30» o «en 20 min»." /> : pending.slice(0, 8).map((r) => (
        <div key={r.id} className="hud-row"><input type="checkbox" className="hud-check" aria-label={`Completar ${r.title}`} checked={false} onChange={() => { completeReminder(update, r); blip('ok', sound); hudBus.emit('success'); }} /><span className="truncate">{r.title}</span><span className={`ml-auto flex-none text-xs ${dueAt(r).getTime() < Date.now() ? 'text-bad' : 'text-muted'}`}>{whenLabel(r.date, r.time)}</span></div>))}
    </Panel>
  );
}

/** Avisa cuando un recordatorio llega a su hora: tarjeta en pantalla, sonido y notificación del navegador si está permitida. */
export function useReminderAlerts() {
  const data = usePersonal((s) => s.data); const update = usePersonal((s) => s.update); const sound = useHud((s) => s.sound);
  const [alerts, setAlerts] = useState<Reminder[]>([]); const seen = useRef(new Set<string>()); const ref = useRef(data); ref.current = data;
  const tickRef = useRef<() => void>(() => {});
  useEffect(() => {
    const tick = () => { const fresh = ref.current.reminders.filter((r) => !r.done && dueAt(r).getTime() <= Date.now() && !seen.current.has(`${r.id}|${r.date}|${r.time}`)); if (!fresh.length) return;
      fresh.forEach((r) => { seen.current.add(`${r.id}|${r.date}|${r.time}`); if (typeof Notification !== 'undefined' && Notification.permission === 'granted') try { new Notification('EDITH · Recordatorio', { body: r.title }); } catch { /* sin permiso */ } });
      setAlerts((a) => [...a, ...fresh].slice(-4)); blip('ok', sound); hudBus.emit('success'); };
    tickRef.current = tick; tick(); const id = setInterval(tick, 15_000); return () => clearInterval(id);
  }, [sound]);
  useEffect(() => { tickRef.current(); }, [data.reminders]);
  const close = (id: string) => setAlerts((a) => a.filter((x) => x.id !== id));
  return { alerts, done: (r: Reminder) => { completeReminder(update, r); close(r.id); }, close,
    snooze: (r: Reminder) => { const d = new Date(Date.now() + 10 * 60_000); update((s) => ({ ...s, reminders: s.reminders.map((x) => x.id === r.id ? { ...x, date: format(d, 'yyyy-MM-dd'), time: format(d, 'HH:mm') } : x) })); close(r.id); } };
}
export function AlertStack({ ctl }: { ctl: ReturnType<typeof useReminderAlerts> }) {
  if (!ctl.alerts.length) return null;
  return <div className="hud-alerts" role="alert" aria-live="assertive">{ctl.alerts.map((r) => (
    <div key={r.id} className="hud-alert"><BellRing size={18} className="flex-none" aria-hidden /><div className="min-w-0 flex-1"><p className="hud-sub">Recordatorio · {whenLabel(r.date, r.time)}</p><p className="truncate font-semibold">{r.title}</p></div>
      <button className="hud-btn !h-8 !px-3" onClick={() => ctl.done(r)}>Hecho</button><button className="hud-btn !h-8 !px-3" onClick={() => ctl.snooze(r)}>+10 min</button><button className="hud-ghost" onClick={() => ctl.close(r.id)} aria-label="Cerrar aviso"><X size={14} aria-hidden /></button></div>))}</div>;
}

/* ───────────── Próximas fechas ───────────── */
export function UpcomingPanel({ onAgenda, onTasks }: { onAgenda: () => void; onTasks: () => void }) {
  const data = usePersonal((s) => s.data); const t = todayISO(); const base = new Date();
  const items = [...data.events.filter((e) => e.date >= t).map((e) => ({ id: e.id, kind: 'evento' as const, title: e.title, date: e.date, time: e.time })), ...data.tasks.filter((x) => !x.done && x.due).map((x) => ({ id: x.id, kind: 'entrega' as const, title: x.title, date: x.due!, time: undefined as string | undefined }))].sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')));
  const label = (d: string) => { const n = differenceInCalendarDays(parseISO(d), base); return n < 0 ? `hace ${-n} d` : n === 0 ? 'hoy' : n === 1 ? 'mañana' : `en ${n} d`; };
  return (
    <Panel title="Próximas fechas" onOpen={onAgenda} grow={1.1}>
      {items.length === 0 ? <Empty text="Sin fechas a la vista. Añade exámenes en Agenda y entregas en Tareas." /> : items.slice(0, 7).map((i) => { const n = differenceInCalendarDays(parseISO(i.date), base); return (
        <button key={i.id} onClick={i.kind === 'evento' ? onAgenda : onTasks} className="hud-row w-full text-left">{i.kind === 'evento' ? <CalendarDays size={14} className="flex-none text-[var(--hud)]" aria-hidden /> : <CheckSquare size={14} className="flex-none text-muted" aria-hidden />}
          <span className="truncate">{i.title}</span><span className={`ml-auto flex-none text-xs ${n < 0 ? 'text-bad' : n <= 2 ? 'text-warn' : 'text-muted'}`}>{label(i.date)}{i.time ? ` · ${i.time}` : ''}</span></button>); })}
    </Panel>
  );
}

/* ───────────── Finanzas ───────────── */
const CATS = ['Comida', 'Transporte', 'Estudios', 'Ocio', 'Casa', 'Salud', 'Otros'];
export function monthStats(d: PData) {
  const from = format(startOfMonth(new Date()), 'yyyy-MM-dd'); const m = d.expenses.filter((e) => e.date >= from);
  const spent = m.filter((e) => !e.income).reduce((a, e) => a + e.amount, 0); const income = m.filter((e) => e.income).reduce((a, e) => a + e.amount, 0);
  const cats = new Map<string, number>(); m.filter((e) => !e.income).forEach((e) => cats.set(e.category, (cats.get(e.category) ?? 0) + e.amount));
  return { spent, income, balance: income - spent, cats: [...cats.entries()].sort((a, b) => b[1] - a[1]), pct: d.budget ? (spent / d.budget) * 100 : 0 };
}
const num = (s: string) => Number(s.replace(',', '.'));

export function Money() {
  const { data, update } = usePersonal(); const [c, setC] = useState(''); const [a, setA] = useState(''); const [cat, setCat] = useState('Ocio'); const [inc, setInc] = useState(false); const st = monthStats(data);
  return (<>
    <div className="mb-4 grid grid-cols-3 gap-2 text-center">
      <div className="hud-panel !flex-none !p-2"><p className="hud-sub">Ingresos</p><p className="hud-val">{eur(st.income)}</p></div><div className="hud-panel !flex-none !p-2"><p className="hud-sub">Gastos</p><p className="hud-val">{eur(st.spent)}</p></div><div className="hud-panel !flex-none !p-2"><p className="hud-sub">Saldo</p><p className={st.balance < 0 ? 'font-bold text-bad' : 'hud-val'}>{eur(st.balance)}</p></div>
    </div>
    <F label="Presupuesto mensual de gastos (€)" w="w-64"><input className="hud-input mb-3" inputMode="decimal" value={data.budget || ''} onChange={(e) => update((d) => ({ ...d, budget: Math.max(0, num(e.target.value) || 0) }))} /></F>
    {data.budget > 0 && <div className="mb-4"><Bar pct={st.pct} tone={st.pct > 100 ? 'bad' : st.pct > 80 ? 'warn' : undefined} /><p className="mt-1 text-xs text-muted">{eur(Math.max(0, data.budget - st.spent))} disponibles de {eur(data.budget)}</p></div>}
    <AddForm label={inc ? 'Ingreso' : 'Gasto'} onAdd={() => { const n = num(a); if (!c.trim() || !(n > 0)) return false; update((d) => ({ ...d, expenses: [{ id: uid(), concept: c.trim(), amount: n, date: todayISO(), category: inc ? 'Ingreso' : cat, income: inc || undefined }, ...d.expenses] })); setC(''); setA(''); }}>
      <F label="Tipo" w="w-32"><div className="hud-seg" role="group" aria-label="Tipo de movimiento"><button type="button" aria-pressed={!inc} onClick={() => setInc(false)}>Gasto</button><button type="button" aria-pressed={inc} onClick={() => setInc(true)}>Ingreso</button></div></F>
      <F label="Concepto"><input className="hud-input" value={c} onChange={(e) => setC(e.target.value)} placeholder={inc ? 'Beca, paga…' : 'Café, libro…'} /></F><F label="Importe (€)" w="w-28"><input className="hud-input" inputMode="decimal" value={a} onChange={(e) => setA(e.target.value)} /></F>
      {!inc && <F label="Categoría" w="w-32"><select className="hud-input" value={cat} onChange={(e) => setCat(e.target.value)}>{CATS.map((x) => <option key={x}>{x}</option>)}</select></F>}
    </AddForm>
    {st.cats.length > 0 && <div className="mb-4"><p className="hud-sub mb-2">Gasto por categoría (este mes)</p>{st.cats.slice(0, 5).map(([k, v]) => <div key={k} className="mb-1.5"><div className="mb-0.5 flex justify-between text-xs"><span>{k}</span><span className="hud-val">{eur(v)}</span></div><Bar pct={(v / st.cats[0][1]) * 100} /></div>)}</div>}
    <p className="hud-sub mb-1">Movimientos</p>
    {data.expenses.length === 0 && <Empty text="Sin movimientos todavía." />}
    {data.expenses.slice(0, 40).map((e) => <Row key={e.id} label={e.concept} onDelete={() => update((d) => ({ ...d, expenses: d.expenses.filter((x) => x.id !== e.id) }))}><span className="w-12 flex-none text-xs text-muted">{e.date.slice(5)}</span><span className="truncate">{e.concept}</span><span className="hud-sub">{e.category}</span><span className={`ml-auto flex-none ${e.income ? 'text-ok' : 'hud-val'}`}>{e.income ? '+' : '−'}{eur(e.amount)}</span></Row>)}
  </>);
}

export function FinancePanel({ onOpen }: { onOpen: () => void }) {
  const { data, update } = usePersonal(); const sound = useHud((s) => s.sound); const st = monthStats(data); const [c, setC] = useState(''); const [a, setA] = useState(''); const [inc, setInc] = useState(false);
  const add = (e: FormEvent) => { e.preventDefault(); const n = num(a); if (!c.trim() || !(n > 0)) return; update((d) => ({ ...d, expenses: [{ id: uid(), concept: c.trim(), amount: n, date: todayISO(), category: inc ? 'Ingreso' : 'Otros', income: inc || undefined }, ...d.expenses] })); setC(''); setA(''); blip('tick', sound); hudBus.emit('pulse'); };
  return (
    <Panel title="Finanzas del mes" right={<span className="hud-sub">{format(new Date(), 'MMMM', { locale: es })}</span>} onOpen={onOpen} grow={1.5}>
      <div className="flex items-end justify-between gap-2"><div><p className="hud-sub">Saldo</p><p className={`text-2xl font-bold tabular-nums ${st.balance < 0 ? 'text-bad' : 'hud-val'}`}>{eur(st.balance)}</p></div>
        <div className="text-right text-xs"><p className="text-ok"><TrendingUp size={11} className="mr-1 inline" aria-hidden />{eur(st.income)}</p><p className="text-muted"><TrendingDown size={11} className="mr-1 inline" aria-hidden />{eur(st.spent)}</p></div></div>
      {data.budget > 0 && <div className="mt-2"><Bar pct={st.pct} tone={st.pct > 100 ? 'bad' : st.pct > 80 ? 'warn' : undefined} /><p className="mt-1 text-[11px] text-muted">{Math.round(st.pct)}% del presupuesto · quedan {eur(Math.max(0, data.budget - st.spent))}</p></div>}
      <form onSubmit={add} className="my-2 flex gap-1.5"><button type="button" className="hud-icon !h-9 !w-9 flex-none text-base" onClick={() => setInc(!inc)} aria-label={inc ? 'Ingreso (pulsa para gasto)' : 'Gasto (pulsa para ingreso)'} title={inc ? 'Ingreso' : 'Gasto'}>{inc ? '+' : '−'}</button><input className="hud-input" value={c} onChange={(e) => setC(e.target.value)} placeholder="Concepto" aria-label="Concepto del movimiento" /><input className="hud-input !w-20 flex-none" inputMode="decimal" value={a} onChange={(e) => setA(e.target.value)} placeholder="€" aria-label="Importe" /><button className="hud-btn !px-3" type="submit" aria-label="Añadir movimiento" disabled={!c.trim() || !(num(a) > 0)}><Plus size={15} aria-hidden /></button></form>
      {data.expenses.length === 0 ? <Empty text="Apunta tu primer gasto o ingreso arriba." /> : data.expenses.slice(0, 4).map((e) => <div key={e.id} className="hud-row"><span className="truncate">{e.concept}</span><span className="hud-sub">{e.category}</span><span className={`ml-auto flex-none text-xs ${e.income ? 'text-ok' : ''}`}>{e.income ? '+' : '−'}{eur(e.amount)}</span></div>)}
    </Panel>
  );
}
