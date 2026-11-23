import { PLANS, type PlanId } from '@/config/plans';
import type { Database } from '@/data/db';
import type { ModuleId } from '@/types';
import { GATED } from '@/config/plans';
import { MODULE_BY_ID } from '@/config/modules';

/** Alumnos que cuentan para el tope del plan: los activos (no de baja ni inactivos). */
export const countActiveStudents = (db: Database, academyId: string) => db.students.filter((s) => s.academyId === academyId && s.status !== 'baja' && s.status !== 'inactivo').length;
/** Usuarios del equipo (administración, secretaría, profesorado) activos. Las cuentas de alumnos y tutores no cuentan. */
export const countTeamUsers = (db: Database, academyId: string) => db.users.filter((u) => u.academyId === academyId && !u.disabled && u.role !== 'ALUMNO' && u.role !== 'TUTOR' && u.role !== 'SUPER_ADMIN').length;

const planOf = (db: Database, academyId: string): PlanId => db.academies.find((a) => a.id === academyId)?.plan ?? 'trial';
const NEXT: Record<PlanId, string> = { trial: '', basic: 'Profesional', pro: 'Premium', premium: '' };

/** Lanza un error claro si añadir `adding` alumnos activos o usuarios supera el tope del plan. Nunca borra ni modifica datos. */
export function assertCapacity(db: Database, academyId: string, kind: 'students' | 'users', adding = 1, fail: (m: string) => Error) {
  const plan = planOf(db, academyId); const limit = PLANS[plan].limits[kind === 'students' ? 'students' : 'users']; if (limit === null) return;
  const now = kind === 'students' ? countActiveStudents(db, academyId) : countTeamUsers(db, academyId);
  if (now + adding <= limit) return;
  const what = kind === 'students' ? 'alumnos activos' : 'usuarios del equipo'; const up = NEXT[plan];
  throw fail(`Has llegado al tope de tu plan ${PLANS[plan].label}: ${limit} ${what} (ahora tienes ${now}${adding > 1 ? ` y intentas añadir ${adding}` : ''}). No se ha perdido ningún dato.${kind === 'students' ? ' Puedes dar de baja a quien ya no cursa' : ''}${kind === 'students' && up ? ' o' : ''}${up ? ` pasar al plan ${up} para tener más${kind === 'students' ? '' : ' capacidad'}` : ''}.`);
}

/** Módulos de pago que el plan NO incluye (para impedir activarlos desde los ajustes). */
export const modulesOutOfPlan = (db: Database, academyId: string, wanted: Partial<Record<ModuleId, boolean>>): ModuleId[] => {
  const allowed = PLANS[planOf(db, academyId)].allowed; return GATED.filter((m) => wanted[m] && !allowed.includes(m));
};
export const moduleTitle = (m: ModuleId) => MODULE_BY_ID[m]?.title ?? m;
