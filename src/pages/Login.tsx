import { Logo } from '@/components/ui/Logo';
import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { IS_API } from '@/services/mode';
import { usePersonal } from '@/store/personal';
import { ArrowRight, Loader2 } from 'lucide-react';
import { ConnectionStatus } from '@/components/layout/ConnectionStatus';
import { ROLE_LABELS } from '@/lib/permissions';
import { listDemoAccounts, listTenants, type DemoAccount } from '@/services/auth';
import type { PublicTenant } from '@/data/tenants';
import { useSession } from '@/store/session';
import { RememberMe, useRemember } from '@/components/domain/RememberMe';
import { useEffect } from 'react';

export default function LoginPage() {
  const { status, signIn, signInDemo } = useSession(); const navigate = useNavigate(); const personalLogin = usePersonal((x) => x.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false); const [remember, setRemember] = useRemember();
  const [accounts, setAccounts] = useState<DemoAccount[]>([]); const [tenants, setTenants] = useState<PublicTenant[]>([]);
  useEffect(() => { void listDemoAccounts().then(setAccounts); void listTenants().then(setTenants); }, []);
  const academies = [...new Set(accounts.map((a) => a.academy))];
  useEffect(() => { document.documentElement.dataset.theme = 'dark'; document.documentElement.style.removeProperty('--brand'); document.documentElement.style.removeProperty('--brand-2'); document.documentElement.style.removeProperty('--on-brand'); }, []);
  if (status === 'auth' || status === 'password') return <Navigate to="/" replace />;

  const submit = async () => {
    setBusy(true); setError('');
    try {
      const id = email.trim();
      // Sin «@» es el acceso personal del propietario (solo existe en el servidor). Los clientes entran siempre con su correo.
      if (id && !id.includes('@')) {
        if (!IS_API) throw new Error('El modo personal solo está disponible en la versión con servidor.');
        await personalLogin(id, password); navigate('/personal', { replace: true }); return;
      }
      await signIn(id, password, remember);
    } catch (err) { setError((err as Error).message); setBusy(false); }
  };
  const enterDemo = async (a: DemoAccount) => { setBusy(true); setError(''); try { await signInDemo(a.key, a.profile); } catch (err) { setError((err as Error).message); setBusy(false); } };

  return (
    <div className="ambient grid min-h-full lg:grid-cols-[1.1fr_1fr]">
      <div className="relative z-10 hidden flex-col justify-between border-r border-line p-12 lg:flex">
        <Logo withWord />
        <div>
          <h1 className="max-w-md text-4xl leading-tight font-semibold tracking-tight">El centro de control de tu academia.</h1>
          <p className="mt-4 max-w-md text-muted">Alumnos, horarios, asistencia, pagos y comunicación en un único lugar. Cada academia con su marca, su vocabulario y sus módulos.</p>
        </div>
        <ConnectionStatus />
      </div>
      <div className="relative z-10 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <h2 className="text-2xl font-semibold tracking-tight">Iniciar sesión</h2>
          <p className="mt-1 text-sm text-muted">Accede con el correo y la contraseña de tu centro, o prueba una demostración sin contraseña.</p>
          <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="mt-6 space-y-4" noValidate>
            <div><label htmlFor="email" className="mb-1.5 block text-sm font-medium">Correo o usuario</label>
              <input id="email" type="text" inputMode="email" autoCapitalize="none" spellCheck={false} autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:border-brand" /></div>
            <div><label htmlFor="pw" className="mb-1.5 block text-sm font-medium">Contraseña</label>
              <input id="pw" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:border-brand" /></div>
            {error && <p role="alert" className="text-sm text-bad">{error}</p>}
            <RememberMe checked={remember} onChange={setRemember} />
            <button type="submit" disabled={busy || !email || !password} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand text-sm font-semibold text-on-brand hover:brightness-110 disabled:opacity-50">{busy ? <Loader2 size={16} className="animate-spin" /> : <>Entrar <ArrowRight size={16} /></>}</button>
          </form>
          {tenants.length > 0 && (
            <section className="mt-8" aria-label="Elige tu negocio">
              <p className="mb-3 text-xs font-semibold text-muted">Elige tu negocio</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {tenants.map((t) => (
                  <Link key={t.slug} to={`/acceso/${t.slug}`} aria-label={`Entrar en ${t.card}`} className="group flex flex-col items-center gap-2 rounded-xl border border-line bg-surface p-4 text-center transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-2" style={{ ['--tc' as string]: t.primary }}>
                    <img src={t.logo} alt="" width={52} height={52} className="rounded-xl shadow-sm" />
                    <span className="text-sm font-semibold">{t.card}</span>
                    <span className="text-xs leading-snug text-muted">{t.tagline}</span>
                    <span className="mt-auto h-0.5 w-8 rounded-full opacity-70 transition-all group-hover:w-14" style={{ background: t.primary }} />
                  </Link>))}
              </div>
            </section>)}
          <div className="mt-8">
            {accounts.length > 0 && <p className="mb-2 text-xs font-semibold text-muted">Acceso demo · sin contraseña</p>}
            <div className="space-y-4">
              {academies.map((name) => (
                <div key={name}>
                  <p className="mb-1.5 text-xs text-muted">{name}</p>
                  <div className="flex flex-wrap gap-2">
                    {accounts.filter((u) => u.academy === name).map((u) => (
                      <button key={u.id} disabled={busy} onClick={() => void enterDemo(u)} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-left text-xs hover:border-brand/50">
                        <span className="block font-medium">{u.name}</span><span className="text-muted">{ROLE_LABELS[u.role as keyof typeof ROLE_LABELS]}</span>
                      </button>))}
                  </div>
                </div>))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
