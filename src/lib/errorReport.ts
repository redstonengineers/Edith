/**
 * Informe de errores a Sentry (opcional, solo con SENTRY_DSN). Cliente mínimo por el protocolo de «envelope» —sin dependencias— y compartido
 * por servidor y navegador. NO envía datos de personas: se descartan usuario, cookies, cabeceras, cuerpos y parámetros de URL, y se tachan
 * correos, teléfonos, DNI/NIE y cadenas largas (posibles tokens) del texto de los mensajes y de las trazas.
 */
export interface ErrorEventInput { error: unknown; where: 'server' | 'browser'; release?: string; environment?: string; url?: string; extra?: Record<string, string | number | boolean> }

const RULES: [RegExp, string][] = [
  [/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[correo]'],
  [/\b\d{8}[A-Za-z]\b|\b[XYZxyz]\d{7}[A-Za-z]\b/g, '[documento]'],
  [/(?<![\w.])\+?\d[\d\s().-]{7,}\d(?![\w])/g, '[número]'],
  [/\b[A-Za-z0-9_-]{32,}\b/g, '[token]'],
];
export const scrubText = (s: string) => RULES.reduce((t, [re, to]) => t.replace(re, to), s);
export const scrubUrl = (u?: string) => { if (!u) return undefined; try { const x = new URL(u, 'http://x'); return scrubText(x.pathname.replace(/\/[^/]*\d[^/]*/g, '/:id')); } catch { return undefined; } };

export interface Dsn { endpoint: string; key: string }
export function parseDsn(dsn: string): Dsn | null {
  try { const u = new URL(dsn); const project = u.pathname.replace(/^\/+/, ''); if (!u.username || !project) return null; return { endpoint: `${u.protocol}//${u.host}/api/${project}/envelope/`, key: u.username }; } catch { return null; }
}

/** Evento ya depurado, listo para enviar. */
export function buildEvent(i: ErrorEventInput, now = new Date()) {
  const err = i.error instanceof Error ? i.error : new Error(String(i.error));
  const frames = (err.stack ?? '').split('\n').slice(1, 30).map((l) => scrubText(l.trim().replace(/\([^)]*[\\/]([^\\/)]+)\)/, '($1)'))).filter(Boolean);
  return {
    event_id: Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join(''), timestamp: now.getTime() / 1000, platform: i.where === 'server' ? 'node' : 'javascript', level: 'error',
    release: i.release, environment: i.environment, tags: { side: i.where }, request: i.url ? { url: scrubUrl(i.url) } : undefined, extra: i.extra,
    exception: { values: [{ type: scrubText(err.name || 'Error'), value: scrubText(err.message || ''), stacktrace: { frames: frames.map((f) => ({ function: f })) } }] },
  };
}

export async function sendError(dsn: string | null | undefined, i: ErrorEventInput, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const d = dsn ? parseDsn(dsn) : null; if (!d) return false;
  const ev = buildEvent(i); const body = [JSON.stringify({ event_id: ev.event_id, sent_at: new Date().toISOString() }), JSON.stringify({ type: 'event' }), JSON.stringify(ev)].join('\n');
  try { const r = await fetchImpl(`${d.endpoint}?sentry_key=${d.key}&sentry_version=7`, { method: 'POST', body, headers: { 'Content-Type': 'application/x-sentry-envelope' }, keepalive: true }); return r.ok; } catch { return false; }
}
