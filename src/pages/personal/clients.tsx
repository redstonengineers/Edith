import { useCallback, useEffect, useState } from 'react';
import { Building2, ChevronDown, ChevronUp, Copy, KeyRound, Loader2, PauseCircle, PlayCircle, Plus, RefreshCw, RotateCcw } from 'lucide-react';
import { PRESETS } from '@/config/presets';
import type { AcademyType } from '@/types';
import { PLANS, PLAN_IDS, type PlanId } from '@/config/plans';
import { personalApi, type Client, type NewClientResult } from '@/services/personalApi';
import { fmtAgo } from '@/utils/format';
import { Empty, Panel, eur } from './shared';

/** Por encima de esto por alumno activo y mes, conviene hablar con el cliente (solo un aviso, no limita nada). */
const WA_FAIR_PER_STUDENT = 8;
const CHANGED = 'edith:clients-changed';
const APPLY_KEY = 'ac.hud.clients.apply';

/** Datos y acciones de los clientes. Lo comparten la tarjeta de la pantalla principal y el panel completo: al cambiar algo en uno, el otro se actualiza. */
function useClients() {
  const [rows, setRows] = useState<Client[] | null>(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState<string | null>(null); const [note, setNote] = useState('');
  const [apply, setApplyRaw] = useState(() => { try { return localStorage.getItem(APPLY_KEY) !== '0'; } catch { return true; } });
  const setApply = (v: boolean) => { setApplyRaw(v); try { localStorage.setItem(APPLY_KEY, v ? '1' : '0'); } catch { /* sin almacenamiento */ } };
  const load = useCallback(async () => { try { setRows((await personalApi.clients()).clients); setErr(''); } catch (e) { setErr((e as Error).message); } }, []);
  useEffect(() => { void load(); const on = () => void load(); window.addEventListener(CHANGED, on); return () => window.removeEventListener(CHANGED, on); }, [load]);
  const done = async (msg: string) => { setNote(msg); window.dispatchEvent(new Event(CHANGED)); };

  const changePlan = async (c: Client, plan: PlanId) => {
    if (plan === c.plan) return;
    const info = PLANS[plan];
    if (!window.confirm(`Cambiar «${c.name}» de ${PLANS[c.plan].label} a ${info.label} (${info.price} €/mes).${apply ? '\nSe desactivarán los módulos que el nuevo plan no incluya.' : '\nNo se tocarán sus módulos.'}\n¿Continuar?`)) return;
    setBusy(c.id); setNote('');
    try { const r = await personalApi.setClientPlan(c.id, plan, apply); await done(`${r.name}: plan ${PLANS[plan].label}${r.disabled.length ? ` · módulos desactivados: ${r.disabled.join(', ')}` : ''}.`); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  };
  const [made, setMade] = useState<NewClientResult | null>(null);
  const makeReal = async (c: Client) => {
    const email = window.prompt(`Pasar «${c.name}» de demostración a cliente real.\nSus datos dejarán de ser una demo abierta y solo se entrará con correo y contraseña.\n\nCorreo del administrador que recibirá la contraseña provisional:`); if (!email) return;
    setBusy(c.id); setNote('');
    try { const r = await personalApi.makeReal(c.id, email); setMade({ academyId: c.id, name: r.name, plan: c.plan, adminEmail: r.adminEmail, password: r.password }); await done(`${r.name}: ya es un cliente real.`); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  };
  const toggle = async (c: Client) => {
    const next = c.status === 'active' ? 'suspended' : 'active';
    if (!window.confirm(next === 'suspended' ? `Suspender «${c.name}»: nadie de ese negocio podrá entrar hasta reactivarlo.\n¿Continuar?` : `Reactivar «${c.name}».`)) return;
    setBusy(c.id); setNote('');
    try { const r = await personalApi.setClientStatus(c.id, next); await done(`${r.name}: ${next === 'active' ? 'reactivado' : 'suspendido'}.`); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  };
  return { rows, err, busy, note, apply, setApply, load, changePlan, toggle, makeReal, made, clearMade: () => setMade(null) };
}
type Ctl = ReturnType<typeof useClients>;

function Kpis({ rows }: { rows: Client[] }) {
  const active = rows.filter((r) => r.status === 'active'); const mrr = active.reduce((a, r) => a + PLANS[r.plan].price, 0); const wa = rows.reduce((a, r) => a + r.waMonth, 0);
  return (
    <div className="grid grid-cols-3 gap-2" aria-label="Resumen de clientes">
      {([['Clientes activos', String(active.length)], ['Ingreso mensual', eur(mrr)], ['WhatsApp este mes', String(wa)]] as const).map(([k, v]) => <div key={k} className="hud-panel !p-3"><p className="hud-sub">{k}</p><p className="hud-title mt-1 text-xl">{v}</p></div>)}
    </div>
  );
}

function ClientList({ ctl, rows }: { ctl: Ctl; rows: Client[] }) {
  const { busy, changePlan, toggle, makeReal } = ctl;
  if (rows.length === 0) return <Empty text="Aún no hay clientes." />;
  return (
    <ul className="space-y-3" aria-label="Clientes">
      {rows.map((c) => { const high = c.waMonth > Math.max(100, c.students * WA_FAIR_PER_STUDENT); return (
        <li key={c.id} className="hud-panel !p-3" data-client={c.slug ?? c.id}>
          <div className="flex flex-wrap items-center gap-2">
            <Building2 size={15} aria-hidden className="text-muted" /><p className="hud-title text-sm">{c.name}</p>
            <span className="hud-chip">{c.status === 'active' ? 'Activo' : 'Suspendido'}</span>{c.isDemo && <span className="hud-chip" title="Demostración abierta: entra sin contraseña">Demo</span>}
            <span className="ml-auto text-xs text-muted">{PLANS[c.plan].price ? `${PLANS[c.plan].price} €/mes` : 'sin cobro'}</span>
          </div>
          <p className="mt-1 text-xs text-muted">{c.type}{c.slug ? ` · /acceso/${c.slug}` : ''} · {c.users} usuarios · {c.students} alumnos · WhatsApp mes: <b>{c.waMonth}</b> ({c.waPrev} mes ant.){high && <span className="ml-1 text-warn"> · uso alto</span>} · {c.lastActivity ? `activo ${fmtAgo(c.lastActivity)}` : 'sin actividad'}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs"><span className="hud-sub">Plan</span>
              <select aria-label={`Plan de ${c.name}`} className="hud-input !h-8 !w-auto" value={c.plan} disabled={busy === c.id} onChange={(e) => void changePlan(c, e.target.value as PlanId)}>{PLAN_IDS.map((p) => <option key={p} value={p}>{PLANS[p].label}{PLANS[p].price ? ` · ${PLANS[p].price} €` : ''}</option>)}</select></label>
            <button className="hud-btn !inline-flex !h-8 items-center gap-1.5" disabled={busy === c.id} onClick={() => void toggle(c)}>{c.status === 'active' ? <><PauseCircle size={14} aria-hidden />Suspender</> : <><PlayCircle size={14} aria-hidden />Reactivar</>}</button>
            {c.isDemo && <button className="hud-btn !inline-flex !h-8 items-center gap-1.5" disabled={busy === c.id} onClick={() => void makeReal(c)}><KeyRound size={14} aria-hidden />Pasar a cliente real</button>}
            {busy === c.id && <Loader2 size={14} className="animate-spin" aria-hidden />}
          </div>
          <p className="mt-1.5 text-[11px] text-muted">{PLANS[c.plan].summary}</p>
        </li>); })}
    </ul>
  );
}

function Feedback({ ctl }: { ctl: Ctl }) {
  return <>
    <label className="flex items-start gap-2 text-xs text-muted"><input type="checkbox" className="mt-0.5" checked={ctl.apply} onChange={(e) => ctl.setApply(e.target.checked)} />Al cambiar de plan, desactivar los módulos que el nuevo plan no incluye (nunca se activa ninguno solo).</label>
    {ctl.note && <p role="status" className="rounded border border-line px-3 py-2 text-xs text-ok">{ctl.note}</p>}
    {ctl.err && <p role="alert" className="text-xs text-warn">{ctl.err}</p>}
  </>;
}

const SECTORS = (Object.entries(PRESETS) as [AcademyType, { label: string }][]).map(([id, p]) => ({ id, label: p.label })).sort((a, b) => a.label.localeCompare(b.label, 'es'));

/** Datos de acceso de un cliente recién creado: la contraseña se muestra UNA vez (después solo existe su hash en el servidor). */
function Credentials({ made, onDone }: { made: NewClientResult; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  const text = `Acceso a EDITH · ${made.name}\nWeb: ${window.location.origin}/login\nCorreo: ${made.adminEmail}\nContraseña provisional: ${made.password}\n(Te pedirá cambiarla en tu primer acceso.)`;
  return (
    <div className="hud-panel !p-4 space-y-3" role="region" aria-label="Cliente creado">
      <p className="hud-title text-sm flex items-center gap-2"><KeyRound size={15} aria-hidden />Datos de acceso: {made.name}</p>
      <p className="text-xs text-warn">Guarda estos datos ahora: la contraseña NO se vuelve a mostrar (solo se guarda cifrada). El cliente deberá cambiarla en su primer acceso.</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm"><dt className="hud-sub">Correo</dt><dd className="select-all">{made.adminEmail}</dd><dt className="hud-sub">Contraseña</dt><dd className="select-all font-mono tracking-wide" data-testid="new-client-password">{made.password}</dd><dt className="hud-sub">Entrada</dt><dd>{window.location.origin}/login</dd></dl>
      <div className="flex flex-wrap gap-2">
        <button className="hud-btn !inline-flex items-center gap-1.5" onClick={() => void navigator.clipboard?.writeText(text).then(() => setCopied(true))}><Copy size={14} aria-hidden />{copied ? 'Copiado' : 'Copiar datos de acceso'}</button>
        <button className="hud-btn" onClick={onDone}>Hecho, ya lo he guardado</button>
      </div>
    </div>);
}

/** Alta de un cliente: nombre, sector, plan y correo del administrador. La contraseña la genera el servidor y se enseña UNA vez. */
function NewClient({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [f, setF] = useState({ academyName: '', type: 'educativa' as AcademyType, plan: 'basic' as PlanId, adminEmail: '', adminName: '' }); const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [made, setMade] = useState<NewClientResult | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { setMade(await personalApi.createClient({ academyName: f.academyName, type: f.type, plan: f.plan, adminEmail: f.adminEmail, adminName: f.adminName || undefined })); window.dispatchEvent(new Event(CHANGED)); }
    catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };
  if (made) return <Credentials made={made} onDone={onDone} />;
  return (
    <form onSubmit={(e) => void submit(e)} className="hud-panel !p-4 space-y-3" aria-label="Nuevo cliente">
      <p className="hud-title text-sm">Nuevo cliente</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block text-xs"><span className="hud-sub">Nombre del negocio</span><input required minLength={2} className="hud-input mt-1" value={f.academyName} onChange={(e) => setF({ ...f, academyName: e.target.value })} /></label>
        <label className="block text-xs"><span className="hud-sub">Sector</span><select className="hud-input mt-1" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as AcademyType })}>{SECTORS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
        <label className="block text-xs"><span className="hud-sub">Plan</span><select className="hud-input mt-1" value={f.plan} onChange={(e) => setF({ ...f, plan: e.target.value as PlanId })}>{PLAN_IDS.map((p) => <option key={p} value={p}>{PLANS[p].label}{PLANS[p].price ? ` · ${PLANS[p].price} €/mes` : ''}</option>)}</select></label>
        <label className="block text-xs"><span className="hud-sub">Correo del administrador</span><input required type="email" className="hud-input mt-1" value={f.adminEmail} onChange={(e) => setF({ ...f, adminEmail: e.target.value })} /></label>
        <label className="block text-xs sm:col-span-2"><span className="hud-sub">Nombre del administrador (opcional)</span><input className="hud-input mt-1" value={f.adminName} onChange={(e) => setF({ ...f, adminName: e.target.value })} /></label>
      </div>
      <p className="text-[11px] text-muted">EDITH genera una contraseña aleatoria fuerte y te la enseña una sola vez. El cliente entra por /login y la cambia en su primer acceso.</p>
      {err && <p role="alert" className="text-xs text-warn">{err}</p>}
      <div className="flex gap-2"><button className="hud-btn" type="submit" disabled={busy}>{busy ? <Loader2 size={14} className="animate-spin" aria-hidden /> : 'Crear cliente'}</button><button className="hud-btn" type="button" onClick={onCancel}>Cancelar</button></div>
    </form>
  );
}

/** Panel completo de clientes (cajón del módulo «Clientes»). */
export function Clients() {
  const ctl = useClients(); const { rows, err } = ctl; const [creating, setCreating] = useState(false); const [msg, setMsg] = useState(''); const [busyReset, setBusyReset] = useState(false);
  const reset = async () => {
    if (!window.confirm('Restaurar las demos (Atlanta, Academia y Clínica) a sus datos de fábrica. No toca a ningún cliente.\n¿Continuar?')) return;
    setBusyReset(true); setMsg(''); try { const r = await personalApi.resetDemos(); setMsg(`Demos restauradas: ${r.restored.join(', ') || 'ninguna'}.`); window.dispatchEvent(new Event(CHANGED)); } catch (e) { setMsg((e as Error).message); } finally { setBusyReset(false); }
  };
  if (!rows) return err ? <p role="alert" className="text-sm text-warn">{err}</p> : <p className="hud-sub flex items-center gap-2"><Loader2 size={14} className="animate-spin" aria-hidden />Cargando clientes…</p>;
  return (
    <div className="space-y-4">
      <Kpis rows={rows} />
      {creating ? <NewClient onDone={() => setCreating(false)} onCancel={() => setCreating(false)} /> : <button className="hud-btn !inline-flex items-center gap-1.5" onClick={() => setCreating(true)}><Plus size={14} aria-hidden />Nuevo cliente</button>}
      {ctl.made && <Credentials made={ctl.made} onDone={ctl.clearMade} />}
      <Feedback ctl={ctl} /><ClientList ctl={ctl} rows={rows} />
      {msg && <p role="status" className="rounded border border-line px-3 py-2 text-xs text-ok">{msg}</p>}
      <div className="flex flex-wrap gap-2">
        <button className="hud-btn" onClick={() => void ctl.load()}><RefreshCw size={14} aria-hidden />Actualizar</button>
        <button className="hud-btn !inline-flex items-center gap-1.5" disabled={busyReset} onClick={() => void reset()}><RotateCcw size={14} aria-hidden />Restaurar demos</button>
      </div>
    </div>
  );
}

const OPEN_KEY = 'ac.hud.clients.open';
/** Tarjeta grande de la pantalla principal: resumen siempre visible y la lista de clientes al desplegarla (se recuerda abierta o minimizada). */
export function ClientsCard({ onOpen, className = '' }: { onOpen: () => void; className?: string }) {
  const ctl = useClients(); const { rows, err } = ctl;
  const [open, setOpenRaw] = useState(() => { try { return localStorage.getItem(OPEN_KEY) === '1'; } catch { return false; } });
  const setOpen = (v: boolean) => { setOpenRaw(v); try { localStorage.setItem(OPEN_KEY, v ? '1' : '0'); } catch { /* sin almacenamiento */ } };
  const toggle = <button className="hud-ghost" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={open ? 'Minimizar clientes' : 'Desplegar clientes'} title={open ? 'Minimizar' : 'Desplegar'}>{open ? <ChevronUp size={15} aria-hidden /> : <ChevronDown size={15} aria-hidden />}</button>;
  return (
    <Panel title="Clientes" right={toggle} onOpen={onOpen} className={`clients-card ${className}`} grow={0}>
      {!rows ? (err ? <p className="text-xs text-muted">{/401|Sesión/.test(err) ? 'Inicia sesión personal para ver tus clientes.' : err}</p> : <p className="hud-sub flex items-center gap-2"><Loader2 size={13} className="animate-spin" aria-hidden />Cargando…</p>) : (
        <div className="space-y-3">
          <Kpis rows={rows} />
          {open && <div className="clients-card-body space-y-3"><Feedback ctl={ctl} /><ClientList ctl={ctl} rows={rows} /></div>}
        </div>)}
    </Panel>
  );
}
