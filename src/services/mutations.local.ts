import type { Group, ID, NoticeSettings, Practice, Student, StudentStatus, Subject, Teacher, Vehicle } from '@/types';
import type { User } from '@/types';
import { can, type Permission } from '@/lib/permissions';
import { groupConflicts } from '@/lib/conflicts';
import type { GroupInput, PracticeInput, StudentInput, SubjectInput, TeacherInput, VehicleInput } from '@/lib/schemas';
import { practiceConflicts, type PracticeConflict } from '@/lib/practices';
import { addDays, format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { logActivity } from './activity';
import { getDatabase, persist } from './database';

export class DomainError extends Error {}

let n = 0;
const newId = (user: User, p: string) => `${user.academyId}_${p}_${Date.now().toString(36)}${(n++).toString(36)}`;
const need = (user: User, p: Permission) => { if (!can(user, p)) throw new DomainError('No tienes permisos para realizar esta acción.'); };
/** Aísla por tenant: una entidad de otra academia se trata como inexistente. */
function own<T extends { academyId: string }>(user: User, row: T | undefined, what: string): T {
  if (!row || row.academyId !== user.academyId) throw new DomainError(`${what} no encontrado.`);
  return row;
}
const done = <T,>(v: T) => { persist(); return v; };

// ───────── Alumnos ─────────
export function createStudent(user: User, input: StudentInput): Student {
  need(user, 'students:write');
  const db = getDatabase();
  let guardianId: ID | undefined;
  if (input.guardian) { guardianId = newId(user, 'gua'); db.guardians.push({ academyId: user.academyId, id: guardianId, ...input.guardian }); }
  if (input.groupId) assertSeat(user, input.groupId);
  const s: Student = {
    academyId: user.academyId, id: newId(user, 'stu'), firstName: input.firstName, lastName: input.lastName, birthDate: input.birthDate, email: input.email, phone: input.phone,
    guardianId, groupIds: input.groupId ? [input.groupId] : [], status: 'nuevo', enrolledAt: new Date().toISOString().slice(0, 10), lastActivityAt: new Date().toISOString(),
    notes: input.notes, avatarHue: Math.floor(Math.random() * 360),
  };
  db.students.push(s);
  db.enrollments.push({ academyId: user.academyId, id: newId(user, 'enr'), studentId: s.id, groupId: input.groupId, status: input.groupId ? 'activa' : 'matriculada', createdAt: s.enrolledAt, updatedAt: s.enrolledAt });
  logActivity(user, 'creó', 'student', `${user.name} creó al alumno ${s.firstName} ${s.lastName}`, s.id);
  return done(s);
}

export function updateStudent(user: User, id: ID, patch: Partial<Pick<Student, 'firstName' | 'lastName' | 'birthDate' | 'email' | 'phone' | 'notes'>>) {
  need(user, 'students:write');
  const s = own(user, getDatabase().students.find((x) => x.id === id), 'Alumno');
  Object.assign(s, patch, { lastActivityAt: new Date().toISOString() });
  logActivity(user, 'modificó', 'student', `${user.name} modificó la ficha de ${s.firstName} ${s.lastName}`, s.id);
  return done(s);
}

export function setStudentStatus(user: User, id: ID, status: StudentStatus) {
  need(user, 'students:write');
  const s = own(user, getDatabase().students.find((x) => x.id === id), 'Alumno');
  s.status = status; s.lastActivityAt = new Date().toISOString();
  if (status === 'baja' || status === 'inactivo') s.groupIds = [];
  s.leftAt = status === 'baja' ? new Date().toISOString().slice(0, 10) : undefined;
  logActivity(user, 'modificó', 'student', `${user.name} cambió a ${s.firstName} ${s.lastName} a estado «${status}»`, s.id);
  return done(s);
}

function assertSeat(user: User, groupId: ID) {
  const db = getDatabase();
  const g = own(user, db.groups.find((x) => x.id === groupId), 'Grupo');
  const count = db.students.filter((s) => s.academyId === user.academyId && s.groupIds.includes(groupId) && s.status !== 'baja').length;
  if (count >= g.capacity) throw new DomainError(`El grupo «${g.name}» está completo (${g.capacity}/${g.capacity}).`);
  return g;
}

export function addStudentToGroup(user: User, studentId: ID, groupId: ID) {
  need(user, 'groups:write');
  const s = own(user, getDatabase().students.find((x) => x.id === studentId), 'Alumno');
  if (s.groupIds.includes(groupId)) return s;
  const g = assertSeat(user, groupId);
  s.groupIds.push(groupId); if (s.status === 'inactivo') s.status = 'activo';
  logActivity(user, 'modificó', 'group', `${user.name} añadió a ${s.firstName} ${s.lastName} al grupo ${g.name}`, s.id);
  return done(s);
}

export function removeStudentFromGroup(user: User, studentId: ID, groupId: ID) {
  need(user, 'groups:write');
  const db = getDatabase();
  const s = own(user, db.students.find((x) => x.id === studentId), 'Alumno');
  const g = own(user, db.groups.find((x) => x.id === groupId), 'Grupo');
  s.groupIds = s.groupIds.filter((x) => x !== groupId);
  logActivity(user, 'modificó', 'group', `${user.name} quitó a ${s.firstName} ${s.lastName} del grupo ${g.name}`, s.id);
  return done(s);
}

// ───────── Profesores ─────────
export function createTeacher(user: User, input: TeacherInput): Teacher {
  need(user, 'teachers:write');
  const t: Teacher = { academyId: user.academyId, id: newId(user, 'tea'), ...input, active: true, avatarHue: Math.floor(Math.random() * 360) };
  getDatabase().teachers.push(t);
  logActivity(user, 'creó', 'teacher', `${user.name} dio de alta a ${t.firstName} ${t.lastName}`, t.id);
  return done(t);
}
export function updateTeacher(user: User, id: ID, input: Partial<TeacherInput> & { active?: boolean }) {
  need(user, 'teachers:write');
  const t = own(user, getDatabase().teachers.find((x) => x.id === id), 'Profesor');
  Object.assign(t, input);
  logActivity(user, 'modificó', 'teacher', `${user.name} modificó a ${t.firstName} ${t.lastName}`, t.id);
  return done(t);
}

// ───────── Grupos ─────────
function checkGroup(user: User, input: GroupInput, id: ID) {
  const db = getDatabase();
  own(user, db.subjects.find((x) => x.id === input.subjectId), 'Asignatura');
  const t = own(user, db.teachers.find((x) => x.id === input.teacherId), 'Profesor');
  const r = own(user, db.classrooms.find((x) => x.id === input.classroomId), 'Aula');
  const others = db.groups.filter((g) => g.academyId === user.academyId);
  const conflicts = groupConflicts({ id, ...input }, others, { teacher: `${t.firstName} ${t.lastName}`, classroom: r.name });
  if (conflicts.length) throw new DomainError(`Conflicto de horario: ${conflicts.map((c) => c.message).join(' ')}`);
}
export function createGroup(user: User, input: GroupInput): Group {
  need(user, 'groups:write');
  const id = newId(user, 'grp');
  checkGroup(user, input, id);
  const g: Group = { academyId: user.academyId, id, ...input, active: true };
  getDatabase().groups.push(g);
  logActivity(user, 'creó', 'group', `${user.name} creó el grupo ${g.name}`, g.id);
  return done(g);
}
export function updateGroup(user: User, id: ID, input: GroupInput) {
  need(user, 'groups:write');
  const g = own(user, getDatabase().groups.find((x) => x.id === id), 'Grupo');
  checkGroup(user, input, id);
  Object.assign(g, input);
  logActivity(user, 'modificó', 'group', `${user.name} modificó el horario/ajustes de ${g.name}`, g.id);
  return done(g);
}

// ───────── Asignaturas ─────────
export function createSubject(user: User, input: SubjectInput): Subject {
  need(user, 'subjects:write');
  const s: Subject = { academyId: user.academyId, id: newId(user, 'sub'), ...input };
  getDatabase().subjects.push(s);
  logActivity(user, 'creó', 'subject', `${user.name} creó la asignatura ${s.name}`, s.id);
  return done(s);
}
export function updateSubject(user: User, id: ID, input: SubjectInput) {
  need(user, 'subjects:write');
  const s = own(user, getDatabase().subjects.find((x) => x.id === id), 'Asignatura');
  Object.assign(s, input);
  logActivity(user, 'modificó', 'subject', `${user.name} modificó la asignatura ${s.name}`, s.id);
  return done(s);
}
export function deleteSubject(user: User, id: ID) {
  need(user, 'subjects:write');
  const db = getDatabase();
  const s = own(user, db.subjects.find((x) => x.id === id), 'Asignatura');
  if (db.groups.some((g) => g.academyId === user.academyId && g.subjectId === id)) throw new DomainError('No se puede eliminar: hay grupos que usan esta asignatura.');
  db.subjects = db.subjects.filter((x) => x.id !== id);
  db.teachers.forEach((t) => { if (t.academyId === user.academyId) t.subjectIds = t.subjectIds.filter((x) => x !== id); });
  logActivity(user, 'eliminó', 'subject', `${user.name} eliminó la asignatura ${s.name}`, id);
  return done(true);
}

// ───────── Clases (sesiones) ─────────
import type { AttendanceStatus, ClassSession, Exam, ExamStatus } from '@/types';
import type { ClassInput, ExamInput } from '@/lib/schemas';
import { sessionConflicts, type Names } from '@/lib/classes';

function namesFor(user: User): Names {
  const db = getDatabase();
  const mine = <T extends { academyId: string; id: string }>(rows: T[], id: string) => rows.find((r) => r.academyId === user.academyId && r.id === id);
  return {
    teacher: (id) => { const t = mine(db.teachers, id); return t ? `${t.firstName} ${t.lastName}` : 'El profesor'; },
    classroom: (id) => mine(db.classrooms, id)?.name ?? 'El aula',
    group: (id) => mine(db.groups, id)?.name ?? 'el grupo',
  };
}
function checkSession(user: User, c: ClassInput & { id: ID }) {
  const db = getDatabase();
  own(user, db.groups.find((x) => x.id === c.groupId), 'Grupo'); own(user, db.teachers.find((x) => x.id === c.teacherId), 'Profesor'); own(user, db.classrooms.find((x) => x.id === c.classroomId), 'Aula');
  const conflicts = sessionConflicts(c, db.classes.filter((x) => x.academyId === user.academyId), namesFor(user));
  if (conflicts.length) throw new DomainError(`Conflicto: ${conflicts.map((x) => x.message).join(' ')}`);
}
export function createClass(user: User, input: ClassInput): ClassSession {
  need(user, 'classes:write');
  const id = newId(user, 'cls'); checkSession(user, { ...input, id });
  const c: ClassSession = { academyId: user.academyId, id, status: 'programada', ...input };
  getDatabase().classes.push(c);
  logActivity(user, 'creó', 'class', `${user.name} programó una clase de ${namesFor(user).group(c.groupId)} el ${c.date} a las ${c.start}`, c.id);
  return done(c);
}
export function updateClass(user: User, id: ID, input: ClassInput) {
  need(user, 'classes:write');
  const c = own(user, getDatabase().classes.find((x) => x.id === id), 'Clase');
  checkSession(user, { ...input, id });
  const moved = c.date !== input.date || c.start !== input.start || c.end !== input.end;
  Object.assign(c, input);
  if (moved && c.status === 'programada' && upcoming(c.date)) classAudience(user, c).forEach((sid) => queueNotice(user.academyId, sid, 'clase', 'clase_cambio', c.id, classVars(user, c)));
  logActivity(user, 'modificó', 'class', `${user.name} modificó el horario de ${namesFor(user).group(c.groupId)} (${c.date} ${c.start})`, c.id);
  return done(c);
}
export function cancelClass(user: User, id: ID, cancelled = true) {
  need(user, 'classes:write');
  const c = own(user, getDatabase().classes.find((x) => x.id === id), 'Clase');
  if (!cancelled) checkSession(user, { ...c, id });
  c.status = cancelled ? 'cancelada' : 'programada';
  if (cancelled && upcoming(c.date)) classAudience(user, c).forEach((sid) => queueNotice(user.academyId, sid, 'clase', 'clase_cancelada', c.id, classVars(user, c)));
  logActivity(user, cancelled ? 'canceló' : 'restauró', 'class', `${user.name} ${cancelled ? 'canceló' : 'restauró'} la clase de ${namesFor(user).group(c.groupId)} del ${c.date}`, c.id);
  return done(c);
}
export function duplicateClass(user: User, id: ID, date: string) {
  const src = own(user, getDatabase().classes.find((x) => x.id === id), 'Clase');
  return createClass(user, { groupId: src.groupId, teacherId: src.teacherId, classroomId: src.classroomId, date, start: src.start, end: src.end, topic: src.topic });
}

// ───────── Asistencia ─────────
function canTakeAttendance(user: User, c: ClassSession) {
  need(user, 'attendance:write');
  if (user.role === 'PROFESOR' && c.teacherId !== user.teacherId) throw new DomainError('Solo puedes registrar asistencia de tus propias clases.');
}
export function setAttendance(user: User, classId: ID, studentId: ID, status: AttendanceStatus | null) {
  const db = getDatabase();
  const c = own(user, db.classes.find((x) => x.id === classId), 'Clase'); canTakeAttendance(user, c);
  const s = own(user, db.students.find((x) => x.id === studentId), 'Alumno');
  const i = db.attendance.findIndex((a) => a.classId === classId && a.studentId === studentId);
  if (status === null) { if (i >= 0) db.attendance.splice(i, 1); }
  else if (i >= 0) db.attendance[i].status = status;
  else db.attendance.push({ academyId: user.academyId, id: newId(user, 'att'), classId, studentId, status });
  if (c.status === 'programada') c.status = 'impartida';
  if (status === 'ausente') logActivity(user, 'registró', 'attendance', `${user.name} registró una ausencia de ${s.firstName} ${s.lastName}`, s.id);
  return done(true);
}
export function markAllPresent(user: User, classId: ID, studentIds: ID[]) {
  const db = getDatabase();
  const c = own(user, db.classes.find((x) => x.id === classId), 'Clase'); canTakeAttendance(user, c);
  for (const sid of studentIds) {
    own(user, db.students.find((x) => x.id === sid), 'Alumno');
    const a = db.attendance.find((x) => x.classId === classId && x.studentId === sid);
    if (!a) db.attendance.push({ academyId: user.academyId, id: newId(user, 'att'), classId, studentId: sid, status: 'presente' });
  }
  if (c.status === 'programada') c.status = 'impartida';
  logActivity(user, 'registró', 'attendance', `${user.name} pasó lista en ${namesFor(user).group(c.groupId)} (${c.date})`, c.id);
  return done(true);
}

// ───────── Exámenes y calificaciones ─────────
function ensureGrades(user: User, exam: Exam) {
  const db = getDatabase();
  for (const s of db.students) {
    if (s.academyId !== user.academyId || !s.groupIds.includes(exam.groupId) || s.status === 'baja') continue;
    if (!db.grades.some((g) => g.examId === exam.id && g.studentId === s.id)) db.grades.push({ academyId: user.academyId, id: newId(user, 'grd'), examId: exam.id, studentId: s.id, score: null });
  }
}
export function createExam(user: User, input: ExamInput): Exam {
  need(user, 'exams:write');
  const db = getDatabase();
  const g = own(user, db.groups.find((x) => x.id === input.groupId), 'Grupo');
  own(user, db.teachers.find((x) => x.id === input.teacherId), 'Profesor'); own(user, db.classrooms.find((x) => x.id === input.classroomId), 'Aula');
  if (user.role === 'PROFESOR' && g.teacherId !== user.teacherId) throw new DomainError('Solo puedes crear exámenes para tus grupos.');
  const e: Exam = { academyId: user.academyId, id: newId(user, 'exm'), subjectId: g.subjectId, status: 'pendiente', ...input };
  db.exams.push(e);
  logActivity(user, 'creó', 'exam', `${user.name} creó el examen ${e.title}`, e.id);
  return done(e);
}
export function updateExam(user: User, id: ID, input: ExamInput) {
  need(user, 'exams:write');
  const e = own(user, getDatabase().exams.find((x) => x.id === id), 'Examen');
  Object.assign(e, input);
  logActivity(user, 'modificó', 'exam', `${user.name} modificó el examen ${e.title}`, e.id);
  return done(e);
}
export function setExamStatus(user: User, id: ID, status: ExamStatus) {
  need(user, 'exams:write');
  const e = own(user, getDatabase().exams.find((x) => x.id === id), 'Examen');
  e.status = status; if (status !== 'pendiente') ensureGrades(user, e);
  logActivity(user, 'modificó', 'exam', `${user.name} marcó el examen ${e.title} como ${status}`, e.id);
  return done(e);
}
export function openGrading(user: User, examId: ID) {
  need(user, 'grades:write');
  const e = own(user, getDatabase().exams.find((x) => x.id === examId), 'Examen');
  if (user.role === 'PROFESOR' && e.teacherId !== user.teacherId) throw new DomainError('Solo puedes calificar tus exámenes.');
  if (e.status === 'pendiente') e.status = 'realizado';
  ensureGrades(user, e); return done(e);
}
export function setGrade(user: User, examId: ID, studentId: ID, score: number | null) {
  need(user, 'grades:write');
  const db = getDatabase();
  const e = own(user, db.exams.find((x) => x.id === examId), 'Examen');
  if (user.role === 'PROFESOR' && e.teacherId !== user.teacherId) throw new DomainError('Solo puedes calificar tus exámenes.');
  if (score !== null && (Number.isNaN(score) || score < 0 || score > 10)) throw new DomainError('La nota debe estar entre 0 y 10.');
  const s = own(user, db.students.find((x) => x.id === studentId), 'Alumno');
  ensureGrades(user, e);
  const g = db.grades.find((x) => x.examId === examId && x.studentId === studentId)!;
  const prev = g.score; g.score = score === null ? null : Math.round(score * 10) / 10;
  const all = db.grades.filter((x) => x.examId === examId);
  e.status = all.length > 0 && all.every((x) => x.score !== null) ? 'corregido' : e.status === 'corregido' ? 'realizado' : e.status;
  if (prev !== g.score) logActivity(user, 'modificó', 'grade', `${user.name} ${prev === null ? 'calificó' : 'modificó la calificación de'} ${s.firstName} ${s.lastName} en ${e.title}`, s.id);
  return done(g);
}

// ═════════ Fase 4: admisión, pagos, incidencias, documentos, comunicación ═════════
import type { Enrollment, EnrollmentStatus, Incident, IncidentStatus, Payment, WaitlistEntry, DocumentFile, DocumentOwner, Message } from '@/types';
import type { ApplicationInput, IncidentInput, PaymentInput, WaitlistInput } from '@/lib/schemas';
import { AUTO, CHANNELS } from './channels';
import { queueNotice } from './notices';
import { EVENT_BY_KEY } from '@/lib/notices';

const today = () => new Date().toISOString().slice(0, 10);
const notify = (user: User, title: string, body: string, level: 'info' | 'warning' | 'success', href?: string) =>
  getDatabase().notifications.unshift({ academyId: user.academyId, id: newId(user, 'ntf'), title, body, level, createdAt: new Date().toISOString(), read: false, href });

const longDay = (iso: string) => format(parseISO(iso), "EEEE d 'de' MMMM", { locale: es });
const teacherName = (user: User, id: ID) => { const t = getDatabase().teachers.find((x) => x.id === id && x.academyId === user.academyId); return t ? `${t.firstName} ${t.lastName}` : 'tu profesor'; };
/** Alumnos de la clase: los de su grupo. */
const classAudience = (user: User, c: { groupId: ID }) => getDatabase().students.filter((s) => s.academyId === user.academyId && s.status !== 'baja' && s.groupIds.includes(c.groupId)).map((s) => s.id);
const classVars = (user: User, c: { groupId: ID; date: string; start: string }) => { const db = getDatabase(); const g = db.groups.find((x) => x.id === c.groupId && x.academyId === user.academyId); const sub = g && db.subjects.find((x) => x.id === g.subjectId); return { materia: sub?.name ?? g?.name ?? 'clase', fecha: longDay(c.date), hora: c.start }; };
const pvars = (user: User, p: { date: string; start: string; teacherId: ID }) => ({ fecha: longDay(p.date), hora: p.start, profesor: teacherName(user, p.teacherId) });
const upcoming = (iso: string) => iso >= new Date().toISOString().slice(0, 10);
const splitName = (full: string) => { const [first, ...rest] = full.trim().split(/\s+/); return { firstName: first, lastName: rest.join(' ') || '—' }; };

/** Crea el alumno a partir de datos de un solicitante / lista de espera. Único punto de conversión. */
function studentFromApplicant(user: User, a: { name: string; email: string; phone: string; birthDate?: string }): Student {
  const { firstName, lastName } = splitName(a.name);
  const s: Student = { academyId: user.academyId, id: newId(user, 'stu'), firstName, lastName, birthDate: a.birthDate || '2000-01-01', email: a.email, phone: a.phone, groupIds: [], status: 'nuevo', enrolledAt: today(), lastActivityAt: new Date().toISOString(), notes: '', avatarHue: Math.floor(Math.random() * 360) };
  getDatabase().students.push(s); return s;
}

// ── Matrículas / solicitudes ──
export function createApplication(user: User, input: ApplicationInput): Enrollment {
  need(user, 'applications:write');
  const e: Enrollment = { academyId: user.academyId, id: newId(user, 'enr'), status: 'solicitud', createdAt: today(), updatedAt: today(), applicant: { name: input.name, email: input.email, phone: input.phone, birthDate: input.birthDate || undefined, course: input.course, source: 'presencial' } };
  getDatabase().enrollments.push(e);
  logActivity(user, 'creó', 'enrollment', `${user.name} registró la solicitud de ${input.name}`, e.id);
  return done(e);
}

const NEXT: Partial<Record<EnrollmentStatus, EnrollmentStatus>> = { solicitud: 'revision', revision: 'aceptada', aceptada: 'matriculada', matriculada: 'activa' };
export const ENROLLMENT_NEXT = NEXT;
export function advanceEnrollment(user: User, id: ID, opts: { groupId?: ID } = {}) {
  need(user, 'enrollments:write');
  const db = getDatabase();
  const e = own(user, db.enrollments.find((x) => x.id === id), 'Matrícula');
  const to = NEXT[e.status]; if (!to) throw new DomainError('Esta matrícula ya no admite más avances.');
  if (to === 'matriculada' && !e.studentId && e.applicant) { const s = studentFromApplicant(user, e.applicant); e.studentId = s.id; e.applicant = undefined; }
  if (to === 'activa') {
    const gid = opts.groupId ?? e.groupId; if (!gid) throw new DomainError('Selecciona un grupo para activar al alumno.');
    const g = own(user, db.groups.find((x) => x.id === gid), 'Grupo');
    const s = own(user, db.students.find((x) => x.id === e.studentId), 'Alumno');
    const n = db.students.filter((x) => x.academyId === user.academyId && x.groupIds.includes(gid) && x.status !== 'baja').length;
    if (n >= g.capacity) throw new DomainError(`El grupo «${g.name}» está completo (${g.capacity}/${g.capacity}).`);
    if (!s.groupIds.includes(gid)) s.groupIds.push(gid);
    s.status = 'activo'; e.groupId = gid;
    logActivity(user, 'modificó', 'enrollment', `${user.name} asignó a ${s.firstName} ${s.lastName} al grupo ${g.name} y lo activó`, s.id);
  }
  e.status = to; e.updatedAt = today();
  const who = e.applicant?.name ?? (() => { const s = db.students.find((x) => x.id === e.studentId); return s ? `${s.firstName} ${s.lastName}` : 'solicitante'; })();
  logActivity(user, 'modificó', 'enrollment', `${user.name} avanzó la matrícula de ${who} a «${to}»`, e.id);
  return done(e);
}
export function rejectEnrollment(user: User, id: ID) {
  need(user, 'enrollments:write');
  const e = own(user, getDatabase().enrollments.find((x) => x.id === id), 'Matrícula');
  if (e.status === 'activa' || e.status === 'baja') throw new DomainError('No se puede rechazar una matrícula ya activa.');
  e.status = 'rechazada'; e.updatedAt = today();
  logActivity(user, 'modificó', 'enrollment', `${user.name} rechazó la solicitud de ${e.applicant?.name ?? 'un alumno'}`, e.id);
  return done(e);
}

// ── Lista de espera ──
export function createWaitlistEntry(user: User, input: WaitlistInput): WaitlistEntry {
  need(user, 'waitlist:write');
  const w: WaitlistEntry = { academyId: user.academyId, id: newId(user, 'wl'), ...input, birthDate: input.birthDate || undefined, requestedAt: today(), status: 'pendiente' };
  getDatabase().waitlist.push(w);
  logActivity(user, 'creó', 'waitlist', `${user.name} añadió a ${w.name} a la lista de espera`, w.id);
  return done(w);
}
export function setWaitlistStatus(user: User, id: ID, status: 'pendiente' | 'contactado' | 'aceptado' | 'rechazado') {
  need(user, 'waitlist:write');
  const w = own(user, getDatabase().waitlist.find((x) => x.id === id), 'Solicitante');
  if (w.status === 'matriculado') throw new DomainError('Esta persona ya está matriculada.');
  w.status = status;
  logActivity(user, 'modificó', 'waitlist', `${user.name} marcó a ${w.name} como «${status}»`, w.id);
  return done(w);
}
export function setWaitlistPriority(user: User, id: ID, priority: 'baja' | 'media' | 'alta') {
  need(user, 'waitlist:write');
  const w = own(user, getDatabase().waitlist.find((x) => x.id === id), 'Solicitante'); w.priority = priority; return done(w);
}
/** Convierte a una persona de la lista de espera en alumno reutilizando sus datos. */
export function convertWaitlist(user: User, id: ID, input: { birthDate: string; groupId?: ID }): Student {
  need(user, 'waitlist:write'); need(user, 'students:write');
  const db = getDatabase();
  const w = own(user, db.waitlist.find((x) => x.id === id), 'Solicitante');
  if (w.status === 'matriculado') throw new DomainError('Esta persona ya fue convertida en alumno.');
  if (input.groupId) assertSeat(user, input.groupId);
  const s = studentFromApplicant(user, { name: w.name, email: w.email, phone: w.phone, birthDate: input.birthDate });
  if (input.groupId) { s.groupIds.push(input.groupId); s.status = 'activo'; }
  db.enrollments.push({ academyId: user.academyId, id: newId(user, 'enr'), studentId: s.id, groupId: input.groupId, status: input.groupId ? 'activa' : 'matriculada', createdAt: today(), updatedAt: today() });
  w.status = 'matriculado'; w.studentId = s.id;
  logActivity(user, 'creó', 'student', `${user.name} convirtió a ${w.name} (lista de espera) en alumno`, s.id);
  return done(s);
}

// ── Pagos ──
export function createPayment(user: User, input: PaymentInput): Payment {
  need(user, 'payments:write');
  const s = own(user, getDatabase().students.find((x) => x.id === input.studentId), 'Alumno');
  const p: Payment = { academyId: user.academyId, id: newId(user, 'pay'), ...input, status: input.dueDate < today() ? 'vencido' : 'pendiente' };
  getDatabase().payments.push(p);
  logActivity(user, 'creó', 'payment', `${user.name} generó un cobro de ${p.amount} € a ${s.firstName} ${s.lastName} (${p.concept})`, p.id);
  return done(p);
}
export function markPaid(user: User, id: ID, input: { paidAt: string; method: NonNullable<Payment['method']> }) {
  need(user, 'payments:write');
  const db = getDatabase();
  const p = own(user, db.payments.find((x) => x.id === id), 'Pago');
  if (p.status === 'pagado') throw new DomainError('Este pago ya está registrado como pagado.');
  const seq = db.payments.filter((x) => x.academyId === user.academyId && x.invoiceNo).length + 1;
  p.status = 'pagado'; p.paidAt = input.paidAt; p.method = input.method; p.invoiceNo = `REC-${input.paidAt.slice(0, 4)}-${String(seq).padStart(4, '0')}`;
  const s = db.students.find((x) => x.id === p.studentId);
  logActivity(user, 'registró', 'payment', `${user.name} registró el pago de ${p.amount} € de ${s ? `${s.firstName} ${s.lastName}` : 'un alumno'} (${p.concept})`, p.id);
  return done(p);
}
export function voidPayment(user: User, id: ID) {
  need(user, 'payments:write');
  const db = getDatabase();
  const p = own(user, db.payments.find((x) => x.id === id), 'Pago');
  if (p.status === 'pagado') throw new DomainError('No se puede anular un pago ya cobrado.');
  db.payments = db.payments.filter((x) => x.id !== id);
  logActivity(user, 'eliminó', 'payment', `${user.name} anuló el cobro «${p.concept}»`, id);
  return done(true);
}
export function sendPaymentReminder(user: User, id: ID) {
  need(user, 'payments:write');
  const db = getDatabase();
  const p = own(user, db.payments.find((x) => x.id === id), 'Pago');
  const s = own(user, db.students.find((x) => x.id === p.studentId), 'Alumno');
  p.remindedAt = today();
  db.messages.unshift({ academyId: user.academyId, id: newId(user, 'msg'), fromUserId: user.id, toUserIds: [], subject: `Recordatorio de pago · ${p.concept}`, body: `Recordatorio para ${s.firstName} ${s.lastName}: ${p.amount} € con vencimiento ${p.dueDate}.`, channel: 'email', sentAt: new Date().toISOString(), kind: 'message' });
  logActivity(user, 'registró', 'payment', `${user.name} envió un recordatorio de pago a ${s.firstName} ${s.lastName}`, p.id);
  return done(p);
}

// ── Incidencias ──
export function createIncident(user: User, input: IncidentInput): Incident {
  need(user, 'incidents:write');
  const db = getDatabase();
  if (input.relatedStudentId) own(user, db.students.find((x) => x.id === input.relatedStudentId), 'Alumno');
  if (input.relatedTeacherId) own(user, db.teachers.find((x) => x.id === input.relatedTeacherId), 'Profesor');
  if (input.assigneeId) own(user, db.users.find((x) => x.id === input.assigneeId), 'Responsable');
  const i: Incident = { academyId: user.academyId, id: newId(user, 'inc'), createdBy: user.id, ...input, assigneeId: input.assigneeId || undefined, relatedStudentId: input.relatedStudentId || undefined, relatedTeacherId: input.relatedTeacherId || undefined, status: 'pendiente', createdAt: today() };
  db.incidents.unshift(i);
  if (i.priority === 'critica' || i.priority === 'alta') notify(user, 'Nueva incidencia prioritaria', i.title, 'warning', `/incidencias/${i.id}`);
  logActivity(user, 'creó', 'incident', `${user.name} abrió la incidencia «${i.title}»`, i.id);
  return done(i);
}
export function updateIncident(user: User, id: ID, patch: Partial<IncidentInput> & { status?: IncidentStatus }) {
  need(user, 'incidents:write');
  const i = own(user, getDatabase().incidents.find((x) => x.id === id), 'Incidencia');
  Object.assign(i, patch, patch.assigneeId === '' ? { assigneeId: undefined } : {});
  logActivity(user, 'modificó', 'incident', `${user.name} ${patch.status ? `cambió la incidencia «${i.title}» a «${patch.status}»` : `actualizó la incidencia «${i.title}»`}`, i.id);
  return done(i);
}

// ── Documentos (solo metadatos; el almacenamiento de ficheros es del backend) ──
export const DOC_MAX_KB = 10 * 1024;
export function addDocument(user: User, d: { name: string; mime: string; sizeKb: number; ownerType: DocumentOwner; ownerId: ID }): DocumentFile {
  need(user, 'documents:write');
  const db = getDatabase();
  const kind: DocumentFile['kind'] = d.mime === 'application/pdf' ? 'pdf' : d.mime.startsWith('image/') ? 'imagen' : /word|officedocument|opendocument|text\//.test(d.mime) ? 'documento' : (null as never);
  if (!kind) throw new DomainError('Tipo de archivo no permitido. Usa PDF, imagen o documento de texto.');
  if (d.sizeKb > DOC_MAX_KB) throw new DomainError('El archivo supera el máximo de 10 MB.');
  const table = { student: db.students, teacher: db.teachers, group: db.groups, enrollment: db.enrollments }[d.ownerType] as { id: string; academyId: string }[];
  own(user, table.find((x) => x.id === d.ownerId), 'Elemento asociado');
  const doc: DocumentFile = { academyId: user.academyId, id: newId(user, 'doc'), name: d.name.slice(0, 120), kind, ownerType: d.ownerType, ownerId: d.ownerId, sizeKb: d.sizeKb, uploadedAt: today() };
  db.documents.unshift(doc);
  logActivity(user, 'creó', 'document', `${user.name} subió el documento ${doc.name}`, doc.id);
  return done(doc);
}
export function deleteDocument(user: User, id: ID) {
  need(user, 'documents:write');
  const db = getDatabase(); const d = own(user, db.documents.find((x) => x.id === id), 'Documento');
  db.documents = db.documents.filter((x) => x.id !== id);
  logActivity(user, 'eliminó', 'document', `${user.name} eliminó el documento ${d.name}`, id);
  return done(true);
}

// ── Comunicación ──
export async function sendMessage(user: User, m: { subject: string; body: string; toUserIds: ID[]; channel?: Message['channel']; kind?: Message['kind']; audienceGroupId?: ID }) {
  need(user, m.kind === 'announcement' ? 'announcements:write' : 'messages:write');
  const db = getDatabase();
  for (const id of m.toUserIds) own(user, db.users.find((u) => u.id === id), 'Destinatario');
  if (m.audienceGroupId) own(user, db.groups.find((g) => g.id === m.audienceGroupId), 'Grupo');
  const msg: Message = { academyId: user.academyId, id: newId(user, 'msg'), fromUserId: user.id, toUserIds: m.toUserIds, subject: m.subject, body: m.body, channel: m.channel ?? 'app', sentAt: new Date().toISOString(), kind: m.kind ?? 'message', audienceGroupId: m.audienceGroupId, readBy: [] };
  db.messages.unshift(msg);
  const res = await CHANNELS[msg.channel].send(msg);
  logActivity(user, 'creó', 'message', `${user.name} ${msg.kind === 'announcement' ? 'publicó el aviso' : 'envió el mensaje'} «${msg.subject}»`, msg.id);
  persist();
  return { msg, ...res };
}
export function markNotificationsRead(user: User, id?: ID) {
  for (const n of getDatabase().notifications) if (n.academyId === user.academyId && (!id || n.id === id)) n.read = true;
  return done(true);
}
export function markMessageRead(user: User, id: ID) {
  const m = own(user, getDatabase().messages.find((x) => x.id === id), 'Mensaje');
  if (!m.readBy) m.readBy = [];
  if (!m.readBy.includes(user.id)) { m.readBy.push(user.id); persist(); }
  return true;
}

// ═════════ Fase 7-8: configuración, usuarios, permisos, plataforma ═════════
import type { AcademyType, LabelKey, EntityLabel, ModuleId, RoleId, ThemeMode } from '@/types';
import { MODULES } from '@/config/modules';
import { PRESETS, DEFAULT_LABELS } from '@/config/presets';
import { LOCKED_ROLES, registerPermissionOverrides, ROLE_PERMISSIONS } from '@/lib/permissions';
import { hashPassword } from './crypto';

const settingsOf = (user: User) => own(user, getDatabase().settings.find((s) => s.academyId === user.academyId), 'Configuración');
export const MAX_LOGO_KB = 256;

export function updateBranding(user: User, b: { name: string; tagline: string; primary: string; secondary: string; theme: ThemeMode; logoUrl?: string | null; faviconUrl?: string | null }) {
  need(user, 'customization:write');
  const st = settingsOf(user);
  for (const u of [b.logoUrl, b.faviconUrl]) if (u && !/^data:image\/(png|jpeg|webp|svg\+xml|x-icon|vnd\.microsoft\.icon);base64,/.test(u)) throw new DomainError('Formato de imagen no permitido.');
  st.branding = { ...st.branding, name: b.name, tagline: b.tagline, primary: b.primary, secondary: b.secondary, theme: b.theme, logoUrl: b.logoUrl === null ? undefined : b.logoUrl ?? st.branding.logoUrl, faviconUrl: b.faviconUrl === null ? undefined : b.faviconUrl ?? st.branding.faviconUrl };
  const a = getDatabase().academies.find((x) => x.id === user.academyId); if (a) a.name = b.name;
  logActivity(user, 'modificó', 'settings', `${user.name} actualizó la marca de la academia`);
  return done(st);
}
export function updateLabels(user: User, labels: Record<LabelKey, EntityLabel>) {
  need(user, 'customization:write'); const st = settingsOf(user); st.labels = labels;
  logActivity(user, 'modificó', 'settings', `${user.name} actualizó el vocabulario de la academia`); return done(st);
}
export function applyPreset(user: User, type: AcademyType) {
  need(user, 'customization:write'); const st = settingsOf(user); const p = PRESETS[type];
  st.labels = { ...DEFAULT_LABELS, ...p.labels };
  logActivity(user, 'modificó', 'settings', `${user.name} aplicó la plantilla de vocabulario «${p.label}»`); return done(st);
}
/** Dependencias entre módulos: desactivar uno puede dejar huérfanos a otros. */
export const MODULE_DEPS: Partial<Record<ModuleId, ModuleId[]>> = { grades: ['exams'], enrollments: ['students'], applications: ['enrollments'], billing: ['payments'], attendance: ['classes'], schedule: ['classes'], waitlist: ['students'] };
export function setModules(user: User, modules: Partial<Record<ModuleId, boolean>>) {
  need(user, 'customization:write'); const st = settingsOf(user);
  for (const m of MODULES) if (m.core) modules[m.id] = true;
  for (const [mod, deps] of Object.entries(MODULE_DEPS) as [ModuleId, ModuleId[]][]) if (modules[mod]) for (const d of deps) if (!modules[d]) throw new DomainError(`«${MODULES.find((x) => x.id === mod)?.title}» necesita «${MODULES.find((x) => x.id === d)?.title}» activo.`);
  st.modules = modules;
  logActivity(user, 'modificó', 'settings', `${user.name} cambió los módulos activos`); return done(st);
}
export function updateGeneral(user: User, g: { currency: string; attendanceAlertThreshold: number }) {
  need(user, 'settings:write'); const st = settingsOf(user); st.currency = g.currency; st.attendanceAlertThreshold = g.attendanceAlertThreshold;
  logActivity(user, 'modificó', 'settings', `${user.name} actualizó los ajustes generales`); return done(st);
}

// ── Usuarios ──
export async function createUser(user: User, input: { name: string; email: string; role: RoleId; teacherId?: ID; studentId?: ID; password: string }) {
  need(user, 'users:write'); const db = getDatabase();
  if (input.role === 'SUPER_ADMIN') throw new DomainError('No se puede crear un Super Admin desde la academia.');
  if (db.users.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) throw new DomainError('Ya existe un usuario con ese correo.');
  if (input.role === 'PROFESOR' && input.teacherId) own(user, db.teachers.find((t) => t.id === input.teacherId), 'Profesor');
  if (input.role === 'ALUMNO' && input.studentId) own(user, db.students.find((t) => t.id === input.studentId), 'Alumno');
  const u: User = { academyId: user.academyId, id: newId(user, 'usr'), name: input.name, email: input.email, role: input.role, teacherId: input.role === 'PROFESOR' ? input.teacherId || undefined : undefined, studentId: input.role === 'ALUMNO' ? input.studentId || undefined : undefined, avatarHue: Math.floor(Math.random() * 360), pwd: await hashPassword(input.password) };
  db.users.push(u);
  logActivity(user, 'creó', 'user', `${user.name} creó el usuario ${u.name} (${u.role})`, u.id);
  return done(u);
}
export function updateUser(user: User, id: ID, patch: { role?: RoleId; disabled?: boolean; teacherId?: ID }) {
  need(user, 'users:write'); const db = getDatabase(); const u = own(user, db.users.find((x) => x.id === id), 'Usuario');
  if (u.role === 'SUPER_ADMIN') throw new DomainError('No se puede modificar al Super Admin.');
  if (u.id === user.id && (patch.role || patch.disabled)) throw new DomainError('No puedes cambiar tu propio rol ni desactivarte.');
  if (patch.role === 'SUPER_ADMIN') throw new DomainError('Rol no permitido.');
  const admins = db.users.filter((x) => x.academyId === user.academyId && x.role === 'ADMIN' && !x.disabled);
  if (u.role === 'ADMIN' && admins.length <= 1 && ((patch.role && patch.role !== 'ADMIN') || patch.disabled)) throw new DomainError('Debe quedar al menos un administrador activo.');
  Object.assign(u, patch);
  logActivity(user, 'modificó', 'user', `${user.name} modificó al usuario ${u.name}${patch.role ? ` (rol ${patch.role})` : ''}${patch.disabled !== undefined ? (patch.disabled ? ' (desactivado)' : ' (activado)') : ''}`, u.id);
  return done(u);
}

// ── Permisos por rol ──
export function setRolePermission(user: User, role: RoleId, permission: Permission, value: boolean) {
  need(user, 'permissions:write'); const st = settingsOf(user);
  if (LOCKED_ROLES.includes(role)) throw new DomainError('La matriz de este rol no se puede modificar.');
  if (permission.startsWith('platform')) throw new DomainError('Permiso no asignable.');
  const o = (st.permissionOverrides ??= {}); const r = (o[role] ??= {});
  const [res, act] = permission.split(':');
  const base = (p: string) => ROLE_PERMISSIONS[role].has(p as Permission);
  const cur = (p: string) => (p in r ? r[p] : base(p));
  r[permission] = value;
  if (value && act === 'write') r[`${res}:read`] = true;           // escribir implica leer
  if (!value && act === 'read') r[`${res}:write`] = false;          // sin leer no se escribe
  for (const k of Object.keys(r)) if (r[k] === base(k) && cur(k) === base(k)) delete r[k];
  registerPermissionOverrides(user.academyId, st.permissionOverrides);
  logActivity(user, 'modificó', 'permissions', `${user.name} ${value ? 'concedió' : 'retiró'} «${permission}» al rol ${role}`);
  return done(st);
}
export function resetRolePermissions(user: User, role: RoleId) {
  need(user, 'permissions:write'); const st = settingsOf(user);
  if (st.permissionOverrides) delete st.permissionOverrides[role];
  registerPermissionOverrides(user.academyId, st.permissionOverrides);
  logActivity(user, 'modificó', 'permissions', `${user.name} restableció los permisos del rol ${role}`); return done(st);
}

// ── Plataforma (Super Admin) ──
const needPlatform = (user: User) => { if (user.role !== 'SUPER_ADMIN' || !can(user, 'platform:write')) throw new DomainError('Acción reservada al propietario de la plataforma.'); };
export function platformOverview(user: User) {
  needPlatform(user); const db = getDatabase();
  return db.academies.map((a) => {
    const st = db.settings.find((s) => s.academyId === a.id);
    const mine = <T extends { academyId: string }>(rows: T[]) => rows.filter((r) => r.academyId === a.id);
    const last = mine(db.activity)[0]?.at;
    return { academy: a, users: mine(db.users).length, students: mine(db.students).filter((s) => s.status !== 'baja').length, teachers: mine(db.teachers).length, groups: mine(db.groups).length, modules: Object.values(st?.modules ?? {}).filter(Boolean).length, storageKb: mine(db.documents).reduce((x, d) => x + d.sizeKb, 0), lastActivity: last };
  });
}
export function setAcademyStatus(user: User, id: ID, status: 'active' | 'suspended') {
  needPlatform(user); const a = getDatabase().academies.find((x) => x.id === id); if (!a) throw new DomainError('Academia no encontrada.');
  if (id === user.academyId && status === 'suspended') throw new DomainError('No puedes suspender tu propia academia.');
  a.status = status; logActivity(user, 'modificó', 'academy', `${user.name} ${status === 'active' ? 'reactivó' : 'suspendió'} la academia ${a.name}`, id); return done(a);
}
export function setAcademyPlan(user: User, id: ID, plan: 'trial' | 'basic' | 'pro') {
  needPlatform(user); const a = getDatabase().academies.find((x) => x.id === id); if (!a) throw new DomainError('Academia no encontrada.');
  a.plan = plan; logActivity(user, 'modificó', 'academy', `${user.name} cambió el plan de ${a.name} a ${plan}`, id); return done(a);
}

/** Alta de una academia nueva (onboarding autoservicio). Crea tenant, ajustes y primer administrador. */
export async function createAcademy(input: { academyName: string; type: AcademyType; logoUrl?: string; modules: ModuleId[]; adminName: string; adminEmail: string; adminPassword: string; primary?: string }) {
  const db = getDatabase();
  if (db.users.some((u) => u.email.toLowerCase() === input.adminEmail.toLowerCase())) throw new DomainError('Ya existe una cuenta con ese correo.');
  const id = `acad_${Date.now().toString(36)}`; const preset = PRESETS[input.type]; const modules: Partial<Record<ModuleId, boolean>> = {};
  for (const m of input.modules) modules[m] = true;
  for (const m of MODULES) if (m.core) modules[m.id] = true;
  db.academies.push({ id, name: input.academyName, type: input.type, plan: 'trial', status: 'active', createdAt: new Date().toISOString().slice(0, 10) });
  db.settings.push({ academyId: id, branding: { name: input.academyName, tagline: '', logoUrl: input.logoUrl, primary: input.primary ?? '#8b7bff', secondary: '#f472b6', theme: 'dark' }, labels: { ...DEFAULT_LABELS, ...preset.labels }, modules, locale: 'es-ES', currency: 'EUR', attendanceAlertThreshold: 75 });
  const admin: User = { academyId: id, id: `${id}_usr_001`, name: input.adminName, email: input.adminEmail, role: 'ADMIN', avatarHue: Math.floor(Math.random() * 360), pwd: await hashPassword(input.adminPassword) };
  db.users.push(admin);
  db.activity.unshift({ academyId: id, id: `${id}_log_1`, at: new Date().toISOString(), actorId: admin.id, actorName: admin.name, action: 'creó', entityType: 'academy', summary: `${admin.name} creó la academia ${input.academyName}` });
  persist();
  return admin;
}

/** Registro de exportación de informes (auditoría). */
export function recordExport(user: User, title: string) {
  logActivity(user, 'exportó', 'report', `${user.name} exportó el informe «${title}»`);
  return done(true);
}

// ───────── Autoescuela: coches y prácticas 1 a 1 ─────────
const VEHICLE_COLORS = ['#22c8ff', '#a78bfa', '#34d399', '#fbbf24', '#f472b6', '#fb923c'];
export function createVehicle(user: User, input: VehicleInput): Vehicle {
  need(user, 'vehiculos:write'); const db = getDatabase();
  if (db.vehicles.some((v) => v.academyId === user.academyId && v.plate === input.plate)) throw new DomainError(`Ya existe un coche con la matrícula ${input.plate}.`);
  const mine = db.vehicles.filter((v) => v.academyId === user.academyId);
  const v: Vehicle = { academyId: user.academyId, id: newId(user, 'veh'), ...input, color: VEHICLE_COLORS[mine.length % VEHICLE_COLORS.length] };
  db.vehicles.push(v); logActivity(user, 'creó', 'vehicle', `${user.name} dio de alta el coche ${v.model} (${v.plate})`, v.id);
  return done(v);
}
export function updateVehicle(user: User, id: ID, patch: Partial<VehicleInput>) {
  need(user, 'vehiculos:write'); const db = getDatabase(); const v = own(user, db.vehicles.find((x) => x.id === id), 'Coche');
  if (patch.plate && patch.plate !== v.plate && db.vehicles.some((x) => x.academyId === user.academyId && x.plate === patch.plate)) throw new DomainError(`Ya existe un coche con la matrícula ${patch.plate}.`);
  Object.assign(v, patch); logActivity(user, 'modificó', 'vehicle', `${user.name} modificó el coche ${v.model} (${v.plate})`, v.id);
  return done(v);
}

function practiceNames(user: User) {
  const db = getDatabase();
  return {
    student: (id: ID) => { const s = db.students.find((x) => x.id === id && x.academyId === user.academyId); return s ? `${s.firstName} ${s.lastName}` : 'El alumno'; },
    teacher: (id: ID) => { const t = db.teachers.find((x) => x.id === id && x.academyId === user.academyId); return t ? `${t.firstName} ${t.lastName}` : 'El profesor'; },
    vehicle: (id: ID) => { const v = db.vehicles.find((x) => x.id === id && x.academyId === user.academyId); return v ? `${v.model} (${v.plate})` : 'El coche'; },
  };
}
/** Valida referencias del tenant y devuelve los choques. Los bloqueantes (coche en taller) nunca se pueden saltar. */
function checkPractice(user: User, p: { id: ID; studentId: ID; teacherId: ID; vehicleId?: ID; date: string; start: string; end: string }): PracticeConflict[] {
  const db = getDatabase(); own(user, db.students.find((x) => x.id === p.studentId), 'Alumno'); own(user, db.teachers.find((x) => x.id === p.teacherId), 'Profesor'); if (p.vehicleId) own(user, db.vehicles.find((x) => x.id === p.vehicleId), 'Coche');
  const all = db.practices.filter((x) => x.academyId === user.academyId); const vs = db.vehicles.filter((x) => x.academyId === user.academyId);
  return practiceConflicts(p, all, vs, practiceNames(user));
}
const enforce = (cs: PracticeConflict[], force: boolean) => {
  const hard = cs.find((c) => c.hard); if (hard) throw new DomainError(hard.message);
  if (cs.length && !force) throw new DomainError(`Hay choques: ${cs.map((c) => c.message).join(' ')}`);
};
/** Un profesor solo gestiona sus propias prácticas. */
const scopeTeacher = (user: User, teacherId: ID) => (user.role === 'PROFESOR' ? (user.teacherId ?? teacherId) : teacherId);

export function createPractice(user: User, input: PracticeInput, force = false): Practice {
  need(user, 'practicas:write'); const teacherId = scopeTeacher(user, input.teacherId); const id = newId(user, 'prc');
  enforce(checkPractice(user, { ...input, teacherId, id }), force);
  const p: Practice = { academyId: user.academyId, id, status: 'programada', ...input, teacherId };
  getDatabase().practices.push(p); logActivity(user, 'creó', 'practice', `${user.name} apuntó una práctica de ${practiceNames(user).student(p.studentId)} el ${p.date} a las ${p.start}`, p.id);
  if (upcoming(p.date)) queueNotice(user.academyId, p.studentId, 'practica', 'practica_nueva', p.id, pvars(user, p));
  return done(p);
}
/** «Repetir cada semana»: crea N prácticas (2–26). Si alguna choca no se crea nada, salvo que se pida saltar las ocupadas. */
export function createPracticeSeries(user: User, input: PracticeInput, weeks: number, skipBusy = false): { created: number; skipped: string[] } {
  need(user, 'practicas:write'); if (!Number.isInteger(weeks) || weeks < 2 || weeks > 26) throw new DomainError('La repetición es de 2 a 26 semanas.');
  const teacherId = scopeTeacher(user, input.teacherId); const seriesId = newId(user, 'ser'); const free: Practice[] = []; const skipped: string[] = [];
  for (let i = 0; i < weeks; i++) {
    const date = format(addDays(parseISO(input.date), 7 * i), 'yyyy-MM-dd'); const id = newId(user, 'prc'); const cand = { ...input, teacherId, date, id };
    const cs = checkPractice(user, cand).concat(free.flatMap((o) => practiceConflicts(cand, [o], getDatabase().vehicles.filter((v) => v.academyId === user.academyId), practiceNames(user))));
    const hard = cs.find((c) => c.hard); if (hard) throw new DomainError(hard.message);
    if (cs.length) { if (!skipBusy) throw new DomainError(`El ${date} choca: ${cs[0].message} No se ha creado nada; puedes «apuntar solo las libres».`); skipped.push(date); continue; }
    free.push({ academyId: user.academyId, id, status: 'programada', ...input, teacherId, date, seriesId });
  }
  getDatabase().practices.push(...free); logActivity(user, 'creó', 'practice', `${user.name} apuntó ${free.length} prácticas semanales de ${practiceNames(user).student(input.studentId)}`, seriesId);
  if (free.length) queueNotice(user.academyId, input.studentId, 'practica', 'practica_serie', seriesId, { ...pvars(user, { date: free[0].date, start: input.start, teacherId }), cantidad: free.length });
  return done({ created: free.length, skipped });
}
export function updatePractice(user: User, id: ID, input: PracticeInput, force = false) {
  need(user, 'practicas:write'); const p = own(user, getDatabase().practices.find((x) => x.id === id), 'Práctica');
  if (user.role === 'PROFESOR' && p.teacherId !== user.teacherId) throw new DomainError('Solo puedes modificar tus prácticas.');
  const teacherId = scopeTeacher(user, input.teacherId); enforce(checkPractice(user, { ...input, teacherId, id }), force);
  const moved = p.date !== input.date || p.start !== input.start || p.end !== input.end || p.teacherId !== teacherId;
  Object.assign(p, input, { teacherId }); logActivity(user, 'modificó', 'practice', `${user.name} modificó la práctica de ${practiceNames(user).student(p.studentId)} (${p.date} ${p.start})`, p.id);
  if (moved && p.status === 'programada' && upcoming(p.date)) queueNotice(user.academyId, p.studentId, 'practica', 'practica_cambio', p.id, pvars(user, p));
  return done(p);
}
export function cancelPractice(user: User, id: ID, cancelled = true) {
  need(user, 'practicas:write'); const p = own(user, getDatabase().practices.find((x) => x.id === id), 'Práctica');
  if (user.role === 'PROFESOR' && p.teacherId !== user.teacherId) throw new DomainError('Solo puedes modificar tus prácticas.');
  if (p.status === 'hecha') throw new DomainError('Una práctica ya hecha no se puede cancelar.');
  if (!cancelled) enforce(checkPractice(user, p), false);
  p.status = cancelled ? 'cancelada' : 'programada'; logActivity(user, 'modificó', 'practice', `${user.name} ${cancelled ? 'canceló' : 'restauró'} la práctica de ${practiceNames(user).student(p.studentId)} (${p.date})`, p.id);
  if (upcoming(p.date)) queueNotice(user.academyId, p.studentId, 'practica', cancelled ? 'practica_cancelada' : 'practica_restaurada', p.id, pvars(user, p));
  return done(p);
}
/** Marca la práctica como hecha, anota los kilómetros y los suma al cuentakilómetros del coche. */
export function completePractice(user: User, id: ID, data: { km?: number; notes?: string; studentSig?: string; teacherSig?: string }) {
  need(user, 'practicas:write'); const db = getDatabase(); const p = own(user, db.practices.find((x) => x.id === id), 'Práctica');
  if (user.role === 'PROFESOR' && p.teacherId !== user.teacherId) throw new DomainError('Solo puedes cerrar tus prácticas.');
  if (p.status === 'cancelada') throw new DomainError('La práctica está cancelada.');
  const wasDone = p.status === 'hecha'; const prevKm = p.km ?? 0; p.status = 'hecha'; p.km = data.km ?? p.km; if (data.notes !== undefined) p.notes = data.notes; if (data.studentSig) p.studentSig = data.studentSig; if (data.teacherSig) p.teacherSig = data.teacherSig;
  const v = p.vehicleId ? db.vehicles.find((x) => x.id === p.vehicleId && x.academyId === user.academyId) : undefined; if (v) v.km = Math.max(0, v.km + (p.km ?? 0) - (wasDone ? prevKm : 0));
  logActivity(user, 'registró', 'practice', `${user.name} cerró la práctica de ${practiceNames(user).student(p.studentId)} (${p.date})`, p.id);
  return done(p);
}
export function setStudentTraining(user: User, id: ID, data: { targetHours?: number; permit?: string; assignedTeacherId?: ID; notifyVia?: 'ambos' | 'correo' | 'whatsapp' | 'nada' }) {
  need(user, 'students:write'); const db = getDatabase(); const s = own(user, db.students.find((x) => x.id === id), 'Alumno');
  if (data.assignedTeacherId) own(user, db.teachers.find((x) => x.id === data.assignedTeacherId), 'Profesor');
  Object.assign(s, data); logActivity(user, 'modificó', 'student', `${user.name} actualizó la formación de ${s.firstName} ${s.lastName}`, s.id);
  return done(s);
}
/** Firmas de una práctica (imágenes aparte del snapshot para no engordar la carga del calendario). */
export function getPracticeSignatures(user: User, id: ID): { studentSig?: string; teacherSig?: string } {
  need(user, 'practicas:read'); const p = own(user, getDatabase().practices.find((x) => x.id === id), 'Práctica');
  if (user.role === 'PROFESOR' && p.teacherId !== user.teacherId) throw new DomainError('Solo puedes ver tus prácticas.');
  return { studentSig: p.studentSig, teacherSig: p.teacherSig };
}

/** Exámenes de conducir (teórico/práctico) en la ficha del alumno. */
export function addDrivingExam(user: User, studentId: ID, input: { kind: 'teorico' | 'practico'; date: string; result: 'pendiente' | 'aprobado' | 'suspendido' }) {
  need(user, 'students:write'); const s = own(user, getDatabase().students.find((x) => x.id === studentId), 'Alumno');
  const ex = { id: newId(user, 'exd'), ...input }; (s.driving ??= []).push(ex);
  if (upcoming(input.date)) queueNotice(user.academyId, studentId, 'examen', 'examen_nuevo', ex.id, { fecha: longDay(input.date), tipo: input.kind === 'teorico' ? 'teórico' : 'práctico' });
  logActivity(user, 'creó', 'student', `${user.name} anotó un examen ${input.kind} de ${s.firstName} ${s.lastName} (${input.result})`, s.id);
  return done(s);
}
export function setDrivingExamResult(user: User, studentId: ID, examId: ID, result: 'pendiente' | 'aprobado' | 'suspendido') {
  need(user, 'students:write'); const s = own(user, getDatabase().students.find((x) => x.id === studentId), 'Alumno');
  const e = (s.driving ?? []).find((x) => x.id === examId); if (!e) throw new Error('Examen no encontrado');
  e.result = result;
  if (result !== 'pendiente') queueNotice(user.academyId, studentId, 'examen', result === 'aprobado' ? 'examen_aprobado' : 'examen_suspendido', e.id, { tipo: e.kind === 'teorico' ? 'teórico' : 'práctico' });
  logActivity(user, 'modificó', 'student', `${user.name} marcó el examen ${e.kind} de ${s.firstName} ${s.lastName} como ${result}`, s.id);
  return done(s);
}
export function deleteDrivingExam(user: User, studentId: ID, examId: ID) {
  need(user, 'students:write'); const s = own(user, getDatabase().students.find((x) => x.id === studentId), 'Alumno');
  s.driving = (s.driving ?? []).filter((x) => x.id !== examId); return done(s);
}
/** Importación masiva de alumnos (CSV/Excel ya parseado en el cliente). Cada fila se valida por separado. */
export function importStudents(user: User, rows: StudentInput[]): { created: number } {
  need(user, 'students:write');
  for (const r of rows) createStudent(user, r);
  return { created: rows.length };
}

/** El aviso de WhatsApp se envió a mano (abriendo wa.me): se da por enviado. */
export function markNoticeSent(user: User, id: ID) {
  need(user, 'practicas:write'); const n = own(user, (getDatabase().outbox ?? []).find((x) => x.id === id), 'Aviso');
  n.waStatus = 'enviado'; return done(n);
}
export function dismissNotice(user: User, id: ID) {
  need(user, 'practicas:write'); const db = getDatabase(); own(user, (db.outbox ?? []).find((x) => x.id === id), 'Aviso'); db.outbox = db.outbox.filter((x) => x.id !== id); return done(true);
}

/** Ajustes de los avisos a alumnos: eventos (activados y con texto propio), canales, recordatorio y horas de descanso. */
export function updateNoticeSettings(user: User, patch: NoticeSettings) {
  need(user, 'settings:write'); const st = settingsOf(user);
  const events: NonNullable<NoticeSettings['events']> = {};
  for (const [k, v] of Object.entries(patch.events ?? {})) if (EVENT_BY_KEY[k]) events[k] = { enabled: v.enabled, subject: v.subject?.trim() || undefined, body: v.body?.trim() || undefined };
  st.notices = { events, channels: patch.channels, reminderHours: patch.reminderHours, quiet: patch.quiet };
  logActivity(user, 'modificó', 'settings', `${user.name} cambió los ajustes de avisos a alumnos`); return done(st);
}
/** Reintenta un aviso que falló (o lo deja listo para enviarlo a mano). */
export function retryNotice(user: User, id: ID) {
  need(user, 'practicas:write'); const n = own(user, (getDatabase().outbox ?? []).find((x) => x.id === id), 'Aviso');
  if (n.emailStatus === 'fallido') n.emailStatus = AUTO.email ? 'pendiente' : 'no';
  if (n.waStatus === 'fallido') n.waStatus = AUTO.whatsapp ? 'pendiente' : 'manual';
  if (n.hookStatus === 'fallido') n.hookStatus = AUTO.webhook ? 'pendiente' : 'no';
  n.attempts = 0; n.note = undefined; return done(n);
}
