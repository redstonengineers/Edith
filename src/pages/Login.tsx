import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowRight, Loader2 } from 'lucide-react';
import { StatusIndicator } from '@/components/ui/primitives';
import { ROLE_LABELS } from '@/lib/permissions';
import { DEMO_PASSWORD, listDemoAccounts, type DemoAccount } from '@/services/auth';
import { useSession } from '@/store/session';
import { useEffect } from 'react';

export default function LoginPage() {
  const { status, signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [accounts, setAccounts] = useState<DemoAccount[]>([]);
  useEffect(() => { void listDemoAccounts().then(setAccounts); }, []);
  const academies = [...new Set(accounts.map((a) => a.academy))];
  useEffect(() => { document.documentElement.dataset.theme = 'dark'; document.documentElement.style.removeProperty('--brand'); document.documentElement.style.removeProperty('--brand-2'); document.documentElement.style.removeProperty('--on-brand'); }, []);
  if (status === 'auth') return <Navigate to="/" replace />;

  const submit = async (e?: string, p?: string) => {
    setBusy(true); setError('');
    try { await signIn(e ?? email, p ?? password); } catch (err) { setError((err as Error).message); setBusy(false); }
  };

  return (
    <div className="ambient grid min-h-full lg:grid-cols-[1.1fr_1fr]">
      <div className="relative z-10 hidden flex-col justify-between border-r border-line p-12 lg:flex">
        <div className="flex items-center gap-3"><span aria-hidden className="grid h-9 w-9 place-items-center rounded-[10px]" style={{ background: 'linear-gradient(135deg,var(--brand),var(--brand-2))' }}><span className="h-3 w-3 rounded-full bg-[#04121c]" /></span><span className="text-sm font-semibold tracking-wide">EDITH</span></div>
        <div>
          <h1 className="max-w-md text-4xl leading-tight font-semibold tracking-tight">El centro de control de tu academia.</h1>
          <p className="mt-4 max-w-md text-muted">Alumnos, horarios, asistencia, pagos y comunicación en un único lugar. Cada academia con su marca, su vocabulario y sus módulos.</p>
        </div>
        <StatusIndicator label="System online" />
      </div>
      <div className="relative z-10 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <h2 className="text-2xl font-semibold tracking-tight">Iniciar sesión</h2>
          <p className="mt-1 text-sm text-muted">Accede con tu cuenta o usa un acceso de demostración.</p>
          <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="mt-6 space-y-4" noValidate>
            <div><label htmlFor="email" className="mb-1.5 block text-sm font-medium">Correo electrónico</label>
              <input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:border-brand" /></div>
            <div><label htmlFor="pw" className="mb-1.5 block text-sm font-medium">Contraseña</label>
              <input id="pw" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:border-brand" /></div>
            {error && <p role="alert" className="text-sm text-bad">{error}</p>}
            <button type="submit" disabled={busy || !email || !password} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand text-sm font-semibold text-on-brand hover:brightness-110 disabled:opacity-50">{busy ? <Loader2 size={16} className="animate-spin" /> : <>Entrar <ArrowRight size={16} /></>}</button>
          </form>
          <p className="mt-5 text-sm text-muted">¿Eres propietario de un centro? <Link to="/onboarding" className="font-medium text-brand-text hover:underline">Crea tu academia</Link></p>
          <div className="mt-8">
            {accounts.length > 0 && <p className="mb-2 text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">Acceso demo · contraseña “{DEMO_PASSWORD}”</p>}
            <div className="space-y-4">
              {academies.map((name) => (
                <div key={name}>
                  <p className="mb-1.5 text-xs text-muted">{name}</p>
                  <div className="flex flex-wrap gap-2">
                    {accounts.filter((u) => u.academy === name).map((u) => (
                      <button key={u.id} disabled={busy} onClick={() => void submit(u.email, DEMO_PASSWORD)} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-left text-xs hover:border-brand/50">
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
