import { DEFAULT_LABELS, PRESETS } from '../src/config/presets';
import { MODULES } from '../src/config/modules';
import { applyTenantAccounts, TENANTS, type TenantDef } from '../src/data/tenants';
import { buildShowcase } from '../src/data/seed';
import { fillAtlantaDemo, fillAtlantaEnrollments } from '../src/data/atlanta-demo';
import type { Database } from '../src/data/db';
import type { Academy, ModuleId } from '../src/types';
import { getDatabase } from '../src/services/database';
import { migrateDemoFlags, stripDemoPasswords } from './access';

/**
 * Prepara los NEGOCIOS DE DEMOSTRACIÓN (Atlanta, Academia y Clínica) de forma idempotente en cada arranque.
 * Solo toca academias con `isDemo: true`: nunca modifica cuentas, contraseñas ni datos de un cliente.
 *  - Atlanta: la academia del administrador indicado en PROVISION_ADMIN_EMAIL (se le pone su `slug`; si aún no tiene el campo `isDemo`, se marca).
 *    Si está vacía se llena una sola vez con datos ficticios; `ATLANTA_DEMO=0` lo desactiva.
 *  - Academia y Clínica: negocios de ejemplo con datos de muestra, si no existen.
 *  - Módulos del perfil que falten, una cuenta por perfil (usuario = perfil) y SIN contraseña: se entra por /api/auth/demo.
 * Devuelve un resumen de lo que ha cambiado.
 */
export async function provisionTenants(opts: { atlantaAdminEmail?: string; atlantaDemo?: boolean }): Promise<string[]> {
  const db = getDatabase(); const log: string[] = [];
  const atlantaAdmin = opts.atlantaAdminEmail ? db.users.find((u) => u.email.toLowerCase() === opts.atlantaAdminEmail!.toLowerCase()) : undefined;
  const atl = atlantaAdmin ? db.academies.find((a) => a.id === atlantaAdmin.academyId) : undefined;
  // Atlanta se identifica por el correo de PROVISION_ADMIN_EMAIL; si ya se decidió que es un cliente real (isDemo false) no se toca.
  if (atl && atl.isDemo !== false) { if (atl.slug !== 'atlanta') { atl.slug = 'atlanta'; log.push('Atlanta'); } if (atl.isDemo === undefined) { atl.isDemo = true; log.push('Atlanta marcada como demo'); } }
  for (const slug of ['academia', 'clinica'] as const) {
    if (db.academies.some((a) => a.slug === slug)) continue;
    buildShowcase(db, slug); const a = db.academies.find((x) => x.id === (slug === 'academia' ? 'acad_001' : 'acad_clinica')); if (a) { a.slug = slug; a.isDemo = true; log.push(`negocio de ejemplo «${slug}»`); }
  }
  log.push(...prepareDemos(db, { atlantaDemo: opts.atlantaDemo !== false }));
  return log;
}

/** Migración + preparación de las demos (sin contraseñas). Sin efectos sobre negocios que no sean `isDemo`. */
export function prepareDemos(db: Database, opts: { atlantaDemo: boolean }): string[] {
  const log: string[] = [];
  const { marked } = migrateDemoFlags(db); if (marked.length) log.push(`isDemo en: ${marked.join(', ')}`);
  const atl = db.academies.find((a) => a.slug === 'atlanta' && a.isDemo === true);
  if (atl && opts.atlantaDemo && fillAtlantaDemo(db, atl.id)) log.push('datos ficticios de Atlanta (alumnos, prácticas, exámenes, cobros)');
  if (atl && opts.atlantaDemo && fillAtlantaEnrollments(db, atl.id)) log.push('solicitudes de matrícula de ejemplo (Atlanta)');
  for (const def of TENANTS) {
    const a = db.academies.find((x) => x.slug === def.slug && x.isDemo === true); const st = a && db.settings.find((s) => s.academyId === a.id); if (!st) continue;
    for (const m of PRESETS[def.type].modules) if (st.modules[m] === undefined) { st.modules[m] = true; log.push(`módulo ${m} (${def.slug})`); }
    // «Prácticas» es el módulo del coche; el de sesiones teóricas/cursos se llama «Clases»: se corrige el vocabulario heredado de la plantilla antigua.
    if ((a!.type === 'autoescuela' || a!.type === 'nautica') && st.labels.class?.plural === 'Prácticas') { st.labels.class = { ...DEFAULT_LABELS.class }; log.push(`vocabulario «Clases» (${a!.name})`); }
  }
  const changed = applyTenantAccounts(db); if (changed.length) log.push(`${changed.length} cuentas de demo`);
  const stripped = stripDemoPasswords(db); if (stripped) log.push(`contraseñas retiradas de ${stripped} cuentas de demo`);
  return log;
}

const freshSettings = (def: TenantDef, a: Academy) => {
  const preset = PRESETS[def.type]; const modules: Partial<Record<ModuleId, boolean>> = {};
  for (const m of preset.modules) modules[m] = true; for (const m of MODULES) if (m.core) modules[m.id] = true;
  return { academyId: a.id, branding: { name: def.name, tagline: def.tagline, logoUrl: def.logo, primary: def.primary, secondary: def.secondary, theme: def.theme }, labels: { ...DEFAULT_LABELS, ...preset.labels }, modules, locale: 'es-ES', currency: 'EUR', attendanceAlertThreshold: 75 };
};
const wipeAcademy = (db: Database, id: string) => { for (const [k, rows] of Object.entries(db as unknown as Record<string, { academyId?: string; id?: string }[]>)) { if (k === 'academies') continue; for (let i = rows.length - 1; i >= 0; i--) if (rows[i].academyId === id) rows.splice(i, 1); } };

/**
 * Restaura los datos de las demos a su estado de fábrica (cada día y con `npm run demo:reset`). SOLO negocios con `isDemo: true` y slug conocido;
 * conserva su plan y estado. Devuelve los negocios restaurados.
 */
export function restoreDemos(db: Database, opts: { atlantaDemo?: boolean } = {}): string[] {
  const done: string[] = [];
  for (const def of TENANTS) {
    const a = db.academies.find((x) => x.slug === def.slug && x.isDemo === true); if (!a) continue;
    const keep = { plan: a.plan, status: a.status, slug: a.slug, createdAt: a.createdAt };
    if (def.slug === 'atlanta') {
      wipeAcademy(db, a.id); delete a.demoSeeded; delete a.waUsage; db.settings.push(freshSettings(def, a));
    } else {
      const id = def.slug === 'academia' ? 'acad_001' : 'acad_clinica'; if (a.id !== id) continue;
      wipeAcademy(db, a.id); db.academies.splice(db.academies.indexOf(a), 1); buildShowcase(db, def.slug);
      const n = db.academies.find((x) => x.id === id); if (!n) continue; Object.assign(n, keep); n.isDemo = true;
    }
    done.push(def.slug);
  }
  prepareDemos(db, { atlantaDemo: opts.atlantaDemo !== false });
  return done;
}
