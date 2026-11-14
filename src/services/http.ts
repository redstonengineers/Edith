import { DomainError } from './mutations.local';
import { API_BASE } from './mode';

/** Cliente HTTP: cookies de sesión httpOnly + cabecera anti-CSRF. Nunca guarda tokens en JS. */
export async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method, credentials: 'include',
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), 'X-Requested-With': 'edith' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data: { error?: string; code?: string } & Record<string, unknown> = {};
  try { data = await res.json(); } catch { /* sin cuerpo */ }
  if (!res.ok) {
    if (res.status === 401 && path !== '/auth/login') window.dispatchEvent(new Event('ac:unauthorized'));
    throw new DomainError(data.error ?? `Error ${res.status}`);
  }
  return data as T;
}
export const get = <T,>(path: string) => request<T>('GET', path);
export const post = <T,>(path: string, body?: unknown) => request<T>('POST', path, body);
export const rpc = async <T,>(name: string, args: unknown[]) => (await post<{ result: T }>(`/rpc/${name}`, { args })).result;
