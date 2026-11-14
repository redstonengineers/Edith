import type { RoleId, User } from '@/types';

export type Resource =
  | 'dashboard' | 'students' | 'teachers' | 'groups' | 'classes' | 'subjects' | 'schedule' | 'exams'
  | 'grades' | 'attendance' | 'applications' | 'waitlist' | 'enrollments' | 'payments' | 'billing'
  | 'documents' | 'incidents' | 'messages' | 'announcements' | 'notifications' | 'statistics'
  | 'reports' | 'ai' | 'settings' | 'users' | 'permissions' | 'customization' | 'platform';
export type Action = 'read' | 'write';
export type Permission = `${Resource}:${Action}`;

const ALL: Resource[] = [
  'dashboard', 'students', 'teachers', 'groups', 'classes', 'subjects', 'schedule', 'exams', 'grades',
  'attendance', 'applications', 'waitlist', 'enrollments', 'payments', 'billing', 'documents',
  'incidents', 'messages', 'announcements', 'notifications', 'statistics', 'reports', 'ai', 'settings',
  'users', 'permissions', 'customization',
];

const rw = (...r: Resource[]): Permission[] => r.flatMap((x) => [`${x}:read`, `${x}:write`] as Permission[]);
const ro = (...r: Resource[]): Permission[] => r.map((x) => `${x}:read` as Permission);

/** Matriz rol → permisos. Misma lógica que deberá replicarse en el servidor. */
export const ROLE_PERMISSIONS: Record<RoleId, ReadonlySet<Permission>> = {
  SUPER_ADMIN: new Set([...rw(...ALL), ...rw('platform')]),
  ADMIN: new Set(rw(...ALL)),
  SECRETARIA: new Set([
    ...rw('dashboard', 'students', 'groups', 'classes', 'schedule', 'applications', 'waitlist', 'enrollments',
      'payments', 'billing', 'documents', 'incidents', 'messages', 'announcements', 'notifications', 'attendance', 'ai'),
    ...ro('teachers', 'subjects', 'exams', 'grades', 'statistics'),
  ]),
  PROFESOR: new Set([
    ...rw('attendance', 'grades', 'exams', 'incidents', 'messages'),
    ...ro('dashboard', 'students', 'groups', 'classes', 'schedule', 'subjects', 'documents', 'announcements', 'notifications', 'ai'),
  ]),
  ALUMNO: new Set(ro('dashboard', 'schedule', 'exams', 'grades', 'attendance', 'payments', 'announcements', 'messages', 'notifications', 'documents')),
  TUTOR: new Set(ro('dashboard', 'schedule', 'exams', 'grades', 'attendance', 'payments', 'announcements', 'messages', 'notifications', 'documents')),
};

/** Ajustes por academia sobre la matriz base. Los registra la capa de servicios al cargar/guardar la configuración. */
const overrides = new Map<string, Partial<Record<RoleId, Record<string, boolean>>>>();
export function registerPermissionOverrides(academyId: string, o: Partial<Record<RoleId, Record<string, boolean>>> | undefined) { if (o) overrides.set(academyId, o); else overrides.delete(academyId); }
/** Roles cuya matriz es inalterable: ADMIN y SUPER_ADMIN conservan siempre todo (evita bloquear la cuenta). */
export const LOCKED_ROLES: RoleId[] = ['SUPER_ADMIN', 'ADMIN'];
export const EDITABLE_RESOURCES: Resource[] = ALL;

export function can(user: Pick<User, 'role'> & { academyId?: string } | null | undefined, permission: Permission): boolean {
  if (!user) return false;
  const base = ROLE_PERMISSIONS[user.role].has(permission);
  if (LOCKED_ROLES.includes(user.role) || !user.academyId) return base;
  const o = overrides.get(user.academyId)?.[user.role]?.[permission];
  if (o === undefined || permission.startsWith('platform')) return base;
  return o;
}

export const ROLE_LABELS: Record<RoleId, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Administrador',
  SECRETARIA: 'Secretaría',
  PROFESOR: 'Profesor',
  ALUMNO: 'Alumno',
  TUTOR: 'Padre/Tutor',
};
