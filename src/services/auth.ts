import type { User } from '@/types';
import { getDatabase } from './database';
import { verifyPassword } from './crypto';
import { IS_API } from './mode';
import { clearOfflineCache, get, OfflineError, post } from './http';
import { publicTenants, type PublicTenant } from '@/data/tenants';

export interface AuthProvider {
  signIn(email: string, password: string, academy?: string): Promise<User>;
  signOut(): Promise<void>;
  restore(): Promise<User | null>;
}

const KEY = 'ac.session';
/** Contraseña de las cuentas de demostración. SOLO modo mock: el servidor real valida con hash en el servidor. */
export const DEMO_PASSWORD = 'demo';

function usable(u: User | undefined | null): u is User {
  if (!u || u.disabled) return false;
  const a = getDatabase().academies.find((x) => x.id === u.academyId);
  return !!a && (a.status === 'active' || u.role === 'SUPER_ADMIN');
}

export const mockAuth: AuthProvider = {
  async signIn(email, password, academy) {
    const db = getDatabase(); const id = email.trim().toLowerCase(); const scope = academy ? db.academies.find((a) => a.slug === academy)?.id : undefined;
    const user = db.users.find((u) => (u.email.toLowerCase() === id || u.username?.toLowerCase() === id) && (!academy || u.academyId === scope));
    // Mensaje único para no revelar si el correo existe.
    const bad = new Error('Credenciales no válidas');
    if (!user) throw bad;
    const okPw = user.pwd ? await verifyPassword(password, user.pwd) : password === DEMO_PASSWORD;
    if (!okPw) throw bad;
    if (user.disabled) throw new Error('Tu cuenta está desactivada. Contacta con el administrador.');
    if (!usable(user)) throw new Error('Esta academia está suspendida. Contacta con soporte.');
    localStorage.setItem(KEY, user.id);
    return user;
  },
  async signOut() { localStorage.removeItem(KEY); },
  async restore() {
    const id = localStorage.getItem(KEY);
    const u = getDatabase().users.find((x) => x.id === id);
    return usable(u) ? u : null;
  },
};

/** Sesión real: el servidor emite una cookie httpOnly; el navegador nunca ve el token. */
export const httpAuth: AuthProvider = {
  async signIn(email, password, academy) { const { user } = await post<{ user: User }>('/auth/login', { email, password, ...(academy ? { academy } : {}) }); await clearOfflineCache(); return user; },
  async signOut() { try { await post('/auth/logout'); } catch (e) { if (!(e instanceof OfflineError)) throw e; } await clearOfflineCache(); },
  async restore() { try { return (await get<{ user: User | null }>('/auth/me')).user; } catch { return null; } },
};

export const authProvider: AuthProvider = IS_API ? httpAuth : mockAuth;

export interface DemoAccount { id: string; name: string; email: string; role: string; academy: string }
/** Cuentas de acceso rápido de la pantalla de login (solo demo). En api, el servidor las expone únicamente con SEED_DEMO=1. */
export async function listDemoAccounts(): Promise<DemoAccount[]> {
  if (IS_API) { try { return (await get<{ accounts: DemoAccount[] }>('/demo-accounts')).accounts; } catch { return []; } }
  const db = getDatabase();
  return db.users.filter((u) => !u.pwd).map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, academy: db.academies.find((a) => a.id === u.academyId)?.name ?? '' }));
}

/** Negocios con acceso propio (tarjetas de la pantalla de inicio de sesión). */
export async function listTenants(): Promise<PublicTenant[]> {
  if (IS_API) { try { return (await get<{ tenants: PublicTenant[] }>('/public/tenants')).tenants; } catch { return []; } }
  return publicTenants(getDatabase());
}
