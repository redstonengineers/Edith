import { CloudOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { discardClosure, retryClosure, syncOutbox } from '@/services/offline';
import { useNet } from '@/services/net';
import { IS_API } from '@/services/mode';
import { useSession } from '@/store/session';
import { fmtAgo } from '@/utils/format';

/** Aviso fijo sin conexión: datos de la copia local, cierres pendientes de enviar y los que el servidor rechazó. */
export function OfflineBanner() {
  const { offline, staleAt, pending, syncing } = useNet(); const reload = useSession((s) => s.reload);
  if (!IS_API) return null;
  const waiting = pending.filter((p) => !p.error); const failed = pending.filter((p) => p.error);
  if (!offline && !waiting.length && !failed.length) return null;
  return (
    <div className="space-y-2 px-4 pt-3 sm:px-6 lg:px-8" aria-live="polite">
      {(offline || waiting.length > 0) && (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface-2 px-4 py-2.5 text-sm">
          <CloudOff size={16} aria-hidden className="shrink-0 text-warn" />
          <p className="min-w-0 flex-1">
            {offline ? <><b>Sin conexión.</b> {staleAt ? `Datos guardados ${fmtAgo(new Date(staleAt).toISOString())}. ` : ''}Puedes terminar y firmar prácticas: se enviarán solas al volver la red.</> : <>Enviando prácticas firmadas…</>}
            {waiting.length > 0 && <> <b>{waiting.length}</b> {waiting.length === 1 ? 'práctica firmada pendiente' : 'prácticas firmadas pendientes'} de enviar.</>}
          </p>
          <Button onClick={() => void (offline ? reload().catch(() => undefined) : syncOutbox())} disabled={syncing}><RefreshCw size={13} aria-hidden className={syncing ? 'animate-spin' : ''} />{offline ? 'Reintentar conexión' : 'Sincronizar ahora'}</Button>
        </div>)}
      {failed.map((f) => (
        <div key={f.id} role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-bad/50 bg-surface-2 px-4 py-2.5 text-sm">
          <p className="min-w-0 flex-1"><b>No se pudo enviar:</b> {f.label}. <span className="text-muted">{f.error}</span></p>
          <Button onClick={() => void retryClosure(f.id)}>Reintentar</Button><Button onClick={() => void discardClosure(f.id)}>Descartar</Button>
        </div>))}
    </div>
  );
}
