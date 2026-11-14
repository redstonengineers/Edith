import { useEffect, useMemo, useRef, useState } from 'react';
import { MODULES, type ModuleDef } from '@/config/modules';
import { can, type Permission } from '@/lib/permissions';
import { useSession } from '@/store/session';
import { useUi } from '@/store/ui';
import type { LabelKey, ModuleId } from '@/types';

export function useUser() { const u = useSession((s) => s.user); if (!u) throw new Error('Sin sesión'); return u; }
export function useSnapshot() { const d = useSession((s) => s.data); if (!d) throw new Error('Datos no cargados'); return d; }
export function useSettings() { return useSnapshot().settings; }
export function useLabels() { return useSettings().labels; }
export function useLabel(key: LabelKey) { return useLabels()[key]; }

export function useCan() { const u = useSession((s) => s.user); return (p: Permission) => can(u, p); }

export function isModuleEnabled(settings: { modules: Partial<Record<ModuleId, boolean>> }, m: ModuleDef) {
  return m.core || settings.modules[m.id] === true;
}

/** Módulos visibles: activos en la academia Y permitidos al rol. Fuente de sidebar, buscador y rutas. */
export function useVisibleModules(): ModuleDef[] {
  const user = useSession((s) => s.user);
  const settings = useSession((s) => s.data?.settings);
  return useMemo(() => (settings ? MODULES.filter((m) => isModuleEnabled(settings, m) && can(user, m.permission)) : []), [user, settings]);
}

/** Título de módulo con la terminología de la academia. */
export function useModuleTitle() {
  const labels = useSession((s) => s.data?.settings.labels);
  return (m: ModuleDef) => (m.labelKey && labels ? labels[m.labelKey].plural : m.title);
}

/** Atajo de teclado global. `mod` = Ctrl o ⌘. */
export function useHotkey(key: string, handler: (e: KeyboardEvent) => void, opts: { mod?: boolean } = {}) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (opts.mod && !(e.ctrlKey || e.metaKey)) return;
      if (e.key.toLowerCase() === key.toLowerCase()) ref.current(e);
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [key, opts.mod]);
}

/** Reloj que se actualiza cada `ms`. */
export function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

/** Atrapa el foco dentro de `ref` mientras `active` y lo devuelve al cerrar. */
export function useFocusTrap(ref: React.RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active || !ref.current) return;
    const el = ref.current;
    const prev = document.activeElement as HTMLElement | null;
    const sel = 'a[href],button:not([disabled]),input:not([disabled]),textarea,select,[tabindex]:not([tabindex="-1"])';
    (el.querySelector<HTMLElement>('[data-autofocus]') ?? el.querySelector<HTMLElement>(sel) ?? el).focus();
    const on = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const f = [...el.querySelectorAll<HTMLElement>(sel)].filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    el.addEventListener('keydown', on);
    return () => { el.removeEventListener('keydown', on); prev?.focus?.(); };
  }, [active, ref]);
}

/** Cuenta animada para cifras grandes (respeta reduced-motion). */
export function useCountUp(target: number, ms = 700) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setV(target); return; }
    let raf = 0; const t0 = performance.now();
    const tick = (t: number) => { const p = Math.min(1, (t - t0) / ms); setV(Math.round(target * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

/** Estado persistente en localStorage (filtros que sobreviven a la navegación y recargas). */
export function usePersistentState<T>(key: string, initial: T) {
  const [v, setV] = useState<T>(() => { try { const r = localStorage.getItem(key); return r ? (JSON.parse(r) as T) : initial; } catch { return initial; } });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* sin cuota */ } }, [key, v]);
  return [v, setV] as const;
}

/** Ejecuta una mutación, recarga datos y avisa con toast. Devuelve true si salió bien. */
export function useAction() {
  const reload = useSession((s) => s.reload);
  const toast = useUi((s) => s.toast);
  return async <T,>(fn: () => T | Promise<T>, ok: string): Promise<Awaited<T> | null> => {
    try { const r = await fn(); await reload(); toast({ kind: 'success', title: ok }); return r; }
    catch (e) { toast({ kind: 'error', title: 'No se pudo completar', description: (e as Error).message }); return null; }
  };
}
