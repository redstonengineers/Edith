import { addDays, differenceInYears, format, subYears } from 'date-fns';
import { es } from 'date-fns/locale';
import type {
  AcademyType, AttendanceStatus, ClassSession, Group, ID, IncidentPriority, IncidentStatus, ModuleId,
  ScheduleSlot, Student, StudentStatus, Teacher, WaitlistStatus,
} from '@/types';
import { DEFAULT_LABELS, PRESETS } from '@/config/presets';
import type { Database } from './db';
import { FIRST_NAMES, LAST_NAMES } from './names';
import { createRng, type Rng } from './rng';
import { buildAtlanta } from './seed.atlanta';

const d = (date: Date) => format(date, 'yyyy-MM-dd');
const dt = (date: Date) => date.toISOString();

interface GroupSpec { name: string; subject: number; teacher: number; room: number; capacity: number; slots: ScheduleSlot[] }
interface AcademySpec {
  id: ID; name: string; tagline: string; type: AcademyType; primary: string; secondary: string; theme: 'dark' | 'light';
  seed: number; students: number; waitlist: number; fixedNames?: string[];
  teachers: { first: string; last: string; specialty: string; subjects: number[] }[];
  subjects: { name: string; code: string; color: string; level?: string }[];
  rooms: { name: string; capacity: number }[];
  groups: GroupSpec[];
  users: { name: string; role: 'SUPER_ADMIN' | 'ADMIN' | 'SECRETARIA' | 'PROFESOR'; teacher?: number; email: string }[];
  modules?: ModuleId[];
}

const LM_X = (start: string, end: string): ScheduleSlot[] => [{ weekday: 1, start, end }, { weekday: 3, start, end }];
const MJ = (start: string, end: string): ScheduleSlot[] => [{ weekday: 2, start, end }, { weekday: 4, start, end }];
const LXV = (start: string, end: string): ScheduleSlot[] => [{ weekday: 1, start, end }, { weekday: 3, start, end }, { weekday: 5, start, end }];
const V = (start: string, end: string): ScheduleSlot[] => [{ weekday: 5, start, end }];

const SPECS: AcademySpec[] = [
  {
    id: 'acad_001', name: 'Academia Horizonte', tagline: 'Refuerzo, idiomas y preparación académica', type: 'educativa',
    primary: '#8b7bff', secondary: '#f472b6', theme: 'dark', seed: 1001, students: 44, waitlist: 7,
    fixedNames: ['María García Ruiz', 'Daniel Moreno Gil', 'Laura García Prieto', 'María Sánchez Vidal', 'Carlos Fernández Cano', 'Juan Pérez Ortega'],
    subjects: [
      { name: 'Matemáticas', code: 'MAT', color: '#8b7bff', level: 'ESO' }, { name: 'Inglés', code: 'ING', color: '#a78bfa' },
      { name: 'Lengua y Literatura', code: 'LEN', color: '#f472b6' }, { name: 'Física y Química', code: 'FYQ', color: '#34d399' },
      { name: 'Francés', code: 'FRA', color: '#fbbf24' }, { name: 'Alemán', code: 'ALE', color: '#fb923c' },
      { name: 'Biología', code: 'BIO', color: '#4ade80' }, { name: 'Historia', code: 'HIS', color: '#f87171' },
    ],
    teachers: [
      { first: 'Carlos', last: 'Fernández', specialty: 'Matemáticas', subjects: [0] },
      { first: 'Laura', last: 'García', specialty: 'Inglés', subjects: [1] },
      { first: 'Marta', last: 'López', specialty: 'Lengua y Literatura', subjects: [2, 7] },
      { first: 'Javier', last: 'Ortega', specialty: 'Física y Química', subjects: [3, 0] },
      { first: 'Elena', last: 'Ruiz', specialty: 'Idiomas modernos', subjects: [4, 5] },
      { first: 'Pablo', last: 'Navarro', specialty: 'Biología', subjects: [6] },
      { first: 'Sofía', last: 'Romero', specialty: 'Historia', subjects: [7] },
      { first: 'Andrés', last: 'Molina', specialty: 'Inglés avanzado', subjects: [1] },
    ],
    rooms: [{ name: 'Aula 1', capacity: 16 }, { name: 'Aula 2', capacity: 14 }, { name: 'Aula 3', capacity: 12 }, { name: 'Aula 4', capacity: 12 }, { name: 'Aula 5', capacity: 10 }],
    groups: [
      { name: 'Matemáticas ESO · Grupo A', subject: 0, teacher: 0, room: 0, capacity: 14, slots: LM_X('16:00', '17:30') },
      { name: 'Matemáticas ESO · Grupo B', subject: 0, teacher: 0, room: 0, capacity: 12, slots: MJ('16:00', '17:30') },
      { name: 'Inglés B2 · Grupo A', subject: 1, teacher: 1, room: 1, capacity: 10, slots: LM_X('17:30', '19:00') },
      { name: 'Inglés B1 · Grupo B', subject: 1, teacher: 1, room: 1, capacity: 12, slots: MJ('17:30', '19:00') },
      { name: 'Lengua y Literatura · Grupo A', subject: 2, teacher: 2, room: 2, capacity: 10, slots: LM_X('18:00', '19:30') },
      { name: 'Física y Química · Grupo A', subject: 3, teacher: 3, room: 2, capacity: 10, slots: MJ('18:00', '19:30') },
      { name: 'Francés A2 · Grupo C', subject: 4, teacher: 4, room: 3, capacity: 8, slots: LM_X('19:00', '20:30') },
      { name: 'Biología · Grupo A', subject: 6, teacher: 5, room: 3, capacity: 10, slots: MJ('19:00', '20:30') },
      { name: 'Historia · Grupo A', subject: 7, teacher: 6, room: 4, capacity: 10, slots: V('16:00', '18:00') },
      { name: 'Inglés C1 · Mañanas', subject: 1, teacher: 7, room: 0, capacity: 8, slots: LXV('09:00', '10:30') },
      { name: 'Alemán A1 · Mañanas', subject: 5, teacher: 4, room: 3, capacity: 8, slots: MJ('10:30', '12:00') },
      { name: 'Preparación Selectividad', subject: 2, teacher: 2, room: 2, capacity: 12, slots: LXV('11:00', '12:30') },
    ],
    users: [
      { name: 'Pablo Vidal', role: 'ADMIN', email: 'admin@horizonte.demo' },
      { name: 'Raquel Domínguez', role: 'SECRETARIA', email: 'secretaria@horizonte.demo' },
      { name: 'Carlos Fernández', role: 'PROFESOR', teacher: 0, email: 'carlos@horizonte.demo' },
      { name: 'Super Admin', role: 'SUPER_ADMIN', email: 'owner@academycontrol.demo' },
    ],
  },
  {
    id: 'acad_002', name: 'Centro Educativo Atlas', tagline: 'Escuela de idiomas', type: 'idiomas',
    primary: '#f59e0b', secondary: '#ef4444', theme: 'light', seed: 2002, students: 18, waitlist: 3,
    fixedNames: ['Giulia Marchetti Ruiz', 'Sofía Alonso Reyes'],
    subjects: [
      { name: 'Inglés General', code: 'EN', color: '#f59e0b' }, { name: 'Italiano', code: 'IT', color: '#10b981' },
      { name: 'Portugués', code: 'PT', color: '#6366f1' },
    ],
    teachers: [
      { first: 'Rosa', last: 'Cabrera', specialty: 'Inglés', subjects: [0] },
      { first: 'Tomás', last: 'Esteban', specialty: 'Italiano y portugués', subjects: [1, 2] },
      { first: 'Lidia', last: 'Fuentes', specialty: 'Inglés', subjects: [0] },
    ],
    rooms: [{ name: 'Sala Mediterráneo', capacity: 12 }, { name: 'Sala Atlántico', capacity: 10 }],
    groups: [
      { name: 'Inglés General · Nivel 1', subject: 0, teacher: 0, room: 0, capacity: 10, slots: LM_X('10:00', '11:30') },
      { name: 'Inglés General · Nivel 3', subject: 0, teacher: 2, room: 1, capacity: 10, slots: MJ('18:00', '19:30') },
      { name: 'Italiano · Principiantes', subject: 1, teacher: 1, room: 0, capacity: 8, slots: MJ('17:00', '18:30') },
      { name: 'Portugués · Intermedio', subject: 2, teacher: 1, room: 1, capacity: 8, slots: LM_X('18:00', '19:30') },
    ],
    users: [{ name: 'Beatriz Quintana', role: 'ADMIN', email: 'admin@atlas.demo' }],
    modules: ['students', 'teachers', 'groups', 'classes', 'subjects', 'schedule', 'attendance', 'payments', 'waitlist', 'enrollments', 'applications', 'incidents', 'notifications', 'statistics', 'ai', 'users', 'permissions'],
  },
];

function buildAcademy(spec: AcademySpec, today: Date, db: Database) {
  const rng: Rng = createRng(spec.seed);
  const A = spec.id;
  const preset = PRESETS[spec.type];
  const uid = (p: string, i: number) => `${A}_${p}_${String(i + 1).padStart(3, '0')}`;

  db.academies.push({ id: A, name: spec.name, type: spec.type, plan: spec.id === 'acad_001' ? 'pro' : 'basic', status: 'active', createdAt: d(subYears(today, 1)) });
  const modules: Partial<Record<ModuleId, boolean>> = {};
  const enabled = new Set<ModuleId>(spec.modules ?? preset.modules);
  for (const m of enabled) modules[m] = true;
  db.settings.push({
    academyId: A,
    branding: { name: spec.name, tagline: spec.tagline, primary: spec.primary, secondary: spec.secondary, theme: spec.theme },
    labels: { ...DEFAULT_LABELS, ...preset.labels },
    modules, locale: 'es-ES', currency: 'EUR', attendanceAlertThreshold: 75,
  });

  const subjects = spec.subjects.map((s, i) => ({ academyId: A, id: uid('sub', i), ...s }));
  db.subjects.push(...subjects);
  const rooms = spec.rooms.map((r, i) => ({ academyId: A, id: uid('room', i), ...r }));
  db.classrooms.push(...rooms);

  const teachers: Teacher[] = spec.teachers.map((t, i) => ({
    academyId: A, id: uid('tea', i), firstName: t.first, lastName: t.last,
    email: `${t.first.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')}@${spec.id === 'acad_001' ? 'horizonte' : 'atlas'}.demo`,
    phone: `6${rng.int(10, 99)} ${rng.int(100, 999)} ${rng.int(100, 999)}`,
    specialty: t.specialty, subjectIds: t.subjects.map((s) => subjects[s].id), weeklyHoursTarget: rng.int(14, 24),
    active: true, avatarHue: rng.int(0, 360), availability: [1, 2, 3, 4, 5],
  }));
  db.teachers.push(...teachers);

  // Usuarios
  spec.users.forEach((u, i) => {
    db.users.push({ academyId: A, id: uid('usr', i), name: u.name, email: u.email, role: u.role, teacherId: u.teacher !== undefined ? teachers[u.teacher].id : undefined, avatarHue: rng.int(0, 360) });
  });

  // Grupos
  const groups: Group[] = spec.groups.map((g, i) => ({
    academyId: A, id: uid('grp', i), name: g.name, subjectId: subjects[g.subject].id, teacherId: teachers[g.teacher].id,
    classroomId: rooms[g.room].id, capacity: g.capacity, slots: g.slots, active: true,
  }));

  // Alumnos
  const usedNames = new Set<string>();
  const students: Student[] = [];
  const size = new Map<ID, number>(groups.map((g) => [g.id, 0]));
  for (let i = 0; i < spec.students; i++) {
    let first: string, last: string, full: string;
    const fixed = spec.fixedNames?.[i];
    if (fixed) { const [f, ...rest] = fixed.split(' '); first = f; last = rest.join(' '); full = fixed; }
    else do { first = rng.pick(FIRST_NAMES); last = `${rng.pick(LAST_NAMES)} ${rng.pick(LAST_NAMES)}`; full = `${first} ${last}`; } while (usedNames.has(full));
    usedNames.add(full);
    const age = rng.chance(0.7) ? rng.int(10, 17) : rng.int(18, 46);
    const birth = addDays(subYears(today, age), -rng.int(0, 330));
    const r = rng.next();
    const status: StudentStatus = fixed ? 'activo' : r < 0.07 ? 'inactivo' : r < 0.1 ? 'baja' : r < 0.22 ? 'nuevo' : 'activo';
    const enrolledAt = status === 'nuevo' ? addDays(today, -rng.int(2, 25)) : addDays(today, -rng.int(40, 600));
    const leftAt = status === 'baja' ? d(addDays(today, -rng.int(5, 150))) : undefined;
    const groupIds: ID[] = [];
    if (status !== 'baja' && status !== 'inactivo') {
      const n = rng.chance(0.35) ? 2 : 1;
      for (const g of rng.shuffle(groups)) {
        if (groupIds.length >= n) break;
        if ((size.get(g.id) ?? 0) < g.capacity) { groupIds.push(g.id); size.set(g.id, (size.get(g.id) ?? 0) + 1); }
      }
    }
    const id = uid('stu', i);
    students.push({
      academyId: A, id, firstName: first, lastName: last, birthDate: d(birth), email: `${first}.${last.split(' ')[0]}`.toLowerCase().normalize('NFD').replace(/[^a-z.]/g, '') + '@correo.demo',
      phone: `6${rng.int(10, 99)} ${rng.int(100, 999)} ${rng.int(100, 999)}`, status, enrolledAt: d(enrolledAt), leftAt, groupIds,
      lastActivityAt: dt(addDays(today, -rng.int(0, 9))), notes: rng.chance(0.15) ? 'Prefiere comunicación por WhatsApp.' : '', avatarHue: rng.int(0, 360),
    });
    if (differenceInYears(today, birth) < 18) {
      const gid = uid('gua', db.guardians.filter((g) => g.academyId === A).length);
      const gl = last.split(' ')[0];
      db.guardians.push({ academyId: A, id: gid, name: `${rng.pick(FIRST_NAMES)} ${gl} ${rng.pick(LAST_NAMES)}`, phone: `6${rng.int(10, 99)} ${rng.int(100, 999)} ${rng.int(100, 999)}`, email: `familia.${gl}@correo.demo`.toLowerCase().normalize('NFD').replace(/[^a-z.@]/g, ''), relation: rng.pick(['Madre', 'Padre', 'Tutor legal']) });
      students[students.length - 1].guardianId = gid;
    }
  }
  // Capacidad realista: ligeramente por encima de la ocupación, y dos grupos completos para la demo.
  groups.forEach((g, i) => { const n = size.get(g.id) ?? 0; g.capacity = Math.max(n, 4) + (i % 4 === 1 || i % 5 === 3 ? 0 : rng.int(1, 4)); });
  db.students.push(...students);
  // Cuentas de portal (alumno y tutor) para la academia principal
  if (spec.id === 'acad_001') {
    const stu = students[1]; const minor = students.find((x) => x.guardianId && x.status === 'activo');
    const g = minor && db.guardians.find((x) => x.id === minor.guardianId);
    db.users.push({ academyId: A, id: uid('usr', 90), name: `${stu.firstName} ${stu.lastName}`, email: 'alumno@horizonte.demo', role: 'ALUMNO', studentId: stu.id, avatarHue: stu.avatarHue });
    if (minor && g) db.users.push({ academyId: A, id: uid('usr', 91), name: g.name, email: 'tutor@horizonte.demo', role: 'TUTOR', guardianOf: [minor.id], avatarHue: rng.int(0, 360) });
  }
  db.groups.push(...groups);

  // Clases: de hace 21 días a +21 días
  const classes: ClassSession[] = [];
  for (let off = -42; off <= 21; off++) {
    const day = addDays(today, off);
    const wd = day.getDay() === 0 ? 7 : day.getDay();
    for (const g of groups) for (const slot of g.slots) {
      if (slot.weekday !== wd) continue;
      const past = off < 0;
      classes.push({
        academyId: A, id: uid('cls', classes.length), groupId: g.id, teacherId: g.teacherId, classroomId: g.classroomId,
        date: d(day), start: slot.start, end: slot.end,
        status: past ? (rng.chance(0.04) ? 'cancelada' : 'impartida') : 'programada',
      });
    }
  }
  db.classes.push(...classes);

  // Asistencia (alumnos con "propensión" a faltar → algunos por debajo del 75 %)
  const propensity = new Map(students.map((s) => [s.id, rng.chance(0.12) ? 0.45 : rng.chance(0.25) ? 0.82 : 0.95]));
  let att = 0;
  for (const c of classes) {
    if (c.status !== 'impartida') continue;
    for (const s of students) {
      if (!s.groupIds.includes(c.groupId)) continue;
      const p = propensity.get(s.id)!;
      const r = rng.next();
      const status: AttendanceStatus = r < p ? (rng.chance(0.07) ? 'retraso' : 'presente') : rng.chance(0.4) ? 'justificado' : 'ausente';
      db.attendance.push({ academyId: A, id: uid('att', att++), classId: c.id, studentId: s.id, status });
    }
  }

  // Exámenes
  const examOffsets = [-18, -11, -6, -2, 1, 4, 9, 15];
  const examDefs = groups.filter((_, i) => i % 2 === 0 || i < 4).slice(0, examOffsets.length);
  examDefs.forEach((g, i) => {
    const off = examOffsets[i];
    const status = off > 0 ? 'pendiente' : off <= -6 ? 'corregido' : 'realizado';
    const exam = {
      academyId: A, id: uid('exm', i), title: `${off > 4 ? 'Examen final' : 'Examen parcial'} · ${g.name.split(' · ')[0]}`, subjectId: g.subjectId, groupId: g.id,
      teacherId: g.teacherId, classroomId: g.classroomId, date: d(addDays(today, off)), start: g.slots[0].start, durationMin: rng.pick([60, 90, 120]),
      description: 'Temas trabajados durante el trimestre.', status,
    } as const;
    db.exams.push(exam);
    if (status !== 'pendiente') {
      students.filter((s) => s.groupIds.includes(g.id)).forEach((s, k) => {
        db.grades.push({ academyId: A, id: `${exam.id}_g${k}`, examId: exam.id, studentId: s.id, score: status === 'corregido' ? Math.round((rng.int(32, 98) / 10) * 10) / 10 : null });
      });
    }
  });

  // Pagos: mensualidad de hace 2 meses, del mes pasado y de este
  let pay = 0;
  const fee = spec.id === 'acad_001' ? [65, 80, 95] : [70, 85];
  for (const s of students) {
    if (s.status === 'baja') continue;
    const amount = rng.pick(fee) * Math.max(1, s.groupIds.length);
    const morosity = rng.next();
    ([-5, -4, -3, -2, -1, 0] as const).forEach((m) => {
      const due = new Date(today.getFullYear(), today.getMonth() + m, 5);
      if (d(due) < s.enrolledAt.slice(0, 8) + '01') return; // sin cobros anteriores al alta
      const isFuture = due > today;
      let status: 'pagado' | 'pendiente' | 'vencido';
      if (isFuture) status = 'pendiente';
      else if (m <= -2) status = morosity < 0.05 && m === -2 ? 'vencido' : 'pagado';
      else if (m === -1) status = morosity < 0.09 ? 'vencido' : 'pagado';
      else status = morosity < 0.2 ? 'pendiente' : 'pagado';
      if (status === 'pendiente' && due < today && m < 0) status = 'vencido';
      const month = format(due, 'MMMM yyyy', { locale: es });
      db.payments.push({ academyId: A, id: uid('pay', pay++), studentId: s.id, concept: `Mensualidad ${month}`, amount, dueDate: d(due), paidAt: status === 'pagado' ? d(addDays(due, rng.int(-2, 3))) : undefined, status });
    });
  }
  // Vencimiento coherente: lo pendiente con fecha pasada es vencido
  for (const p of db.payments) if (p.academyId === A && p.status === 'pendiente' && p.dueDate < d(today)) p.status = 'vencido';

  // Lista de espera
  const wlStatuses: WaitlistStatus[] = ['pendiente', 'pendiente', 'contactado', 'pendiente', 'aceptado', 'contactado', 'pendiente'];
  for (let i = 0; i < spec.waitlist; i++) {
    const first = rng.pick(FIRST_NAMES), last = rng.pick(LAST_NAMES);
    const g = rng.pick(groups);
    db.waitlist.push({
      academyId: A, id: uid('wl', i), name: `${first} ${last} ${rng.pick(LAST_NAMES)}`, phone: `6${rng.int(10, 99)} ${rng.int(100, 999)} ${rng.int(100, 999)}`,
      email: `${first}.${last}@correo.demo`.toLowerCase().normalize('NFD').replace(/[^a-z.@]/g, ''), course: g.name.split(' · ')[0], level: rng.pick(['Inicial', 'Intermedio', 'Avanzado']),
      requestedAt: d(addDays(today, -rng.int(1, 30))), priority: rng.pick(['baja', 'media', 'media', 'alta']), status: wlStatuses[i % wlStatuses.length],
    });
  }

  // Matrículas
  students.forEach((s, i) => db.enrollments.push({
    academyId: A, id: uid('enr', i), studentId: s.id, groupId: s.groupIds[0], status: s.status === 'baja' ? 'baja' : 'activa', createdAt: s.enrolledAt, updatedAt: s.enrolledAt,
  }));

  // Solicitudes de admisión en curso
  const apps: { name: string; course: string; status: 'solicitud' | 'revision' | 'aceptada' }[] = [
    { name: 'Nerea Aguilar Soto', course: groups[0 % groups.length].name.split(' · ')[0], status: 'solicitud' },
    { name: 'Gael Montero Pinto', course: groups[2 % groups.length].name.split(' · ')[0], status: 'revision' },
    { name: 'Alicia Rubio Mena', course: groups[4 % groups.length].name.split(' · ')[0], status: 'aceptada' },
  ];
  apps.slice(0, spec.id === 'acad_001' ? 3 : 1).forEach((a, i) => db.enrollments.push({
    academyId: A, id: uid('enrA', i), applicant: { name: a.name, email: `${a.name.split(' ')[0]}@correo.demo`.toLowerCase(), phone: `6${rng.int(10, 99)} ${rng.int(100, 999)} ${rng.int(100, 999)}`, birthDate: d(subYears(today, rng.int(12, 30))), course: a.course, source: i === 0 ? 'web' : 'presencial' },
    status: a.status, createdAt: d(addDays(today, -(i * 3 + 1))), updatedAt: d(addDays(today, -i)),
  }));

  // Incidencias
  const incTpl: [string, string, IncidentPriority, IncidentStatus][] = [
    ['Alumno con problemas de asistencia', 'Asistencia', 'media', 'pendiente'],
    ['Proyector del aula averiado', 'Instalaciones', 'alta', 'en_proceso'],
    ['Profesor solicita cambio de horario', 'Horarios', 'baja', 'pendiente'],
    ['Reclamación de calificación', 'Evaluación', 'media', 'en_proceso'],
    ['Aula sin calefacción', 'Instalaciones', 'critica', 'pendiente'],
    ['Falta de material didáctico', 'Material', 'baja', 'resuelto'],
    ['Conflicto de aula entre dos grupos', 'Horarios', 'alta', 'resuelto'],
  ];
  const adminId = db.users.find((u) => u.academyId === A && u.role === 'ADMIN')!.id;
  incTpl.slice(0, spec.id === 'acad_001' ? 7 : 3).forEach(([title, type, priority, status], i) => db.incidents.push({
    academyId: A, id: uid('inc', i), title, type, priority, status, assigneeId: adminId, createdAt: d(addDays(today, -rng.int(0, 12))),
    description: 'Registrada desde secretaría. Pendiente de seguimiento por el responsable asignado.',
    relatedStudentId: type === 'Asistencia' ? students[3]?.id : undefined,
  }));

  // Documentos
  ['Contrato de matrícula.pdf', 'Autorización de imagen.pdf', 'DNI (copia).jpg', 'Justificante médico.pdf'].forEach((name, i) => db.documents.push({
    academyId: A, id: uid('doc', i), name, kind: name.endsWith('jpg') ? 'imagen' : 'pdf', ownerType: 'student', ownerId: students[i].id, sizeKb: rng.int(80, 900), uploadedAt: d(addDays(today, -rng.int(1, 60))),
  }));

  // Mensajes y avisos
  const sender = db.users.find((u) => u.academyId === A && u.role === 'ADMIN')!;
  db.messages.push(
    { academyId: A, id: uid('msg', 0), fromUserId: sender.id, toUserIds: [], subject: 'Calendario de exámenes del trimestre', body: 'Os recordamos que las convocatorias están publicadas en el calendario. Revisad vuestras fechas.', channel: 'app', sentAt: dt(addDays(today, -2)), kind: 'announcement' },
    { academyId: A, id: uid('msg', 1), fromUserId: sender.id, toUserIds: db.users.filter((u) => u.academyId === A && u.id !== sender.id).map((u) => u.id), subject: 'Reunión de equipo el jueves', body: 'Reunión de coordinación a las 14:00 en secretaría.', channel: 'app', sentAt: dt(addDays(today, -1)), kind: 'message', readBy: [] },
  );

  // Notificaciones y actividad
  const now = new Date();
  db.notifications.push(
    { academyId: A, id: uid('ntf', 0), title: 'Pago vencido', body: 'Hay recibos vencidos pendientes de gestionar.', level: 'warning', createdAt: dt(addDays(now, 0)), read: false, href: '/pagos' },
    { academyId: A, id: uid('ntf', 1), title: 'Nuevo alumno matriculado', body: `${students.find((s) => s.status === 'nuevo')?.firstName ?? 'Un alumno'} se ha incorporado.`, level: 'success', createdAt: dt(addDays(now, 0)), read: false, href: '/alumnos' },
    { academyId: A, id: uid('ntf', 2), title: 'Examen próximo', body: 'Hay un examen programado para mañana.', level: 'info', createdAt: dt(addDays(now, -1)), read: true, href: '/examenes' },
  );
  const logTpl = [
    ['creó', 'student', 'se ha matriculado'], ['creó', 'exam', 'ha creado un examen'], ['modificó', 'group', 'ha movido un alumno de grupo'],
    ['registró', 'attendance', 'ha registrado una ausencia'], ['modificó', 'grade', 'ha modificado una calificación'], ['registró', 'payment', 'ha registrado un pago'],
    ['modificó', 'class', 'ha modificado un horario'], ['creó', 'incident', 'ha abierto una incidencia'],
  ];
  logTpl.forEach(([, type, text], i) => {
    const staff = db.users.filter((u) => u.academyId === A && ['ADMIN', 'SECRETARIA', 'PROFESOR'].includes(u.role)); const actor = staff[i % staff.length];
    const s = students[(i * 5) % students.length];
    const who = type === 'student' ? `${s.firstName} ${s.lastName.split(' ')[0]}` : actor.name;
    db.activity.push({ academyId: A, id: uid('log', i), at: dt(new Date(now.getTime() - (i * 47 + 12) * 60000)), actorId: actor.id, actorName: actor.name, action: text, entityType: type, entityId: s.id, summary: type === 'student' ? `${who} se ha matriculado` : `${actor.name} ${text}` });
  });
}

export function generateDatabase(today: Date = new Date()): Database {
  const db: Database = {
    academies: [], settings: [], users: [], students: [], guardians: [], teachers: [], subjects: [], classrooms: [], groups: [], classes: [],
    enrollments: [], waitlist: [], attendance: [], exams: [], grades: [], payments: [], incidents: [], documents: [], notifications: [], messages: [], activity: [], vehicles: [], practices: [],
  };
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  for (const spec of SPECS) buildAcademy(spec, t, db);
  buildAtlanta(db, t);
  return db;
}
