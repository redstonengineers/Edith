import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUp, Sparkles } from 'lucide-react';
import { AI_SUGGESTIONS } from '@/lib/ai';
import { useSession } from '@/store/session';
import { useAi } from '@/store/ai';
import { cn } from '@/utils/cn';

/** Conversación reutilizable (panel lateral y página completa). */
export function Chat({ onNavigate, autoFocus, className }: { onNavigate?: () => void; autoFocus?: boolean; className?: string }) {
  const user = useSession((s) => s.user)!; const data = useSession((s) => s.data)!;
  const { msgs, busy, hydrate, ask } = useAi(); const [q, setQ] = useState(''); const end = useRef<HTMLDivElement>(null);
  useEffect(() => { hydrate(user); }, [user, hydrate]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [msgs, busy]);
  const send = (t: string) => { setQ(''); void ask(t, data, user); };
  const last = msgs[msgs.length - 1];
  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4" aria-live="polite" aria-label="Conversación con JARVIS">
        {msgs.length === 0 && (
          <div className="space-y-3"><p className="text-sm text-muted">¿Qué quieres saber? Prueba con una de estas:</p>
            <div className="flex flex-col gap-2">{AI_SUGGESTIONS.map((s) => <button key={s} onClick={() => send(s)} className="rounded-lg border border-line px-3 py-2 text-left text-sm hover:border-brand/40 hover:bg-brand/8">{s}</button>)}</div></div>)}
        {msgs.map((m) => (
          <div key={m.id} className={cn('anim-rise flex', m.role === 'user' && 'justify-end')}>
            <div className={cn('max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm', m.role === 'user' ? 'bg-brand text-on-brand' : m.kind === 'refusal' ? 'border border-warn/40 bg-warn/10' : 'border border-line bg-surface-2')}>
              <p>{m.text}</p>
              {m.items && m.items.length > 0 && <ol className="mt-2 list-decimal space-y-1 pl-5 text-[13px]">{m.items.map((it, i) => <li key={i}>{it.href ? <Link to={it.href} onClick={onNavigate} className="text-brand-text underline-offset-2 hover:underline">{it.label}</Link> : it.label}</li>)}</ol>}
            </div>
          </div>))}
        {!busy && last?.role === 'ai' && last.suggestions && last.suggestions.length > 0 && <div className="flex flex-wrap gap-1.5">{last.suggestions.map((s) => <button key={s} onClick={() => send(s)} className="rounded-full border border-line px-3 py-1 text-xs text-muted hover:border-brand/40 hover:text-fg">{s}</button>)}</div>}
        {busy && <div className="flex gap-1 px-2" role="status" aria-label="JARVIS está pensando">{[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${i * 120}ms` }} />)}</div>}
        <div ref={end} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(q); }} className="flex items-center gap-2 border-t border-line p-3">
        <label className="sr-only" htmlFor="ai-q">Pregunta para JARVIS</label>
        <input id="ai-q" data-autofocus={autoFocus ? '' : undefined} value={q} maxLength={400} onChange={(e) => setQ(e.target.value)} placeholder="Escribe tu pregunta…" className="h-10 flex-1 rounded-lg border border-line bg-bg px-3 text-sm outline-none focus:border-brand" />
        <button type="submit" disabled={!q.trim() || busy} aria-label="Enviar" className="grid h-10 w-10 place-items-center rounded-lg bg-brand text-on-brand disabled:opacity-40"><ArrowUp size={18} /></button>
      </form>
    </div>
  );
}
export const AiHeader = ({ provider }: { provider: string }) => (
  <div className="flex items-center gap-3 border-b border-line px-5 py-4 pr-14"><span className="grid h-9 w-9 place-items-center rounded-xl bg-brand/12 text-brand-text"><Sparkles size={18} aria-hidden /></span>
    <div><h2 className="text-sm font-semibold">JARVIS AI</h2><p className="text-xs text-muted">Motor: {provider}</p></div></div>
);
