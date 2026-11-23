import { Check, ChevronDown } from 'lucide-react';
import { Dropdown } from './Dropdown';
import { cn } from '@/utils/cn';

export interface FilterOption { value: string; label: string }

/** Selector de filtro con el desplegable de la app (en lugar del <select> nativo): etiqueta, valor actual y lista navegable con teclado. */
export function FilterSelect({ label, value, options, onChange, className, width = 'w-60' }: { label: string; value: string; options: FilterOption[]; onChange: (v: string) => void; className?: string; width?: string }) {
  const cur = options.find((o) => o.value === value) ?? options[0];
  return (
    <Dropdown label={label} align="left" width={width} trigger={({ props }) => (
      <button type="button" {...props} aria-label={`${label}: ${cur?.label ?? ''}`} className={cn('flex h-10 min-w-[9rem] items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 text-sm hover:bg-surface-2', className)}>
        <span className="truncate"><span className="text-muted">{label}: </span>{cur?.label}</span><ChevronDown size={15} aria-hidden className="shrink-0 text-muted" />
      </button>)}>
      {(close) => (
        <div className="max-h-72 overflow-y-auto p-1.5">
          {options.map((o) => (
            <button key={o.value} type="button" role="menuitem" onClick={() => { onChange(o.value); close(); }} className={cn('flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-surface-2 focus:bg-surface-2 focus:outline-none', o.value === value && 'font-semibold')}>
              <span>{o.label}</span>{o.value === value && <Check size={15} aria-hidden className="text-brand-text" />}
            </button>))}
        </div>)}
    </Dropdown>
  );
}
