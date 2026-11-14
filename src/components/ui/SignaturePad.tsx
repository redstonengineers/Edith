import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

export interface PadHandle { clear: () => void; toDataURL: () => string | null; isEmpty: () => boolean }
/** Recuadro de firma táctil (ratón, dedo o lápiz). Devuelve un PNG pequeño; sin dependencias. */
export const SignaturePad = forwardRef<PadHandle, { label: string; onChange?: (empty: boolean) => void; height?: number }>(function SignaturePad({ label, onChange, height = 180 }, ref) {
  const cv = useRef<HTMLCanvasElement>(null); const drawing = useRef(false); const last = useRef<{ x: number; y: number } | null>(null); const [empty, setEmpty] = useState(true);
  const ctx = () => cv.current!.getContext('2d')!;
  useEffect(() => { const c = cv.current!; const r = c.getBoundingClientRect(); const dpr = Math.min(window.devicePixelRatio || 1, 2); c.width = Math.round(r.width * dpr); c.height = Math.round(height * dpr); const g = ctx(); g.scale(dpr, dpr); g.lineWidth = 2.4; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#111'; }, [height]);
  const pos = (e: React.PointerEvent) => { const r = cv.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const down = (e: React.PointerEvent) => { e.preventDefault(); cv.current!.setPointerCapture(e.pointerId); drawing.current = true; last.current = pos(e); const g = ctx(); g.beginPath(); g.arc(last.current.x, last.current.y, 1.2, 0, 7); g.fillStyle = '#111'; g.fill(); if (empty) { setEmpty(false); onChange?.(false); } };
  const move = (e: React.PointerEvent) => { if (!drawing.current || !last.current) return; const p = pos(e); const g = ctx(); g.beginPath(); g.moveTo(last.current.x, last.current.y); g.lineTo(p.x, p.y); g.stroke(); last.current = p; };
  const up = () => { drawing.current = false; last.current = null; };
  const clear = () => { const c = cv.current!; ctx().clearRect(0, 0, c.width, c.height); setEmpty(true); onChange?.(true); };
  useImperativeHandle(ref, () => ({ clear, isEmpty: () => empty, toDataURL: () => (empty ? null : cv.current!.toDataURL('image/png')) }));
  return (
    <div>
      <div className="relative overflow-hidden rounded-xl border-2 border-dashed border-line-strong bg-white" style={{ height }}>
        <canvas ref={cv} aria-label={label} role="img" className="absolute inset-0 h-full w-full touch-none" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
        {empty && <span className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-neutral-400">Firma aquí con el dedo</span>}
      </div>
      <button type="button" onClick={clear} className="mt-1.5 text-xs text-muted hover:text-fg" disabled={empty}>Borrar y repetir</button>
    </div>
  );
});
