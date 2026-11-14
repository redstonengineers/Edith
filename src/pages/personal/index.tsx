import { useEffect, useRef, useState, type FormEvent, type PointerEvent as RPE, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { addDays, format, parseISO, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarDays, CheckSquare, Flame, GraduationCap, HelpCircle, Loader2, LogOut, NotebookPen, Pause, Play, Plus, RotateCcw, Send, Settings, Target, Timer as TimerIcon, Trash2, Users, Wallet, X } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { Drawer } from '@/components/ui/Overlay';
import { PROFILES, uid, usePersonal, type Profile, type PData } from '@/store/personal';
import { personalApi } from '@/services/personalApi';
import { createScene, type HudScene } from './scene';
import { THEMES, applyTheme, clearTheme, themeOf, useHud, type Quality } from './themes';
import { blip, hudBus } from './fx';
import './hud.css';

const todayISO = () => format(new Date(), 'yyyy-MM-dd');
const COLORS = ['#22c8ff', '#a78bfa', '#34d399', '#fbbf24', '#f472b6', '#fb923c'];
const eur = (n: number) => `${n.toLocaleString('es-ES', { maximumFractionDigits: 2 })} €`;
const gradeAvg = (d: PData, id: string) => { const g = d.grades.filter((x) => x.subjectId === id); const w = g.reduce((a, x) => a + x.weight, 0); return w ? g.reduce((a, x) => a + x.score * x.weight, 0) / w : null; };
const streak = (log: string[]) => { let n = 0; let d = new Date(); if (!log.includes(format(d, 'yyyy-MM-dd'))) d = addDays(d, -1); while (log.includes(format(d, 'yyyy-MM-dd'))) { n++; d = addDays(d, -1); } return n; };

function Bar({ pct, tone }: { pct: number; tone?: 'warn' | 'bad' }) { return <div className={`hud-bar ${tone ?? ''}`} role="progressbar" aria-label="Progreso" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} /></div>; }
const Empty = ({ text }: { text: string }) => <p className="py-2 text-xs text-muted">{text}</p>;

/** Panel de cristal que se inclina hacia el puntero y refleja luz. */
function Panel({ title, right, children, className = '', onOpen }: { title: string; right?: ReactNode; children: ReactNode; className?: string; onOpen?: () => void }) {
  const ref = useRef<HTMLElement>(null);
  const move = (e: RPE<HTMLElement>) => {
    if (e.pointerType === 'touch') return; const el = ref.current!; const r = el.getBoundingClientRect(); const px = (e.clientX - r.left) / r.width; const py = (e.clientY - r.top) / r.height;
    el.classList.add('tilting'); el.style.setProperty('--ry', `${(px - .5) * 8}deg`); el.style.setProperty('--rx', `${-(py - .5) * 8}deg`); el.style.setProperty('--gx', `${px * 100}%`); el.style.setProperty('--gy', `${py * 100}%`);
  };
  const leave = () => { const el = ref.current!; el.classList.remove('tilting'); el.style.setProperty('--ry', '0deg'); el.style.setProperty('--rx', '0deg'); };
  return (
    <section ref={ref} className={`hud-panel ${className}`} onPointerMove={move} onPointerLeave={leave}>
      <i className="hud-glare" aria-hidden />
      <h2 className="hud-h"><span>{title}</span>{right}{onOpen && <button className="hud-ghost" onClick={onOpen} aria-label={`Abrir ${title}`}><Plus size={14} aria-hidden /></button>}</h2>
      <div className="hud-body">{children}</div>
    </section>
  );
}

/* ───────────── Módulos ───────────── */
type Mod = 'tasks' | 'agenda' | 'subjects' | 'habits' | 'study' | 'notes' | 'money' | 'goals';
const MODS: { id: Mod; label: string; icon: typeof CheckSquare }[] = [
  { id: 'tasks', label: 'Tareas', icon: CheckSquare }, { id: 'agenda', label: 'Agenda', icon: CalendarDays }, { id: 'subjects', label: 'Notas', icon: GraduationCap },
  { id: 'habits', label: 'Hábitos', icon: Flame }, { id: 'study', label: 'Estudio', icon: TimerIcon }, { id: 'notes', label: 'Apuntes', icon: NotebookPen },
  { id: 'money', label: 'Gastos', icon: Wallet }, { id: 'goals', label: 'Objetivos', icon: Target },
];

/* ───────────── Escena 3D de fondo + nodos orbitales ───────────── */
function Stage({ onOpen, orbit }: { onOpen?: (m: Mod) => void; orbit: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null); const nodes = useRef<(HTMLButtonElement | null)[]>([]); const sc = useRef<HudScene | null>(null);
  const { theme, quality, motion, sound } = useHud(); const [failed, setFailed] = useState(false);
  useEffect(() => {
    const t = themeOf(theme);
    try {
      sc.current = createScene(canvas.current!, { quality, motion, hex: t.hex, hex2: t.hex2, nodes: orbit ? MODS.length : 0, onNodes: (ns) => ns.forEach((n, i) => { const el = nodes.current[i]; if (!el) return; el.style.transform = `translate3d(${n.x}px, ${n.y}px, 0) scale(${n.scale})`; el.style.opacity = String(Math.min(1, .45 + n.scale * .6)); el.style.zIndex = String(Math.round(n.depth * 10 + 50)); }) });
    } catch { setFailed(true); }
    const off = hudBus.on((e) => { if (e === 'pulse' || e === 'success') sc.current?.pulse(); if (e === 'think-on') sc.current?.setThinking(true); if (e === 'think-off') sc.current?.setThinking(false); });
    const move = (e: PointerEvent) => { const s = document.documentElement.style; s.setProperty('--mx', String((e.clientX / window.innerWidth) * 2 - 1)); s.setProperty('--my', String((e.clientY / window.innerHeight) * 2 - 1)); };
    window.addEventListener('pointermove', move, { passive: true });
    return () => { off(); window.removeEventListener('pointermove', move); sc.current?.dispose(); sc.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orbit]);
  useEffect(() => { const t = themeOf(theme); sc.current?.setColors(t.hex, t.hex2); }, [theme]);
  useEffect(() => { sc.current?.setQuality(quality); }, [quality]);
  useEffect(() => { sc.current?.setMotion(motion); }, [motion]);
  return (<>
    <canvas ref={canvas} className="hud-canvas" aria-hidden />
    {failed && <p className="sr-only">La escena 3D no está disponible en este dispositivo.</p>}
    <div className="hud-vignette" aria-hidden />
    {orbit && <div className="hud-nodes" role="group" aria-label="Módulos">
      {MODS.map((m, i) => <button key={m.id} ref={(el) => { nodes.current[i] = el; }} className="hud-node" aria-label={`${m.label} (tecla ${i + 1})`} onClick={() => { blip('open', sound); hudBus.emit('pulse'); onOpen?.(m.id); }}
        onPointerEnter={() => { sc.current?.setHover(true); blip('hover', sound); }} onPointerLeave={() => sc.current?.setHover(false)}>
        <span className="orb"><m.icon size={20} aria-hidden /></span><span className="lbl">{m.label}</span></button>)}
    </div>}
  </>);
}

/* ───────────── Selector de perfil ───────────── */
function Choose() {
  const { choose, logout } = usePersonal(); const [busy, setBusy] = useState<Profile | null>(null); const [err, setErr] = useState('');
  const go = async (p: Profile) => { setBusy(p); setErr(''); hudBus.emit('think-on'); try { await choose(p); } catch (e) { setErr((e as Error).message); setBusy(null); } finally { hudBus.emit('think-off'); } };
  return (
    <main className="hud-root">
      <Stage orbit={false} />
      <div className="absolute inset-x-0 top-[7vh] z-10 text-center" style={{ textShadow: '0 0 10px #000' }}>
        <div className="mb-4 flex justify-center drop-shadow-[0_0_28px_var(--hud)]"><Logo size={84} /></div><h1 className="hud-title text-5xl md:text-6xl">E.D.I.T.H.</h1><p className="hud-sub mt-3">Tu sistema personal</p></div>
      <div className="absolute inset-x-0 bottom-[7vh] z-10 p-4 text-center">
        <p className="mb-5 text-sm text-muted" style={{ textShadow: '0 0 8px #000' }}>¿Quién eres? Elige tu perfil para despertar tu sistema</p>
        <div className="flex flex-wrap justify-center gap-7">
          {(Object.keys(PROFILES) as Profile[]).map((p) => (
            <button key={p} className="profile-card" disabled={!!busy} onClick={() => void go(p)} aria-label={`Entrar como ${PROFILES[p].name}`}>
              <span className="hud-sub block">{PROFILES[p].tag}</span><span className="hud-title mt-3 block text-3xl">{PROFILES[p].name.toUpperCase()}</span>
              <span className="mt-4 block text-xs text-muted">{busy === p ? 'Cargando sistemas…' : 'Abrir mi EDITH →'}</span>
            </button>))}
        </div>
        {err && <p role="alert" className="mt-5 text-sm text-bad">{err}</p>}
        <button className="hud-ghost mt-6" onClick={() => void logout()}>Cerrar sesión</button>
      </div>
    </main>
  );
}

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
      <input type="checkbox" className="hud-check" checked={t.done} onChange={() => { if (!t.done) hudBus.emit('success'); update((d) => ({ ...d, tasks: d.tasks.map((x) => x.id === t.id ? { ...x, done: !x.done } : x) })); }} aria-label={`Completar ${t.title}`} />
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


/* ───────────── Ajustes y ayuda ───────────── */
function SettingsBody({ onSwitch }: { onSwitch: () => void }) {
  const h = useHud();
  const Toggle = ({ on, set, label }: { on: boolean; set: (b: boolean) => void; label: string }) => <div className="hud-seg" role="group" aria-label={label}><button aria-pressed={on} onClick={() => set(true)}>Sí</button><button aria-pressed={!on} onClick={() => set(false)}>No</button></div>;
  return (
    <div className="space-y-7">
      <section><h3 className="hud-sub mb-3">Paleta de colores</h3>
        <div className="flex flex-wrap gap-3">{THEMES.map((t) => <button key={t.id} className="theme-dot" aria-pressed={h.theme === t.id} aria-label={`Paleta ${t.name}`} title={t.name} style={{ background: `linear-gradient(135deg, ${t.hex}, ${t.hex2})`, ['--c' as string]: t.hex }} onClick={() => { h.setTheme(t.id); hudBus.emit('pulse'); }} />)}</div>
        <p className="mt-2 text-xs text-muted">Activa: {themeOf(h.theme).name}. Cambia todo el sistema, incluido el 3D.</p></section>
      <section><h3 className="hud-sub mb-3">Calidad del 3D</h3>
        <div className="hud-seg" role="group" aria-label="Calidad del 3D">{(['alta', 'media', 'baja'] as Quality[]).map((q) => <button key={q} aria-pressed={h.quality === q} onClick={() => h.setQuality(q)}>{q}</button>)}</div>
        <p className="mt-2 text-xs text-muted">Si va lento en tu equipo o móvil, baja la calidad.</p></section>
      <section><h3 className="hud-sub mb-3">Animación y movimiento</h3><Toggle on={h.motion} set={h.setMotion} label="Animación" /><p className="mt-2 text-xs text-muted">Desactívala para reducir el movimiento (parallax y giro).</p></section>
      <section><h3 className="hud-sub mb-3">Sonidos de interfaz</h3><Toggle on={h.sound} set={h.setSound} label="Sonido" /></section>
      <section><h3 className="hud-sub mb-3">Perfil</h3><button className="hud-btn" onClick={onSwitch}><Users size={14} className="mr-2 inline" aria-hidden />Cambiar de perfil</button></section>
    </div>
  );
}
function HelpBody() {
  const rows: [string, string][] = [['1 – 8', 'Abrir un módulo'], ['/', 'Hablar con EDITH'], [',', 'Ajustes (paleta, calidad)'], ['?', 'Esta ayuda'], ['Esc', 'Cerrar paneles']];
  return (<div className="space-y-5 text-sm">
    <p>Tu sistema personal en una sola pantalla: lo importante está a la vista y los <b>nodos que orbitan</b> el núcleo abren cada módulo.</p>
    <ul className="space-y-2 text-muted"><li>• <b className="text-fg">Misiones</b>: escribe y pulsa Intro para añadir; marca el cuadro para completar.</li><li>• <b className="text-fg">Hábitos</b>: pulsa el hábito para marcar hoy.</li><li>• <b className="text-fg">Estudio</b>: inicia el temporizador en el panel; al acabar se guarda solo.</li><li>• Todo se guarda automáticamente y se sincroniza entre dispositivos.</li></ul>
    <div className="hud-panel !flex-none">{rows.map(([k, v]) => <div key={k} className="hud-row"><span className="hud-kbd w-12 text-center">{k}</span><span>{v}</span></div>)}</div>
  </div>);
}

/* ───────────── HUD ───────────── */
function QuickAdd() {
  const update = usePersonal((s) => s.update); const sound = useHud((s) => s.sound); const [t, setT] = useState('');
  const go = (e: FormEvent) => { e.preventDefault(); const title = t.trim(); if (!title) return; update((d) => ({ ...d, tasks: [...d.tasks, { id: uid(), title, priority: 'media', done: false }] })); setT(''); blip('tick', sound); hudBus.emit('pulse'); };
  return <form onSubmit={go} className="mb-2 flex gap-2"><input className="hud-input" value={t} onChange={(e) => setT(e.target.value)} placeholder="Nueva misión… (Intro)" aria-label="Nueva misión" maxLength={140} /><button className="hud-btn !px-3" type="submit" aria-label="Añadir misión" disabled={!t.trim()}><Plus size={15} aria-hidden /></button></form>;
}

function Hud() {
  const { data, update, profile, logout, sync, status, switchProfile } = usePersonal(); const timer = useTimer(); const { sound } = useHud();
  const [open, setOpen] = useState<Mod | null>(null); const [panel, setPanel] = useState<'settings' | 'help' | null>(null); const [now, setNow] = useState(new Date()); const chatRef = useRef<HTMLInputElement>(null);
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement; if (el.closest('input, textarea, select, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[1-8]$/.test(e.key)) { setOpen(MODS[Number(e.key) - 1].id); blip('open', sound); hudBus.emit('pulse'); } else if (e.key === '/') { e.preventDefault(); chatRef.current?.focus(); } else if (e.key === ',') setPanel('settings'); else if (e.key === '?') setPanel('help');
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [sound]);
  const t = todayISO(); const pending = data.tasks.filter((x) => !x.done); const done = data.tasks.length - pending.length; const taskPct = data.tasks.length ? (done / data.tasks.length) * 100 : 0;
  const upcoming = data.events.filter((e) => e.date >= t).sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')));
  const spend = monthSpend(data); const spendPct = data.budget ? (spend / data.budget) * 100 : 0; const hour = now.getHours();
  const greet = hour < 6 ? 'Buenas noches' : hour < 13 ? 'Buenos días' : hour < 21 ? 'Buenas tardes' : 'Buenas noches';
  const studyToday = data.study.filter((s) => s.date === t).reduce((a, s) => a + s.minutes, 0); const name = profile ? PROFILES[profile].name : '';
  const syncLabel = { ok: 'Guardado', saving: 'Guardando…', error: 'Sin conexión', conflict: 'Conflicto' }[sync];
  const bestStreak = Math.max(0, ...data.habits.map((h) => streak(h.log)));
  const mm = String(Math.floor(timer.left / 60)).padStart(2, '0'); const ss = String(timer.left % 60).padStart(2, '0');
  const ModBody = { tasks: <Tasks />, agenda: <Agenda />, subjects: <Subjects />, habits: <Habits />, study: <StudyPanel timer={timer} />, notes: <Notes />, money: <Money />, goals: <Goals /> };
  const toggleTask = (id: string) => { update((d) => ({ ...d, tasks: d.tasks.map((y) => y.id === id ? { ...y, done: true } : y) })); blip('ok', sound); hudBus.emit('success'); };
  const toggleHabit = (id: string) => { update((d) => ({ ...d, habits: d.habits.map((x) => x.id === id ? { ...x, log: x.log.includes(t) ? x.log.filter((l) => l !== t) : [...x.log, t] } : x) })); blip('tick', sound); hudBus.emit('pulse'); };
  return (
    <div className="hud-root" onPointerDown={(e) => { if ((e.target as HTMLElement).closest('.hud-btn, .hud-check, .hud-dock button, .hud-icon')) blip('tick', sound); }}>
      <Stage orbit onOpen={setOpen} />
      <div className="hud-hero" aria-live="off" style={{ top: '19%' }}>
        <div className="mb-2 flex justify-center"><Logo size={40} /></div><p className="hud-sub">{greet}</p><p className="hud-title text-2xl">{name.toUpperCase()}</p>
        <p className="mt-1 text-[11px] text-muted">{pending.length} misiones · {upcoming.length} citas · racha {bestStreak} d</p>
      </div>
      <div className="hud-stage">
        <header className="hud-top">
          <div className="flex items-center gap-3"><Logo size={30} /><span className="hud-title text-lg">E.D.I.T.H.</span><span className="hud-chip hidden md:inline-flex">{name} · {format(now, "EEE d 'de' MMM", { locale: es })}</span></div>
          <div className="flex items-center gap-2">
            <span className="hud-val mr-1 text-lg tabular-nums">{format(now, 'HH:mm:ss')}</span>
            <span className={`hud-chip ${sync === 'ok' ? '' : '!border-warn !text-warn'}`} role="status"><i className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: sync === 'ok' ? 'var(--ok)' : 'var(--warn)', boxShadow: '0 0 8px currentColor' }} />{syncLabel}</span>
            <button className="hud-icon" style={{ ['--rot' as string]: '90deg' }} onClick={() => setPanel('settings')} aria-label="Ajustes"><Settings size={16} aria-hidden /></button>
            <button className="hud-icon" onClick={() => setPanel('help')} aria-label="Ayuda"><HelpCircle size={16} aria-hidden /></button>
            <button className="hud-icon" onClick={() => void logout()} aria-label="Cerrar sesión"><LogOut size={16} aria-hidden /></button>
          </div>
        </header>
        {sync === 'conflict' && <p role="alert" className="pointer-events-auto absolute top-16 left-1/2 z-20 -translate-x-1/2 rounded border border-warn bg-black/70 px-3 py-2 text-sm text-warn">Datos modificados desde otro dispositivo. Recarga la página para no perder cambios.</p>}
        <div className="hud-cols">
          <div className="hud-col l">
            <Panel title="Misiones de hoy" right={<span className="hud-val">{done}/{data.tasks.length}</span>} onOpen={() => setOpen('tasks')}>
              <QuickAdd /><Bar pct={taskPct} />
              {pending.length === 0 ? <Empty text={data.tasks.length ? 'Todo completado. Buen trabajo.' : 'Escribe arriba tu primera misión.'} /> : [...pending].sort((a, b) => (a.due ?? '9').localeCompare(b.due ?? '9')).slice(0, 8).map((x) => (
                <div key={x.id} className="hud-row"><input type="checkbox" className="hud-check" aria-label={`Completar ${x.title}`} checked={false} onChange={() => toggleTask(x.id)} /><span className="truncate">{x.title}</span>{x.due && <span className={`ml-auto text-xs ${x.due < t ? 'text-bad' : 'text-muted'}`}>{x.due.slice(5)}</span>}</div>))}
            </Panel>
            <Panel title="Agenda" right={<span className="hud-sub">{upcoming.length} próximas</span>} onOpen={() => setOpen('agenda')}>
              {upcoming.length === 0 ? <Empty text="Nada próximo. Pulsa + para añadir un examen o cita." /> : upcoming.slice(0, 6).map((e) => <div key={e.id} className="hud-row"><span className="hud-val w-24 flex-none text-xs">{e.date === t ? 'Hoy' : format(parseISO(e.date), 'EEE d MMM', { locale: es })}{e.time && ` ${e.time}`}</span><span className="truncate">{e.title}</span></div>)}
            </Panel>
            <Panel title="Hábitos" right={<span className="hud-sub">{data.habits.filter((h) => h.log.includes(t)).length}/{data.habits.length} hoy</span>} onOpen={() => setOpen('habits')}>
              {data.habits.length === 0 ? <Empty text="Crea hábitos con +. Luego pulsa para marcar el día." /> : data.habits.slice(0, 6).map((h) => <button key={h.id} className="hud-row w-full text-left" onClick={() => toggleHabit(h.id)} aria-pressed={h.log.includes(t)} aria-label={`Hábito ${h.name}`}><span className={`hud-check ${h.log.includes(t) ? '!bg-[var(--hud)]' : ''}`} aria-hidden /><span className="truncate">{h.name}</span><span className="hud-val ml-auto text-xs"><Flame size={11} className="mr-1 inline" aria-hidden />{streak(h.log)}</span></button>)}
            </Panel>
          </div>
          <div className="hud-mid">
            <div className="pointer-events-auto flex flex-wrap justify-center gap-2" aria-label="Resumen">
              <span className="hud-chip"><CheckSquare size={11} aria-hidden />{pending.length} pendientes</span><span className="hud-chip"><Flame size={11} aria-hidden />racha {bestStreak} d</span><span className="hud-chip"><TimerIcon size={11} aria-hidden />{studyToday} min hoy</span>{data.budget > 0 && <span className="hud-chip"><Wallet size={11} aria-hidden />{Math.round(spendPct)}% presupuesto</span>}
            </div>
            <Chat profile={name} inputRef={chatRef} />
          </div>
          <div className="hud-col r">
            <Panel title="Estudio" right={<span className={timer.running ? 'hud-val' : 'hud-sub'}>{timer.running ? 'en marcha' : `${studyToday} min hoy`}</span>} onOpen={() => setOpen('study')}>
              <div className="flex items-center gap-3"><p className="hud-title !tracking-[.12em] text-3xl tabular-nums">{mm}:{ss}</p><div className="ml-auto flex gap-2"><button className="hud-btn !px-3" onClick={timer.toggle} aria-label={timer.running ? 'Pausar' : 'Iniciar estudio'}>{timer.running ? <Pause size={15} aria-hidden /> : <Play size={15} aria-hidden />}</button><button className="hud-icon" onClick={timer.reset} aria-label="Reiniciar"><RotateCcw size={14} aria-hidden /></button></div></div>
              <div className="mt-2"><Bar pct={100 - (timer.left / (timer.total * 60)) * 100} /></div>
            </Panel>
            <Panel title="Rendimiento académico" onOpen={() => setOpen('subjects')}>{data.subjects.length === 0 ? <Empty text="Pulsa + para añadir asignaturas y notas." /> : data.subjects.slice(0, 6).map((s) => { const a = gradeAvg(data, s.id); return <div key={s.id} className="mb-2"><div className="mb-1 flex justify-between text-xs"><span><i style={{ color: s.color }}>●</i> {s.name}</span><span className="hud-val">{a === null ? '—' : a.toFixed(1)}</span></div><Bar pct={(a ?? 0) * 10} tone={a !== null && a < 5 ? 'bad' : a !== null && a < 6 ? 'warn' : undefined} /></div>; })}</Panel>
            <Panel title="Finanzas del mes" right={<span className="hud-val">{eur(spend)}</span>} onOpen={() => setOpen('money')}>{data.budget ? <><Bar pct={spendPct} tone={spendPct > 100 ? 'bad' : spendPct > 80 ? 'warn' : undefined} /><p className="mt-1 text-xs text-muted">{eur(Math.max(0, data.budget - spend))} disponibles de {eur(data.budget)}</p></> : <Empty text="Define un presupuesto con +." />}</Panel>
            <Panel title="Objetivos" onOpen={() => setOpen('goals')}>{data.goals.length === 0 ? <Empty text="Pulsa + para fijar tu primer objetivo." /> : data.goals.slice(0, 4).map((g) => <div key={g.id} className="mb-2"><div className="mb-1 flex justify-between text-xs"><span className="truncate">{g.title}</span><span className="hud-val">{g.progress}%</span></div><Bar pct={g.progress} /></div>)}</Panel>
          </div>
        </div>
        <nav className="hud-dock" aria-label="Módulos">{MODS.map((m, i) => <button key={m.id} onClick={() => { setOpen(m.id); blip('open', sound); hudBus.emit('pulse'); }}><m.icon size={15} aria-hidden /><span className="hidden xl:inline">{m.label}</span><span className="hud-kbd">{i + 1}</span></button>)}</nav>
        <span className="sr-only">{status}</span>
      </div>
      <Drawer open={open !== null} onClose={() => setOpen(null)} label={open ? MODS.find((m) => m.id === open)?.label ?? '' : ''} className="w-full max-w-xl">
        <div className="hud-root !h-full !min-h-0 overflow-y-auto p-5"><h2 className="hud-title mb-4 text-xl">{open ? MODS.find((m) => m.id === open)?.label.toUpperCase() : ''}</h2>{open && ModBody[open]}</div>
      </Drawer>
      <Drawer open={panel !== null} onClose={() => setPanel(null)} label={panel === 'settings' ? 'Ajustes' : 'Ayuda'} className="w-full max-w-md">
        <div className="hud-root !h-full !min-h-0 overflow-y-auto p-5"><h2 className="hud-title mb-5 text-xl">{panel === 'settings' ? 'AJUSTES' : 'AYUDA'}</h2>{panel === 'settings' ? <SettingsBody onSwitch={() => { setPanel(null); void switchProfile(); }} /> : <HelpBody />}</div>
      </Drawer>
    </div>
  );
}

/* ───────────── Chat con EDITH ───────────── */
const SUGGEST = ['¿Qué tengo pendiente hoy?', 'Hazme un plan de estudio para esta semana', '¿Cómo voy de notas?'];
function Chat({ profile, inputRef }: { profile: string; inputRef: React.RefObject<HTMLInputElement | null> }) {
  const sound = useHud((s) => s.sound); const [msgs, setMsgs] = useState<{ role: 'user' | 'ai'; text: string }[]>([]); const [q, setQ] = useState(''); const [busy, setBusy] = useState(false); const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [msgs]);
  const ask = async (text: string) => {
    if (!text || busy) return; setQ(''); const hist = msgs.slice(-8); setMsgs((m) => [...m, { role: 'user', text }]); setBusy(true); blip('tick', sound); hudBus.emit('think-on');
    try { const r = await personalApi.ask(text, hist); setMsgs((m) => [...m, { role: 'ai', text: r.text }]); blip('ok', sound); } catch (err) { setMsgs((m) => [...m, { role: 'ai', text: (err as Error).message }]); } finally { setBusy(false); hudBus.emit('think-off'); hudBus.emit('pulse'); }
  };
  return (
    <section className="hud-panel !flex-none" aria-label="Conversación con EDITH">
      <i className="hud-glare" aria-hidden />
      <h2 className="hud-h"><span>Habla con EDITH</span><span className="hud-kbd">/</span></h2>
      <div className="mb-2 max-h-28 min-h-10 space-y-2 overflow-y-auto text-sm" aria-live="polite">
        {msgs.length === 0 && <div className="flex flex-wrap gap-2">{SUGGEST.map((s) => <button key={s} className="hud-chip hover:!border-[var(--hud)] hover:!text-white" onClick={() => void ask(s)}>{s}</button>)}</div>}
        {msgs.map((m, i) => <p key={i} className={m.role === 'user' ? 'text-right text-muted' : 'whitespace-pre-wrap'}><span className="hud-sub mr-2">{m.role === 'user' ? profile : 'EDITH'}</span>{m.text}</p>)}
        {busy && <p className="hud-sub"><Loader2 size={12} className="mr-1 inline animate-spin" aria-hidden />Procesando…</p>}<div ref={end} />
      </div>
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); void ask(q.trim()); }} className="flex gap-2"><input ref={inputRef} className="hud-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Pregúntame lo que quieras, ${profile}…`} aria-label="Pregunta para EDITH" maxLength={400} /><button className="hud-btn" type="submit" disabled={busy || !q.trim()} aria-label="Enviar"><Send size={14} aria-hidden /></button></form>
    </section>
  );
}

export default function PersonalPage() {
  const { status, init } = usePersonal(); const started = useRef(false); const theme = useHud((s) => s.theme);
  useEffect(() => { document.documentElement.classList.add('hud'); document.documentElement.dataset.theme = 'dark'; document.title = 'EDITH · Personal'; return () => { document.documentElement.classList.remove('hud'); clearTheme(); }; }, []);
  useEffect(() => { applyTheme(theme); }, [theme]);
  useEffect(() => { if (!started.current) { started.current = true; void init(); } }, [init]);
  if (status === 'loading') return <div className="hud-root grid place-items-center"><p className="hud-title text-xl">INICIANDO SISTEMAS…</p></div>;
  if (status === 'anon') return <Navigate to="/login" replace />;
  if (status === 'choose') return <Choose />;
  return <Hud />;
}
