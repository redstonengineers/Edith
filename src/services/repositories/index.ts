import type { Database } from '@/data/db';
import type { User } from '@/types';
import { can } from '@/lib/permissions';

/**
 * Contrato de acceso a datos. `createRepos(db, user)` devuelve una vista **ya acotada al tenant** del usuario
 * (academyId) y a su alcance por rol. No hay ninguna función que devuelva datos de otra academia.
 * La implementación HTTP futura expondrá exactamente esta misma forma.
 */
export type Snapshot = ReturnType<typeof scopeSnapshot>;

function scopeSnapshot(db: Database, user: User) {
  const A = user.academyId;
  const byTenant = <T extends { academyId: string }>(rows: T[]) => rows.filter((r) => r.academyId === A);

  let groups = byTenant(db.groups);
  let classes = byTenant(db.classes);
  let exams = byTenant(db.exams);
  let students = byTenant(db.students);

  // Alcance por rol: un profesor solo ve sus grupos y los alumnos de esos grupos.
  if (user.role === 'PROFESOR' && user.teacherId) {
    groups = groups.filter((g) => g.teacherId === user.teacherId);
    const gids = new Set(groups.map((g) => g.id));
    classes = classes.filter((c) => gids.has(c.groupId));
    exams = exams.filter((e) => gids.has(e.groupId));
    students = students.filter((s) => s.groupIds.some((g) => gids.has(g)));
  }
  // Portal: alumno y tutor solo ven su propia información.
  const portal = user.role === 'ALUMNO' || user.role === 'TUTOR';
  if (portal) {
    const mine = new Set(user.role === 'ALUMNO' ? (user.studentId ? [user.studentId] : []) : user.guardianOf ?? []);
    students = students.filter((s) => mine.has(s.id));
    const gids = new Set(students.flatMap((s) => s.groupIds));
    groups = groups.filter((g) => gids.has(g.id)); classes = classes.filter((c) => gids.has(c.groupId)); exams = exams.filter((e) => gids.has(e.groupId));
  }
  const studentIds = new Set(students.map((s) => s.id));

  return {
    academy: { ...db.academies.find((a) => a.id === A)! },
    // Copia por valor: la UI debe ver una referencia nueva tras cada cambio de configuración.
    settings: structuredClone(db.settings.find((s) => s.academyId === A)!),
    users: byTenant(db.users).map(({ pwd: _pwd, ...u }) => u),
    students,
    guardians: byTenant(db.guardians).filter((g) => students.some((s) => s.guardianId === g.id)),
    teachers: portal ? byTenant(db.teachers).filter((t) => groups.some((g) => g.teacherId === t.id)) : byTenant(db.teachers),
    subjects: byTenant(db.subjects),
    classrooms: byTenant(db.classrooms),
    groups,
    classes,
    enrollments: byTenant(db.enrollments).filter((e) => (e.studentId ? studentIds.has(e.studentId) : can(user, 'applications:read'))),
    waitlist: can(user, 'waitlist:read') ? byTenant(db.waitlist) : [],
    attendance: byTenant(db.attendance).filter((a) => studentIds.has(a.studentId)),
    exams,
    grades: byTenant(db.grades).filter((g) => studentIds.has(g.studentId)),
    payments: can(user, 'payments:read') ? byTenant(db.payments).filter((p) => studentIds.has(p.studentId)) : [],
    incidents: can(user, 'incidents:read') ? byTenant(db.incidents).filter((i) => user.role !== 'PROFESOR' || i.assigneeId === user.id || i.createdBy === user.id || (!!user.teacherId && i.relatedTeacherId === user.teacherId) || (!!i.relatedStudentId && studentIds.has(i.relatedStudentId))) : [],
    documents: can(user, 'documents:read') ? byTenant(db.documents).filter((d) => !portal || (d.ownerType === 'student' && studentIds.has(d.ownerId))) : [],
    notifications: byTenant(db.notifications),
    messages: byTenant(db.messages).filter((m) => m.kind === 'announcement' || m.fromUserId === user.id || m.toUserIds.includes(user.id)),
    activity: byTenant(db.activity),
  };
}

export interface Repos { snapshot(): Promise<Snapshot> }

export function createRepos(db: Database, user: User): Repos {
  return { snapshot: async () => scopeSnapshot(db, user) };
}
