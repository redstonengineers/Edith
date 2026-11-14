import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/utils/cn';

/** Menú desplegable accesible: Esc cierra, ↑/↓ navegan, foco vuelve al botón. */
export function Dropdown({ trigger, label, children, align = 'right', width = 'w-72', onOpenChange }: {
  trigger: (p: { open: boolean; props: Record<string, unknown> }) => ReactNode; label: string; children: (close: () => void) => ReactNode; align?: 'left' | 'right'; width?: string; onOpenChange?: (o: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  const set = (v: boolean) => { setOpen(v); onOpenChange?.(v); };
  useEffect(() => {
    if (!open) return;
    const click = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) set(false); };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { set(false); wrap.current?.querySelector<HTMLElement>('[aria-haspopup]')?.focus(); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
        if (!items.length) return; e.preventDefault();
        const i = items.indexOf(document.activeElement as HTMLElement);
        items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus();
      }
    };
    document.addEventListener('mousedown', click); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', click); document.removeEventListener('keydown', key); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  return (
    <div ref={wrap} className="relative">
      {trigger({ open, props: { 'aria-haspopup': 'menu', 'aria-expanded': open, 'aria-controls': open ? id : undefined, onClick: () => set(!open) } })}
      {open && (
        <div ref={menu} id={id} role="menu" aria-label={label} className={cn('anim-pop panel absolute z-40 mt-2 overflow-hidden bg-surface shadow-2xl', width, align === 'right' ? 'right-0' : 'left-0')}>
          {children(() => set(false))}
        </div>
      )}
    </div>
  );
}
