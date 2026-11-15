import { useEffect, useRef, useState, type FormEvent } from 'react';
import { addDays, addMonths, differenceInCalendarDays, format, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeftRight, Banknote, Bell, BellRing, Briefcase, CalendarDays, CheckSquare, ChevronLeft, ChevronRight, CreditCard, Landmark, Pencil, PiggyBank, Plus, Trash2, TrendingDown, TrendingUp, Wallet, X } from 'lucide-react';
import { uid, usePersonal, type PData, type Reminder, type Repeat, type WalletKind } from '@/store/personal';
import { Bar, Empty, F, AddForm, Row, Panel, eur, todayISO } from './shared';
import { blip, hudBus } from './fx';
import { useHud } from './themes';
import { speak } from './voice';
import { classesOn, mins } from './timetable';

type Update = (fn: (d: PData) => PData) => void;

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
      setAlerts((a) => [...a, ...fresh].slice(-4)); blip('ok', sound); { const hs = useHud.getState(); if (hs.voice) speak(fresh.length === 1 ? `Recordatorio: ${fresh[0].title}` : `Tienes ${fresh.length} recordatorios: ${fresh.map((r) => r.title).join(', ')}`, { voiceURI: hs.voiceURI, rate: hs.voiceRate }); } hudBus.emit('success'); };
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

/* ───────────── Finanzas: carpetas de dinero ───────────── */
const CATS = ['Comida', 'Transporte', 'Estudios', 'Ocio', 'Casa', 'Salud', 'Otros'];
const num = (s: string) => Number(s.replace(',', '.'));
const KINDS: { id: WalletKind; label: string; icon: typeof Wallet; color: string }[] = [
  { id: 'efectivo', label: 'Efectivo', icon: Banknote, color: '#34d399' }, { id: 'banco', label: 'Banco', icon: Landmark, color: '#22c8ff' }, { id: 'pension', label: 'Pensión', icon: Briefcase, color: '#fbbf24' },
  { id: 'ahorro', label: 'Ahorros', icon: PiggyBank, color: '#f472b6' }, { id: 'tarjeta', label: 'Tarjeta', icon: CreditCard, color: '#a78bfa' }, { id: 'otro', label: 'Otra', icon: Wallet, color: '#fb923c' },
];
const kindOf = (k: WalletKind) => KINDS.find((x) => x.id === k) ?? KINDS[5];
export const walletBalance = (d: PData, id: string) => { const w = d.wallets.find((x) => x.id === id); return (w?.opening ?? 0) + d.expenses.filter((e) => e.walletId === id).reduce((a, e) => a + (e.income ? e.amount : -e.amount), 0); };
export const totalBalance = (d: PData) => d.wallets.reduce((a, w) => a + walletBalance(d, w.id), 0);
export function monthStats(d: PData) {
  const from = format(startOfMonth(new Date()), 'yyyy-MM-dd'); const m = d.expenses.filter((e) => e.date >= from && !e.transferId);
  const spent = m.filter((e) => !e.income).reduce((a, e) => a + e.amount, 0); const income = m.filter((e) => e.income).reduce((a, e) => a + e.amount, 0);
  const cats = new Map<string, number>(); m.filter((e) => !e.income).forEach((e) => cats.set(e.category, (cats.get(e.category) ?? 0) + e.amount));
  return { spent, income, balance: income - spent, total: totalBalance(d), cats: [...cats.entries()].sort((a, b) => b[1] - a[1]), pct: d.budget ? (spent / d.budget) * 100 : 0 };
}
/** Ingresos y gastos del mes de una carpeta (los traspasos entre carpetas no cuentan) frente a sus presupuestos. */
export function walletMonth(d: PData, id: string) {
  const w = d.wallets.find((x) => x.id === id); const from = format(startOfMonth(new Date()), 'yyyy-MM-dd'); const m = d.expenses.filter((e) => e.walletId === id && e.date >= from && !e.transferId);
  const income = m.filter((e) => e.income).reduce((a, e) => a + e.amount, 0); const spent = m.filter((e) => !e.income).reduce((a, e) => a + e.amount, 0); const bIn = w?.budgetIn ?? 0; const bOut = w?.budgetOut ?? 0;
  return { income, spent, bIn, bOut, pctIn: bIn ? (income / bIn) * 100 : 0, pctOut: bOut ? (spent / bOut) * 100 : 0 };
}
const addMove = (d: PData, walletId: string, concept: string, amount: number, income: boolean, category: string): PData => ({ ...d, expenses: [{ id: uid(), concept, amount, date: todayISO(), category, income: income || undefined, walletId }, ...d.expenses] });
const transfer = (d: PData, from: string, to: string, amount: number): PData => { const t = uid(); const fn = d.wallets.find((w) => w.id === from)?.name ?? ''; const tn = d.wallets.find((w) => w.id === to)?.name ?? ''; const base = { amount, date: todayISO(), category: 'Traspaso', transferId: t };
  return { ...d, expenses: [{ id: uid(), concept: `A ${tn}`, walletId: from, ...base }, { id: uid(), concept: `De ${fn}`, walletId: to, income: true, ...base }, ...d.expenses] }; };

/** Alta rápida de carpetas: un toque en «Efectivo», «Banco», «Pensión»… */
function NewFolder({ onDone }: { onDone: (id: string) => void }) {
  const update = usePersonal((s) => s.update); const [kind, setKind] = useState<WalletKind>('banco'); const [name, setName] = useState(''); const [open, setOpen] = useState('');
  const add = () => { const k = kindOf(kind); const id = uid(); update((d) => ({ ...d, wallets: [...d.wallets, { id, name: name.trim() || k.label, kind, color: k.color, opening: Math.max(0, num(open) || 0) }] })); setName(''); setOpen(''); onDone(id); };
  return (
    <div className="hud-panel !flex-none !p-3" role="group" aria-label="Nueva carpeta de dinero">
      <p className="hud-sub mb-2">Nueva carpeta</p>
      <div className="mb-3 flex flex-wrap gap-2">{KINDS.map((k) => <button key={k.id} type="button" aria-pressed={kind === k.id} onClick={() => setKind(k.id)} className="hud-chip hover:!text-white" style={kind === k.id ? { borderColor: k.color, color: '#fff', background: `${k.color}33` } : undefined}><k.icon size={12} aria-hidden />{k.label}</button>)}</div>
      <div className="flex flex-wrap gap-2"><F label="Nombre" w="flex-1 min-w-32"><input className="hud-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={kindOf(kind).label} aria-label="Nombre de la carpeta" /></F><F label="Dinero que hay ahora (€)" w="w-44"><input className="hud-input" inputMode="decimal" value={open} onChange={(e) => setOpen(e.target.value)} placeholder="0" aria-label="Saldo inicial" /></F><button className="hud-btn self-end" onClick={add}><Plus size={14} className="mr-1 inline" aria-hidden />Crear</button></div>
    </div>
  );
}

export function Money({ sel, setSel }: { sel: string; setSel: (id: string) => void }) {
  const { data, update } = usePersonal(); const [mode, setMode] = useState<'gasto' | 'ingreso' | 'traspaso' | null>(null); const [c, setC] = useState(''); const [a, setA] = useState(''); const [cat, setCat] = useState('Ocio'); const [to, setTo] = useState(''); const [adding, setAdding] = useState(data.wallets.length === 0); const [edit, setEdit] = useState(false);
  const st = monthStats(data); const w = data.wallets.find((x) => x.id === sel); const list = data.expenses.filter((e) => sel === 'all' || e.walletId === sel); const wn = (id?: string) => data.wallets.find((x) => x.id === id);
  const others = data.wallets.filter((x) => x.id !== sel);
  const submit = () => { const n = num(a); if (!w || !(n > 0) || !mode) return; if (mode === 'traspaso') { if (!to || to === w.id) return; update((d) => transfer(d, w.id, to, n)); } else { const inc = mode === 'ingreso'; const label = c.trim() || (inc ? 'Ingreso' : cat); update((d) => addMove(d, w.id, label, n, inc, inc ? 'Ingreso' : cat)); } setC(''); setA(''); setMode(null); };
  return (<>
    <div className="mb-4 text-center"><p className="hud-sub">Todo tu dinero</p><p className={`text-4xl font-bold tabular-nums ${st.total < 0 ? 'text-bad' : 'hud-val'}`}>{eur(st.total)}</p><p className="mt-1 text-xs text-muted">Este mes: <span className="text-ok">+{eur(st.income)}</span> · <span>−{eur(st.spent)}</span></p></div>
    <div className="mb-3 grid grid-cols-2 gap-2">
      {data.wallets.map((x) => { const k = kindOf(x.kind); const b = walletBalance(data, x.id); return (
        <button key={x.id} onClick={() => { setSel(x.id); setMode(null); setEdit(false); }} aria-pressed={sel === x.id} aria-label={`Carpeta ${x.name}: ${eur(b)}`} className="wallet-card" style={{ ['--c' as string]: x.color }}>
          <k.icon size={16} aria-hidden /><span className="truncate text-sm font-semibold">{x.name}</span><b className={`tabular-nums ${b < 0 ? 'text-bad' : ''}`}>{eur(b)}</b></button>); })}
      <button onClick={() => setAdding(!adding)} aria-expanded={adding} className="wallet-card dashed"><Plus size={16} aria-hidden /><span className="text-sm">Nueva carpeta</span></button>
    </div>
    {adding && <div className="mb-4"><NewFolder onDone={(id) => { setSel(id); setAdding(false); }} /></div>}
    {data.wallets.length === 0 && <Empty text="Crea tu primera carpeta (por ejemplo «Efectivo» o tu banco) y apunta cuánto dinero hay en ella." />}
    {w && (<div className="mb-4">
      <div className="mb-2 flex items-center gap-2"><b className="flex-1 truncate">{w.name}</b><span className={`tabular-nums ${walletBalance(data, w.id) < 0 ? 'text-bad' : 'hud-val'}`}>{eur(walletBalance(data, w.id))}</span><button className="hud-ghost" onClick={() => setEdit(!edit)} aria-label="Editar carpeta"><Pencil size={14} aria-hidden /></button></div>
      {edit && (<div className="hud-panel !flex-none !p-3 mb-3"><div className="flex flex-wrap gap-2"><F label="Nombre" w="flex-1 min-w-32"><input className="hud-input" value={w.name} onChange={(e) => update((d) => ({ ...d, wallets: d.wallets.map((x) => x.id === w.id ? { ...x, name: e.target.value } : x) }))} aria-label="Renombrar carpeta" /></F>
        <F label="Saldo inicial (€)" w="w-36"><input className="hud-input" inputMode="decimal" defaultValue={w.opening} onBlur={(e) => update((d) => ({ ...d, wallets: d.wallets.map((x) => x.id === w.id ? { ...x, opening: num(e.target.value) || 0 } : x) }))} aria-label="Saldo inicial" /></F>
        <F label="Presupuesto de ingresos al mes (€)" w="w-52"><input className="hud-input" inputMode="decimal" placeholder="Sin presupuesto" defaultValue={w.budgetIn || ''} onBlur={(e) => update((d) => ({ ...d, wallets: d.wallets.map((x) => x.id === w.id ? { ...x, budgetIn: Math.max(0, num(e.target.value) || 0) || undefined } : x) }))} aria-label="Presupuesto mensual de ingresos" /></F>
        <F label="Presupuesto de gastos al mes (€)" w="w-52"><input className="hud-input" inputMode="decimal" placeholder="Sin presupuesto" defaultValue={w.budgetOut || ''} onBlur={(e) => update((d) => ({ ...d, wallets: d.wallets.map((x) => x.id === w.id ? { ...x, budgetOut: Math.max(0, num(e.target.value) || 0) || undefined } : x) }))} aria-label="Presupuesto mensual de gastos de la carpeta" /></F></div>
        <button className="hud-ghost mt-2 !text-bad" onClick={() => { if (window.confirm(`¿Eliminar la carpeta «${w.name}» y sus movimientos?`)) { update((d) => ({ ...d, wallets: d.wallets.filter((x) => x.id !== w.id), expenses: d.expenses.filter((e) => e.walletId !== w.id && !(e.transferId && d.expenses.some((o) => o.transferId === e.transferId && o.walletId === w.id))) })); setSel('all'); setEdit(false); } }}><Trash2 size={13} className="mr-1 inline" aria-hidden />Eliminar carpeta</button></div>)}
      {(() => { const m = walletMonth(data, w.id); return (
        <div className="mb-3 space-y-2" aria-label={`Este mes en ${w.name}`}>
          <div className="flex justify-between text-xs"><span className="hud-sub">Este mes</span><span><span className="text-ok">+{eur(m.income)}</span> · <span className="text-muted">−{eur(m.spent)}</span></span></div>
          {m.bIn > 0 ? <div><div className="mb-0.5 flex justify-between text-xs"><span>Ingresos previstos</span><span className="hud-val">{eur(m.income)} de {eur(m.bIn)}</span></div><Bar pct={Math.min(100, m.pctIn)} tone={m.pctIn >= 100 ? undefined : m.pctIn < 50 ? 'warn' : undefined} /><p className="mt-0.5 text-[11px] text-muted">{m.income >= m.bIn ? 'Objetivo de ingresos cumplido' : `Faltan ${eur(m.bIn - m.income)} por ingresar`}</p></div> : null}
          {m.bOut > 0 ? <div><div className="mb-0.5 flex justify-between text-xs"><span>Gastos permitidos</span><span className="hud-val">{eur(m.spent)} de {eur(m.bOut)}</span></div><Bar pct={Math.min(100, m.pctOut)} tone={m.pctOut > 100 ? 'bad' : m.pctOut > 80 ? 'warn' : undefined} /><p className="mt-0.5 text-[11px] text-muted">{m.spent > m.bOut ? `Te has pasado ${eur(m.spent - m.bOut)}` : `Quedan ${eur(m.bOut - m.spent)}`}</p></div> : null}
          {!m.bIn && !m.bOut && <button className="hud-ghost !h-auto !py-1 text-xs" onClick={() => setEdit(true)}>+ Fijar presupuesto de ingresos o gastos</button>}
        </div>); })()}
      <div className="mb-3 grid grid-cols-3 gap-2" role="group" aria-label="Acciones de la carpeta">
        <button className="hud-btn" aria-pressed={mode === 'ingreso'} onClick={() => setMode(mode === 'ingreso' ? null : 'ingreso')}><TrendingUp size={13} className="mr-1 inline" aria-hidden />Meter</button>
        <button className="hud-btn" aria-pressed={mode === 'gasto'} onClick={() => setMode(mode === 'gasto' ? null : 'gasto')}><TrendingDown size={13} className="mr-1 inline" aria-hidden />Sacar</button>
        <button className="hud-btn" disabled={others.length === 0} aria-pressed={mode === 'traspaso'} onClick={() => { setMode(mode === 'traspaso' ? null : 'traspaso'); setTo(others[0]?.id ?? ''); }}><ArrowLeftRight size={13} className="mr-1 inline" aria-hidden />Mover</button></div>
      {mode && (<form className="hud-panel !flex-none !p-3" onSubmit={(e: FormEvent) => { e.preventDefault(); submit(); }}>
        <p className="hud-sub mb-2">{mode === 'ingreso' ? `Meter dinero en ${w.name}` : mode === 'gasto' ? `Sacar dinero de ${w.name}` : `Mover dinero desde ${w.name}`}</p>
        <div className="flex flex-wrap gap-2"><F label="Importe (€)" w="w-28"><input className="hud-input" autoFocus inputMode="decimal" value={a} onChange={(e) => setA(e.target.value)} aria-label="Importe" /></F>
          {mode === 'traspaso' ? <F label="A la carpeta"><select className="hud-input" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Carpeta de destino">{others.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></F> : <>
            <F label={mode === 'ingreso' ? 'De qué (opcional)' : 'En qué (opcional)'}><input className="hud-input" value={c} onChange={(e) => setC(e.target.value)} placeholder={mode === 'ingreso' ? 'Beca, paga…' : 'Café, libro…'} aria-label="Concepto" /></F>
            {mode === 'gasto' && <F label="Categoría" w="w-32"><select className="hud-input" value={cat} onChange={(e) => setCat(e.target.value)}>{CATS.map((x) => <option key={x}>{x}</option>)}</select></F>}</>}
          <button className="hud-btn self-end" type="submit" disabled={!(num(a) > 0)}>Confirmar</button></div></form>)}
    </div>)}
    <div className="mb-3 flex gap-2" role="group" aria-label="Ver movimientos"><button className="hud-chip" aria-pressed={sel === 'all'} onClick={() => setSel('all')} style={sel === 'all' ? { color: '#fff', borderColor: 'var(--hud)' } : undefined}>Todos los movimientos</button></div>
    {st.cats.length > 0 && <div className="mb-4"><p className="hud-sub mb-2">Gasto por categoría (este mes)</p>{st.cats.slice(0, 5).map(([k, v]) => <div key={k} className="mb-1.5"><div className="mb-0.5 flex justify-between text-xs"><span>{k}</span><span className="hud-val">{eur(v)}</span></div><Bar pct={(v / st.cats[0][1]) * 100} /></div>)}</div>}
    <F label="Presupuesto mensual de gastos de todo (€)" w="w-72"><input className="hud-input mb-2" inputMode="decimal" value={data.budget || ''} onChange={(e) => update((d) => ({ ...d, budget: Math.max(0, num(e.target.value) || 0) }))} /></F>
    {data.budget > 0 && <div className="mb-4"><Bar pct={st.pct} tone={st.pct > 100 ? 'bad' : st.pct > 80 ? 'warn' : undefined} /><p className="mt-1 text-xs text-muted">{eur(Math.max(0, data.budget - st.spent))} disponibles de {eur(data.budget)}</p></div>}
    <p className="hud-sub mb-1">Movimientos{w ? ` de ${w.name}` : ''}</p>
    {list.length === 0 && <Empty text="Sin movimientos todavía." />}
    {list.slice(0, 50).map((e) => <Row key={e.id} label={e.concept} onDelete={() => update((d) => ({ ...d, expenses: d.expenses.filter((x) => x.id !== e.id && !(e.transferId && x.transferId === e.transferId)) }))}><span className="w-12 flex-none text-xs text-muted">{e.date.slice(5)}</span><span className="truncate">{e.concept}</span>{sel === 'all' && wn(e.walletId) && <span className="hud-sub">{wn(e.walletId)!.name}</span>}<span className="hud-sub">{e.transferId ? '⇄' : e.category}</span><span className={`ml-auto flex-none ${e.income ? 'text-ok' : 'hud-val'}`}>{e.income ? '+' : '−'}{eur(e.amount)}</span></Row>)}
  </>);
}

/** Panel de portada: total y carpetas de un vistazo; un toque abre la carpeta. */
export function FinancePanel({ onOpen }: { onOpen: (id?: string) => void }) {
  const { data, update } = usePersonal(); const sound = useHud((s) => s.sound); const st = monthStats(data); const [wid, setWid] = useState(''); const [c, setC] = useState(''); const [a, setA] = useState(''); const [inc, setInc] = useState(false);
  const cur = data.wallets.find((w) => w.id === wid) ?? data.wallets[0];
  const add = (e: FormEvent) => { e.preventDefault(); const n = num(a); if (!cur || !(n > 0)) return; update((d) => addMove(d, cur.id, c.trim() || (inc ? 'Ingreso' : 'Gasto'), n, inc, inc ? 'Ingreso' : 'Otros')); setC(''); setA(''); blip('tick', sound); hudBus.emit('pulse'); };
  return (
    <Panel title="Mi dinero" right={<span className="hud-sub">{data.wallets.length} {data.wallets.length === 1 ? 'carpeta' : 'carpetas'}</span>} onOpen={() => onOpen()} grow={1.5}>
      <div className="flex items-end justify-between gap-2"><div><p className="hud-sub">Total</p><p className={`text-2xl font-bold tabular-nums ${st.total < 0 ? 'text-bad' : 'hud-val'}`}>{eur(st.total)}</p></div>
        <div className="text-right text-[11px]"><p className="text-ok"><TrendingUp size={11} className="mr-1 inline" aria-hidden />{eur(st.income)}</p><p className="text-muted"><TrendingDown size={11} className="mr-1 inline" aria-hidden />{eur(st.spent)}</p></div></div>
      {data.wallets.length === 0 ? <Empty text="Crea carpetas para tu dinero: efectivo, tu banco, la pensión… Pulsa + para empezar." /> : <>
        <div className="mt-2 flex flex-wrap gap-1.5">{data.wallets.map((w) => { const k = kindOf(w.kind); const b = walletBalance(data, w.id); return (
          <button key={w.id} onClick={() => onOpen(w.id)} aria-label={`Abrir carpeta ${w.name}`} className="wallet-mini" style={{ ['--c' as string]: w.color }}><k.icon size={12} aria-hidden /><span className="truncate">{w.name}</span><b className={`tabular-nums ${b < 0 ? 'text-bad' : ''}`}>{eur(b)}</b></button>); })}</div>
        <form onSubmit={add} className="mt-2 flex gap-1.5"><select className="hud-input !w-28 flex-none" value={cur?.id} onChange={(e) => setWid(e.target.value)} aria-label="Carpeta del movimiento">{data.wallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
          <button type="button" className="hud-icon !h-9 !w-9 flex-none text-base" onClick={() => setInc(!inc)} aria-label={inc ? 'Ingreso (pulsa para gasto)' : 'Gasto (pulsa para ingreso)'} title={inc ? 'Ingreso' : 'Gasto'}>{inc ? '+' : '−'}</button>
          <input className="hud-input" value={c} onChange={(e) => setC(e.target.value)} placeholder="Concepto" aria-label="Concepto del movimiento" /><input className="hud-input !w-16 flex-none" inputMode="decimal" value={a} onChange={(e) => setA(e.target.value)} placeholder="€" aria-label="Importe" />
          <button className="hud-btn !px-3" type="submit" aria-label="Añadir movimiento" disabled={!(num(a) > 0)}><Plus size={15} aria-hidden /></button></form></>}
    </Panel>
  );
}

/* ───────────── Calendario mensual ───────────── */
const WD = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
export function dayItems(d: PData, iso: string) {
  return {
    events: d.events.filter((e) => e.date === iso).sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '')),
    tasks: d.tasks.filter((x) => x.due === iso),
    reminders: d.reminders.filter((r) => r.date === iso).sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '')),
    classes: classesOn(d, iso),
  };
}
function MonthGrid({ month, day, onDay, big }: { month: Date; day: string; onDay: (iso: string) => void; big?: boolean }) {
  const data = usePersonal((s) => s.data); const today = todayISO(); const first = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const cells = Array.from({ length: 42 }, (_, i) => addDays(first, i));
  return (
    <div role="grid" aria-label={format(month, 'MMMM yyyy', { locale: es })}>
      <div className="grid grid-cols-7 text-center text-[10px] text-muted" role="row">{WD.map((w) => <span key={w} role="columnheader">{w}</span>)}</div>
      <div className="grid grid-cols-7 gap-px">
        {cells.map((c) => {
          const iso = format(c, 'yyyy-MM-dd'); const it = dayItems(data, iso); const inM = c.getMonth() === month.getMonth(); const sel = iso === day;
          return (
            <button key={iso} role="gridcell" aria-selected={sel} aria-label={`${format(c, "EEEE d 'de' MMMM", { locale: es })}${it.events.length + it.tasks.length + it.reminders.length ? `, ${it.events.length + it.tasks.length + it.reminders.length} elementos` : ''}`} onClick={() => onDay(iso)}
              className={`cal-cell ${big ? 'big' : ''} ${inM ? '' : 'out'} ${iso === today ? 'today' : ''} ${sel ? 'sel' : ''}`}>
              <span>{c.getDate()}</span>
              <i className="cal-dots" aria-hidden>{it.events.length > 0 && <b style={{ background: 'var(--hud)' }} />}{it.tasks.length > 0 && <b style={{ background: 'var(--warn)' }} />}{it.reminders.length > 0 && <b style={{ background: 'var(--info)' }} />}</i>
            </button>);
        })}
      </div>
    </div>
  );
}
function MonthNav({ month, setMonth }: { month: Date; setMonth: (d: Date) => void }) {
  return <span className="flex items-center gap-1"><button className="hud-ghost" aria-label="Mes anterior" onClick={() => setMonth(addMonths(month, -1))}><ChevronLeft size={15} aria-hidden /></button><button className="hud-ghost min-w-24 text-center capitalize" onClick={() => setMonth(new Date())} aria-label="Ir a hoy">{format(month, 'MMMM yyyy', { locale: es })}</button><button className="hud-ghost" aria-label="Mes siguiente" onClick={() => setMonth(addMonths(month, 1))}><ChevronRight size={15} aria-hidden /></button></span>;
}
function DayList({ iso, compact, edit }: { iso: string; compact?: boolean; edit?: boolean }) {
  const { data, update } = usePersonal(); const it = dayItems(data, iso); const none = !it.events.length && !it.tasks.length && !it.reminders.length;
  return (<div>
    {none && <p className="py-1 text-xs text-muted">{it.classes.length ? `Sin eventos. ${it.classes.length} clases ese día.` : 'Nada ese día.'}</p>}
    {it.events.map((e) => <div key={e.id} className="hud-row"><CalendarDays size={13} className="flex-none text-[var(--hud)]" aria-hidden /><span className="hud-val w-16 flex-none text-xs whitespace-nowrap">{e.time ?? 'todo el día'}</span><span className="truncate">{e.title}</span>{edit && <button className="hud-ghost ml-auto" aria-label={`Eliminar ${e.title}`} onClick={() => update((d) => ({ ...d, events: d.events.filter((x) => x.id !== e.id) }))}><X size={13} aria-hidden /></button>}</div>)}
    {it.tasks.map((x) => <div key={x.id} className="hud-row"><CheckSquare size={13} className="flex-none text-warn" aria-hidden /><span className={`truncate ${x.done ? 'text-muted line-through' : ''}`}>Entrega: {x.title}</span></div>)}
    {it.reminders.map((r) => <div key={r.id} className="hud-row"><Bell size={13} className="flex-none text-info" aria-hidden /><span className="hud-val w-12 flex-none text-xs">{r.time ?? ''}</span><span className={`truncate ${r.done ? 'text-muted line-through' : ''}`}>{r.title}</span></div>)}
    {!compact && it.classes.length > 0 && <div className="mt-2"><p className="hud-sub mb-1">Clases</p>{it.classes.map((s) => <div key={s.key} className="hud-row"><i className="h-4 w-1 rounded" style={{ background: s.color }} /><span className="hud-val w-24 text-xs">{s.start}–{s.end}</span><span>{s.title}</span></div>)}</div>}
  </div>);
}

/** Módulo Agenda: calendario del mes + alta de eventos en el día elegido. */
export function AgendaCal({ day, setDay }: { day: string; setDay: (d: string) => void }) {
  const { data, update } = usePersonal(); const [month, setMonth] = useState(parseISO(day)); const [title, setTitle] = useState(''); const [time, setTime] = useState('');
  const pick = (iso: string) => { setDay(iso); const d = parseISO(iso); if (d.getMonth() !== month.getMonth()) setMonth(d); };
  const upcoming = [...data.events].filter((e) => e.date >= todayISO()).sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')));
  return (<>
    <div className="mb-3 flex items-center justify-between"><MonthNav month={month} setMonth={setMonth} /><span className="flex gap-3 text-[10px] text-muted"><span><b className="cal-leg" style={{ background: 'var(--hud)' }} />evento</span><span><b className="cal-leg" style={{ background: 'var(--warn)' }} />entrega</span><span><b className="cal-leg" style={{ background: 'var(--info)' }} />recordatorio</span></span></div>
    <MonthGrid month={month} day={day} onDay={pick} big />
    <h3 className="hud-sub mt-4 mb-1 capitalize">{format(parseISO(day), "EEEE d 'de' MMMM", { locale: es })}</h3>
    <DayList iso={day} edit />
    <AddForm label="Añadir al día" onAdd={() => { if (!title.trim()) return false; update((d) => ({ ...d, events: [...d.events, { id: uid(), title: title.trim(), date: day, time: time || undefined }] })); setTitle(''); }}>
      <F label="Evento o examen" w="w-full"><input className="hud-input mt-0" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Examen de cálculo" /></F>
      <F label="Día"><input className="hud-input" type="date" value={day} onChange={(e) => e.target.value && pick(e.target.value)} /></F><F label="Hora" w="w-28"><input className="hud-input" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></F>
    </AddForm>
    {upcoming.length > 0 && <><h3 className="hud-sub mb-1">Próximos eventos</h3>{upcoming.slice(0, 12).map((e) => <button key={e.id} className="hud-row w-full text-left" onClick={() => pick(e.date)}><span className="hud-val w-28 flex-none text-xs">{format(parseISO(e.date), 'EEE d MMM', { locale: es })}{e.time && ` ${e.time}`}</span><span className="truncate">{e.title}</span></button>)}</>}
  </>);
}

/** Panel de portada: mes con puntos por día, y lo del día elegido debajo. */
export function CalendarPanel({ day, setDay, onOpen }: { day: string; setDay: (d: string) => void; onOpen: () => void }) {
  const events = usePersonal((s) => s.data.events); const [month, setMonth] = useState(new Date());
  const next = events.filter((e) => e.date >= todayISO()).sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')))[0];
  const nd = next ? differenceInCalendarDays(parseISO(next.date), new Date()) : 0;
  return (
    <Panel title="Calendario" right={<MonthNav month={month} setMonth={setMonth} />} onOpen={onOpen} grow={1.9}>
      <MonthGrid month={month} day={day} onDay={(iso) => { setDay(iso); if (parseISO(iso).getMonth() !== month.getMonth()) setMonth(parseISO(iso)); }} />
      {next && <p className="mt-1 mb-1 truncate text-[11px] text-muted">Próximo: <b className="text-fg">{next.title}</b> · <span className={nd <= 2 ? 'text-warn' : ''}>{nd === 0 ? 'hoy' : nd === 1 ? 'mañana' : `en ${nd} d`}</span></p>}
      <h3 className="hud-sub mt-1 capitalize">{format(parseISO(day), "EEEE d 'de' MMM", { locale: es })}</h3><DayList iso={day} compact />
    </Panel>
  );
}
