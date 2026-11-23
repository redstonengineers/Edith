import { useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { passwordSchema } from '@/lib/schemas';
import { useSession } from '@/store/session';

/** Primer acceso de un cliente: la contraseña generada por EDITH es provisional y hay que cambiarla antes de entrar. */
export default function ChangePasswordPage() {
  const { user, changePassword, signOut } = useSession();
  const [cur, setCur] = useState(''); const [next, setNext] = useState(''); const [again, setAgain] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    const ok = passwordSchema.safeParse(next); if (!ok.success) return setError(ok.error.issues[0]?.message ?? 'Contraseña no válida');
    if (next !== again) return setError('Las contraseñas nuevas no coinciden.'); if (next === cur) return setError('La contraseña nueva debe ser distinta de la provisional.');
    setBusy(true); try { await changePassword(cur, next); } catch (err) { setError((err as Error).message); setBusy(false); }
  };
  const field = 'h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:border-brand';
  return (
    <div className="ambient grid min-h-full place-items-center p-6">
      <main className="relative z-10 w-full max-w-md rounded-2xl border border-line bg-surface p-8 shadow-xl">
        <Logo withWord />
        <h1 className="mt-6 flex items-center gap-2 text-2xl font-semibold tracking-tight"><KeyRound size={22} aria-hidden />Elige tu contraseña</h1>
        <p className="mt-2 text-sm text-muted">Hola{user ? `, ${user.name}` : ''}. La contraseña con la que has entrado es provisional: cámbiala por una que solo conozcas tú para continuar.</p>
        <form onSubmit={(e) => void submit(e)} className="mt-6 space-y-4" noValidate>
          <div><label htmlFor="cp-cur" className="mb-1.5 block text-sm font-medium">Contraseña provisional</label><input id="cp-cur" type="password" autoComplete="current-password" required value={cur} onChange={(e) => setCur(e.target.value)} className={field} /></div>
          <div><label htmlFor="cp-new" className="mb-1.5 block text-sm font-medium">Contraseña nueva</label><input id="cp-new" type="password" autoComplete="new-password" required value={next} onChange={(e) => setNext(e.target.value)} className={field} aria-describedby="cp-hint" /><p id="cp-hint" className="mt-1 text-xs text-muted">Mínimo 8 caracteres, con letras y números.</p></div>
          <div><label htmlFor="cp-again" className="mb-1.5 block text-sm font-medium">Repite la contraseña nueva</label><input id="cp-again" type="password" autoComplete="new-password" required value={again} onChange={(e) => setAgain(e.target.value)} className={field} /></div>
          {error && <p role="alert" className="text-sm text-bad">{error}</p>}
          <button type="submit" disabled={busy || !cur || !next || !again} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand text-sm font-semibold text-on-brand hover:brightness-110 disabled:opacity-60">{busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : 'Guardar y entrar'}</button>
        </form>
        <button type="button" onClick={() => void signOut()} className="mt-4 text-sm text-muted hover:text-fg">Salir</button>
      </main>
    </div>
  );
}
