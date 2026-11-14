import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { addDays, format, parseISO, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarDays, CheckSquare, Flame, GraduationCap, Loader2, LogOut, NotebookPen, Plus, Send, Target, Timer, Trash2, Wallet, X } from 'lucide-react';
import { Drawer } from '@/components/ui/Overlay';
import { PROFILES, uid, usePersonal, type Profile, type PData } from '@/store/personal';
import { personalApi } from '@/services/personalApi';
import './hud.css';

const todayISO = () => format(new Date(), 'yyyy-MM-dd');
const COLORS = ['#22c8ff', '#a78bfa', '#34d399', '#fbbf24', '#f472b6', '#fb923c'];
const eur = (n: number) => `${n.toLocaleString('es-ES', { maximumFractionDigits: 2 })} €`;
const gradeAvg = (d: PData, id: string) => { const g = d.grades.filter((x) => x.subjectId === id); const w = g.reduce((a, x) => a + x.weight, 0); return w ? g.reduce((a, x) => a + x.score * x.weight, 0) / w : null; };
const streak = (log: string[]) => { let n = 0; let d = new Date(); if (!log.includes(format(d, 'yyyy-MM-dd'))) d = addDays(d, -1); while (log.includes(format(d, 'yyyy-MM-dd'))) { n++; d = addDays(d, -1); } return n; };

function Bar({ pct, tone }: { pct: number; tone?: 'warn' | 'bad' }) { return <div className={`hud-bar ${tone ?? ''}`} role="progressbar" aria-label="Progreso" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} /></div>; }
function Panel({ title, right, children, className = '' }: { title: string; right?: ReactNode; children: ReactNode; className?: string }) { return <section className={`hud-panel ${className}`}><h2 className="hud-h"><span>{title}</span>{right}</h2>{children}</section>; }
const Empty = ({ text }: { text: string }) => <p className="py-3 text-xs text-muted">{text}</p>;

/* ───────────── Selector de perfil ───────────── */
function Choose() {
  const { choose, logout } = usePersonal(); const [busy, setBusy] = useState<Profile | null>(null); const [err, setErr] = useState('');
  const go = async (p: Profile) => { setBusy(p); setErr(''); try { await choose(p); } catch (e) { setErr((e as Error).message); setBusy(null); } };
  return (
    <main className="hud-root grid min-h-screen place-items-center p-6">
      <div className="relative z-10 text-center">
        <h1 className="hud-title text-5xl">JARVIS</h1><p className="hud-sub mt-2">Just a rather very intelligent system</p>
        <p className="mt-10 mb-5 text-sm text-muted">Identifícate para abrir tu sistema personal</p>
        <div className="flex flex-wrap justify-center gap-6">
          {(Object.keys(PROFILES) as Profile[]).map((p) => (
            <button key={p} className="profile-card" disabled={!!busy} onClick={() => void go(p)} aria-label={`Entrar como ${PROFILES[p].name}`}>
              <span className="hud-sub block">{PROFILES[p].tag}</span><span className="hud-title mt-3 block text-3xl">{PROFILES[p].name.toUpperCase()}</span>
              <span className="mt-4 block text-xs text-muted">{busy === p ? 'Cargando sistemas…' : 'Abrir mi JARVIS'}</span>
            </button>))}
        </div>
        {err && <p role="alert" className="mt-5 text-sm text-bad">{err}</p>}
        <button className="hud-ghost mt-10" onClick={() => void logout()}>Cerrar sesión</button>
      </div>
    </main>
  );
}

/* ───────────── Reactor ───────────── */
function Reactor({ children }: { children: ReactNode }) {
  const ticks = Array.from({ length: 60 }, (_, i) => i);
  return (
    <div className="reactor" aria-hidden={false}>
      <svg viewBox="0 0 400 400" aria-hidden>
        <defs><radialGradient id="core" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#fff" /><stop offset=".25" stopColor="#bff0ff" /><stop offset=".6" stopColor="#22c8ff" stopOpacity=".7" /><stop offset="1" stopColor="#22c8ff" stopOpacity="0" /></radialGradient></defs>
        <g className="r-spin-c" stroke="#22c8ff" strokeOpacity=".7">{ticks.map((i) => <line key={i} x1="200" y1="8" x2="200" y2={i % 5 === 0 ? 24 : 16} transform={`rotate(${i * 6} 200 200)`} strokeWidth={i % 5 === 0 ? 2 : 1} />)}</g>
        <circle cx="200" cy="200" r="170" fill="none" stroke="#22c8ff" strokeOpacity=".35" strokeWidth="1" />
        <g className="r-spin-a"><circle cx="200" cy="200" r="150" fill="none" stroke="#22c8ff" strokeWidth="5" strokeDasharray="90 30 40 30" strokeOpacity=".85" /><circle cx="200" cy="200" r="138" fill="none" stroke="#3b82f6" strokeWidth="2" strokeDasharray="3 9" /></g>
        <g className="r-spin-b"><circle cx="200" cy="200" r="120" fill="none" stroke="#22c8ff" strokeWidth="10" strokeDasharray="38 12" strokeOpacity=".55" /></g>
        <circle cx="200" cy="200" r="98" fill="#041426" stroke="#22c8ff" strokeWidth="2" />
        <g className="r-core"><circle cx="200" cy="200" r="86" fill="url(#core)" /><circle cx="200" cy="200" r="66" fill="none" stroke="#bff0ff" strokeOpacity=".5" /></g>
        <circle cx="200" cy="200" r="72" fill="#031020" fillOpacity=".9" />
      </svg>
      <div className="reactor-center"><div className="max-w-[34%]">{children}</div></div>
    </div>
  );
}

/* ───────────── Módulos (cajón lateral) ───────────── */
type Mod = 'tasks' | 'agenda' | 'subjects' | 'habits' | 'study' | 'notes' | 'money' | 'goals';
const MODS: { id: Mod; label: string; icon: typeof CheckSquare }[] = [
  { id: 'tasks', label: 'Tareas', icon: CheckSquare }, { id: 'agenda', label: 'Agenda', icon: CalendarDays }, { id: 'subjects', label: 'Notas', icon: GraduationCap },
  { id: 'habits', label: 'Hábitos', icon: Flame }, { id: 'study', label: 'Estudio', icon: Timer }, { id: 'notes', label: 'Apuntes', icon: NotebookPen },
  { id: 'money', label: 'Gastos', icon: Wallet }, { id: 'goals', label: 'Objetivos', icon: Target },
];
const Row = ({ children, onDelete, label }: { children: ReactNode; onDelete: () => void; label: string }) => <div className="hud-row">{children}<button onClick={onDelete} className="hud-ghost ml-auto" aria-label={`Eliminar ${label}`}><Trash2 size={14} aria-hidden /></button></div>;
function AddForm({ onAdd, children, label = 'Añadir' }: { onAdd: () => boolean | void; children: ReactNode; label?: string }) {
  return <form onSubmit={(e: FormEvent) => { e.preventDefault(); onAdd(); }} className="mb-4 flex flex-wrap items-end gap-2">{children}<button className="hud-btn" type="submit"><Plus size={14} className="mr-1 inline" aria-hidden />{label}</button></form>;
}
const F = ({ label, children, w = 'flex-1 min-w-32' }: { label: string; children: ReactNode; w?: string }) => <label className={`block ${w}`}><span className="hud-sub mb-1 block">{label}</span>{children}</label>;

function Tasks() {
  const { data, update } = usePersonal(); const [title, setTitle] = useState(''); const [due, setDue] = useState(''); const [subj, setSubj] = useState(''); const [pr, setPr] = useState<'alta' | 'media' | 'baja'>('media');
  const sorted = [...data.tasks].sort((a, b) => Number(a.done) - Number(b.done) || (a.due ?? '9').localeCompare(b.due ?? '9'));
  return (<>
    <AddForm onAdd={() => { if (!title.trim()) return; update((d) => ({ ...d, tasks: [...d.tasks, { id: uid(), title: title.trim(), due: due || undefined, subjectId: subj || undefined, priority: pr, done: false }] })); setTitle(''); setDue(''); }}>
      <F label="Tarea" w="w-full"><input className="hud-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Entregar práctica de física…" /></F>
      <F label="Fecha límite"><input className="hud-input" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></F>
      <F label="Asignatura"><select className="hud-input" value={subj} onChange={(e) => setSubj(e.target.value)}><option value="">—</option>{data.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></F>
      <F label="Prioridad" w="w-28"><select className="hud-input" value={pr} onChange={(e) => setPr(e.target.value as typeof pr)}><option>alta</option><option>media</option><option>baja</option></select></F>
    </AddForm>
    {sorted.length === 0 && <Empty text="Sin tareas. Añade la primera arriba." />}
    {sorted.map((t) => <Row key={t.id} label={t.title} onDelete={() => update((d) => ({ ...d, tasks: d.tasks.filter((x) => x.id !== t.id) }))}>
      <input type="checkbox" className="hud-check" checked={t.done} onChange={() => update((d) => ({ ...d, tasks: d.tasks.map((x) => x.id === t.id ? { ...x, done: !x.done } : x) }))} aria-label={`Completar ${t.title}`} />
      <span className={t.done ? 'text-muted line-through' : ''}>{t.title}</span>
      <span className="hud-sub">{data.subjects.find((s) => s.id === t.subjectId)?.name}</span>
      {t.due && <span className={`ml-2 text-xs ${!t.done && t.due < todayISO() ? 'text-bad' : 'text-muted'}`}>{format(parseISO(t.due), 'd MMM', { locale: es })}</span>}
      <span className={`text-[10px] uppercase ${t.priority === 'alta' ? 'text-bad' : 'text-muted'}`}>{t.priority}</span></Row>)}
  </>);
}
function Agenda() {
  const { data, update } = usePersonal(); const [title, setTitle] = useState(''); const [date, setDate] = useState(todayISO()); const [time, setTime] = useState('');
  const list = [...data.events].sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')));
  return (<>
    <AddForm onAdd={() => { if (!title.trim()) return; update((d) => ({ ...d, events: [...d.events, { id: uid(), title: title.trim(), date, time: time || undefined }] })); setTitle(''); }}>
      <F label="Evento" w="w-full"><input className="hud-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Examen de cálculo" /></F>
      <F label="Día"><input className="hud-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></F><F label="Hora" w="w-32"><input className="hud-input" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></F>
    </AddForm>
    {list.length === 0 && <Empty text="Agenda vacía." />}
    {list.map((e) => <Row key={e.id} label={e.title} onDelete={() => update((d) => ({ ...d, events: d.events.filter((x) => x.id !== e.id) }))}><span className={`w-28 text-xs ${e.date < todayISO() ? 'text-muted' : 'hud-val'}`}>{format(parseISO(e.date), 'EEE d MMM', { locale: es })}{e.time && ` · ${e.time}`}</span><span>{e.title}</span></Row>)}
  </>);
}
function Subjects() {
  const { data, update } = usePersonal(); const [name, setName] = useState(''); const [sid, setSid] = useState(''); const [t, setT] = useState(''); const [score, setScore] = useState(''); const [w, setW] = useState('1');
  return (<>
    <AddForm label="Asignatura" onAdd={() => { if (!name.trim()) return; update((d) => ({ ...d, subjects: [...d.subjects, { id: uid(), name: name.trim(), color: COLORS[d.subjects.length % COLORS.length] }] })); setName(''); }}>
      <F label="Nueva asignatura" w="w-full"><input className="hud-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Cálculo I" /></F></AddForm>
    <AddForm label="Nota" onAdd={() => { const n = Number(score.replace(',', '.')); if (!sid || !t.trim() || Number.isNaN(n) || n < 0 || n > 10) return; update((d) => ({ ...d, grades: [...d.grades, { id: uid(), subjectId: sid, title: t.trim(), score: n, weight: Math.max(0.1, Number(w) || 1), date: todayISO() }] })); setT(''); setScore(''); }}>
      <F label="Asignatura"><select className="hud-input" value={sid} onChange={(e) => setSid(e.target.value)}><option value="">—</option>{data.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></F>
      <F label="Examen / trabajo"><input className="hud-input" value={t} onChange={(e) => setT(e.target.value)} placeholder="Parcial 1" /></F>
      <F label="Nota (0-10)" w="w-24"><input className="hud-input" inputMode="decimal" value={score} onChange={(e) => setScore(e.target.value)} /></F><F label="Peso" w="w-20"><input className="hud-input" inputMode="decimal" value={w} onChange={(e) => setW(e.target.value)} /></F>
    </AddForm>
    {data.subjects.length === 0 && <Empty text="Añade tus asignaturas para llevar la media ponderada." />}
    {data.subjects.map((s) => { const a = gradeAvg(data, s.id); return (
      <div key={s.id} className="mb-3"><Row label={s.name} onDelete={() => update((d) => ({ ...d, subjects: d.subjects.filter((x) => x.id !== s.id), grades: d.grades.filter((g) => g.subjectId !== s.id) }))}><span style={{ color: s.color }}>●</span><b>{s.name}</b><span className="hud-val ml-3">{a === null ? '—' : a.toFixed(2)}</span></Row>
        {data.grades.filter((g) => g.subjectId === s.id).map((g) => <div key={g.id} className="flex items-center gap-2 pl-6 text-xs text-muted"><span>{g.title}</span><span className="hud-val">{g.score}</span><span>×{g.weight}</span><button className="hud-ghost ml-auto" aria-label={`Eliminar nota ${g.title}`} onClick={() => update((d) => ({ ...d, grades: d.grades.filter((x) => x.id !== g.id) }))}><X size={12} aria-hidden /></button></div>)}</div>); })}
  </>);
}
function Habits() {
  const { data, update } = usePersonal(); const [name, setName] = useState(''); const t = todayISO();
  return (<>
    <AddForm onAdd={() => { if (!name.trim()) return; update((d) => ({ ...d, habits: [...d.habits, { id: uid(), name: name.trim(), log: [] }] })); setName(''); }}><F label="Nuevo hábito" w="w-full"><input className="hud-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Leer 20 minutos" /></F></AddForm>
    {data.habits.length === 0 && <Empty text="Sin hábitos todavía." />}
    {data.habits.map((h) => <Row key={h.id} label={h.name} onDelete={() => update((d) => ({ ...d, habits: d.habits.filter((x) => x.id !== h.id) }))}>
      <input type="checkbox" className="hud-check" checked={h.log.includes(t)} aria-label={`Hoy: ${h.name}`} onChange={() => update((d) => ({ ...d, habits: d.habits.map((x) => x.id === h.id ? { ...x, log: x.log.includes(t) ? x.log.filter((l) => l !== t) : [...x.log, t] } : x) }))} />
      <span>{h.name}</span><span className="hud-val ml-auto text-xs"><Flame size={12} className="mr-1 inline" aria-hidden />{streak(h.log)} días</span></Row>)}
  </>);
}
function StudyPanel({ timer }: { timer: Timer }) {
  const { data } = usePersonal(); const week = data.study.filter((s) => s.date >= format(addDays(new Date(), -6), 'yyyy-MM-dd')); const mm = String(Math.floor(timer.left / 60)).padStart(2, '0'); const ss = String(timer.left % 60).padStart(2, '0');
  return (<>
    <div className="mb-5 text-center"><p className="hud-title text-5xl" aria-live="off">{mm}:{ss}</p>
      <div className="mt-3 flex flex-wrap justify-center gap-2"><select className="hud-input w-48" value={timer.subjectId} onChange={(e) => timer.setSubjectId(e.target.value)} aria-label="Asignatura de la sesión"><option value="">Sin asignatura</option>{data.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <select className="hud-input w-28" value={timer.total} disabled={timer.running} onChange={(e) => timer.setTotal(Number(e.target.value))} aria-label="Duración"><option value={25}>25 min</option><option value={45}>45 min</option><option value={50}>50 min</option><option value={5}>5 min</option></select>
        <button className="hud-btn" onClick={timer.toggle}>{timer.running ? 'Pausar' : 'Iniciar'}</button><button className="hud-btn" onClick={timer.reset}>Reiniciar</button></div></div>
    <p className="hud-sub mb-2">Últimos 7 días · {week.reduce((a, s) => a + s.minutes, 0)} min</p>
    {data.subjects.map((s) => { const m = week.filter((x) => x.subjectId === s.id).reduce((a, x) => a + x.minutes, 0); return <div key={s.id} className="mb-2"><div className="mb-1 flex justify-between text-xs"><span>{s.name}</span><span className="hud-val">{m} min</span></div><Bar pct={Math.min(100, m / 3)} /></div>; })}
  </>);
}
function Notes() {
  const { data, update } = usePersonal(); const [title, setTitle] = useState(''); const [body, setBody] = useState('');
  return (<>
    <AddForm onAdd={() => { if (!title.trim()) return; update((d) => ({ ...d, notes: [{ id: uid(), title: title.trim(), body, updated: todayISO() }, ...d.notes] })); setTitle(''); setBody(''); }}>
      <F label="Título" w="w-full"><input className="hud-input" value={title} onChange={(e) => setTitle(e.target.value)} /></F><F label="Apunte" w="w-full"><textarea className="hud-input h-24 py-2" value={body} onChange={(e) => setBody(e.target.value)} /></F></AddForm>
    {data.notes.length === 0 && <Empty text="Sin apuntes." />}
    {data.notes.map((n) => <div key={n.id} className="mb-3 border-l-2 border-line-strong pl-3"><Row label={n.title} onDelete={() => update((d) => ({ ...d, notes: d.notes.filter((x) => x.id !== n.id) }))}><b>{n.title}</b><span className="hud-sub">{n.updated}</span></Row><p className="whitespace-pre-wrap text-sm text-muted">{n.body}</p></div>)}
  </>);
}
const monthSpend = (d: PData) => d.expenses.filter((e) => e.date >= format(startOfMonth(new Date()), 'yyyy-MM-dd')).reduce((a, e) => a + e.amount, 0);
function Money() {
  const { data, update } = usePersonal(); const [c, setC] = useState(''); const [a, setA] = useState(''); const [cat, setCat] = useState('Ocio');
  return (<>
    <F label="Presupuesto mensual (€)" w="w-48"><input className="hud-input mb-4" inputMode="decimal" value={data.budget || ''} onChange={(e) => update((d) => ({ ...d, budget: Math.max(0, Number(e.target.value.replace(',', '.')) || 0) }))} /></F>
    <AddForm onAdd={() => { const n = Number(a.replace(',', '.')); if (!c.trim() || !(n > 0)) return; update((d) => ({ ...d, expenses: [{ id: uid(), concept: c.trim(), amount: n, date: todayISO(), category: cat }, ...d.expenses] })); setC(''); setA(''); }}>
      <F label="Concepto"><input className="hud-input" value={c} onChange={(e) => setC(e.target.value)} /></F><F label="Importe (€)" w="w-28"><input className="hud-input" inputMode="decimal" value={a} onChange={(e) => setA(e.target.value)} /></F>
      <F label="Categoría" w="w-32"><select className="hud-input" value={cat} onChange={(e) => setCat(e.target.value)}>{['Comida', 'Transporte', 'Estudios', 'Ocio', 'Casa', 'Otros'].map((x) => <option key={x}>{x}</option>)}</select></F></AddForm>
    <p className="mb-2 text-sm">Este mes: <b className="hud-val">{eur(monthSpend(data))}</b>{data.budget > 0 && <> de {eur(data.budget)}</>}</p>
    {data.expenses.slice(0, 40).map((e) => <Row key={e.id} label={e.concept} onDelete={() => update((d) => ({ ...d, expenses: d.expenses.filter((x) => x.id !== e.id) }))}><span className="w-20 text-xs text-muted">{e.date.slice(5)}</span><span>{e.concept}</span><span className="hud-sub">{e.category}</span><span className="hud-val ml-auto">{eur(e.amount)}</span></Row>)}
  </>);
}
function Goals() {
  const { data, update } = usePersonal(); const [t, setT] = useState(''); const [due, setDue] = useState('');
  return (<>
    <AddForm onAdd={() => { if (!t.trim()) return; update((d) => ({ ...d, goals: [...d.goals, { id: uid(), title: t.trim(), progress: 0, due: due || undefined }] })); setT(''); }}><F label="Objetivo" w="w-full"><input className="hud-input" value={t} onChange={(e) => setT(e.target.value)} placeholder="Aprobar el curso con media de 8" /></F><F label="Para el"><input className="hud-input" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></F></AddForm>
    {data.goals.length === 0 && <Empty text="Sin objetivos." />}
    {data.goals.map((g) => <div key={g.id} className="mb-3"><Row label={g.title} onDelete={() => update((d) => ({ ...d, goals: d.goals.filter((x) => x.id !== g.id) }))}><b>{g.title}</b>{g.due && <span className="hud-sub">{g.due}</span>}<span className="hud-val ml-auto">{g.progress}%</span></Row>
      <input type="range" min={0} max={100} step={5} value={g.progress} aria-label={`Progreso de ${g.title}`} className="w-full accent-[var(--hud)]" onChange={(e) => update((d) => ({ ...d, goals: d.goals.map((x) => x.id === g.id ? { ...x, progress: Number(e.target.value) } : x) }))} /></div>)}
  </>);
}

/* ───────────── Temporizador de estudio (vive en el HUD, no en el cajón) ───────────── */
interface Timer { left: number; total: number; running: boolean; subjectId: string; setSubjectId: (s: string) => void; setTotal: (m: number) => void; toggle: () => void; reset: () => void }
function useTimer(): Timer {
  const update = usePersonal((s) => s.update); const [total, setTotal] = useState(25); const [left, setLeft] = useState(25 * 60); const [running, setRunning] = useState(false); const [subjectId, setSubjectId] = useState('');
  const ref = useRef({ total, subjectId }); ref.current = { total, subjectId };
  useEffect(() => { if (!running) return; const id = setInterval(() => setLeft((l) => l - 1), 1000); return () => clearInterval(id); }, [running]);
  useEffect(() => { if (left > 0 || !running) return; setRunning(false); update((d) => ({ ...d, study: [...d.study, { id: uid(), subjectId: ref.current.subjectId || undefined, minutes: ref.current.total, date: todayISO() }] })); setLeft(ref.current.total * 60); }, [left, running, update]);
  return { left, total, running, subjectId, setSubjectId, setTotal: (m) => { setTotal(m); setLeft(m * 60); }, toggle: () => setRunning((r) => !r), reset: () => { setRunning(false); setLeft(total * 60); } };
}

/* ───────────── HUD ───────────── */
function Hud() {
  const { data, update, profile, logout, sync, status } = usePersonal(); const timer = useTimer(); const [open, setOpen] = useState<Mod | null>(null); const [now, setNow] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);
  const t = todayISO(); const pending = data.tasks.filter((x) => !x.done); const doneToday = data.tasks.filter((x) => x.done).length; const taskPct = data.tasks.length ? (doneToday / data.tasks.length) * 100 : 0;
  const upcoming = data.events.filter((e) => e.date >= t).sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? ''))).slice(0, 5);
  const spend = monthSpend(data); const spendPct = data.budget ? (spend / data.budget) * 100 : 0; const hour = now.getHours();
  const greet = hour < 6 ? 'Buenas noches' : hour < 13 ? 'Buenos días' : hour < 21 ? 'Buenas tardes' : 'Buenas noches';
  const studyToday = data.study.filter((s) => s.date === t).reduce((a, s) => a + s.minutes, 0);
  const name = profile ? PROFILES[profile].name : '';
  const syncLabel = { ok: 'Todo guardado', saving: 'Guardando…', error: 'Sin conexión', conflict: 'Datos cambiados en otro dispositivo' }[sync];
  const ModBody = { tasks: <Tasks />, agenda: <Agenda />, subjects: <Subjects />, habits: <Habits />, study: <StudyPanel timer={timer} />, notes: <Notes />, money: <Money />, goals: <Goals /> };
  return (
    <div className="hud-root">
      <header className="relative z-10 flex flex-wrap items-start justify-between gap-3 px-5 pt-4">
        <div className="hud-sub">Perfil · <b className="text-fg">{name}</b><br />{format(now, "EEEE d 'de' MMMM", { locale: es })}</div>
        <div className="text-center"><h1 className="hud-title text-4xl">JARVIS</h1><p className="hud-sub">Just a rather very intelligent system</p></div>
        <div className="flex items-center gap-3 text-right"><div className="hud-sub"><span className="hud-val text-lg">{format(now, 'HH:mm:ss')}</span><br /><span className={sync === 'ok' ? '' : 'text-warn'} role="status">{syncLabel}</span></div>
          <button className="hud-ghost" onClick={() => void logout()} aria-label="Cerrar sesión"><LogOut size={18} aria-hidden /></button></div>
      </header>
      {sync === 'conflict' && <p role="alert" className="relative z-10 mx-5 mt-2 rounded border border-warn px-3 py-2 text-sm text-warn">Estos datos se modificaron desde otro dispositivo. Recarga la página para no perder cambios.</p>}
      <main className="relative z-10 grid gap-4 p-5 lg:grid-cols-[1fr_minmax(380px,1.15fr)_1fr]">
        <div className="space-y-4">
          <Panel title="Misiones de hoy" right={<span className="hud-val">{Math.round(taskPct)}%</span>}>
            <Bar pct={taskPct} />
            {pending.length === 0 ? <Empty text={data.tasks.length ? 'Todo completado. Buen trabajo.' : 'Aún no hay tareas.'} /> : pending.sort((a, b) => (a.due ?? '9').localeCompare(b.due ?? '9')).slice(0, 5).map((x) => (
              <div key={x.id} className="hud-row"><input type="checkbox" className="hud-check" aria-label={`Completar ${x.title}`} checked={false} onChange={() => update((d) => ({ ...d, tasks: d.tasks.map((y) => y.id === x.id ? { ...y, done: true } : y) }))} /><span className="truncate">{x.title}</span>{x.due && <span className={`ml-auto text-xs ${x.due < t ? 'text-bad' : 'text-muted'}`}>{x.due.slice(5)}</span>}</div>))}
          </Panel>
          <Panel title="Hábitos" right={<span className="hud-sub">{data.habits.filter((h) => h.log.includes(t)).length}/{data.habits.length} hoy</span>}>
            {data.habits.length === 0 ? <Empty text="Crea hábitos en el módulo Hábitos." /> : data.habits.slice(0, 5).map((h) => <div key={h.id} className="mb-2"><div className="mb-1 flex justify-between text-xs"><span>{h.name}</span><span className="hud-val">{streak(h.log)} d</span></div><Bar pct={Math.min(100, streak(h.log) * (100 / 7))} /></div>)}
          </Panel>
          <Panel title="Estudio" right={<span className="hud-val">{studyToday} min hoy</span>}>
            <p className="text-xs text-muted">Temporizador: <span className={timer.running ? 'hud-val' : ''}>{String(Math.floor(timer.left / 60)).padStart(2, '0')}:{String(timer.left % 60).padStart(2, '0')}</span> {timer.running ? '· en marcha' : ''}</p>
            <button className="hud-btn mt-2 w-full" onClick={() => setOpen('study')}>Abrir sesión de estudio</button>
          </Panel>
        </div>
        <div className="space-y-4">
          <Reactor><p className="hud-sub">{greet}</p><p className="hud-title text-xl">{name.toUpperCase()}</p><p className="mt-1 text-[10px] leading-tight text-muted">{pending.length} misiones<br />{upcoming.length} citas</p></Reactor>
          <Chat profile={name} />
          <div className="hud-panel text-center"><p className="hud-sub">System status</p><p className="hud-title mt-1 text-lg">ALL SYSTEMS OPERATIONAL</p><div className="mt-3"><Bar pct={status === 'ready' ? 100 : 30} /></div></div>
        </div>
        <div className="space-y-4">
          <Panel title="Agenda"><>{upcoming.length === 0 ? <Empty text="Nada próximo en la agenda." /> : upcoming.map((e) => <div key={e.id} className="hud-row"><span className="hud-val w-24 text-xs">{e.date === t ? 'Hoy' : format(parseISO(e.date), 'EEE d MMM', { locale: es })}{e.time && ` ${e.time}`}</span><span className="truncate">{e.title}</span></div>)}</></Panel>
          <Panel title="Rendimiento académico">{data.subjects.length === 0 ? <Empty text="Añade asignaturas y notas." /> : data.subjects.map((s) => { const a = gradeAvg(data, s.id); return <div key={s.id} className="mb-2"><div className="mb-1 flex justify-between text-xs"><span>{s.name}</span><span className="hud-val">{a === null ? '—' : a.toFixed(1)}</span></div><Bar pct={(a ?? 0) * 10} tone={a !== null && a < 5 ? 'bad' : a !== null && a < 6 ? 'warn' : undefined} /></div>; })}</Panel>
          <Panel title="Finanzas del mes" right={<span className="hud-val">{eur(spend)}</span>}>{data.budget ? <><Bar pct={spendPct} tone={spendPct > 100 ? 'bad' : spendPct > 80 ? 'warn' : undefined} /><p className="mt-1 text-xs text-muted">{eur(Math.max(0, data.budget - spend))} disponibles de {eur(data.budget)}</p></> : <Empty text="Define un presupuesto en Gastos." />}</Panel>
          <Panel title="Objetivos">{data.goals.length === 0 ? <Empty text="Sin objetivos." /> : data.goals.slice(0, 4).map((g) => <div key={g.id} className="mb-2"><div className="mb-1 flex justify-between text-xs"><span>{g.title}</span><span className="hud-val">{g.progress}%</span></div><Bar pct={g.progress} /></div>)}</Panel>
        </div>
      </main>
      <nav className="hud-dock relative z-10 px-5 pb-8" aria-label="Módulos">{MODS.map((m) => <button key={m.id} onClick={() => setOpen(m.id)}><m.icon size={20} aria-hidden />{m.label}</button>)}</nav>
      <Drawer open={open !== null} onClose={() => setOpen(null)} label={open ? MODS.find((m) => m.id === open)?.label ?? '' : ''} className="w-full max-w-xl">
        <div className="hud-root h-full overflow-y-auto p-5"><h2 className="hud-title mb-4 text-xl">{open ? MODS.find((m) => m.id === open)?.label.toUpperCase() : ''}</h2>{open && ModBody[open]}</div>
      </Drawer>
    </div>
  );
}

/* ───────────── Chat con JARVIS ───────────── */
function Chat({ profile }: { profile: string }) {
  const [msgs, setMsgs] = useState<{ role: 'user' | 'ai'; text: string }[]>([]); const [q, setQ] = useState(''); const [busy, setBusy] = useState(false); const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [msgs]);
  const send = async (e: FormEvent) => {
    e.preventDefault(); const text = q.trim(); if (!text || busy) return; setQ(''); const hist = msgs.slice(-8); setMsgs((m) => [...m, { role: 'user', text }]); setBusy(true);
    try { const r = await personalApi.ask(text, hist); setMsgs((m) => [...m, { role: 'ai', text: r.text }]); } catch (err) { setMsgs((m) => [...m, { role: 'ai', text: (err as Error).message }]); } finally { setBusy(false); }
  };
  return (
    <section className="hud-panel" aria-label="Conversación con JARVIS">
      <h2 className="hud-h"><span>Consulta a JARVIS</span></h2>
      <div className="mb-3 max-h-52 min-h-16 space-y-2 overflow-y-auto text-sm" aria-live="polite">
        {msgs.length === 0 && <p className="text-xs text-muted">Pregúntame por tus tareas, un plan de estudio o cómo vas de notas, {profile}.</p>}
        {msgs.map((m, i) => <p key={i} className={m.role === 'user' ? 'text-right text-muted' : 'whitespace-pre-wrap'}><span className="hud-sub mr-2">{m.role === 'user' ? profile : 'JARVIS'}</span>{m.text}</p>)}
        {busy && <p className="hud-sub"><Loader2 size={12} className="mr-1 inline animate-spin" aria-hidden />Procesando…</p>}<div ref={end} />
      </div>
      <form onSubmit={(e) => void send(e)} className="flex gap-2"><input className="hud-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="¿Qué debería estudiar esta semana?" aria-label="Pregunta para JARVIS" maxLength={400} /><button className="hud-btn" type="submit" disabled={busy || !q.trim()} aria-label="Enviar"><Send size={14} aria-hidden /></button></form>
    </section>
  );
}

export default function PersonalPage() {
  const { status, init } = usePersonal(); const started = useRef(false);
  useEffect(() => { document.documentElement.classList.add('hud'); document.documentElement.dataset.theme = 'dark'; document.title = 'JARVIS · Personal'; return () => { document.documentElement.classList.remove('hud'); }; }, []);
  useEffect(() => { if (!started.current) { started.current = true; void init(); } }, [init]);
  if (status === 'loading') return <div className="hud-root grid min-h-screen place-items-center"><p className="hud-title text-xl">INICIANDO SISTEMAS…</p></div>;
  if (status === 'anon') return <Navigate to="/login" replace />;
  if (status === 'choose') return <Choose />;
  return <Hud />;
}
