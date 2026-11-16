import { useState } from 'react';

const KEY = 'ac.remember';
/** Preferencia «mantener la sesión iniciada» (solo la casilla; nunca se guardan credenciales). */
export function useRemember() {
  const [on, setOn] = useState(() => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } });
  const set = (v: boolean) => { setOn(v); try { localStorage.setItem(KEY, v ? '1' : '0'); } catch { /* sin almacenamiento */ } };
  return [on, set] as const;
}

export function RememberMe({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-2.5 text-sm"><input type="checkbox" className="mt-0.5 size-4 accent-[var(--brand)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>Mantener la sesión iniciada<span className="block text-xs text-muted">Durante 30 días en este dispositivo. No lo actives en ordenadores compartidos.</span></span></label>
  );
}
