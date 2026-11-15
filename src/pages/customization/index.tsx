import { useRef, useState } from 'react';
import { AlertTriangle, ImageUp, Lock, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/controls';
import { Field, Input, Select } from '@/components/ui/form';
import { Badge, Panel } from '@/components/ui/primitives';
import { MODULES, SECTION_ORDER, SECTION_TITLES } from '@/config/modules';
import { PRESETS } from '@/config/presets';
import { useAction, useCan, useSettings, useSnapshot, useUser } from '@/hooks';
import { contrast, onColor, SURFACES } from '@/lib/color';
import { brandingSchema, fieldErrors, labelSchema } from '@/lib/schemas';
import { applyPreset, MAX_LOGO_KB, MODULE_DEPS, setModules, updateBranding, updateLabels } from '@/services/mutations';
import { useUi } from '@/store/ui';
import type { AcademyType, EntityLabel, LabelKey, ModuleId, ThemeMode } from '@/types';
import { cn } from '@/utils/cn';

const readImage = (f: File): Promise<string> => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new Error('No se pudo leer el archivo')); r.readAsDataURL(f); });

function Preview({ name, tagline, logo, primary, secondary, theme }: { name: string; tagline: string; logo?: string; primary: string; secondary: string; theme: ThemeMode }) {
  const surface = SURFACES[theme];
  return (
    <div data-theme={theme} style={{ ['--brand' as string]: primary, ['--brand-2' as string]: secondary, ['--on-brand' as string]: onColor(primary), background: theme === 'dark' ? '#070b13' : '#f4f6fb', color: theme === 'dark' ? '#e8edf6' : '#0f172a', ['--surface' as string]: surface }} className="rounded-xl border border-line p-4" aria-label="Vista previa de la marca" role="group">
      <div className="mb-3 flex items-center gap-3">
        {logo ? <img src={logo} alt="" className="h-8 w-8 rounded-lg object-contain" /> : <span aria-hidden className="grid h-8 w-8 place-items-center rounded-[10px] text-sm font-bold text-on-brand" style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}>{name.trim()[0]?.toUpperCase() ?? 'A'}</span>}
        <div><p className="text-sm leading-tight font-semibold">{name || 'Tu academia'}</p><p className="text-[10px] opacity-60">{tagline || 'EDITH'}</p></div>
      </div>
      <div className="mb-3 rounded-lg px-3 py-2 text-[13px] font-medium" style={{ background: `color-mix(in oklab, ${primary} 14%, transparent)`, borderLeft: `3px solid ${primary}` }}>Command Center</div>
      <div className="flex flex-wrap items-center gap-2"><span className="rounded-lg bg-brand px-3 py-1.5 text-[13px] font-medium text-on-brand">Acción principal</span><span className="rounded-md px-2 py-0.5 text-[11px] font-medium" style={{ background: `color-mix(in oklab, ${primary} 15%, transparent)`, color: theme === 'dark' ? `color-mix(in oklab, ${primary} 82%, white)` : `color-mix(in oklab, ${primary} 62%, black)` }}>Etiqueta</span><span className="h-2 w-24 rounded-full" style={{ background: `linear-gradient(90deg, ${primary}, ${secondary})` }} /></div>
    </div>
  );
}

function BrandTab() {
  const st = useSettings(); const user = useUser(); const run = useAction(); const toast = useUi((s) => s.toast);
  const b = st.branding; const [f, setF] = useState({ name: b.name, tagline: b.tagline, primary: b.primary, secondary: b.secondary, theme: b.theme as ThemeMode });
  const [logo, setLogo] = useState<string | null | undefined>(undefined); const [fav, setFav] = useState<string | null | undefined>(undefined); const [err, setErr] = useState<Record<string, string>>({});
  const logoRef = useRef<HTMLInputElement>(null); const favRef = useRef<HTMLInputElement>(null);
  const shownLogo = logo === undefined ? b.logoUrl : logo ?? undefined;
  const ratio = contrast(f.primary, SURFACES[f.theme]);
  const pick = async (file: File | undefined, set: (v: string) => void) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp|svg\+xml|x-icon|vnd\.microsoft\.icon)$/.test(file.type)) return toast({ kind: 'error', title: 'Formato no permitido', description: 'Usa PNG, JPG, WebP, SVG o ICO.' });
    if (file.size > MAX_LOGO_KB * 1024) return toast({ kind: 'error', title: 'Imagen demasiado grande', description: `Máximo ${MAX_LOGO_KB} KB.` });
    set(await readImage(file));
  };
  const save = async () => {
    const p = brandingSchema.safeParse(f); if (!p.success) return setErr(fieldErrors(p.error)); setErr({});
    if (await run(() => updateBranding(user, { ...p.data, logoUrl: logo, faviconUrl: fav }), 'Marca actualizada')) { setLogo(undefined); setFav(undefined); }
  };
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const color = (k: 'primary' | 'secondary', label: string) => (
    <Field label={label} error={err[k]}>{(p) => <div className="flex gap-2"><input type="color" aria-label={`${label} (selector)`} value={f[k]} onChange={set(k)} className="h-10 w-12 cursor-pointer rounded-lg border border-line bg-transparent p-1" /><Input {...p} value={f[k]} onChange={set(k)} className="font-mono uppercase" maxLength={7} /></div>}</Field>
  );
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <Panel title="Identidad"><div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre de la academia" required error={err.name}>{(p) => <Input {...p} value={f.name} onChange={set('name')} />}</Field>
          <Field label="Eslogan" error={err.tagline}>{(p) => <Input {...p} value={f.tagline} onChange={set('tagline')} />}</Field>
          <div><p className="mb-1.5 text-[13px] font-medium">Logo</p><div className="flex items-center gap-2">{shownLogo ? <img src={shownLogo} alt="Logo actual" className="h-10 w-10 rounded-lg border border-line object-contain" /> : <span className="grid h-10 w-10 place-items-center rounded-lg border border-dashed border-line text-xs text-muted">—</span>}
            <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={(e) => void pick(e.target.files?.[0], setLogo)} /><Button size="sm" onClick={() => logoRef.current?.click()}><ImageUp size={14} />Subir</Button>{shownLogo && <Button size="sm" variant="ghost" aria-label="Quitar logo" onClick={() => setLogo(null)}><Trash2 size={14} /></Button>}</div></div>
          <div><p className="mb-1.5 text-[13px] font-medium">Favicon</p><div className="flex items-center gap-2">{(fav === undefined ? b.faviconUrl : fav) ? <img src={(fav === undefined ? b.faviconUrl : fav) ?? ''} alt="Favicon actual" className="h-10 w-10 rounded-lg border border-line object-contain p-1" /> : <span className="grid h-10 w-10 place-items-center rounded-lg border border-dashed border-line text-xs text-muted">—</span>}
            <input ref={favRef} type="file" accept="image/png,image/svg+xml,image/x-icon,image/vnd.microsoft.icon" hidden onChange={(e) => void pick(e.target.files?.[0], setFav)} /><Button size="sm" onClick={() => favRef.current?.click()}><ImageUp size={14} />Subir</Button></div></div>
        </div></Panel>
        <Panel title="Color y tema"><div className="grid gap-4 sm:grid-cols-2">
          {color('primary', 'Color principal')}{color('secondary', 'Color secundario')}
          <Field label="Tema por defecto">{(p) => <Select {...p} value={f.theme} onChange={set('theme')}><option value="dark">Oscuro</option><option value="light">Claro</option></Select>}</Field>
        </div>
          {ratio < 3 && <p role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-[13px] text-warn"><AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden />Este color tiene poco contraste ({ratio.toFixed(1)}:1) con el fondo del tema {f.theme === 'dark' ? 'oscuro' : 'claro'}. Los elementos de marca pueden costar de ver; se recomienda al menos 3:1.</p>}
          <p className="mt-3 text-xs text-muted">El texto sobre botones de marca se ajusta solo (blanco u oscuro) para mantener la legibilidad.</p></Panel>
        <div className="flex justify-end"><Button variant="primary" onClick={() => void save()}>Guardar marca</Button></div>
      </div>
      <div className="lg:sticky lg:top-24 lg:self-start"><Panel title="Vista previa"><Preview name={f.name} tagline={f.tagline} logo={shownLogo} primary={f.primary} secondary={f.secondary} theme={f.theme} /><p className="mt-3 text-xs text-muted">Los cambios se aplican a toda la aplicación al guardar.</p></Panel></div>
    </div>
  );
}

function LabelsTab() {
  const st = useSettings(); const user = useUser(); const run = useAction(); const [labels, setLabels] = useState<Record<LabelKey, EntityLabel>>(structuredClone(st.labels)); const [err, setErr] = useState<Record<string, string>>({}); const [preset, setPreset] = useState<AcademyType>('educativa');
  const keys = Object.keys(labels) as LabelKey[]; const names: Record<LabelKey, string> = { student: 'Alumnos', teacher: 'Profesores', group: 'Grupos', class: 'Clases', subject: 'Asignaturas', exam: 'Exámenes', classroom: 'Aulas', enrollment: 'Matrículas', payment: 'Pagos', incident: 'Incidencias', document: 'Documentos' };
  const save = async () => { const e: Record<string, string> = {}; for (const k of keys) { const r = labelSchema.safeParse(labels[k]); if (!r.success) e[k] = Object.values(fieldErrors(r.error))[0]; } setErr(e); if (!Object.keys(e).length) await run(() => updateLabels(user, labels), 'Vocabulario actualizado'); };
  return (
    <div className="space-y-6">
      <Panel title="Plantilla por tipo de academia">
        <div className="flex flex-wrap items-end gap-3"><div className="w-56"><Field label="Tipo">{(p) => <Select {...p} value={preset} onChange={(e) => setPreset(e.target.value as AcademyType)}>{(Object.entries(PRESETS) as [AcademyType, { label: string }][]).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select>}</Field></div>
          <Button onClick={async () => { if (await run(() => applyPreset(user, preset), 'Plantilla aplicada')) { const fresh = { ...structuredClone(st.labels) }; setLabels(fresh); } }}>Aplicar vocabulario</Button></div>
        <p className="mt-2 text-xs text-muted">Ej.: una autoescuela usa «Alumnos / Conductores» y «Permisos»; una academia de idiomas, «Cursos».</p>
      </Panel>
      <Panel title="Nombres de cada elemento" bodyClassName="px-0 pb-2">
        <ul className="divide-y divide-line">{keys.map((k) => (
          <li key={k} className="grid items-start gap-3 px-5 py-3 sm:grid-cols-[140px_1fr_1fr]"><span className="pt-2.5 text-sm text-muted">{names[k]}</span>
            <Field label="Singular">{(p) => <Input {...p} value={labels[k].singular} onChange={(e) => setLabels({ ...labels, [k]: { ...labels[k], singular: e.target.value } })} aria-invalid={err[k] ? true : undefined} />}</Field>
            <Field label="Plural" error={err[k]}>{(p) => <Input {...p} value={labels[k].plural} onChange={(e) => setLabels({ ...labels, [k]: { ...labels[k], plural: e.target.value } })} />}</Field></li>))}</ul>
      </Panel>
      <div className="flex justify-end"><Button variant="primary" onClick={() => void save()}>Guardar vocabulario</Button></div>
    </div>
  );
}

/** Activa un módulo junto con los que necesita, o desactiva un módulo junto con los que dependen de él. */
function toggleModule(mods: Partial<Record<ModuleId, boolean>>, id: ModuleId, on: boolean): Partial<Record<ModuleId, boolean>> {
  const next = { ...mods, [id]: on };
  const need = (m: ModuleId) => { for (const d of MODULE_DEPS[m] ?? []) if (!next[d]) { next[d] = true; need(d); } };
  const drop = (m: ModuleId) => { for (const [k, deps] of Object.entries(MODULE_DEPS) as [ModuleId, ModuleId[]][]) if (deps.includes(m) && next[k]) { next[k] = false; drop(k); } };
  if (on) need(id); else drop(id);
  return next;
}
function ModulesTab() {
  const st = useSettings(); const user = useUser(); const run = useAction(); const toast = useUi((s) => s.toast);
  const [mods, setMods] = useState<Partial<Record<ModuleId, boolean>>>({ ...st.modules });
  const save = async () => { try { await run(() => setModules(user, { ...mods }), 'Módulos actualizados'); } catch (e) { toast({ kind: 'error', title: (e as Error).message }); } };
  return (
    <div className="space-y-6">
      {SECTION_ORDER.filter((s) => s !== 'platform' && MODULES.some((m) => m.section === s && m.id !== 'dashboard')).map((sec) => (
        <Panel key={sec} title={SECTION_TITLES[sec]} bodyClassName="px-0 pb-1"><ul className="divide-y divide-line">
          {MODULES.filter((m) => m.section === sec && m.id !== 'dashboard' && m.id !== 'platform').map((m) => { const on = m.core || mods[m.id] === true; const Icon = m.icon; return (
            <li key={m.id} className="flex items-center gap-3 px-5 py-3"><Icon size={17} className="shrink-0 text-muted" aria-hidden /><div className="min-w-0 flex-1"><p className="text-sm font-medium">{m.title}</p><p className="text-xs text-muted">{m.description}</p></div>
              {m.core ? <Badge><Lock size={10} aria-hidden />Siempre activo</Badge> : (
                <button role="switch" aria-checked={on} aria-label={`${on ? 'Desactivar' : 'Activar'} ${m.title}`} onClick={() => setMods(toggleModule(mods, m.id, !on))} className={cn('relative h-6 w-11 shrink-0 rounded-full border transition-colors', on ? 'border-brand bg-brand' : 'border-line-strong bg-surface-2')}><span className={cn('absolute top-0.5 left-0.5 h-4.5 w-4.5 rounded-full bg-white shadow transition-transform', on && 'translate-x-5')} style={{ width: 18, height: 18 }} /></button>)}</li>); })}</ul></Panel>))}
      <div className="flex justify-end"><Button variant="primary" onClick={() => void save()}>Guardar módulos</Button></div>
    </div>
  );
}

export default function CustomizationPage() {
  const can = useCan(); useSnapshot();
  return (
    <>
      <PageHeader title="Personalización" description="Marca, vocabulario y módulos de tu academia." />
      {!can('customization:write') && <p className="mb-4 text-sm text-muted">Solo lectura: tu rol no puede modificar la personalización.</p>}
      <fieldset disabled={!can('customization:write')} className="min-w-0 border-0 p-0">
        <Tabs tabs={[{ id: 'marca', label: 'Marca', content: <BrandTab /> }, { id: 'vocab', label: 'Vocabulario', content: <LabelsTab /> }, { id: 'mods', label: 'Módulos', content: <ModulesTab /> }]} />
      </fieldset>
    </>
  );
}
