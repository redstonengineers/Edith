import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { StatusIndicator } from '@/components/ui/primitives';
import { onColor } from '@/lib/color';
import { differenceInYears, parseISO } from 'date-fns';
import { loadApplyForm, sendApplication } from '@/services/publicApplyClient';
import type { PublicApplyInfo } from '@/services/publicApply';

const field = 'h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:border-brand';

/** Formulario público de solicitud de matrícula de un negocio. Lo rellena cualquiera, sin cuenta: llega a Matrículas como «Solicitud». */
export default function Matricula() {
  const { key = '' } = useParams(); const [info, setInfo] = useState<PublicApplyInfo | null | undefined>(undefined);
  const [f, setF] = useState({ name: '', email: '', phone: '', birthDate: '', interest: '', message: '', guardianName: '', guardianPhone: '', consent: false, whatsappConsent: false, website: '' });
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [sent, setSent] = useState(false); const started = useRef(Date.now());
  useEffect(() => { void loadApplyForm(key).then(setInfo); }, [key]);
  useEffect(() => {
    if (!info) return; const root = document.documentElement; root.dataset.theme = info.theme; root.style.setProperty('--brand', info.primary); root.style.setProperty('--brand-2', info.secondary); root.style.setProperty('--on-brand', onColor(info.primary)); document.title = `Solicitar plaza · ${info.name}`;
    return () => { root.style.removeProperty('--brand'); root.style.removeProperty('--brand-2'); root.style.removeProperty('--on-brand'); root.dataset.theme = 'dark'; document.title = 'EDITH'; };
  }, [info]);
  if (info === undefined) return <div className="grid min-h-full place-items-center"><Loader2 className="animate-spin text-muted" aria-label="Cargando" /></div>;
  if (info === null) return <div className="grid min-h-full place-items-center p-6 text-center"><div><h1 className="text-xl font-semibold">Este formulario no está disponible</h1><p className="mt-2 text-sm text-muted">El enlace no es correcto o el negocio no acepta solicitudes por internet ahora mismo.</p></div></div>;
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const minor = !!f.birthDate && /^\d{4}-\d{2}-\d{2}$/.test(f.birthDate) && differenceInYears(new Date(), parseISO(f.birthDate)) < 18;
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError(''); setBusy(true);
    try { await sendApplication(key, { ...f, consent: f.consent as true, elapsed: Date.now() - started.current }); setSent(true); }
    catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };
  const brandBg = { background: `linear-gradient(160deg, color-mix(in srgb, ${info.primary} 14%, transparent), transparent 55%)` };
  return (
    <div className="ambient min-h-full" style={brandBg}>
      <div className="relative z-10 mx-auto w-full max-w-xl px-5 py-10">
        <header className="mb-7 flex items-center gap-3">
          {info.logoUrl ? <img src={info.logoUrl} alt={`Logo de ${info.name}`} width={52} height={52} className="rounded-xl" /> : <span aria-hidden className="grid size-[52px] place-items-center rounded-xl bg-brand text-lg font-bold text-on-brand">{info.name.slice(0, 1)}</span>}
          <div><h1 className="text-xl leading-tight font-semibold">{info.name}</h1>{info.tagline && <p className="text-sm text-muted">{info.tagline}</p>}</div>
        </header>
        {sent ? (
          <div role="status" className="panel p-8 text-center"><CheckCircle2 size={44} className="mx-auto text-ok" aria-hidden /><h2 className="mt-4 text-xl font-semibold">¡Solicitud enviada!</h2><p className="mt-2 text-sm text-muted">{info.name} ha recibido tus datos y se pondrá en contacto contigo lo antes posible.</p></div>
        ) : (
          <form onSubmit={(e) => void submit(e)} className="panel space-y-4 p-6" noValidate aria-label="Solicitud de matrícula">
            <div><h2 className="text-lg font-semibold">Solicita tu plaza</h2><p className="mt-1 text-sm text-muted">{info.message}</p></div>
            <div><label htmlFor="m-name" className="mb-1.5 block text-sm font-medium">Nombre completo</label><input id="m-name" className={field} autoComplete="name" required value={f.name} onChange={(e) => set('name', e.target.value)} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label htmlFor="m-email" className="mb-1.5 block text-sm font-medium">Correo electrónico</label><input id="m-email" type="email" className={field} autoComplete="email" required value={f.email} onChange={(e) => set('email', e.target.value)} /></div>
              <div><label htmlFor="m-phone" className="mb-1.5 block text-sm font-medium">Teléfono</label><input id="m-phone" type="tel" className={field} autoComplete="tel" required value={f.phone} onChange={(e) => set('phone', e.target.value)} /></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label htmlFor="m-birth" className="mb-1.5 block text-sm font-medium">Fecha de nacimiento</label><input id="m-birth" type="date" className={field} autoComplete="bday" value={f.birthDate} onChange={(e) => set('birthDate', e.target.value)} /></div>
              <div><label htmlFor="m-interest" className="mb-1.5 block text-sm font-medium">{info.interestLabel}</label>
                {info.interests.length > 0 ? <select id="m-interest" className={field} required value={f.interest} onChange={(e) => set('interest', e.target.value)}><option value="">Elige una opción…</option>{info.interests.map((i) => <option key={i} value={i}>{i}</option>)}<option value="Otra / no lo sé aún">Otra / no lo sé aún</option></select>
                  : <input id="m-interest" className={field} required value={f.interest} onChange={(e) => set('interest', e.target.value)} />}</div>
            </div>
            {minor && <fieldset className="grid gap-4 rounded-lg border border-line p-4 sm:grid-cols-2"><legend className="px-1 text-xs font-semibold tracking-wider text-muted uppercase">Madre, padre o tutor</legend>
              <div><label htmlFor="m-gname" className="mb-1.5 block text-sm font-medium">Nombre</label><input id="m-gname" className={field} required value={f.guardianName} onChange={(e) => set('guardianName', e.target.value)} /></div>
              <div><label htmlFor="m-gphone" className="mb-1.5 block text-sm font-medium">Teléfono</label><input id="m-gphone" type="tel" className={field} required value={f.guardianPhone} onChange={(e) => set('guardianPhone', e.target.value)} /></div></fieldset>}
            <div><label htmlFor="m-msg" className="mb-1.5 block text-sm font-medium">Mensaje <span className="font-normal text-muted">(opcional)</span></label><textarea id="m-msg" rows={3} maxLength={500} className="w-full rounded-lg border border-line bg-surface p-3 text-sm outline-none focus:border-brand" value={f.message} onChange={(e) => set('message', e.target.value)} /></div>
            {/* Señuelo anti-spam: invisible para personas. */}
            <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden"><label>No rellenar<input tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => set('website', e.target.value)} /></label></div>
            <label className="flex items-start gap-2.5 text-sm"><input type="checkbox" className="mt-1 size-4 accent-[var(--brand)]" checked={f.consent} onChange={(e) => set('consent', e.target.checked)} /><span>Acepto que <b>{info.name}</b> use mis datos para contactar conmigo y gestionar mi solicitud.</span></label>
            <label className="flex items-start gap-2.5 text-sm"><input type="checkbox" className="mt-1 size-4 accent-[var(--brand)]" checked={f.whatsappConsent} onChange={(e) => set('whatsappConsent', e.target.checked)} /><span>Quiero recibir avisos por <b>WhatsApp</b> (citas, cambios, recordatorios). <span className="text-muted">Opcional; puedes retirarlo cuando quieras.</span></span></label>
            {error && <p role="alert" className="text-sm text-bad">{error}</p>}
            <button type="submit" disabled={busy} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand text-sm font-semibold text-on-brand hover:brightness-110 disabled:opacity-60">{busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null}{busy ? 'Enviando…' : 'Enviar solicitud'}</button>
            <p className="flex items-center gap-1.5 text-xs text-muted"><ShieldCheck size={13} aria-hidden />Tus datos solo los verá {info.name}. No se comparten con nadie más.</p>
          </form>
        )}
        <div className="mt-6 flex justify-center"><StatusIndicator label="Powered by EDITH" /></div>
      </div>
    </div>
  );
}
