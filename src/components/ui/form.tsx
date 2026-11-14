import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export const inputCls = 'h-10 w-full rounded-lg border border-line bg-bg px-3 text-sm outline-none transition-colors placeholder:text-muted focus:border-brand disabled:opacity-50 aria-[invalid=true]:border-bad';

/** Etiqueta + control + error enlazados por ARIA. `children` recibe los props a aplicar al control. */
export function Field({ label, error, hint, required, className, children }: { label: string; error?: string; hint?: string; required?: boolean; className?: string; children: (p: { id: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }) => ReactNode }) {
  const id = useId(); const msg = `${id}-m`;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium">{label}{required && <span aria-hidden className="text-bad"> *</span>}</label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': error || hint ? msg : undefined })}
      {(error || hint) && <p id={msg} role={error ? 'alert' : undefined} className={cn('mt-1 text-xs', error ? 'text-bad' : 'text-muted')}>{error ?? hint}</p>}
    </div>
  );
}
export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cn(inputCls, p.className)} />;
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cn(inputCls, 'pr-8', p.className)} />;
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={cn(inputCls, 'h-auto min-h-24 py-2', p.className)} />;
