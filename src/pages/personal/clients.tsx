import { useCallback, useEffect, useState } from 'react';
import { Building2, ChevronDown, ChevronUp, Loader2, PauseCircle, PlayCircle, RefreshCw } from 'lucide-react';
import { PLANS, PLAN_IDS, type PlanId } from '@/config/plans';
import { personalApi, type Client } from '@/services/personalApi';
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
  const toggle = async (c: Client) => {
    const next = c.status === 'active' ? 'suspended' : 'active';
    if (!window.confirm(next === 'suspended' ? `Suspender «${c.name}»: nadie de ese negocio podrá entrar hasta reactivarlo.\n¿Continuar?` : `Reactivar «${c.name}».`)) return;
    setBusy(c.id); setNote('');
    try { const r = await personalApi.setClientStatus(c.id, next); await done(`${r.name}: ${next === 'active' ? 'reactivado' : 'suspendido'}.`); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  };
  return { rows, err, busy, note, apply, setApply, load, changePlan, toggle };
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
  const { busy, changePlan, toggle } = ctl;
  if (rows.length === 0) return <Empty text="Aún no hay clientes." />;
  return (
    <ul className="space-y-3" aria-label="Clientes">
      {rows.map((c) => { const high = c.waMonth > Math.max(100, c.students * WA_FAIR_PER_STUDENT); return (
        <li key={c.id} className="hud-panel !p-3" data-client={c.slug ?? c.id}>
          <div className="flex flex-wrap items-center gap-2">
            <Building2 size={15} aria-hidden className="text-muted" /><p className="hud-title text-sm">{c.name}</p>
            <span className="hud-chip">{c.status === 'active' ? 'Activo' : 'Suspendido'}</span>
            <span className="ml-auto text-xs text-muted">{PLANS[c.plan].price ? `${PLANS[c.plan].price} €/mes` : 'sin cobro'}</span>
          </div>
          <p className="mt-1 text-xs text-muted">{c.type}{c.slug ? ` · /acceso/${c.slug}` : ''} · {c.users} usuarios · {c.students} alumnos · WhatsApp mes: <b>{c.waMonth}</b> ({c.waPrev} mes ant.){high && <span className="ml-1 text-warn"> · uso alto</span>} · {c.lastActivity ? `activo ${fmtAgo(c.lastActivity)}` : 'sin actividad'}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs"><span className="hud-sub">Plan</span>
              <select aria-label={`Plan de ${c.name}`} className="hud-input !h-8 !w-auto" value={c.plan} disabled={busy === c.id} onChange={(e) => void changePlan(c, e.target.value as PlanId)}>{PLAN_IDS.map((p) => <option key={p} value={p}>{PLANS[p].label}{PLANS[p].price ? ` · ${PLANS[p].price} €` : ''}</option>)}</select></label>
            <button className="hud-btn !inline-flex !h-8 items-center gap-1.5" disabled={busy === c.id} onClick={() => void toggle(c)}>{c.status === 'active' ? <><PauseCircle size={14} aria-hidden />Suspender</> : <><PlayCircle size={14} aria-hidden />Reactivar</>}</button>
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

/** Panel completo de clientes (cajón del módulo «Clientes»). */
export function Clients() {
  const ctl = useClients(); const { rows, err } = ctl;
  if (!rows) return err ? <p role="alert" className="text-sm text-warn">{err}</p> : <p className="hud-sub flex items-center gap-2"><Loader2 size={14} className="animate-spin" aria-hidden />Cargando clientes…</p>;
  return (
    <div className="space-y-4">
      <Kpis rows={rows} /><Feedback ctl={ctl} /><ClientList ctl={ctl} rows={rows} />
      <button className="hud-btn" onClick={() => void ctl.load()}><RefreshCw size={14} aria-hidden />Actualizar</button>
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
