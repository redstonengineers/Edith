import { CheckCircle2, Info, XCircle } from 'lucide-react';
import { useUi } from '@/store/ui';
import { cn } from '@/utils/cn';

export function Toaster() {
  const toasts = useUi((s) => s.toasts);
  const dismiss = useUi((s) => s.dismissToast);
  return (
    <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-20 z-[80] flex w-[min(92vw,360px)] flex-col gap-2 lg:bottom-4">
      {toasts.map((t) => {
        const Icon = t.kind === 'success' ? CheckCircle2 : t.kind === 'error' ? XCircle : Info;
        return (
          <div key={t.id} role={t.kind === 'error' ? 'alert' : 'status'} className="toast anim-pop panel pointer-events-auto relative flex items-start gap-3 overflow-hidden bg-surface p-3.5 shadow-xl" data-kind={t.kind}>
            <Icon size={18} className={cn('toast-icon mt-0.5 shrink-0', t.kind === 'success' && 'text-ok', t.kind === 'error' && 'text-bad', t.kind === 'info' && 'text-info')} aria-hidden />
            <div className="min-w-0 flex-1"><p className="text-sm font-medium">{t.title}</p>{t.description && <p className="text-[13px] text-muted">{t.description}</p>}</div>
            <button onClick={() => dismiss(t.id)} className="text-xs text-muted hover:text-fg" aria-label="Cerrar aviso">✕</button>
            <span aria-hidden className="toast-bar" />
          </div>
        );
      })}
    </div>
  );
}
