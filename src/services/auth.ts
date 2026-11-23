import type { User } from '@/types';
import { getDatabase } from './database';
import { hashPassword, verifyPassword } from './crypto';
import { IS_API } from './mode';
import { clearOfflineCache, get, OfflineError, post } from './http';
import { publicTenants, type PublicTenant } from '@/data/tenants';

export interface AuthProvider {
  /** Cliente: correo y contraseña. */
  signIn(email: string, password: string, remember?: boolean): Promise<User>;
  /** Demo abierta: sin contraseña, solo en negocios con `isDemo`. `academy` = slug (o id) del negocio y `profile` = usuario del perfil. */
  signInDemo(academy: string, profile: string): Promise<User>;
  /** Cambia la contraseña (obligatorio en el primer acceso de un cliente). */
  changePassword(current: string, next: string): Promise<User>;
  signOut(): Promise<void>;
  restore(): Promise<User | null>;
}

const KEY = 'ac.session';

function usable(u: User | undefined | null): u is User {
  if (!u || u.disabled) return false;
  const a = getDatabase().academies.find((x) => x.id === u.academyId);
  return !!a && (a.status === 'active' || u.role === 'SUPER_ADMIN');
}

export const mockAuth: AuthProvider = {
  async signIn(email, password) {
    const db = getDatabase(); const id = email.trim().toLowerCase();
    // Las cuentas de negocios demo no entran con contraseña (no la tienen); solo los clientes, por correo.
    const user = db.users.find((u) => u.email.toLowerCase() === id && db.academies.find((a) => a.id === u.academyId)?.isDemo !== true);
    // Mensaje único para no revelar si el correo existe.
    const bad = new Error('Credenciales no válidas');
    if (!user || !user.pwd) throw bad;
    if (!(await verifyPassword(password, user.pwd))) throw bad;
    if (user.disabled) throw new Error('Tu cuenta está desactivada. Contacta con el administrador.');
    if (!usable(user)) throw new Error('Esta academia está suspendida. Contacta con soporte.');
    localStorage.setItem(KEY, user.id);
    return user;
  },
  async signInDemo(academy, profile) {
    const db = getDatabase(); const a = db.academies.find((x) => (x.slug === academy || x.id === academy) && x.isDemo === true); const who = profile.trim().toLowerCase();
    const user = a && db.users.find((u) => u.academyId === a.id && (u.username?.toLowerCase() === who || u.email.toLowerCase() === who));
    if (!user || !usable(user)) throw new Error('Este acceso no está disponible.');
    localStorage.setItem(KEY, user.id); return user;
  },
  async changePassword(current, next) {
    const id = localStorage.getItem(KEY); const u = getDatabase().users.find((x) => x.id === id);
    if (!u?.pwd || !(await verifyPassword(current, u.pwd))) throw new Error('La contraseña actual no es correcta.');
    u.pwd = await hashPassword(next); delete u.mustChangePassword; return u;
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
  async signIn(email, password, remember) { const { user } = await post<{ user: User }>('/auth/login', { email, password, ...(remember ? { remember: true } : {}) }); await clearOfflineCache(); return user; },
  async signInDemo(academy, profile) { const { user } = await post<{ user: User }>('/auth/demo', { academy, profile }); await clearOfflineCache(); return user; },
  async changePassword(current, next) { const { user } = await post<{ user: User }>('/auth/password', { current, next }); await clearOfflineCache(); return user; },
  async signOut() { try { await post('/auth/logout'); } catch (e) { if (!(e instanceof OfflineError)) throw e; } await clearOfflineCache(); },
  async restore() { try { return (await get<{ user: User | null }>('/auth/me')).user; } catch { return null; } },
};

export const authProvider: AuthProvider = IS_API ? httpAuth : mockAuth;

export interface DemoAccount { id: string; name: string; role: string; academy: string; key: string; profile: string }
/** Cuentas de acceso rápido de la pantalla de login (solo demo, sin contraseña). En api, el servidor las expone únicamente con SEED_DEMO=1. */
export async function listDemoAccounts(): Promise<DemoAccount[]> {
  if (IS_API) { try { return (await get<{ accounts: DemoAccount[] }>('/demo-accounts')).accounts; } catch { return []; } }
  const db = getDatabase();
  return db.users.filter((u) => db.academies.find((a) => a.id === u.academyId)?.isDemo === true).map((u) => { const a = db.academies.find((x) => x.id === u.academyId)!; return { id: u.id, name: u.name, role: u.role, academy: a.name, key: a.slug ?? a.id, profile: u.username ?? u.email }; });
}

/** Negocios con acceso propio (tarjetas de la pantalla de inicio de sesión). */
export async function listTenants(): Promise<PublicTenant[]> {
  if (IS_API) { try { return (await get<{ tenants: PublicTenant[] }>('/public/tenants')).tenants; } catch { return []; } }
  return publicTenants(getDatabase());
}
