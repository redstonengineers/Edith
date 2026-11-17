import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/utils/cn';

export interface MenuItem { label: string; icon?: ReactNode; onSelect: () => void; danger?: boolean; hint?: string }

/** Menú contextual: clic derecho o pulsación larga. Flechas, Inicio/Fin, Esc y clic fuera; el foco vuelve a donde estaba. */
export function ContextMenu({ at, items, onClose }: { at: { x: number; y: number }; items: MenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null); const [pos, setPos] = useState(at); const back = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => { back.current = document.activeElement as HTMLElement; const r = ref.current!.getBoundingClientRect(); setPos({ x: Math.min(at.x, window.innerWidth - r.width - 8), y: Math.min(at.y, window.innerHeight - r.height - 8) }); ref.current!.querySelector<HTMLElement>('[role=menuitem]')?.focus(); }, [at]);
  useEffect(() => {
    const close = () => onClose();
    const key = (e: KeyboardEvent) => {
      const els = [...(ref.current?.querySelectorAll<HTMLElement>('[role=menuitem]') ?? [])]; const i = els.indexOf(document.activeElement as HTMLElement);
      if (e.key === 'Escape') { e.preventDefault(); onClose(); back.current?.focus?.(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); els[(i + 1) % els.length]?.focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); els[(i - 1 + els.length) % els.length]?.focus(); }
      else if (e.key === 'Home') { e.preventDefault(); els[0]?.focus(); }
      else if (e.key === 'End') { e.preventDefault(); els[els.length - 1]?.focus(); }
      else if (e.key === 'Tab') { e.preventDefault(); onClose(); }
    };
    const down = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    document.addEventListener('keydown', key); document.addEventListener('mousedown', down); window.addEventListener('blur', close); window.addEventListener('resize', close); window.addEventListener('scroll', close, true);
    return () => { document.removeEventListener('keydown', key); document.removeEventListener('mousedown', down); window.removeEventListener('blur', close); window.removeEventListener('resize', close); window.removeEventListener('scroll', close, true); };
  }, [onClose]);
  return createPortal(
    <div ref={ref} role="menu" aria-label="Acciones" style={{ left: pos.x, top: pos.y }} className="ctx-menu anim-pop fixed z-[90] min-w-[190px] rounded-xl border border-line-strong bg-surface p-1.5 shadow-2xl">
      {items.map((it) => (
        <button key={it.label} role="menuitem" type="button" onClick={() => { onClose(); it.onSelect(); }}
          className={cn('ctx-item flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] outline-none', it.danger ? 'text-bad hover:bg-bad/10 focus:bg-bad/10' : 'text-fg hover:bg-surface-2 focus:bg-surface-2')}>
          {it.icon && <span aria-hidden className="text-muted">{it.icon}</span>}<span className="flex-1">{it.label}</span>{it.hint && <span className="text-[11px] text-muted">{it.hint}</span>}
        </button>))}
    </div>, document.body);
}
