import { create } from 'zustand';
import type { User } from '@/types';
import { authProvider } from '@/services/auth';
import { createRepos, type Snapshot } from '@/services/repositories';
import { getDatabase } from '@/services/database';
import { logActivity } from '@/services/activity';
import { IS_API } from '@/services/mode';
import { registerPermissionOverrides } from '@/lib/permissions';
import { get } from '@/services/http';
import { probe, setOfflineUser, syncOutbox, withPending } from '@/services/offline';

interface SessionState {
  status: 'loading' | 'anon' | 'auth';
  user: User | null;
  data: Snapshot | null;
  dataError: string | null;
  init(): Promise<void>;
  signIn(email: string, password: string, academy?: string, remember?: boolean): Promise<void>;
  signOut(): Promise<void>;
  reload(): Promise<void>;
}

async function hydrate(user: User): Promise<Snapshot> {
  let snap = IS_API ? await get<Snapshot>('/snapshot') : await createRepos(getDatabase(), user).snapshot();
  if (IS_API) { setOfflineUser(user.id); snap = await withPending(snap, user.id); }
  // La matriz de permisos de la academia (ajustes por rol) condiciona menús y rutas en el cliente; el servidor la aplica igualmente.
  registerPermissionOverrides(user.academyId, snap.settings.permissionOverrides);
  return snap;
}

export const useSession = create<SessionState>((set, get) => ({
  status: 'loading', user: null, data: null, dataError: null,
  async init() {
    const user = await authProvider.restore();
    if (!user) return set({ status: 'anon' });
    try { set({ status: 'auth', user, data: await hydrate(user), dataError: null }); void syncOutbox(); }
    catch (e) { set({ status: 'auth', user, data: null, dataError: (e as Error).message }); }
  },
  async signIn(email, password, academy, remember) {
    const user = await authProvider.signIn(email, password, academy, remember);
    if (!IS_API) logActivity(user, 'inició sesión', 'session', `${user.name} inició sesión`);
    set({ status: 'auth', user, data: await hydrate(user), dataError: null }); void syncOutbox();
  },
  async signOut() { await authProvider.signOut(); setOfflineUser(null); set({ status: 'anon', user: null, data: null }); },
  async reload() { const u = get().user; if (u) set({ data: await hydrate(u) }); },
}));

/** Si el servidor invalida la sesión (caducada, usuario desactivado, academia suspendida), volvemos al acceso. */
if (typeof window !== 'undefined') window.addEventListener('ac:unauthorized', () => { if (useSession.getState().status === 'auth') useSession.setState({ status: 'anon', user: null, data: null }); });

/** Sin conexión: al volver la red (o cada 30 s) se envían los cierres guardados y se refresca la vista. */
if (typeof window !== 'undefined' && IS_API) {
  const refresh = () => { if (useSession.getState().status === 'auth') void useSession.getState().reload().catch(() => undefined); };
  const tick = () => { if (useSession.getState().status !== 'auth') return; void syncOutbox().then(() => probe()); };
  window.addEventListener('online', tick); window.addEventListener('ac:synced', refresh); setInterval(tick, 30_000);
}
