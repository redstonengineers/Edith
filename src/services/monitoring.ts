import { IS_API } from './mode';
import { API_BASE } from './mode';
import { sendError } from '@/lib/errorReport';

let dsn: string | null = null;
/** Errores del navegador a Sentry (opcional). El DSN llega del servidor (SENTRY_DSN); sin él no se envía nada. Los datos de personas se tachan antes de salir. */
export const reportBrowserError = (error: unknown) => { if (dsn) void sendError(dsn, { error, where: 'browser', url: location.pathname, environment: import.meta.env.MODE }); };

export async function initMonitoring() {
  if (!IS_API) return;
  try { const r = await fetch(`${API_BASE}/public/config`, { credentials: 'omit' }); if (!r.ok) return; dsn = ((await r.json()) as { sentryDsn: string | null }).sentryDsn; } catch { return; }
  if (!dsn) return;
  window.addEventListener('error', (e) => reportBrowserError(e.error ?? e.message));
  window.addEventListener('unhandledrejection', (e) => reportBrowserError(e.reason));
}
