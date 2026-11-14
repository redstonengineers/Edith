import { API_BASE } from './mode';

/** Cliente del modo personal. Cookie httpOnly propia (ruta /api/personal); no toca la sesión de academias. */
async function call<T>(method: 'GET' | 'POST' | 'PUT', path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}/personal${path}`, { method, credentials: 'include', headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), 'X-Requested-With': 'edith' }, body: body === undefined ? undefined : JSON.stringify(body) });
  let data: { error?: string } & Record<string, unknown> = {}; try { data = await res.json(); } catch { /* sin cuerpo */ }
  if (!res.ok) throw Object.assign(new Error(data.error ?? `Error ${res.status}`), { status: res.status });
  return data as T;
}
export interface AiReply { text: string; kind?: string }
export const personalApi = {
  me: () => call<{ authed: boolean; profile: string | null }>('GET', '/me'),
  login: (user: string, password: string) => call<{ ok: true }>('POST', '/login', { user, password }),
  profile: (profile: string) => call<{ ok: true }>('POST', '/profile', { profile }),
  logout: () => call<{ ok: true }>('POST', '/logout'),
  load: () => call<{ rev: number; data: Record<string, unknown> | null }>('GET', '/data'),
  save: (rev: number, data: unknown) => call<{ rev: number }>('PUT', '/data', { rev, data }),
  ask: (question: string, history: { role: 'user' | 'ai'; text: string }[]) => call<AiReply>('POST', '/ai', { question, history }),
};
