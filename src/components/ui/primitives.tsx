import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/utils/cn';
import { initials } from '@/utils/format';

type Tone = 'neutral' | 'ok' | 'warn' | 'bad' | 'info' | 'brand';
const tones: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-muted border-line',
  ok: 'bg-ok/12 text-ok border-ok/25',
  warn: 'bg-warn/12 text-warn border-warn/25',
  bad: 'bg-bad/12 text-bad border-bad/25',
  info: 'bg-info/12 text-info border-info/25',
  brand: 'bg-brand/12 text-brand-text border-brand/25',
};
export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cn('inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium leading-4', tones[tone], className)}>{children}</span>;
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-line-strong bg-surface-2 px-1.5 py-0.5 font-sans text-xs font-medium text-muted">{children}</kbd>;
}

export function StatusIndicator({ tone = 'ok', label, pulse = true }: { tone?: 'ok' | 'warn' | 'bad'; label: string; pulse?: boolean }) {
  const c = { ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad' }[tone];
  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium text-muted" role="status">
      <span aria-hidden className={cn('h-2 w-2 rounded-full', c, pulse && tone === 'ok' && 'dot-live')} />
      {label}
    </span>
  );
}

export function Avatar({ name, hue, size = 32 }: { name: string; hue: number; size?: number }) {
  return (
    <span aria-hidden className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white select-none"
      style={{ width: size, height: size, fontSize: size * 0.36, background: `linear-gradient(135deg, hsl(${hue} 65% 48%), hsl(${(hue + 40) % 360} 65% 38%))` }}>
      {initials(name)}
    </span>
  );
}

export function Panel({ title, action, children, className, bodyClassName, id }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string; id?: string }) {
  const hid = id ? `${id}-h` : undefined;
  return (
    <section aria-labelledby={title ? hid : undefined} className={cn('panel', className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-2">
          <h2 id={hid} className="text-xs font-semibold text-muted">{title}</h2>
          {action}
        </header>
      )}
      <div className={cn('px-5 pb-5', !title && !action && 'pt-5', bodyClassName)}>{children}</div>
    </section>
  );
}

export function Skeleton({ className }: { className?: string }) { return <div aria-hidden className={cn('skeleton', className)} />; }

export function LoadingState({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-4 p-1">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-44 w-full" />
      <div className="grid gap-4 md:grid-cols-3"><Skeleton className="h-40" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action, page }: { icon?: LucideIcon; title: string; description?: string; action?: ReactNode; /** Pantalla completa de estado: el título es el h1 de la página. */ page?: boolean }) {
  const Title = page ? 'h1' : 'h3';
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      {Icon && <span className="grid h-12 w-12 place-items-center rounded-xl border border-line bg-surface-2 text-muted"><Icon size={22} aria-hidden /></span>}
      <Title className="text-base font-semibold">{title}</Title>
      {description && <p className="max-w-md text-sm text-muted">{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ title = 'Algo ha salido mal', description, onRetry }: { title?: string; description?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="panel mx-auto max-w-lg p-8 text-center">
      <h3 className="text-base font-semibold text-bad">{title}</h3>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      {onRetry && <button onClick={onRetry} className="mt-4 rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-surface-2">Reintentar</button>}
    </div>
  );
}

export function Timeline({ items }: { items: { id: string; time: ReactNode; title: ReactNode; meta?: ReactNode; dot?: string; state?: 'done' | 'live' | 'next' | 'later' | 'cancelled' }[] }) {
  return (
    <ol className="relative">
      {items.map((it, i) => (
        <li key={it.id} className={cn('relative grid grid-cols-[3.25rem_1fr] gap-3 pb-4 last:pb-0', it.state === 'cancelled' && 'opacity-70')}>
          <span className="tnum pt-0.5 text-right text-[13px] font-medium text-muted">{it.time}</span>
          <div className="relative pl-5">
            {i < items.length - 1 && <span aria-hidden className="absolute top-3 left-[3px] h-full w-px bg-line" />}
            <span aria-hidden className={cn('absolute top-[7px] left-0 h-[7px] w-[7px] rounded-full ring-4 ring-surface', it.state === 'live' && 'dot-live')} style={{ background: it.dot ?? 'var(--brand)' }} />
            {it.title}
            {it.meta}
          </div>
        </li>
      ))}
    </ol>
  );
}
