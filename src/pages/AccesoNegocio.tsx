import { PRODUCT_NAME } from '@/config/brand';
import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { StatusIndicator } from '@/components/ui/primitives';
import type { PublicTenant } from '@/data/tenants';
import { onColor } from '@/lib/color';
import { listTenants } from '@/services/auth';
import { useSession } from '@/store/session';

/** Acceso personalizado de un negocio: su logo, sus colores y sus perfiles (director, profesor, paciente…). */
export default function AccesoNegocio() {
  const { slug = '' } = useParams(); const { status, signInDemo } = useSession(); const navigate = useNavigate();
  const [tenants, setTenants] = useState<PublicTenant[] | null>(null); const [error, setError] = useState(''); const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { void listTenants().then(setTenants); }, []);
  const t = tenants?.find((x) => x.slug === slug);
  useEffect(() => {
    if (!t) return; const root = document.documentElement; root.dataset.theme = t.theme; root.style.setProperty('--brand', t.primary); root.style.setProperty('--brand-2', t.secondary); root.style.setProperty('--on-brand', onColor(t.primary)); document.title = `${t.name} · EDITH`;
    return () => { root.style.removeProperty('--brand'); root.style.removeProperty('--brand-2'); root.style.removeProperty('--on-brand'); root.dataset.theme = 'light'; document.title = 'EDITH'; };
  }, [t]);
  if (status === 'auth' || status === 'password') return <Navigate to="/" replace />;
  if (tenants && !t) return <Navigate to="/login" replace />;
  if (!t) return <div className="grid min-h-full place-items-center"><Loader2 className="animate-spin text-muted" aria-label="Cargando" /></div>;

  // Demo abierta: pulsar un perfil entra directamente (sin contraseña). El servidor solo lo permite en negocios con isDemo.
  const enter = async (username: string) => { setBusy(username); setError(''); try { await signInDemo(t.slug, username); navigate('/', { replace: true }); } catch (e) { setError((e as Error).message); setBusy(null); } };
  return (
    <div className="ambient grid min-h-full lg:grid-cols-[1.1fr_1fr]">
      <div className="relative z-10 hidden flex-col justify-between border-r border-line p-12 lg:flex" style={{ background: `linear-gradient(160deg, color-mix(in srgb, ${t.primary} 16%, transparent), transparent 60%)` }}>
        <div className="flex items-center gap-3"><img src={t.logo} alt="" width={44} height={44} className="rounded-xl" /><span className="text-lg font-semibold">{t.name}</span></div>
        <div>
          <img src={t.logo} alt={`Logo de ${t.name}`} width={96} height={96} className="mb-8 rounded-3xl shadow-xl" />
          <h1 className="max-w-md text-4xl leading-tight font-semibold tracking-tight">{t.name}</h1>
          <p className="mt-3 max-w-md text-lg" style={{ color: t.primary }}>{t.tagline}</p>
          <p className="mt-4 max-w-md text-muted">{t.blurb}</p>
        </div>
        <StatusIndicator label={`Creado con ${PRODUCT_NAME}`} />
      </div>
      <div className="relative z-10 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <Link to="/login" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg"><ArrowLeft size={14} aria-hidden />Otros negocios</Link>
          <div className="mb-6 flex items-center gap-3 lg:hidden"><img src={t.logo} alt={`Logo de ${t.name}`} width={48} height={48} className="rounded-xl" /><div><p className="font-semibold">{t.name}</p><p className="text-xs text-muted">{t.tagline}</p></div></div>
          <h2 className="text-2xl font-semibold tracking-tight">Probar {t.card}</h2>
          <p className="mt-1 text-sm text-muted">Demostración abierta con datos ficticios: elige un perfil y entra, sin contraseña.</p>
          <div className="mt-6" role="group" aria-label="Entrar como">
            <p className="mb-2 text-xs font-semibold text-muted">Entrar como</p>
            <div className="grid gap-2 sm:grid-cols-2">{t.profiles.map((p) => (
              <button key={p.username} type="button" disabled={!!busy} onClick={() => void enter(p.username)} className="flex h-12 items-center justify-between gap-2 rounded-xl border border-line bg-surface px-4 text-left text-sm font-medium transition hover:border-brand hover:shadow-md disabled:opacity-60">
                <span>{p.label}</span>{busy === p.username ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <ArrowRight size={16} className="text-muted" aria-hidden />}
              </button>))}</div>
          </div>
          {error && <p role="alert" className="mt-4 text-sm text-bad">{error}</p>}
          <p className="mt-6 text-xs text-muted">Los datos de esta demostración son inventados y se restauran cada día. Aquí no se envía ningún correo ni WhatsApp real.</p>
        </div>
      </div>
    </div>
  );
}
