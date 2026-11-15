import { useCallback, useEffect, useState } from 'react';
import { Building2, Loader2, PauseCircle, PlayCircle, RefreshCw } from 'lucide-react';
import { PLANS, PLAN_IDS, type PlanId } from '@/config/plans';
import { personalApi, type Client } from '@/services/personalApi';
import { fmtAgo } from '@/utils/format';
import { Empty, eur } from './shared';

/** Por encima de esto por alumno activo y mes, conviene hablar con el cliente (solo un aviso, no limita nada). */
const WA_FAIR_PER_STUDENT = 8;

/** Panel del propietario: los negocios que usan EDITH, su suscripción y su uso. Solo cifras, nunca datos personales de sus alumnos. */
export function Clients() {
  const [rows, setRows] = useState<Client[] | null>(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState(''); const [apply, setApply] = useState(true);
  const load = useCallback(async () => { try { setRows((await personalApi.clients()).clients); setErr(''); } catch (e) { setErr((e as Error).message); } }, []);
  useEffect(() => { void load(); }, [load]);

  const changePlan = async (c: Client, plan: PlanId) => {
    if (plan === c.plan) return;
    const info = PLANS[plan];
    const msg = `Cambiar «${c.name}» de ${PLANS[c.plan].label} a ${info.label} (${info.price} €/mes).${apply ? '\nSe desactivarán los módulos que el nuevo plan no incluya.' : '\nNo se tocarán sus módulos.'}\n¿Continuar?`;
    if (!window.confirm(msg)) return;
    setBusy(c.id); setNote('');
    try { const r = await personalApi.setClientPlan(c.id, plan, apply); setNote(`${r.name}: plan ${PLANS[plan].label}${r.disabled.length ? ` · módulos desactivados: ${r.disabled.join(', ')}` : ''}.`); await load(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  };
  const toggle = async (c: Client) => {
    const next = c.status === 'active' ? 'suspended' : 'active';
    if (!window.confirm(next === 'suspended' ? `Suspender «${c.name}»: nadie de ese negocio podrá entrar hasta reactivarlo.\n¿Continuar?` : `Reactivar «${c.name}».`)) return;
    setBusy(c.id); setNote('');
    try { const r = await personalApi.setClientStatus(c.id, next); setNote(`${r.name}: ${next === 'active' ? 'reactivado' : 'suspendido'}.`); await load(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  };

  if (!rows) return err ? <p role="alert" className="text-sm text-warn">{err}</p> : <p className="hud-sub flex items-center gap-2"><Loader2 size={14} className="animate-spin" aria-hidden />Cargando clientes…</p>;
  const active = rows.filter((r) => r.status === 'active'); const mrr = active.reduce((a, r) => a + PLANS[r.plan].price, 0); const wa = rows.reduce((a, r) => a + r.waMonth, 0);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2" aria-label="Resumen de clientes">
        {([['Clientes activos', String(active.length)], ['Ingreso mensual', eur(mrr)], ['WhatsApp este mes', String(wa)]] as const).map(([k, v]) => <div key={k} className="hud-panel !p-3"><p className="hud-sub">{k}</p><p className="hud-title mt-1 text-xl">{v}</p></div>)}
      </div>
      <label className="flex items-start gap-2 text-xs text-muted"><input type="checkbox" className="mt-0.5" checked={apply} onChange={(e) => setApply(e.target.checked)} />Al cambiar de plan, desactivar los módulos que el nuevo plan no incluye (nunca se activa ninguno solo).</label>
      {note && <p role="status" className="rounded border border-line px-3 py-2 text-xs text-ok">{note}</p>}
      {err && <p role="alert" className="text-xs text-warn">{err}</p>}
      {rows.length === 0 ? <Empty text="Aún no hay clientes." /> : (
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
        </ul>)}
      <button className="hud-btn" onClick={() => void load()}><RefreshCw size={14} aria-hidden />Actualizar</button>
    </div>
  );
}
