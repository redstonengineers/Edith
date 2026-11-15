import { getDatabase } from '../src/services/database';
import { hashPassword, verifyPassword } from '../src/services/crypto';
import { createStudent, createTeacher } from '../src/services/mutations.local';
import type { RoleId, User } from '../src/types';

/** Cuentas por defecto de una academia dada de alta: el usuario es el nombre del perfil (director, secretaria, profesor, alumno, padre). */
export const DEFAULT_ACCOUNTS: [string, RoleId, string][] = [['director', 'ADMIN', 'Director'], ['secretaria', 'SECRETARIA', 'Secretaría'], ['profesor', 'PROFESOR', 'Profesor'], ['alumno', 'ALUMNO', 'Alumno'], ['padre', 'TUTOR', 'Padre']];

/** Garantiza (idempotente) una cuenta por perfil en la academia, todas con la misma contraseña. Devuelve los usuarios creados/actualizados. */
export async function ensureAccounts(academyId: string, password: string, accounts = DEFAULT_ACCOUNTS): Promise<string[]> {
  const db = getDatabase(); const done: string[] = []; const mine = () => db.users.filter((u) => u.academyId === academyId);
  const admin = mine().find((u) => u.role === 'ADMIN'); if (!admin) return done;
  const slug = academyId.replace(/^acad_/, '');
  const upsert = async (username: string, role: RoleId, name: string, extra: Partial<User> = {}) => {
    let u = mine().find((x) => x.username === username) ?? (role === 'ADMIN' ? admin : undefined);
    if (!u) { u = { academyId, id: `${academyId}_usr_${username}`, name, email: `${username}@${slug}.local`, role, avatarHue: Math.floor(Math.random() * 360), ...extra }; db.users.push(u); done.push(username); }
    if (u.username !== username) { u.username = username; done.push(username); }
    Object.assign(u, extra);
    if (!u.pwd || !(await verifyPassword(password, u.pwd))) { u.pwd = await hashPassword(password); if (!done.includes(username)) done.push(username); }
  };
  // Fichas vinculadas: un profesor, un alumno menor con su padre.
  let teacher = db.teachers.find((t) => t.academyId === academyId && t.email === `profesor@${slug}.local`);
  if (!teacher) teacher = createTeacher(admin, { firstName: 'Profesor', lastName: 'Atlanta', email: `profesor@${slug}.local`, phone: '600000001', specialty: 'Permiso B', subjectIds: [], weeklyHoursTarget: 30, availability: [1, 2, 3, 4, 5] });
  let student = db.students.find((s) => s.academyId === academyId && s.email === `alumno@${slug}.local`);
  if (!student) { student = createStudent(admin, { firstName: 'Alumno', lastName: 'Atlanta', birthDate: '2010-01-01', email: `alumno@${slug}.local`, phone: '600000002', notes: '', guardian: { name: 'Padre Atlanta', phone: '600000003', email: `padre@${slug}.local`, relation: 'Padre' } }); student.assignedTeacherId = teacher.id; }
  for (const [username, role, name] of accounts) {
    await upsert(username, role, name, role === 'PROFESOR' ? { teacherId: teacher.id } : role === 'ALUMNO' ? { studentId: student.id } : role === 'TUTOR' ? { guardianOf: [student.id] } : {});
  }
  return [...new Set(done)];
}
