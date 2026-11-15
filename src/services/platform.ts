import type { Database } from '@/data/db';
import type { Academy, ID, ModuleId } from '@/types';
import { modulesToDisable } from '@/config/plans';
import { DomainError } from './mutations.local';

/** Cifras de uso de cada negocio (nunca datos personales). Sin comprobación de permisos: la llaman la plataforma y el modo personal del propietario. */
export function platformRows(db: Database) {
  return db.academies.map((a) => {
    const st = db.settings.find((s) => s.academyId === a.id);
    const mine = <T extends { academyId: string }>(rows: T[]) => rows.filter((r) => r.academyId === a.id);
    const last = mine(db.activity)[0]?.at;
    const ym = (d: Date) => d.toISOString().slice(0, 7); const now = new Date(); const prev = new Date(now.getFullYear(), now.getMonth() - 1, 15);
    const waMonth = a.waUsage?.[ym(now)] ?? 0; const waPrev = a.waUsage?.[ym(prev)] ?? 0;
    return { waMonth, waPrev, academy: a, users: mine(db.users).length, students: mine(db.students).filter((s) => s.status !== 'baja').length, teachers: mine(db.teachers).length, groups: mine(db.groups).length, modules: Object.values(st?.modules ?? {}).filter(Boolean).length, storageKb: mine(db.documents).reduce((x, d) => x + d.sizeKb, 0), lastActivity: last };
  });
}
/** Cambia el plan de un negocio. Con `applyModules`, desactiva los módulos que el nuevo plan no incluye (nunca activa ninguno: eso lo decide el cliente). */
export function changeAcademyPlan(db: Database, id: ID, plan: Academy['plan'], applyModules: boolean): { academy: Academy; disabled: ModuleId[] } {
  const a = db.academies.find((x) => x.id === id); if (!a) throw new DomainError('Academia no encontrada.');
  a.plan = plan; const st = db.settings.find((x) => x.academyId === id); const off = applyModules && st ? modulesToDisable(plan, st.modules) : [];
  if (st) for (const m of off) st.modules[m] = false;
  return { academy: a, disabled: off };
}
