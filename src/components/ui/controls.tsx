import { useState, type ReactNode } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/utils/cn';

export function SearchInput({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder: string; label: string }) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <Search size={15} aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
      <input type="search" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-10 w-full rounded-lg border border-line bg-surface/70 pr-3 pl-9 text-sm outline-none placeholder:text-muted focus:border-brand" />
    </div>
  );
}

export function FilterChips<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; label: string; options: { id: T; label: string; count?: number }[] }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button key={o.id} onClick={() => onChange(o.id)} aria-pressed={value === o.id}
          className={cn('h-8 rounded-full border px-3 text-[13px] transition-colors', value === o.id ? 'border-brand/50 bg-brand/12 text-fg' : 'border-line text-muted hover:border-line-strong hover:text-fg')}>
          {o.label}{o.count !== undefined && <span className="tnum ml-1.5 text-[11px]">{o.count}</span>}
        </button>))}
    </div>
  );
}

export function Tabs({ tabs, initial }: { tabs: { id: string; label: string; badge?: ReactNode; content: ReactNode }[]; initial?: string }) {
  const [active, setActive] = useState(initial ?? tabs[0].id);
  const cur = tabs.find((t) => t.id === active) ?? tabs[0];
  const onKey = (e: React.KeyboardEvent) => {
    const i = tabs.findIndex((t) => t.id === cur.id);
    if (e.key === 'ArrowRight') setActive(tabs[(i + 1) % tabs.length].id);
    if (e.key === 'ArrowLeft') setActive(tabs[(i - 1 + tabs.length) % tabs.length].id);
  };
  return (
    <div>
      <div role="tablist" onKeyDown={onKey} className="mb-4 flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map((t) => (
          <button key={t.id} role="tab" id={`tab-${t.id}`} aria-selected={cur.id === t.id} aria-controls={`panel-${t.id}`} tabIndex={cur.id === t.id ? 0 : -1} onClick={() => setActive(t.id)}
            className={cn('-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm', cur.id === t.id ? 'border-brand text-fg' : 'border-transparent text-muted hover:text-fg')}>
            {t.label}{t.badge}
          </button>))}
      </div>
      <div role="tabpanel" id={`panel-${cur.id}`} aria-labelledby={`tab-${cur.id}`}>{cur.content}</div>
    </div>
  );
}

export function ProgressBar({ pct, tone = 'brand', label }: { pct: number; tone?: 'brand' | 'ok' | 'warn' | 'bad'; label: string }) {
  const c = { brand: 'bg-brand', ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad' }[tone];
  return <div role="progressbar" aria-label={label} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} className="h-1.5 w-full overflow-hidden rounded-full bg-line"><div className={cn('h-full rounded-full', c)} style={{ width: `${Math.min(100, pct)}%` }} /></div>;
}
