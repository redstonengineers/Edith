import { useState } from 'react';
import { Copy, ExternalLink, Globe } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAction, useCan, useSnapshot, useUser } from '@/hooks';
import { updateApplySettings } from '@/services/mutations';

/** Enlace público para que cualquiera pida plaza sin cuenta; las solicitudes llegan a la columna «Solicitud». */
export function PublicFormCard() {
  const snap = useSnapshot(); const user = useUser(); const can = useCan(); const act = useAction(); const apply = snap.settings.apply; const on = apply?.enabled !== false; const edit = can('settings:write');
  const key = snap.academy.slug ?? snap.academy.id; const url = `${window.location.origin}/matricula/${key}`;
  const [open, setOpen] = useState(false); const [msg, setMsg] = useState(apply?.message ?? ''); const [opts, setOpts] = useState((apply?.interests ?? []).join(', ')); const [copied, setCopied] = useState(false);
  const save = (enabled: boolean, message = msg, interests = opts) => act(() => updateApplySettings(user, { enabled, message: message.trim() || undefined, interests: interests.split(/[,\n]/).map((x) => x.trim()).filter(Boolean) }), enabled ? 'Formulario público guardado' : 'Formulario público desactivado');
  const copy = async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { window.prompt('Copia el enlace:', url); } };
  return (
    <section aria-label="Formulario público de solicitud" className="panel mb-5 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span aria-hidden className="grid size-9 place-items-center rounded-lg bg-brand/15 text-brand-text"><Globe size={18} /></span>
        <div className="min-w-0 flex-1"><h2 className="text-sm font-semibold">Formulario público de solicitud</h2>
          <p className="text-xs text-muted">{on ? 'Cualquiera puede pedir plaza con este enlace, sin cuenta. Ponlo en tu web, redes o un cartel.' : 'Desactivado: el enlace no admite solicitudes.'}</p></div>
        {edit && <label className="flex items-center gap-2 text-xs"><input type="checkbox" role="switch" aria-label="Formulario público activo" className="size-4 accent-[var(--brand)]" checked={on} onChange={(e) => void save(e.target.checked)} />Activo</label>}
      </div>
      {on && <div className="mt-3 flex flex-wrap items-center gap-2">
        <input readOnly aria-label="Enlace del formulario público" value={url} onFocus={(e) => e.currentTarget.select()} className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-xs" />
        <Button size="sm" onClick={() => void copy()}><Copy size={14} aria-hidden />{copied ? 'Copiado' : 'Copiar enlace'}</Button>
        <a href={url} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-3 text-xs hover:bg-surface-2"><ExternalLink size={14} aria-hidden />Ver formulario</a>
        {edit && <Button size="sm" variant="ghost" aria-expanded={open} onClick={() => setOpen(!open)}>Personalizar</Button>}
      </div>}
      {on && edit && open && <div className="mt-3 grid gap-3 border-t border-line pt-3 md:grid-cols-2">
        <label className="text-xs text-muted">Texto de bienvenida<textarea rows={3} maxLength={400} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Rellena el formulario y nos pondremos en contacto contigo." className="mt-1 w-full rounded-lg border border-line bg-surface p-2 text-sm text-fg" /></label>
        <label className="text-xs text-muted">Opciones de «qué te interesa» (separadas por comas; vacío = las del negocio)<textarea rows={3} value={opts} onChange={(e) => setOpts(e.target.value)} placeholder="Permiso B, Permiso A2, Refresco de conducción" className="mt-1 w-full rounded-lg border border-line bg-surface p-2 text-sm text-fg" /></label>
        <div className="md:col-span-2"><Button size="sm" variant="primary" onClick={() => void save(true)}>Guardar</Button></div>
      </div>}
    </section>
  );
}
