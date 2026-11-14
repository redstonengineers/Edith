import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { addDays, format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { BellRing, CalendarDays, CheckSquare, Clock, GraduationCap, HelpCircle, Loader2, LogOut, NotebookPen, Pause, Play, RotateCcw, Send, Settings, Timer as TimerIcon, Users, Wallet, X } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { Drawer } from '@/components/ui/Overlay';
import { PROFILES, uid, usePersonal, type Profile, type PData } from '@/store/personal';
import { personalApi } from '@/services/personalApi';
import { AddForm, Bar, COLORS, Empty, F, Panel, Row, eur, todayISO } from './shared';
import { AlertStack, FinancePanel, Money, RemindersPanel, Reminders, AgendaCal, CalendarPanel, monthStats, useReminderAlerts } from './life';
import { Schedule, SchedulePanel, classesOn, mins } from './timetable';
import { createScene, type HudScene } from './scene';
import { THEMES, applyTheme, clearTheme, themeOf, useHud, type Quality } from './themes';
import { blip, hudBus } from './fx';
import './hud.css';

const gradeAvg = (d: PData, id: string) => { const g = d.grades.filter((x) => x.subjectId === id); const w = g.reduce((a, x) => a + x.weight, 0); return w ? g.reduce((a, x) => a + x.score * x.weight, 0) / w : null; };



/* ───────────── Módulos ───────────── */
type Mod = 'schedule' | 'reminders' | 'agenda' | 'tasks' | 'money' | 'study' | 'notes' | 'subjects';
const MODS: { id: Mod; label: string; icon: typeof CheckSquare }[] = [
  { id: 'schedule', label: 'Horario', icon: Clock }, { id: 'reminders', label: 'Recordatorios', icon: BellRing }, { id: 'agenda', label: 'Agenda', icon: CalendarDays }, { id: 'tasks', label: 'Tareas', icon: CheckSquare },
  { id: 'money', label: 'Finanzas', icon: Wallet }, { id: 'study', label: 'Estudio', icon: TimerIcon }, { id: 'notes', label: 'Apuntes', icon: NotebookPen }, { id: 'subjects', label: 'Notas', icon: GraduationCap },
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
/** Nombre y duración del temporizador, editables (con atajos de duración). */
function TimerControls({ timer, presets }: { timer: Timer; presets?: boolean }) {
  const [draft, setDraft] = useState(String(timer.total)); useEffect(() => setDraft(String(timer.total)), [timer.total]);
  const commit = () => { const n = Math.round(Number(draft.replace(',', '.'))); if (n >= 1) timer.setTotal(n); else setDraft(String(timer.total)); };
  return (<div className="flex flex-wrap items-center gap-2">
    <input className="hud-input min-w-0 flex-1" value={timer.name} onChange={(e) => timer.setName(e.target.value)} maxLength={40} placeholder="Nombre (ej. Repaso de cálculo)" aria-label="Nombre del temporizador" />
    <label className="flex flex-none items-center gap-1.5 text-xs text-muted"><input className="hud-input !w-16 text-center" inputMode="numeric" value={draft} disabled={timer.running} onChange={(e) => setDraft(e.target.value.replace(/[^\d.,]/g, ''))} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }} aria-label="Minutos del temporizador" />min</label>
    {presets && <div className="flex w-full flex-wrap gap-1.5">{[15, 25, 45, 60, 90, 120].map((m) => <button key={m} className="hud-chip hover:!border-[var(--hud)] hover:!text-white disabled:opacity-40" disabled={timer.running} aria-pressed={timer.total === m} onClick={() => timer.setTotal(m)}>{m} min</button>)}</div>}
  </div>);
}
function StudyPanel({ timer }: { timer: Timer }) {
  const { data, update } = usePersonal(); const week = data.study.filter((s) => s.date >= format(addDays(new Date(), -6), 'yyyy-MM-dd')); const mm = String(Math.floor(timer.left / 60)).padStart(2, '0'); const ss = String(timer.left % 60).padStart(2, '0');
  const recent = [...data.study].reverse().slice(0, 8);
  return (<>
    <div className="mb-5"><p className="hud-title mb-3 text-center text-5xl" aria-live="off">{mm}:{ss}</p>
      <TimerControls timer={timer} presets />
      <div className="mt-3 flex flex-wrap items-center gap-2"><select className="hud-input w-48" value={timer.subjectId} onChange={(e) => timer.setSubjectId(e.target.value)} aria-label="Asignatura de la sesión"><option value="">Sin asignatura</option>{data.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <button className="hud-btn" onClick={timer.toggle}>{timer.running ? 'Pausar' : 'Iniciar'}</button><button className="hud-btn" onClick={timer.reset}>Reiniciar</button></div></div>
    <p className="hud-sub mb-2">Últimos 7 días · {week.reduce((a, s) => a + s.minutes, 0)} min</p>
    {data.subjects.map((s) => { const m = week.filter((x) => x.subjectId === s.id).reduce((a, x) => a + x.minutes, 0); return <div key={s.id} className="mb-2"><div className="mb-1 flex justify-between text-xs"><span>{s.name}</span><span className="hud-val">{m} min</span></div><Bar pct={Math.min(100, m / 3)} /></div>; })}
    {recent.length > 0 && <><p className="hud-sub mt-4 mb-1">Últimas sesiones</p>{recent.map((r) => <Row key={r.id} label={r.name ?? 'sesión'} onDelete={() => update((d) => ({ ...d, study: d.study.filter((x) => x.id !== r.id) }))}><span className="w-12 flex-none text-xs text-muted">{r.date.slice(5)}</span><span className="truncate">{r.name || 'Estudio'}</span><span className="hud-sub">{data.subjects.find((x) => x.id === r.subjectId)?.name}</span><span className="hud-val ml-auto flex-none">{r.minutes} min</span></Row>)}</>}
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

/* ───────────── Temporizador de estudio (nombre y duración libres) ───────────── */
const TKEY = 'edith.timer.v1'; const clampMin = (n: number) => Math.max(1, Math.min(600, Math.round(n) || 25));
interface Timer { left: number; total: number; name: string; running: boolean; subjectId: string; setSubjectId: (s: string) => void; setName: (n: string) => void; setTotal: (m: number) => void; toggle: () => void; reset: () => void }
function useTimer(): Timer {
  const update = usePersonal((s) => s.update); const sound = useHud((s) => s.sound);
  const saved = useRef((() => { try { return JSON.parse(localStorage.getItem(TKEY) ?? '{}') as { name?: string; total?: number }; } catch { return {}; } })()).current;
  const [total, setTot] = useState(clampMin(saved.total ?? 25)); const [name, setNameS] = useState(saved.name ?? 'Estudio'); const [left, setLeft] = useState(clampMin(saved.total ?? 25) * 60); const [running, setRunning] = useState(false); const [subjectId, setSubjectId] = useState('');
  const endAt = useRef(0); const leftRef = useRef(left); leftRef.current = left; const ref = useRef({ total, name, subjectId }); ref.current = { total, name, subjectId };
  const persist = (n: string, t: number) => { try { localStorage.setItem(TKEY, JSON.stringify({ name: n, total: t })); } catch { /* sin almacenamiento */ } };
  useEffect(() => { if (!running) return; endAt.current = Date.now() + leftRef.current * 1000; const id = setInterval(() => setLeft(Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000))), 250); return () => clearInterval(id); }, [running]);
  useEffect(() => { if (left > 0 || !running) return; setRunning(false); const r = ref.current; update((d) => ({ ...d, study: [...d.study, { id: uid(), subjectId: r.subjectId || undefined, minutes: r.total, date: todayISO(), name: r.name.trim() || undefined }] })); setLeft(r.total * 60); blip('ok', sound); hudBus.emit('success'); try { if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification('EDITH', { body: `${r.name || 'Sesión'} completada (${r.total} min)` }); } catch { /* sin permiso */ } }, [left, running, update, sound]);
  useEffect(() => { if (running) document.title = `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')} · ${name || 'Estudio'}`; else document.title = 'EDITH · Personal'; }, [left, running, name]);
  return { left, total, name, running, subjectId, setSubjectId,
    setName: (n) => { setNameS(n); persist(n, total); }, setTotal: (m) => { const t = clampMin(m); setTot(t); setLeft(t * 60); persist(name, t); },
    toggle: () => setRunning((r) => !r), reset: () => { setRunning(false); setLeft(total * 60); } };
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
    <ul className="space-y-2 text-muted"><li>• <b className="text-fg">Horario</b>: añade tus clases y verás qué toca ahora y qué viene después.</li><li>• <b className="text-fg">Recordatorios</b>: escribe «llamar al médico mañana 10:30» y Intro; te avisará a su hora.</li><li>• <b className="text-fg">Finanzas</b>: apunta gastos e ingresos desde el propio panel.</li><li>• Todo se guarda automáticamente y se sincroniza entre dispositivos.</li></ul>
    <div className="hud-panel !flex-none">{rows.map(([k, v]) => <div key={k} className="hud-row"><span className="hud-kbd w-12 text-center">{k}</span><span>{v}</span></div>)}</div>
  </div>);
}

/* ───────────── HUD ───────────── */
function Hud() {
  const { data, profile, logout, sync, status, switchProfile } = usePersonal(); const timer = useTimer(); const { sound } = useHud(); const alerts = useReminderAlerts();
  const [open, setOpen] = useState<Mod | null>(null); const [calDay, setCalDay] = useState(todayISO()); const [finSel, setFinSel] = useState('all'); const [panel, setPanel] = useState<'settings' | 'help' | null>(null); const [now, setNow] = useState(new Date()); const chatRef = useRef<HTMLInputElement>(null);
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement; if (el.closest('input, textarea, select, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[1-8]$/.test(e.key)) { setOpen(MODS[Number(e.key) - 1].id); blip('open', sound); hudBus.emit('pulse'); } else if (e.key === '/') { e.preventDefault(); chatRef.current?.focus(); } else if (e.key === ',') setPanel('settings'); else if (e.key === '?') setPanel('help');
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [sound]);
  const hour = now.getHours(); const greet = hour < 6 ? 'Buenas noches' : hour < 13 ? 'Buenos días' : hour < 21 ? 'Buenas tardes' : 'Buenas noches';
  const name = profile ? PROFILES[profile].name : ''; const st = monthStats(data); const nowM = hour * 60 + now.getMinutes();
  const todayClasses = classesOn(data, todayISO()); const nextClass = todayClasses.find((s) => mins(s.start) > nowM);
  const pendingRem = data.reminders.filter((r) => !r.done).length; const pendingTasks = data.tasks.filter((x) => !x.done).length;
  const syncLabel = { ok: 'Guardado', saving: 'Guardando…', error: 'Sin conexión', conflict: 'Conflicto' }[sync];
  const mm = String(Math.floor(timer.left / 60)).padStart(2, '0'); const ss = String(timer.left % 60).padStart(2, '0'); const studyToday = data.study.filter((s) => s.date === todayISO()).reduce((a, s) => a + s.minutes, 0);
  const ModBody = { schedule: <Schedule />, reminders: <Reminders />, agenda: <AgendaCal day={calDay} setDay={setCalDay} />, tasks: <Tasks />, money: <Money sel={finSel} setSel={setFinSel} />, study: <StudyPanel timer={timer} />, notes: <Notes />, subjects: <Subjects /> };
  const openMod = (m: Mod) => () => setOpen(m);
  return (
    <div className="hud-root" onPointerDown={(e) => { if ((e.target as HTMLElement).closest('.hud-btn, .hud-check, .hud-dock button, .hud-icon')) blip('tick', sound); }}>
      <Stage orbit onOpen={setOpen} />
      <div className="hud-hero" aria-live="off" style={{ top: '19%' }}>
        <div className="mb-2 flex justify-center"><Logo size={40} /></div><p className="hud-sub">{greet}</p><p className="hud-title text-2xl">{name.toUpperCase()}</p>
        <p className="mt-1 text-[11px] text-muted">{todayClasses.length} clases hoy · {pendingRem} recordatorios · total {eur(st.total)}</p>
      </div>
      <AlertStack ctl={alerts} />
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
          <div className="hud-col l"><SchedulePanel now={now} onOpen={openMod('schedule')} /><RemindersPanel onOpen={openMod('reminders')} /></div>
          <div className="hud-mid">
            <div className="pointer-events-auto flex flex-wrap justify-center gap-2" aria-label="Resumen">
              <span className="hud-chip"><Clock size={11} aria-hidden />{nextClass ? `${nextClass.title} · ${nextClass.start}` : 'sin más clases hoy'}</span><span className="hud-chip"><BellRing size={11} aria-hidden />{pendingRem} recordatorios</span><span className="hud-chip"><CheckSquare size={11} aria-hidden />{pendingTasks} tareas</span>
            </div>
            <Chat profile={name} inputRef={chatRef} />
          </div>
          <div className="hud-col r">
            <CalendarPanel day={calDay} setDay={setCalDay} onOpen={openMod('agenda')} />
            <FinancePanel onOpen={(id) => { setFinSel(id ?? data.wallets[0]?.id ?? 'all'); setOpen('money'); }} />
            <Panel title="Estudio" right={<span className={timer.running ? 'hud-val' : 'hud-sub'}>{timer.running ? 'en marcha' : `${studyToday} min hoy`}</span>} onOpen={openMod('study')} grow={.95}>
              <TimerControls timer={timer} />
              <div className="mt-2 flex items-center gap-3"><p className="hud-title !tracking-[.12em] text-3xl tabular-nums">{mm}:{ss}</p><div className="ml-auto flex gap-2"><button className="hud-btn !px-3" onClick={timer.toggle} aria-label={timer.running ? 'Pausar' : 'Iniciar estudio'}>{timer.running ? <Pause size={15} aria-hidden /> : <Play size={15} aria-hidden />}</button><button className="hud-icon" onClick={timer.reset} aria-label="Reiniciar"><RotateCcw size={14} aria-hidden /></button></div></div>
              <div className="mt-2"><Bar pct={100 - (timer.left / (timer.total * 60)) * 100} /></div>
            </Panel>
          </div>
        </div>
        <nav className="hud-dock" aria-label="Módulos">{MODS.map((m, i) => <button key={m.id} onClick={() => { setOpen(m.id); blip('open', sound); hudBus.emit('pulse'); }}><m.icon size={15} aria-hidden /><span className="hidden xl:inline">{m.label}</span><span className="hud-kbd">{i + 1}</span></button>)}</nav>
        <span className="sr-only">{status}</span>
      </div>
      <Drawer open={open !== null} onClose={() => setOpen(null)} label={open ? MODS.find((m) => m.id === open)?.label ?? '' : ''} className={open === 'schedule' ? 'w-full max-w-[min(1240px,97vw)]' : 'w-full max-w-xl'}>
        <div className="hud-root !h-full !min-h-0 overflow-y-auto p-5"><h2 className="hud-title mb-4 text-xl">{open ? MODS.find((m) => m.id === open)?.label.toUpperCase() : ''}</h2>{open && ModBody[open]}</div>
      </Drawer>
      <Drawer open={panel !== null} onClose={() => setPanel(null)} label={panel === 'settings' ? 'Ajustes' : 'Ayuda'} className="w-full max-w-md">
        <div className="hud-root !h-full !min-h-0 overflow-y-auto p-5"><h2 className="hud-title mb-5 text-xl">{panel === 'settings' ? 'AJUSTES' : 'AYUDA'}</h2>{panel === 'settings' ? <SettingsBody onSwitch={() => { setPanel(null); void switchProfile(); }} /> : <HelpBody />}</div>
      </Drawer>
    </div>
  );
}

/* ───────────── Chat con EDITH ───────────── */
const SUGGEST = ['¿Qué tengo hoy?', '¿Cuándo es mi próximo examen?', 'Resume mis finanzas del mes', 'Hazme un plan de estudio para esta semana'];
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
