import { randomInt } from 'node:crypto';
import type { Database } from '../src/data/db';

/**
 * Modelo de acceso (dos vías independientes):
 *  1. Demos abiertas (`Academy.isDemo === true`): datos ficticios, se entra con `POST /api/auth/demo`, sin contraseña.
 *     Sus cuentas no tienen contraseña utilizable y NO pueden entrar por `/api/auth/login`.
 *  2. Clientes (`isDemo` ausente o false): usuario y contraseña por `/api/auth/login`. Se crean solo desde la sesión personal del propietario
 *     o con el script `npm run client:new`; la contraseña inicial se genera al azar y debe cambiarse en el primer acceso.
 * `isDemo` es un campo explícito: nada se deduce del slug, del nombre ni del correo (salvo la migración única de `migrateDemoFlags`).
 */
export const isDemoAcademy = (db: Database, academyId: string) => db.academies.find((a) => a.id === academyId)?.isDemo === true;

/** Contraseña inicial de un cliente: 16 caracteres al azar (≈ 93 bits) sin caracteres ambiguos, en grupos de 4 para dictarla o copiarla. */
export function generatePassword(): string {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'; const pick = () => A[randomInt(A.length)];
  const groups = Array.from({ length: 4 }, () => Array.from({ length: 4 }, pick).join(''));
  const pw = groups.join('-'); return /[A-Za-z]/.test(pw) && /\d/.test(pw) ? pw : generatePassword();
}

/** Mutaciones que una sesión demo nunca puede ejecutar: planes, suspensiones y todo lo de plataforma. */
export const DEMO_BLOCKED_RPC = new Set(['platformOverview', 'setAcademyPlan', 'setAcademyStatus']);

/** Negocios de demostración conocidos: solo estos tres se marcan en la migración. */
export const DEMO_SLUGS = ['atlanta', 'academia', 'clinica'] as const;

/**
 * Migración idempotente al arrancar: marca `isDemo: true` en Atlanta, Academia y Clínica (por su slug) cuando aún no tienen el campo,
 * y en nada más. Respeta un `isDemo` ya decidido (si Atlanta pasa a cliente real y se pone false, no se vuelve a marcar).
 * Devuelve lo marcado y los negocios que quedan sin marcar (se tratan como clientes).
 */
export function migrateDemoFlags(db: Database): { marked: string[]; unmarked: string[] } {
  const marked: string[] = []; const unmarked: string[] = [];
  for (const a of db.academies) {
    if (a.isDemo !== undefined) continue;
    if (a.slug && (DEMO_SLUGS as readonly string[]).includes(a.slug)) { a.isDemo = true; marked.push(`${a.name} (${a.slug})`); }
    else unmarked.push(`${a.name} (${a.id})`);
  }
  return { marked, unmarked };
}

/** Las cuentas de los negocios demo no tienen contraseña utilizable: se retira cualquiera que exista. */
export function stripDemoPasswords(db: Database): number {
  let n = 0;
  for (const u of db.users) if (isDemoAcademy(db, u.academyId) && (u.pwd || u.mustChangePassword)) { delete u.pwd; delete u.mustChangePassword; n++; }
  return n;
}
