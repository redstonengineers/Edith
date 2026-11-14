import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useFocusTrap } from '@/hooks';

interface BaseProps { open: boolean; onClose: () => void; label: string; children: ReactNode; className?: string }

function useEsc(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const on = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [open, onClose]);
}

/** Panel lateral (menú móvil, JARVIS AI, detalle rápido). */
export function Drawer({ open, onClose, label, children, side = 'right', className, hideClose }: BaseProps & { side?: 'left' | 'right'; hideClose?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEsc(open, onClose);
  useFocusTrap(ref, open);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="anim-fade absolute inset-0 bg-black/55 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div ref={ref} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}
        className={cn('absolute top-0 bottom-0 flex w-[min(92vw,400px)] flex-col border-line bg-surface shadow-2xl', side === 'right' ? 'right-0 border-l anim-right' : 'left-0 border-r anim-left', className)}>
        {!hideClose && (
          <button onClick={onClose} aria-label="Cerrar" className="absolute top-3 right-3 z-10 grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg"><X size={16} /></button>
        )}
        {children}
      </div>
    </div>, document.body);
}

/** Diálogo centrado. */
export function Modal({ open, onClose, label, children, className }: BaseProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEsc(open, onClose);
  useFocusTrap(ref, open);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]">
      <div className="anim-fade absolute inset-0 bg-black/60 backdrop-blur-[3px]" onClick={onClose} aria-hidden />
      <div ref={ref} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} className={cn('anim-pop panel relative w-full max-w-xl shadow-2xl', className)}>{children}</div>
    </div>, document.body);
}

export function ConfirmDialog({ open, title, description, confirmLabel = 'Confirmar', danger, onConfirm, onClose }: { open: boolean; title: string; description?: string; confirmLabel?: string; danger?: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} label={title} className="max-w-md">
      <div className="p-6">
        <h2 className="text-base font-semibold">{title}</h2>
        {description && <p className="mt-1.5 text-sm text-muted">{description}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="h-9 rounded-lg border border-line px-3.5 text-sm hover:bg-surface-2">Cancelar</button>
          <button data-autofocus onClick={() => { onConfirm(); onClose(); }} className={cn('h-9 rounded-lg px-3.5 text-sm font-medium', danger ? 'bg-bad text-white' : 'bg-brand text-on-brand')}>{confirmLabel}</button>
        </div>
      </div>
    </Modal>
  );
}
