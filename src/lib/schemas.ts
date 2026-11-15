import { z } from 'zod';

const text = (label: string, min = 2) => z.string().trim().min(min, `${label}: mínimo ${min} caracteres`).max(80, `${label}: máximo 80 caracteres`);
const phone = z.string().trim().regex(/^[0-9 +()-]{9,16}$/, 'Teléfono no válido');
const email = z.string().trim().toLowerCase().email('Correo no válido');
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha obligatoria');

export const guardianSchema = z.object({ name: text('Nombre del tutor'), phone, email, relation: text('Parentesco', 3) });

export const studentSchema = z.object({
  firstName: text('Nombre'), lastName: text('Apellidos'),
  birthDate: date.refine((d) => d <= new Date().toISOString().slice(0, 10), 'La fecha no puede ser futura'),
  email, phone, groupId: z.string().optional(), notes: z.string().max(1000).default(''),
  guardian: guardianSchema.optional(),
});
export type StudentInput = z.infer<typeof studentSchema>;

export const teacherSchema = z.object({
  firstName: text('Nombre'), lastName: text('Apellidos'), email, phone, specialty: text('Especialidad'),
  subjectIds: z.array(z.string()).default([]), weeklyHoursTarget: z.coerce.number().min(1, 'Mínimo 1 h').max(40, 'Máximo 40 h'),
  availability: z.array(z.number().int().min(1).max(7)).min(1, 'Selecciona al menos un día'),
});
export type TeacherInput = z.infer<typeof teacherSchema>;

const time = z.string().regex(/^\d{2}:\d{2}$/, 'Hora no válida');
export const groupSchema = z.object({
  name: text('Nombre', 3), subjectId: z.string().min(1, 'Selecciona una asignatura'), teacherId: z.string().min(1, 'Selecciona un profesor'),
  classroomId: z.string().min(1, 'Selecciona un aula'), capacity: z.coerce.number().int().min(1, 'Mínimo 1').max(60, 'Máximo 60'),
  slots: z.array(z.object({ weekday: z.number().int().min(1).max(7), start: time, end: time })).min(1, 'Añade al menos un horario')
    .refine((s) => s.every((x) => x.start < x.end), 'La hora de fin debe ser posterior al inicio'),
});
export type GroupInput = z.infer<typeof groupSchema>;

export const subjectSchema = z.object({ name: text('Nombre'), code: z.string().trim().toUpperCase().min(2, 'Mínimo 2 caracteres').max(6, 'Máximo 6'), level: z.string().trim().max(30).optional(), color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color no válido') });
export type SubjectInput = z.infer<typeof subjectSchema>;

/** Convierte errores de Zod en { campo: mensaje } para los formularios. */
export function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) { const k = i.path.join('.') || '_'; if (!out[k]) out[k] = i.message; }
  return out;
}

export const classSchema = z.object({
  groupId: z.string().min(1, 'Selecciona un grupo'), teacherId: z.string().min(1, 'Selecciona un profesor'), classroomId: z.string().min(1, 'Selecciona un aula'),
  date: date, start: time, end: time, topic: z.string().trim().max(120).optional(),
}).refine((c) => c.start < c.end, { path: ['end'], message: 'La hora de fin debe ser posterior al inicio' });
export type ClassInput = z.infer<typeof classSchema>;

export const examSchema = z.object({
  title: text('Título', 3), groupId: z.string().min(1, 'Selecciona un grupo'), teacherId: z.string().min(1, 'Selecciona un profesor'), classroomId: z.string().min(1, 'Selecciona un aula'),
  date, start: time, durationMin: z.coerce.number().int().min(10, 'Mínimo 10 min').max(480, 'Máximo 8 h'), description: z.string().trim().max(500).default(''),
});
export type ExamInput = z.infer<typeof examSchema>;

export const applicationSchema = z.object({ name: text('Nombre completo', 3), email, phone, birthDate: date.optional().or(z.literal('')), course: text('Curso / asignatura') });
export type ApplicationInput = z.infer<typeof applicationSchema>;

export const waitlistSchema = z.object({ name: text('Nombre completo', 3), email, phone, course: text('Curso'), level: text('Nivel', 2), priority: z.enum(['baja', 'media', 'alta']), birthDate: date.optional().or(z.literal('')) });
export type WaitlistInput = z.infer<typeof waitlistSchema>;

export const convertSchema = z.object({ birthDate: date.refine((d) => d <= new Date().toISOString().slice(0, 10), 'La fecha no puede ser futura'), groupId: z.string().optional() });

export const paymentSchema = z.object({ studentId: z.string().min(1, 'Selecciona un alumno'), concept: text('Concepto', 3), amount: z.coerce.number().positive('El importe debe ser mayor que 0').max(100000, 'Importe demasiado alto'), dueDate: date });
export type PaymentInput = z.infer<typeof paymentSchema>;
export const markPaidSchema = z.object({ paidAt: date, method: z.enum(['efectivo', 'tarjeta', 'transferencia', 'domiciliacion']) });

export const incidentSchema = z.object({
  title: text('Título', 4), type: z.string().min(1, 'Selecciona un tipo'), priority: z.enum(['baja', 'media', 'alta', 'critica']), assigneeId: z.string().optional(),
  description: z.string().trim().min(5, 'Describe brevemente la incidencia').max(1000), relatedStudentId: z.string().optional(), relatedTeacherId: z.string().optional(),
});
export type IncidentInput = z.infer<typeof incidentSchema>;

export const messageSchema = z.object({ subject: text('Asunto', 3), body: z.string().trim().min(3, 'Escribe un mensaje').max(2000), toUserIds: z.array(z.string()).default([]) });
export const announcementSchema = z.object({ subject: text('Título', 3), body: z.string().trim().min(3, 'Escribe el aviso').max(2000), audienceGroupId: z.string().optional(), channel: z.enum(['app', 'email', 'whatsapp', 'sms', 'push']) });

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color no válido (formato #RRGGBB)');
export const brandingSchema = z.object({ name: text('Nombre de la academia', 2), tagline: z.string().trim().max(80, 'Máximo 80 caracteres').default(''), primary: hex, secondary: hex, theme: z.enum(['dark', 'light']) });
export const labelSchema = z.object({ singular: text('Singular', 2), plural: text('Plural', 2) });
export const generalSchema = z.object({ currency: z.enum(['EUR', 'USD', 'GBP', 'MXN']), attendanceAlertThreshold: z.coerce.number().int().min(10, 'Mínimo 10').max(100, 'Máximo 100') });

export const passwordSchema = z.string().min(8, 'Mínimo 8 caracteres').max(72, 'Máximo 72 caracteres').refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), 'Debe incluir letras y números');
export const userSchema = z.object({ name: text('Nombre', 3), email, role: z.enum(['ADMIN', 'SECRETARIA', 'PROFESOR', 'ALUMNO', 'TUTOR']), teacherId: z.string().optional(), studentId: z.string().optional(), password: passwordSchema });
export const onboardingSchema = z.object({ academyName: text('Nombre de la academia', 2), adminName: text('Tu nombre', 3), adminEmail: email, adminPassword: passwordSchema });

/* ── Autoescuela ── */
const optDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha no válida').optional().or(z.literal('').transform(() => undefined));
export const vehicleSchema = z.object({
  plate: text('Matrícula', 4).transform((s) => s.toUpperCase()), model: text('Modelo'), km: z.coerce.number().int().min(0, 'No puede ser negativo').max(2_000_000),
  status: z.enum(['activo', 'taller', 'baja']).default('activo'), itvDue: optDate, insuranceDue: optDate, notes: z.string().max(500).optional(),
});
export type VehicleInput = z.infer<typeof vehicleSchema>;
export const practiceSchema = z.object({
  studentId: z.string().min(1, 'Elige al alumno'), teacherId: z.string().min(1, 'Elige al profesor'), vehicleId: z.string().optional().or(z.literal('').transform(() => undefined)),
  date, start: z.string().regex(/^\d{2}:\d{2}$/, 'Hora no válida'), end: z.string().regex(/^\d{2}:\d{2}$/, 'Hora no válida'), notes: z.string().max(500).optional(),
}).refine((v) => v.start < v.end, { path: ['end'], message: 'El fin debe ser posterior al inicio' });
export type PracticeInput = z.infer<typeof practiceSchema>;

/** Formulario público de solicitud de matrícula (lo rellena una persona sin cuenta). */
export const publicApplySchema = z.object({
  name: text('Nombre completo', 3), email, phone, birthDate: date.refine((d) => d <= new Date().toISOString().slice(0, 10) && d >= '1900-01-01', 'Fecha no válida').optional().or(z.literal('')),
  interest: z.string().trim().min(2, 'Indica qué te interesa').max(80), message: z.string().trim().max(500, 'Máximo 500 caracteres').optional().or(z.literal('')),
  guardianName: z.string().trim().max(80).optional().or(z.literal('')), guardianPhone: z.string().trim().max(16).optional().or(z.literal('')),
  consent: z.literal(true, { error: 'Debes aceptar el tratamiento de tus datos' }),
  /** Consentimiento específico y opcional para avisos por WhatsApp. */ whatsappConsent: z.boolean().optional(),
  /** Señuelo anti-spam: un humano no lo ve ni lo rellena (si llega relleno se descarta en silencio). */ website: z.string().max(300).optional(),
  /** Milisegundos que tardó en rellenarlo (un robot lo envía al instante). */ elapsed: z.number().min(0).max(86_400_000).optional(),
});
export type PublicApplyInput = z.infer<typeof publicApplySchema>;
