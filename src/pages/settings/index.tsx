import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Palette, RotateCcw, ShieldCheck, UserCog } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/form';
import { ConfirmDialog } from '@/components/ui/Overlay';
import { Badge, Panel } from '@/components/ui/primitives';
import { useAction, useCan, useSnapshot, useUser, useVisibleModules } from '@/hooks';
import { fieldErrors, generalSchema } from '@/lib/schemas';
import { PRESETS } from '@/config/presets';
import { resetDatabase } from '@/services/database';
import { updateGeneral } from '@/services/mutations';
import { useSession } from '@/store/session';
import { IS_API } from '@/services/mode';

export default function SettingsPage() {
  const snap = useSnapshot(); const user = useUser(); const can = useCan(); const run = useAction(); const mods = useVisibleModules(); const signOut = useSession((s) => s.signOut);
  const st = snap.settings; const [f, setF] = useState({ currency: st.currency, attendanceAlertThreshold: String(st.attendanceAlertThreshold) }); const [err, setErr] = useState<Record<string, string>>({}); const [reset, setReset] = useState(false);
  const write = can('settings:write'); const has = (id: string) => mods.some((m) => m.id === id);
  const save = async () => { const p = generalSchema.safeParse(f); if (!p.success) return setErr(fieldErrors(p.error)); setErr({}); await run(() => updateGeneral(user, p.data), 'Ajustes guardados'); };
  const links = [['customization', '/personalizacion', Palette, 'Personalización', 'Marca, vocabulario y módulos'], ['users', '/usuarios', UserCog, 'Usuarios', 'Cuentas de acceso y roles'], ['permissions', '/permisos', ShieldCheck, 'Permisos', 'Qué puede hacer cada rol']] as const;
  return (
    <>
      <PageHeader title="Configuración" description="Ajustes generales de la academia." />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">{links.filter(([id]) => has(id)).map(([id, to, I, t, d]) => <Link key={id} to={to} className="panel p-4 transition-colors hover:border-brand/50"><I size={18} className="text-brand-text" aria-hidden /><p className="mt-2 text-sm font-semibold">{t}</p><p className="text-xs text-muted">{d}</p></Link>)}</div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Academia"><dl className="space-y-2 text-sm"><div className="flex justify-between"><dt className="text-muted">Nombre</dt><dd>{snap.academy.name}</dd></div><div className="flex justify-between"><dt className="text-muted">Tipo</dt><dd>{PRESETS[snap.academy.type].label}</dd></div><div className="flex justify-between"><dt className="text-muted">Plan</dt><dd><Badge tone="brand">{snap.academy.plan}</Badge></dd></div><div className="flex justify-between"><dt className="text-muted">Alta</dt><dd>{snap.academy.createdAt}</dd></div></dl></Panel>
        <Panel title="Ajustes generales"><fieldset disabled={!write} className="space-y-4 border-0 p-0">
          <Field label="Moneda">{(p) => <Select {...p} value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })}><option value="EUR">Euro (€)</option><option value="USD">Dólar (US$)</option><option value="GBP">Libra (£)</option><option value="MXN">Peso mexicano (MX$)</option></Select>}</Field>
          <Field label="Umbral de alerta de asistencia (%)" error={err.attendanceAlertThreshold} hint="Por debajo de este porcentaje se avisa en el panel y en la ficha.">{(p) => <Input {...p} type="number" min={10} max={100} value={f.attendanceAlertThreshold} onChange={(e) => setF({ ...f, attendanceAlertThreshold: e.target.value })} />}</Field>
          {write && <Button variant="primary" onClick={() => void save()}>Guardar</Button>}</fieldset></Panel>
        {!IS_API && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') ? (
          <Panel title="Datos de demostración" className="lg:col-span-2"><p className="text-sm text-muted">Esta versión guarda los datos en el navegador. Puedes restaurar el conjunto de demostración original (se pierden los cambios de todas las academias demo en este navegador).</p><Button className="mt-3" variant="danger" onClick={() => setReset(true)}><RotateCcw size={15} />Restablecer datos de demostración</Button></Panel>) : null}
      </div>
      <ConfirmDialog open={reset} danger title="¿Restablecer los datos de demostración?" description="Se borrarán todos los cambios y se cerrará la sesión." confirmLabel="Restablecer" onClose={() => setReset(false)} onConfirm={() => { void signOut().then(() => { resetDatabase(); localStorage.removeItem('ac.theme'); location.assign('/login'); }); }} />
    </>
  );
}
