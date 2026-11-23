import { StatusIndicator } from '@/components/ui/primitives';
import { IS_API } from '@/services/mode';
import { useNet } from '@/services/net';
import { useNow } from '@/hooks';

/** Estado real de la conexión: sin red, datos locales (modo de prueba) o conectado con la hora de la última sincronización. */
export function ConnectionStatus() {
  const { offline, syncedAt, staleAt } = useNet(); useNow(60_000);
  const hm = (t: number) => new Date(t).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  if (!IS_API) return <StatusIndicator tone="warn" pulse={false} label="Datos en este navegador" />;
  if (offline) return <StatusIndicator tone="warn" pulse={false} label={staleAt ? `Sin conexión · datos del ${hm(staleAt)}` : 'Sin conexión'} />;
  return <StatusIndicator label={syncedAt ? `Conectado · sincronizado ${hm(syncedAt)}` : 'Conectado'} />;
}
