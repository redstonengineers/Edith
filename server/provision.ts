import { DEFAULT_LABELS, PRESETS } from '../src/config/presets';
import { applyTenantAccounts, TENANTS } from '../src/data/tenants';
import { buildShowcase } from '../src/data/seed';
import { fillAtlantaDemo, fillAtlantaEnrollments } from '../src/data/atlanta-demo';
import { hashPassword, verifyPassword } from '../src/services/crypto';
import { getDatabase } from '../src/services/database';

/**
 * Deja listos los negocios con acceso propio (Atlanta, Academia y Clínica), de forma idempotente y en cada arranque:
 *  - Atlanta: la academia real del administrador indicado (se marca con su `slug`). Si está vacía se llena una sola vez con datos ficticios
 *    de demostración (alumnos, prácticas, exámenes, cobros…); `ATLANTA_DEMO=0` lo desactiva.
 *  - Academia y Clínica: negocios de ejemplo con datos de muestra, si no existen.
 *  - Módulos del perfil de cada negocio que falten, una cuenta por perfil (usuario = perfil) y la misma contraseña en todas.
 * Devuelve un resumen de lo que ha cambiado.
 */
export async function provisionTenants(opts: { password: string; atlantaAdminEmail?: string; atlantaDemo?: boolean }): Promise<string[]> {
  const db = getDatabase(); const log: string[] = [];
  const atlantaAdmin = opts.atlantaAdminEmail ? db.users.find((u) => u.email.toLowerCase() === opts.atlantaAdminEmail!.toLowerCase()) : undefined;
  const atl = atlantaAdmin ? db.academies.find((a) => a.id === atlantaAdmin.academyId) : undefined;
  if (atl && atl.slug !== 'atlanta') { atl.slug = 'atlanta'; log.push('Atlanta'); }
  if (atl && opts.atlantaDemo !== false && fillAtlantaDemo(db, atl.id)) log.push('datos ficticios de Atlanta (alumnos, prácticas, exámenes, cobros)');
  if (atl && opts.atlantaDemo !== false && fillAtlantaEnrollments(db, atl.id)) log.push('solicitudes de matrícula de ejemplo (Atlanta)');
  for (const slug of ['academia', 'clinica'] as const) {
    if (db.academies.some((a) => a.slug === slug)) continue;
    buildShowcase(db, slug); const a = db.academies.find((x) => x.id === (slug === 'academia' ? 'acad_001' : 'acad_clinica')); if (a) { a.slug = slug; log.push(`negocio de ejemplo «${slug}»`); }
  }
  for (const def of TENANTS) {
    const a = db.academies.find((x) => x.slug === def.slug); const st = a && db.settings.find((s) => s.academyId === a.id); if (!st) continue;
    for (const m of PRESETS[def.type].modules) if (st.modules[m] === undefined) { st.modules[m] = true; log.push(`módulo ${m} (${def.slug})`); }
  }
  // «Prácticas» es el módulo del coche; el de sesiones teóricas/cursos se llama «Clases»: se corrige el vocabulario heredado de la plantilla antigua.
  for (const a of db.academies) { const st = db.settings.find((x) => x.academyId === a.id); if (st && (a.type === 'autoescuela' || a.type === 'nautica') && st.labels.class?.plural === 'Prácticas') { st.labels.class = { ...DEFAULT_LABELS.class }; log.push(`vocabulario «Clases» (${a.name})`); } }
  const pwd = await hashPassword(opts.password);
  const changed = applyTenantAccounts(db, pwd); if (changed.length) log.push(`${changed.length} cuentas`);
  // La contraseña de las cuentas de los negocios es siempre la configurada: si no coincide, se restablece.
  for (const u of db.users) {
    const a = db.academies.find((x) => x.id === u.academyId); if (!a?.slug || !u.username) continue;
    if (!u.pwd || !(await verifyPassword(opts.password, u.pwd))) { u.pwd = { ...pwd }; log.push(`contraseña de ${a.slug}/${u.username}`); }
  }
  return log;
}
