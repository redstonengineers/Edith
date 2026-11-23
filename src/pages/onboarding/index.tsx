import { Logo } from '@/components/ui/Logo';
import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, ImageUp, Loader2 } from 'lucide-react';
import { Field, Input } from '@/components/ui/form';
import { ALL_OPTIONAL_MODULES, PRESETS } from '@/config/presets';
import { MODULE_BY_ID } from '@/config/modules';
import { contrast, SURFACES } from '@/lib/color';
import { fieldErrors, onboardingSchema } from '@/lib/schemas';
import { createAcademy, MAX_LOGO_KB } from '@/services/mutations';
import { useSession } from '@/store/session';
import { useUi } from '@/store/ui';
import type { AcademyType, ModuleId } from '@/types';
import { cn } from '@/utils/cn';

const STEPS = ['Academia', 'Logo y color', 'Tipo', 'Módulos', 'Administrador'] as const;
const COLORS = ['#8b7bff', '#38bdf8', '#34d399', '#f59e0b', '#f472b6', '#ef4444'];

export default function OnboardingPage() {
  const nav = useNavigate(); const signIn = useSession((s) => s.signIn); const toast = useUi((s) => s.toast);
  const [step, setStep] = useState(0); const [busy, setBusy] = useState(false); const [err, setErr] = useState<Record<string, string>>({}); const [top, setTop] = useState<string | null>(null);
  const [f, setF] = useState({ academyName: '', adminName: '', adminEmail: '', adminPassword: '' });
  const [logo, setLogo] = useState<string | undefined>(); const [color, setColor] = useState(COLORS[0]); const [type, setType] = useState<AcademyType>('educativa');
  const [mods, setMods] = useState<ModuleId[]>(PRESETS.educativa.modules); const file = useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  const pickLogo = (fl?: File) => { if (!fl) return; if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(fl.type) || fl.size > MAX_LOGO_KB * 1024) return toast({ kind: 'error', title: 'Logo no válido', description: `PNG, JPG, WebP o SVG de hasta ${MAX_LOGO_KB} KB.` }); const r = new FileReader(); r.onload = () => setLogo(String(r.result)); r.readAsDataURL(fl); };
  const next = async () => {
    setTop(null);
    if (step === 0) { if (f.academyName.trim().length < 2) return setErr({ academyName: 'Escribe el nombre de la academia' }); setErr({}); }
    if (step === 4) {
      const p = onboardingSchema.safeParse(f); if (!p.success) return setErr(fieldErrors(p.error)); setErr({}); setBusy(true);
      try { await createAcademy({ ...p.data, type, logoUrl: logo, modules: mods, primary: color }); await signIn(p.data.adminEmail, p.data.adminPassword); toast({ kind: 'success', title: '¡Academia creada!', description: 'Ya puedes empezar a trabajar.' }); nav('/', { replace: true }); }
      catch (e) { setTop((e as Error).message); setBusy(false); }
      return;
    }
    setStep(step + 1);
  };
  const toggle = (m: ModuleId) => setMods((x) => (x.includes(m) ? x.filter((y) => y !== m) : [...x, m]));
  const low = contrast(color, SURFACES.dark) < 3;

  return (
    <div className="ambient min-h-full" style={{ ['--brand' as string]: color }}>
      <div className="relative z-10 mx-auto max-w-2xl px-5 py-10">
        <div className="mb-8 flex items-center justify-between"><Link to="/login" className="text-sm text-muted hover:text-fg">← Volver al acceso</Link><Logo withWord size={28} /></div>
        <ol aria-label="Progreso" className="mb-8 flex gap-1.5">{STEPS.map((s, i) => <li key={s} aria-current={i === step ? 'step' : undefined} className="flex-1"><span className={cn('block h-1 rounded-full', i <= step ? 'bg-brand' : 'bg-line')} /><span className={cn('mt-1.5 block text-xs', i === step ? 'text-fg' : 'text-muted')}>{i + 1}. {s}</span></li>)}</ol>
        <form onSubmit={(e) => { e.preventDefault(); void next(); }} noValidate className="panel p-7">
          {step === 0 && <div className="space-y-4"><h1 className="text-2xl font-semibold tracking-tight">¿Cómo se llama tu academia?</h1><p className="text-sm text-muted">Aparecerá en la barra lateral, el acceso y los documentos.</p>
            <Field label="Nombre de la academia" required error={err.academyName}>{(p) => <Input {...p} autoFocus value={f.academyName} onChange={set('academyName')} placeholder="Nombre de tu centro" />}</Field></div>}
          {step === 1 && <div className="space-y-5"><h1 className="text-2xl font-semibold tracking-tight">Logo y color</h1><p className="text-sm text-muted">Opcional. Podrás cambiarlos cuando quieras en Personalización.</p>
            <div className="flex items-center gap-4">{logo ? <img src={logo} alt="Logo" className="h-14 w-14 rounded-xl border border-line object-contain" /> : <span aria-hidden className="grid h-14 w-14 place-items-center rounded-xl text-xl font-bold text-on-brand" style={{ background: color, color: '#0d0a24' }}>{f.academyName.trim()[0]?.toUpperCase() ?? 'A'}</span>}
              <input ref={file} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={(e) => pickLogo(e.target.files?.[0])} /><button type="button" onClick={() => file.current?.click()} className="inline-flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-sm hover:bg-surface-2"><ImageUp size={15} />Subir logo</button></div>
            <fieldset><legend className="mb-2 text-[13px] font-medium">Color principal</legend><div className="flex flex-wrap gap-2.5">{COLORS.map((c) => <button type="button" key={c} onClick={() => setColor(c)} aria-label={`Color ${c}`} aria-pressed={color === c} className="h-9 w-9 rounded-full ring-offset-2 ring-offset-surface aria-pressed:ring-2 aria-pressed:ring-fg" style={{ background: c }} />)}</div>{low && <p className="mt-2 text-xs text-warn">Poco contraste con el fondo oscuro.</p>}</fieldset></div>}
          {step === 2 && <div className="space-y-4"><h1 className="text-2xl font-semibold tracking-tight">¿Qué tipo de centro es?</h1><p className="text-sm text-muted">Adaptamos el vocabulario y los módulos iniciales.</p>
            <div role="radiogroup" aria-label="Tipo de academia" className="grid gap-2.5 sm:grid-cols-2">{(Object.entries(PRESETS) as [AcademyType, { label: string; description: string; modules: ModuleId[] }][]).map(([k, v]) => <button type="button" key={k} role="radio" aria-checked={type === k} onClick={() => { setType(k); setMods(v.modules); }} className={cn('rounded-xl border p-4 text-left text-sm transition-colors', type === k ? 'border-brand/60 bg-brand/10' : 'border-line hover:border-line-strong')}>{type === k && <Check size={14} className="float-right text-brand-text" aria-hidden />}<span className="font-medium">{v.label}</span><span className="mt-1 block text-xs text-muted">{v.description}</span></button>)}</div></div>}
          {step === 3 && <div className="space-y-4"><h1 className="text-2xl font-semibold tracking-tight">Elige tus módulos</h1><p className="text-sm text-muted">Hemos marcado los habituales para tu tipo de centro. Se pueden activar o desactivar después.</p>
            <ul className="grid gap-2 sm:grid-cols-2">{ALL_OPTIONAL_MODULES.map((m) => { const on = mods.includes(m); const d = MODULE_BY_ID[m]; return <li key={m}><label className={cn('flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm', on ? 'border-brand/50 bg-brand/8' : 'border-line')}><input type="checkbox" checked={on} onChange={() => toggle(m)} className="h-4 w-4 accent-[var(--brand)]" />{d.title}</label></li>; })}</ul></div>}
          {step === 4 && <div className="space-y-4"><h1 className="text-2xl font-semibold tracking-tight">Crea tu cuenta de administrador</h1><p className="text-sm text-muted">Con ella gestionarás la academia.</p>
            {top && <p role="alert" className="rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-sm text-bad">{top}</p>}
            <Field label="Tu nombre" required error={err.adminName}>{(p) => <Input {...p} autoFocus value={f.adminName} onChange={set('adminName')} autoComplete="name" />}</Field>
            <Field label="Correo" required error={err.adminEmail}>{(p) => <Input {...p} type="email" value={f.adminEmail} onChange={set('adminEmail')} autoComplete="email" />}</Field>
            <Field label="Contraseña" required error={err.adminPassword} hint="Mínimo 8 caracteres, con letras y números.">{(p) => <Input {...p} type="password" value={f.adminPassword} onChange={set('adminPassword')} autoComplete="new-password" />}</Field></div>}
          <div className="mt-8 flex items-center justify-between">
            <button type="button" onClick={() => setStep(step - 1)} disabled={step === 0 || busy} className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm text-muted hover:text-fg disabled:invisible"><ArrowLeft size={15} />Atrás</button>
            <button type="submit" disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-5 text-sm font-semibold text-on-brand hover:brightness-110 disabled:opacity-60">{busy ? <Loader2 size={16} className="animate-spin" /> : step === 4 ? 'Crear academia' : <>Continuar<ArrowRight size={15} /></>}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
