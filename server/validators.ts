import { z } from 'zod';
import { MODULES } from '../src/config/modules';
import { DEFAULT_LABELS } from '../src/config/presets';
import { announcementSchema as _a, practiceSchema, vehicleSchema, applicationSchema, brandingSchema, classSchema, convertSchema, examSchema, generalSchema, groupSchema, incidentSchema, labelSchema, markPaidSchema, paymentSchema, studentSchema, subjectSchema, teacherSchema, userSchema, waitlistSchema, onboardingSchema } from '../src/lib/schemas';
void _a;

const id = z.string().min(1).max(100);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const dataUrl = z.string().max(400_000);
const role = z.enum(['ADMIN', 'SECRETARIA', 'PROFESOR', 'ALUMNO', 'TUTOR']);
const roleAny = z.enum(['SUPER_ADMIN', 'ADMIN', 'SECRETARIA', 'PROFESOR', 'ALUMNO', 'TUTOR']);
const moduleIds = MODULES.map((m) => m.id) as [string, ...string[]];
const labelKeys = Object.keys(DEFAULT_LABELS) as [string, ...string[]];
const academyType = z.enum(['educativa', 'idiomas', 'musica', 'oposiciones', 'refuerzo', 'autoescuela', 'fisioterapia', 'psicologia', 'fitness', 'danza', 'deportiva', 'infantil', 'formacion', 'nautica', 'canina', 'estetica', 'artes', 'otro']);
const channel = z.enum(['app', 'email', 'whatsapp', 'sms', 'push']);

/**
 * Esquema de argumentos de CADA mutación expuesta (sin el usuario, que sale de la sesión, nunca del cliente).
 * Zod descarta claves desconocidas, lo que evita "mass assignment" (p. ej. cambiar academyId o rol desde el cuerpo).
 * Si una mutación exportada no aparece aquí, el servidor no arranca (falla cerrado).
 */
export const RPC: Record<string, z.ZodType<unknown[]>> = {
  createStudent: z.tuple([studentSchema]),
  updateStudent: z.tuple([id, studentSchema.pick({ firstName: true, lastName: true, birthDate: true, email: true, phone: true, notes: true }).partial()]),
  setStudentStatus: z.tuple([id, z.enum(['activo', 'inactivo', 'nuevo', 'baja'])]),
  addStudentToGroup: z.tuple([id, id]), removeStudentFromGroup: z.tuple([id, id]),
  createTeacher: z.tuple([teacherSchema]),
  updateTeacher: z.tuple([id, teacherSchema.partial().extend({ active: z.boolean().optional() })]),
  createGroup: z.tuple([groupSchema]), updateGroup: z.tuple([id, groupSchema]),
  createSubject: z.tuple([subjectSchema]), updateSubject: z.tuple([id, subjectSchema]), deleteSubject: z.tuple([id]),
  createClass: z.tuple([classSchema]), updateClass: z.tuple([id, classSchema]), cancelClass: z.tuple([id, z.boolean().optional()]), duplicateClass: z.tuple([id, day]),
  setAttendance: z.tuple([id, id, z.enum(['presente', 'ausente', 'retraso', 'justificado']).nullable()]), markAllPresent: z.tuple([id, z.array(id).max(500)]),
  createExam: z.tuple([examSchema]), updateExam: z.tuple([id, examSchema]), setExamStatus: z.tuple([id, z.enum(['pendiente', 'realizado', 'corregido'])]),
  openGrading: z.tuple([id]), setGrade: z.tuple([id, id, z.number().min(0).max(10).nullable()]),
  createApplication: z.tuple([applicationSchema]), advanceEnrollment: z.tuple([id, z.object({ groupId: id.optional() }).optional()]), rejectEnrollment: z.tuple([id]),
  createWaitlistEntry: z.tuple([waitlistSchema]), setWaitlistStatus: z.tuple([id, z.enum(['pendiente', 'contactado', 'aceptado', 'rechazado'])]),
  setWaitlistPriority: z.tuple([id, z.enum(['baja', 'media', 'alta'])]), convertWaitlist: z.tuple([id, convertSchema]),
  createPayment: z.tuple([paymentSchema]), markPaid: z.tuple([id, markPaidSchema]), voidPayment: z.tuple([id]), sendPaymentReminder: z.tuple([id]),
  createIncident: z.tuple([incidentSchema]), updateIncident: z.tuple([id, incidentSchema.partial().extend({ status: z.enum(['pendiente', 'en_proceso', 'resuelto']).optional() })]),
  addDocument: z.tuple([z.object({ name: z.string().min(1).max(200), mime: z.string().max(100), sizeKb: z.number().int().min(1).max(100_000), ownerType: z.enum(['student', 'teacher', 'group', 'enrollment']), ownerId: id })]), deleteDocument: z.tuple([id]),
  sendMessage: z.tuple([z.object({ subject: z.string().min(3).max(80), body: z.string().min(3).max(2000), toUserIds: z.array(id).max(200), channel: channel.optional(), kind: z.enum(['message', 'announcement']).optional(), audienceGroupId: id.optional() })]),
  markNotificationsRead: z.tuple([id.optional()]), markMessageRead: z.tuple([id]),
  updateBranding: z.tuple([brandingSchema.extend({ logoUrl: dataUrl.nullable().optional(), faviconUrl: dataUrl.nullable().optional() })]),
  updateLabels: z.tuple([z.object(Object.fromEntries(labelKeys.map((k) => [k, labelSchema])))]),
  applyPreset: z.tuple([academyType]),
  setModules: z.tuple([z.partialRecord(z.enum(moduleIds), z.boolean())]),
  updateGeneral: z.tuple([generalSchema]),
  createUser: z.tuple([userSchema]),
  updateUser: z.tuple([id, z.object({ role: role.optional(), disabled: z.boolean().optional(), teacherId: id.optional() })]),
  setRolePermission: z.tuple([roleAny, z.string().regex(/^[a-z]{3,20}:(read|write)$/), z.boolean()]), resetRolePermissions: z.tuple([roleAny]),
  platformOverview: z.tuple([]), setAcademyStatus: z.tuple([id, z.enum(['active', 'suspended'])]), setAcademyPlan: z.tuple([id, z.enum(['trial', 'basic', 'pro'])]),
  createVehicle: z.tuple([vehicleSchema]), updateVehicle: z.tuple([id, vehicleSchema.partial()]),
  createPractice: z.tuple([practiceSchema, z.boolean().optional()]), createPracticeSeries: z.tuple([practiceSchema, z.number().int().min(2).max(26), z.boolean().optional()]),
  updatePractice: z.tuple([id, practiceSchema, z.boolean().optional()]), cancelPractice: z.tuple([id, z.boolean().optional()]),
  completePractice: z.tuple([id, z.object({ km: z.number().int().min(0).max(1000).optional(), notes: z.string().max(500).optional(), studentSig: dataUrl.optional(), teacherSig: dataUrl.optional() })]), getPracticeSignatures: z.tuple([id]),
  addDrivingExam: z.tuple([id, z.object({ kind: z.enum(['teorico', 'practico']), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), result: z.enum(['pendiente', 'aprobado', 'suspendido']) })]),
  setDrivingExamResult: z.tuple([id, id, z.enum(['pendiente', 'aprobado', 'suspendido'])]), deleteDrivingExam: z.tuple([id, id]),
  importStudents: z.tuple([z.array(studentSchema).min(1).max(500)]),
  setStudentTraining: z.tuple([id, z.object({ targetHours: z.number().min(1).max(200).optional(), permit: z.string().max(10).optional(), assignedTeacherId: id.optional(), notifyVia: z.enum(['ambos', 'correo', 'whatsapp', 'nada']).optional() })]),
  markNoticeSent: z.tuple([id]), dismissNotice: z.tuple([id]),
  recordExport: z.tuple([z.string().min(1).max(200)]),
};

export const onboardingBody = onboardingSchema.extend({
  type: academyType, logoUrl: dataUrl.optional(), modules: z.array(z.enum(moduleIds)).max(60), primary: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});
export const loginBody = z.object({ email: z.string().min(1).max(200), password: z.string().min(1).max(200), academy: z.string().regex(/^[a-z0-9-]{1,40}$/).optional() });
export const aiBody = z.object({ question: z.string().min(1).max(400), history: z.array(z.object({ role: z.enum(['user', 'ai']), text: z.string().max(500) })).max(20).optional() });
