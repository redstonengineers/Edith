import type { FormEvent, ReactNode } from 'react';
import { X } from 'lucide-react';
import { Modal } from './Overlay';
import { Button } from './Button';

/** Modal con formulario: título, cuerpo con scroll y pie con Cancelar / Guardar. */
export function FormModal({ open, onClose, title, description, onSubmit, submitLabel = 'Guardar', busy, error, children, wide }: {
  open: boolean; onClose: () => void; title: string; description?: string; onSubmit: () => void; submitLabel?: string; busy?: boolean; error?: string | null; children: ReactNode; wide?: boolean;
}) {
  const submit = (e: FormEvent) => { e.preventDefault(); onSubmit(); };
  return (
    <Modal open={open} onClose={onClose} label={title} className={wide ? 'max-w-2xl' : 'max-w-xl'}>
      <form onSubmit={submit} noValidate>
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div><h2 className="text-base font-semibold">{title}</h2>{description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}</div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2"><X size={16} /></button>
        </div>
        <div className="max-h-[62vh] space-y-4 overflow-y-auto px-6 py-5">
          {error && <p role="alert" className="rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p>}
          {children}
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-6 py-3.5">
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="primary" disabled={busy}>{submitLabel}</Button>
        </div>
      </form>
    </Modal>
  );
}
