import { create } from 'zustand';
import type { User } from '@/types';
import { authProvider } from '@/services/auth';
import { createRepos, type Snapshot } from '@/services/repositories';
import { getDatabase } from '@/services/database';
import { logActivity } from '@/services/activity';
import { IS_API } from '@/services/mode';
import { registerPermissionOverrides } from '@/lib/permissions';
import { get } from '@/services/http';

interface SessionState {
  status: 'loading' | 'anon' | 'auth';
  user: User | null;
  data: Snapshot | null;
  dataError: string | null;
  init(): Promise<void>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  reload(): Promise<void>;
}

async function hydrate(user: User): Promise<Snapshot> {
  const snap = IS_API ? await get<Snapshot>('/snapshot') : await createRepos(getDatabase(), user).snapshot();
  // La matriz de permisos de la academia (ajustes por rol) condiciona menús y rutas en el cliente; el servidor la aplica igualmente.
  registerPermissionOverrides(user.academyId, snap.settings.permissionOverrides);
  return snap;
}

export const useSession = create<SessionState>((set, get) => ({
  status: 'loading', user: null, data: null, dataError: null,
  async init() {
    const user = await authProvider.restore();
    if (!user) return set({ status: 'anon' });
    try { set({ status: 'auth', user, data: await hydrate(user), dataError: null }); }
    catch (e) { set({ status: 'auth', user, data: null, dataError: (e as Error).message }); }
  },
  async signIn(email, password) {
    const user = await authProvider.signIn(email, password);
    if (!IS_API) logActivity(user, 'inició sesión', 'session', `${user.name} inició sesión`);
    set({ status: 'auth', user, data: await hydrate(user), dataError: null });
  },
  async signOut() { await authProvider.signOut(); set({ status: 'anon', user: null, data: null }); },
  async reload() { const u = get().user; if (u) set({ data: await hydrate(u) }); },
}));

/** Si el servidor invalida la sesión (caducada, usuario desactivado, academia suspendida), volvemos al acceso. */
if (typeof window !== 'undefined') window.addEventListener('ac:unauthorized', () => { if (useSession.getState().status === 'auth') useSession.setState({ status: 'anon', user: null, data: null }); });
