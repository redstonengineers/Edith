import { DomainError } from './mutations.local';
import { API_BASE } from './mode';
import { idb } from './idb';
import { setOffline, useNet } from './net';

/** Sin conexión (o servidor inalcanzable): la acción no se ha enviado. */
export class OfflineError extends DomainError { constructor() { super('Sin conexión: esta acción necesita internet.'); } }
/** Respuesta de error del servidor, con su código HTTP (para distinguir fallos transitorios de rechazos definitivos). */
export class ApiError extends DomainError { constructor(message: string, public status: number) { super(message); } }

/** Lecturas que se guardan en el dispositivo para poder abrir la app sin conexión (se borran al cerrar sesión). */
const isCached = (path: string) => path === '/auth/me' || path === '/snapshot' || path.startsWith('/snapshot?');
export const clearOfflineCache = () => idb.clear('cache').catch(() => undefined);

/** Cliente HTTP: cookies de sesión httpOnly + cabecera anti-CSRF. Nunca guarda tokens en JS. */
export async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method, credentials: 'include',
      headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), 'X-Requested-With': 'edith' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    // fetch solo lanza si no hay red: lecturas básicas se sirven de la copia local; lo demás falla con un aviso claro.
    setOffline(true);
    if (method === 'GET' && isCached(path)) {
      const c = await idb.get<{ data: T; ts: number }>('cache', path).catch(() => undefined);
      if (c) { useNet.setState({ staleAt: c.ts }); return c.data; }
    }
    throw new OfflineError();
  }
  setOffline(false);
  let data: { error?: string; code?: string } & Record<string, unknown> = {};
  try { data = await res.json(); } catch { /* sin cuerpo */ }
  if (!res.ok) {
    if (res.status === 401 && path !== '/auth/login') { void clearOfflineCache(); window.dispatchEvent(new Event('ac:unauthorized')); }
    throw new ApiError(data.error ?? `Error ${res.status}`, res.status);
  }
  if (method === 'GET' && isCached(path)) {
    if (path === '/auth/me' && !(data as { user?: unknown }).user) void clearOfflineCache(); else void idb.put('cache', { k: path, data, ts: Date.now() }).catch(() => undefined);
  }
  return data as T;
}
export const get = <T,>(path: string) => request<T>('GET', path);
export const post = <T,>(path: string, body?: unknown) => request<T>('POST', path, body);
export const rpc = async <T,>(name: string, args: unknown[]) => (await post<{ result: T }>(`/rpc/${name}`, { args })).result;
