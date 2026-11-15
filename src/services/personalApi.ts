import { API_BASE } from './mode';

/** Cliente del modo personal. Cookie httpOnly propia (ruta /api/personal); no toca la sesión de academias. */
async function call<T>(method: 'GET' | 'POST' | 'PUT', path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}/personal${path}`, { method, credentials: 'include', headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), 'X-Requested-With': 'edith' }, body: body === undefined ? undefined : JSON.stringify(body) });
  let data: { error?: string } & Record<string, unknown> = {}; try { data = await res.json(); } catch { /* sin cuerpo */ }
  if (!res.ok) throw Object.assign(new Error(data.error ?? `Error ${res.status}`), { status: res.status });
  return data as T;
}
export interface Client { id: string; name: string; slug?: string; type: string; plan: 'trial' | 'basic' | 'pro' | 'premium'; status: 'active' | 'suspended'; createdAt: string; users: number; students: number; modules: number; storageKb: number; lastActivity?: string; waMonth: number; waPrev: number }
export interface AiReply { text: string; kind?: string }
export const personalApi = {
  me: () => call<{ authed: boolean; profile: string | null }>('GET', '/me'),
  login: (user: string, password: string) => call<{ ok: true }>('POST', '/login', { user, password }),
  profile: (profile: string) => call<{ ok: true }>('POST', '/profile', { profile }),
  logout: () => call<{ ok: true }>('POST', '/logout'),
  load: () => call<{ rev: number; data: Record<string, unknown> | null }>('GET', '/data'),
  save: (rev: number, data: unknown) => call<{ rev: number }>('PUT', '/data', { rev, data }),
  clients: () => call<{ clients: Client[] }>('GET', '/clients'),
  setClientPlan: (id: string, plan: Client['plan'], applyModules: boolean) => call<{ ok: true; name: string; plan: string; disabled: string[] }>('POST', `/clients/${encodeURIComponent(id)}/plan`, { plan, applyModules }),
  setClientStatus: (id: string, status: Client['status']) => call<{ ok: true; name: string; status: string }>('POST', `/clients/${encodeURIComponent(id)}/status`, { status }),
  ask: (question: string, history: { role: 'user' | 'ai'; text: string }[]) => call<AiReply>('POST', '/ai', { question, history }),
};
