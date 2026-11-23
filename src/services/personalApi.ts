import { API_BASE } from './mode';

/** Cliente del modo personal. Cookie httpOnly propia (ruta /api/personal); no toca la sesión de academias. */
async function call<T>(method: 'GET' | 'POST' | 'PUT', path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}/personal${path}`, { method, credentials: 'include', headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), 'X-Requested-With': 'edith' }, body: body === undefined ? undefined : JSON.stringify(body) });
  let data: { error?: string } & Record<string, unknown> = {}; try { data = await res.json(); } catch { /* sin cuerpo */ }
  if (!res.ok) throw Object.assign(new Error(data.error ?? `Error ${res.status}`), { status: res.status });
  return data as T;
}
export interface Client { id: string; name: string; slug?: string; isDemo: boolean; type: string; plan: 'trial' | 'basic' | 'pro' | 'premium'; status: 'active' | 'suspended'; createdAt: string; users: number; students: number; modules: number; storageKb: number; lastActivity?: string; waMonth: number; waPrev: number }
export interface NewClientInput { academyName: string; type: string; plan: Client['plan']; adminEmail: string; adminName?: string }
export interface NewClientResult { academyId: string; name: string; plan: string; adminEmail: string; password: string }
/** Alta de cliente: va al endpoint de onboarding (cerrado al público; exige la sesión personal). La contraseña generada solo llega aquí, una vez. */
async function createClient(body: NewClientInput): Promise<NewClientResult> {
  const res = await fetch(`${API_BASE}/onboarding`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'edith' }, body: JSON.stringify(body) });
  let data: { error?: string } & Partial<NewClientResult> = {}; try { data = await res.json(); } catch { /* sin cuerpo */ }
  if (!res.ok) throw Object.assign(new Error(data.error ?? `Error ${res.status}`), { status: res.status });
  return data as NewClientResult;
}
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
  createClient,
  makeReal: (id: string, adminEmail: string) => call<{ ok: true; name: string; adminEmail: string; password: string }>('POST', `/clients/${encodeURIComponent(id)}/real`, { adminEmail }),
  resetDemos: () => call<{ ok: true; restored: string[] }>('POST', '/demos/reset'),
  ask: (question: string, history: { role: 'user' | 'ai'; text: string }[]) => call<AiReply>('POST', '/ai', { question, history }),
};
