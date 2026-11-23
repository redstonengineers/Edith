import { create } from 'zustand';
import type { User } from '@/types';
import { authProvider } from '@/services/auth';
import { createRepos, type Snapshot } from '@/services/repositories';
import { getDatabase } from '@/services/database';
import { logActivity } from '@/services/activity';
import { IS_API } from '@/services/mode';
import { registerPermissionOverrides } from '@/lib/permissions';
import { ApiError, get } from '@/services/http';
import { useNet } from '@/services/net';
import { probe, setOfflineUser, syncOutbox, withPending } from '@/services/offline';

interface SessionState {
  /** `password`: el cliente debe cambiar su contraseña generada antes de usar la aplicación. */
  status: 'loading' | 'anon' | 'auth' | 'password';
  user: User | null;
  data: Snapshot | null;
  /** Falso mientras llegan las colecciones grandes (alumnos, asistencia, pagos, prácticas): las pantallas que las usan esperan. */
  heavyReady: boolean;
  dataError: string | null;
  init(): Promise<void>;
  signIn(email: string, password: string, remember?: boolean): Promise<void>;
  signInDemo(academy: string, profile: string): Promise<void>;
  changePassword(current: string, next: string): Promise<void>;
  signOut(): Promise<void>;
  reload(): Promise<void>;
}

type Heavy = 'students' | 'attendance' | 'payments' | 'practices';
const HEAVY: Heavy[] = ['students', 'attendance', 'payments', 'practices']; const PAGE = 1000;
/** Pide una colección grande por trozos de 1000 filas (varios en paralelo no hace falta: el trozo siguiente depende del total). */
async function fetchPart<K extends Heavy>(part: K): Promise<Snapshot[K]> {
  const rows: unknown[] = []; let total = Infinity;
  while (rows.length < total) { const r = await get<{ rows: unknown[]; total: number }>(`/snapshot?part=${part}&offset=${rows.length}&limit=${PAGE}`); total = r.total; rows.push(...r.rows); if (!r.rows.length) break; }
  return rows as Snapshot[K];
}

/**
 * Carga los datos. En modo API primero llega el «núcleo» (todo salvo las colecciones grandes: alumnos, asistencia, pagos y prácticas), con lo que
 * la aplicación ya puede pintarse; las grandes se piden después, por trozos, y se avisa con `onCore`. Si el servidor es antiguo o no hay caché
 * de las partes (sin conexión tras una actualización), se usa la instantánea completa.
 */
async function hydrate(user: User, onCore?: (core: Snapshot) => void): Promise<Snapshot> {
  let snap: Snapshot;
  if (!IS_API) snap = await createRepos(getDatabase(), user).snapshot();
  else {
    try {
      const core = await get<Snapshot & { heavy?: Record<Heavy, number> }>('/snapshot?part=core');
      if (!core.heavy) snap = core;
      else {
        registerPermissionOverrides(user.academyId, core.settings.permissionOverrides); setOfflineUser(user.id);
        onCore?.(core);
        const parts = await Promise.all(HEAVY.map((h) => fetchPart(h))); snap = { ...core, ...Object.fromEntries(HEAVY.map((h, i) => [h, parts[i]])) } as Snapshot;
      }
    } catch (e) { if (e instanceof ApiError) throw e; snap = await get<Snapshot>('/snapshot'); }
  }
  if (IS_API) { setOfflineUser(user.id); snap = await withPending(snap, user.id); }
  // La matriz de permisos de la academia (ajustes por rol) condiciona menús y rutas en el cliente; el servidor la aplica igualmente.
  registerPermissionOverrides(user.academyId, snap.settings.permissionOverrides);
  if (IS_API) useNet.setState({ syncedAt: Date.now() });
  return snap;
}

export const useSession = create<SessionState>((set, get) => {
  const enter = async (user: User) => {
    if (user.mustChangePassword) return set({ status: 'password', user, data: null, dataError: null });
    if (!IS_API) logActivity(user, 'inició sesión', 'session', `${user.name} inició sesión`);
    const data = await hydrate(user, (core) => set({ status: 'auth', user, data: core, heavyReady: false, dataError: null }));
    set({ status: 'auth', user, data, heavyReady: true, dataError: null }); void syncOutbox();
  };
  return ({
  status: 'loading', user: null, data: null, heavyReady: false, dataError: null,
  async init() {
    const user = await authProvider.restore();
    if (!user) return set({ status: 'anon' });
    if (user.mustChangePassword) return set({ status: 'password', user, data: null, dataError: null });
    try { const data = await hydrate(user, (core) => set({ status: 'auth', user, data: core, heavyReady: false, dataError: null })); set({ status: 'auth', user, data, heavyReady: true, dataError: null }); void syncOutbox(); }
    catch (e) { set({ status: 'auth', user, data: null, dataError: (e as Error).message }); }
  },
  async signIn(email, password, remember) { await enter(await authProvider.signIn(email, password, remember)); },
  async signInDemo(academy, profile) { await enter(await authProvider.signInDemo(academy, profile)); },
  async changePassword(current, next) { await enter(await authProvider.changePassword(current, next)); },
  async signOut() { await authProvider.signOut(); setOfflineUser(null); set({ status: 'anon', user: null, data: null }); },
  async reload() { const u = get().user; if (u) set({ data: await hydrate(u), heavyReady: true }); },
  });
});

/** Si el servidor invalida la sesión (caducada, usuario desactivado, academia suspendida), volvemos al acceso. */
if (typeof window !== 'undefined') window.addEventListener('ac:unauthorized', () => { if (useSession.getState().status === 'auth') useSession.setState({ status: 'anon', user: null, data: null }); });

/** Sin conexión: al volver la red (o cada 30 s) se envían los cierres guardados y se refresca la vista. */
if (typeof window !== 'undefined' && IS_API) {
  const refresh = () => { if (useSession.getState().status === 'auth') void useSession.getState().reload().catch(() => undefined); };
  const tick = () => { if (useSession.getState().status !== 'auth') return; void syncOutbox().then(() => probe()); };
  window.addEventListener('online', tick); window.addEventListener('ac:synced', refresh); setInterval(tick, 30_000);
}
