import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useModuleTitle, useVisibleModules } from '@/hooks';
import { Kbd } from '@/components/ui/primitives';

/** Atajos tipo «g luego letra»: g → a abre Alumnos, g → p Pagos… Solo ofrece los módulos que el usuario tiene. */
export const GOTO_KEYS: Record<string, string> = { i: '/', a: '/alumnos', t: '/profesores', g: '/grupos', c: '/clases', h: '/horarios', e: '/examenes', s: '/asistencia', p: '/pagos', f: '/facturacion', d: '/documentos', n: '/incidencias', m: '/mensajes', v: '/avisos', r: '/informes', u: '/usuarios', o: '/configuracion', x: '/practicas', y: '/coches' };

export function GoTo() {
  const nav = useNavigate(); const mods = useVisibleModules(); const title = useModuleTitle(); const [armed, setArmed] = useState(false); const timer = useRef<number | null>(null);
  const options = useMemo(() => Object.entries(GOTO_KEYS).map(([k, path]) => ({ k, path, m: mods.find((x) => x.path === path) })).filter((o) => o.m), [mods]);
  useEffect(() => {
    const off = () => { setArmed(false); if (timer.current) clearTimeout(timer.current); };
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement; if (e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable || document.querySelector('[role=dialog],[role=menu]')) return;
      if (!armed) { if (e.key === 'g') { setArmed(true); timer.current = window.setTimeout(off, 1600); } return; }
      const hit = options.find((o) => o.k === e.key.toLowerCase()); off(); if (hit) { e.preventDefault(); nav(hit.path); } else if (e.key !== 'Shift') { /* cualquier otra tecla cancela */ }
    };
    window.addEventListener('keydown', on); return () => { window.removeEventListener('keydown', on); if (timer.current) clearTimeout(timer.current); };
  }, [armed, options, nav]);
  if (!armed) return null;
  return (
    <div role="status" aria-label="Ir a…" className="goto-pill anim-pop fixed bottom-5 left-1/2 z-[85] max-w-[94vw] -translate-x-1/2 rounded-2xl border border-line-strong bg-surface/95 p-3 shadow-2xl backdrop-blur">
      <p className="mb-2 text-[11px] tracking-[0.14em] text-muted uppercase">Ir a…</p>
      <ul className="flex max-w-[640px] flex-wrap gap-x-4 gap-y-1.5 text-[13px]">{options.map((o) => <li key={o.k} className="flex items-center gap-1.5"><Kbd>{o.k.toUpperCase()}</Kbd><span>{title(o.m!)}</span></li>)}</ul>
    </div>
  );
}
