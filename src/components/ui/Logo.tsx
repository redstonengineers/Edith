import { useId } from 'react';

/** Logotipo de EDITH (propuesta B: hexágono con E). Colores propios de la plataforma, no de la academia. */
export function Logo({ size = 36, withWord = false }: { size?: number; withWord?: boolean }) {
  const id = useId();
  return (
    <span className="inline-flex items-center gap-3">
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden focusable="false">
        <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8b7bff" /><stop offset="1" stopColor="#f472b6" /></linearGradient></defs>
        <path d="M32 4l24 14v28L32 60 8 46V18z" fill={`url(#${id})`} />
        <path d="M23 21h19M23 32h14M23 43h19M23 21v22" stroke="#0d0a24" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
      {withWord && <span className="text-sm font-semibold tracking-[0.32em]">EDITH</span>}
    </span>
  );
}
