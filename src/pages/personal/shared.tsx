import { useRef, type FormEvent, type PointerEvent as RPE, type ReactNode } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

export const todayISO = () => format(new Date(), 'yyyy-MM-dd');
export const COLORS = ['#22c8ff', '#a78bfa', '#34d399', '#fbbf24', '#f472b6', '#fb923c'];
export const eur = (n: number) => `${n.toLocaleString('es-ES', { maximumFractionDigits: 2 })} €`;
export function Bar({ pct, tone }: { pct: number; tone?: 'warn' | 'bad' }) { return <div className={`hud-bar ${tone ?? ''}`} role="progressbar" aria-label="Progreso" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} /></div>; }
export const Empty = ({ text }: { text: string }) => <p className="py-2 text-xs text-muted">{text}</p>;

/** Panel de cristal que se inclina hacia el puntero y refleja luz. */
export function Panel({ title, right, children, className = '', onOpen, grow = 1 }: { grow?: number; title: string; right?: ReactNode; children: ReactNode; className?: string; onOpen?: () => void }) {
  const ref = useRef<HTMLElement>(null);
  const move = (e: RPE<HTMLElement>) => {
    if (e.pointerType === 'touch') return; const el = ref.current!; const r = el.getBoundingClientRect(); const px = (e.clientX - r.left) / r.width; const py = (e.clientY - r.top) / r.height;
    el.classList.add('tilting'); el.style.setProperty('--ry', `${(px - .5) * 8}deg`); el.style.setProperty('--rx', `${-(py - .5) * 8}deg`); el.style.setProperty('--gx', `${px * 100}%`); el.style.setProperty('--gy', `${py * 100}%`);
  };
  const leave = () => { const el = ref.current!; el.classList.remove('tilting'); el.style.setProperty('--ry', '0deg'); el.style.setProperty('--rx', '0deg'); };
  return (
    <section ref={ref} style={{ flexGrow: grow }} className={`hud-panel ${className}`} onPointerMove={move} onPointerLeave={leave}>
      <i className="hud-glare" aria-hidden />
      <h2 className="hud-h"><span>{title}</span>{right}{onOpen && <button className="hud-ghost" onClick={onOpen} aria-label={`Abrir ${title}`}><Plus size={14} aria-hidden /></button>}</h2>
      <div className="hud-body">{children}</div>
    </section>
  );
}

export const Row = ({ children, onDelete, label }: { children: ReactNode; onDelete: () => void; label: string }) => <div className="hud-row">{children}<button onClick={onDelete} className="hud-ghost ml-auto" aria-label={`Eliminar ${label}`}><Trash2 size={14} aria-hidden /></button></div>;
export function AddForm({ onAdd, children, label = 'Añadir' }: { onAdd: () => boolean | void; children: ReactNode; label?: string }) {
  return <form onSubmit={(e: FormEvent) => { e.preventDefault(); onAdd(); }} className="mb-4 flex flex-wrap items-end gap-2">{children}<button className="hud-btn" type="submit"><Plus size={14} className="mr-1 inline" aria-hidden />{label}</button></form>;
}
export const F = ({ label, children, w = 'flex-1 min-w-32' }: { label: string; children: ReactNode; w?: string }) => <label className={`block ${w}`}><span className="hud-sub mb-1 block">{label}</span>{children}</label>;
