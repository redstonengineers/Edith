/** Entidades del dominio. Toda entidad de negocio lleva `academyId` (multi-tenancy). */
export type ID = string;
export type ISODate = string; // 'YYYY-MM-DD'
export type ISODateTime = string;

export type RoleId = 'SUPER_ADMIN' | 'ADMIN' | 'SECRETARIA' | 'PROFESOR' | 'ALUMNO' | 'TUTOR';
export type ThemeMode = 'dark' | 'light';

export interface Tenant { academyId: ID }

export interface Academy {
  id: ID;
  name: string;
  type: AcademyType;
  plan: 'trial' | 'basic' | 'pro';
  status: 'active' | 'suspended';
  /** Identificador público del negocio en la pantalla de acceso (p. ej. «atlanta»). */
  slug?: string;
  /** Se rellenó con datos ficticios de demostración (no se vuelve a hacer aunque se borren). */
  demoSeeded?: boolean;
  createdAt: ISODate;
}
export type AcademyType = 'educativa' | 'idiomas' | 'musica' | 'oposiciones' | 'refuerzo' | 'autoescuela' | 'fisioterapia' | 'psicologia' | 'fitness' | 'danza' | 'deportiva' | 'infantil' | 'formacion' | 'nautica' | 'canina' | 'estetica' | 'artes' | 'otro';

export interface User extends Tenant {
  id: ID;
  name: string;
  email: string;
  /** Nombre de usuario alternativo al correo para iniciar sesión (p. ej. «director»). */
  username?: string;
  role: RoleId;
  /** Vincula al usuario con su ficha (profesor/alumno/tutor) para filtrar alcance. */
  teacherId?: ID;
  studentId?: ID;
  guardianOf?: ID[];
  avatarHue: number;
  disabled?: boolean;
  /** Solo modo mock: hash salado de la contraseña. Nunca se expone a la UI. */
  pwd?: { salt: string; hash: string };
}

export interface EntityLabel { singular: string; plural: string; /** Género femenino (para «Nueva sesión»). Si falta, se infiere. */ f?: boolean }
export type LabelKey =
  | 'student' | 'teacher' | 'group' | 'class' | 'subject' | 'exam' | 'classroom'
  | 'enrollment' | 'payment' | 'incident' | 'document';

export type ModuleId =
  | 'dashboard' | 'students' | 'teachers' | 'groups' | 'classes' | 'subjects' | 'schedule'
  | 'exams' | 'grades' | 'attendance' | 'applications' | 'waitlist' | 'enrollments'
  | 'payments' | 'billing' | 'documents' | 'practicas' | 'vehiculos' | 'parte' | 'avisos' | 'incidents' | 'messages' | 'announcements'
  | 'notifications' | 'statistics' | 'reports' | 'ai' | 'settings' | 'users' | 'permissions'
  | 'customization' | 'platform';

export interface Settings extends Tenant {
  branding: { name: string; tagline: string; logoUrl?: string; faviconUrl?: string; primary: string; secondary: string; theme: ThemeMode };
  labels: Record<LabelKey, EntityLabel>;
  modules: Partial<Record<ModuleId, boolean>>;
  locale: string;
  currency: string;
  attendanceAlertThreshold: number; // %
  /** Ajustes de permisos por rol de esta academia: { ROL: { 'recurso:accion': true|false } } sobre la matriz por defecto. */
  permissionOverrides?: Partial<Record<RoleId, Record<string, boolean>>>;
  /** Avisos automáticos a alumnos: qué eventos se avisan, con qué texto y por qué canales. */
  notices?: NoticeSettings;
  /** Formulario público de solicitud de matrícula (enlace `/matricula/<negocio>`). Activo salvo que se desactive. */
  apply?: ApplySettings;
}

export interface ApplySettings { enabled?: boolean; /** Texto de bienvenida del formulario. */ message?: string; /** Opciones de «¿qué te interesa?» (si se dejan vacías se usan las asignaturas/permisos). */ interests?: string[] }

export interface NoticeSettings {
  /** Por evento: activado y/o texto propio (con variables como {nombre}, {fecha}, {hora}). */
  events?: Record<string, { enabled?: boolean; subject?: string; body?: string }>;
  /** Canales de la academia (por defecto todos activos; además cuenta la preferencia de cada alumno). */
  channels?: { email?: boolean; whatsapp?: boolean; webhook?: boolean };
  /** Recordatorio automático antes de cada práctica (horas; 0 = sin recordatorio). Por defecto 24. */
  reminderHours?: number;
  /** Horas de descanso: los avisos automáticos esperan a que acabe (hora local de la academia). */
  quiet?: { enabled?: boolean; from?: string; to?: string };
}

export interface Guardian extends Tenant {
  id: ID; name: string; phone: string; email: string; relation: string;
}

export type StudentStatus = 'activo' | 'inactivo' | 'nuevo' | 'baja';
export interface Student extends Tenant {
  id: ID;
  firstName: string;
  lastName: string;
  birthDate: ISODate;
  email: string;
  phone: string;
  guardianId?: ID;
  groupIds: ID[];
  status: StudentStatus;
  enrolledAt: ISODate;
  /** Fecha de baja (si status = baja). */
  leftAt?: ISODate;
  lastActivityAt: ISODateTime;
  notes: string;
  avatarHue: number;
  /** Autoescuela: horas de prácticas objetivo y permiso que prepara (p. ej. B). */
  targetHours?: number;
  permit?: string;
  /** Autoescuela: profesor asignado (el profesor solo ve a sus alumnos). */
  assignedTeacherId?: ID;
  /** Autoescuela: exámenes de la DGT (teórico/práctico) con su resultado. */
  driving?: DrivingExam[];
  /** Cómo avisar al alumno de cambios que le afectan (por defecto, correo y WhatsApp). */
  notifyVia?: 'ambos' | 'correo' | 'whatsapp' | 'nada';
}

export interface DrivingExam { id: ID; kind: 'teorico' | 'practico'; date: ISODate; result: 'pendiente' | 'aprobado' | 'suspendido' }

/** Aviso al alumno (y a su tutor si es menor) por un cambio que le afecta; el servidor lo entrega por correo y/o WhatsApp. */
export type DeliveryStatus = 'pendiente' | 'enviado' | 'fallido' | 'manual' | 'no';
export interface OutboxItem extends Tenant {
  id: ID; studentId: ID; kind: 'practica' | 'examen' | 'clase'; /** Referencia (id de práctica/examen) para unir cambios seguidos en un solo aviso. */ ref?: ID;
  to: { name: string; email?: string; phone?: string }[]; subject: string; body: string; createdAt: ISODateTime;
  emailStatus: DeliveryStatus; waStatus: DeliveryStatus; /** Integración propia (webhook firmado hacia otras herramientas). */ hookStatus?: DeliveryStatus; attempts: number; note?: string; event?: string;
}

export interface Teacher extends Tenant {
  id: ID; firstName: string; lastName: string; email: string; phone: string;
  specialty: string; subjectIds: ID[]; weeklyHoursTarget: number; active: boolean; avatarHue: number;
  /** Días de la semana disponibles (1=lun … 7=dom) */
  availability: number[];
}

export interface Subject extends Tenant { id: ID; name: string; code: string; level?: string; color: string }
export interface Classroom extends Tenant { id: ID; name: string; capacity: number }

export interface ScheduleSlot { weekday: number; start: string; end: string } // weekday 1..7, 'HH:mm'
export interface Group extends Tenant {
  id: ID; name: string; subjectId: ID; teacherId: ID; classroomId: ID;
  capacity: number; slots: ScheduleSlot[]; active: boolean;
}

export type ClassStatus = 'programada' | 'impartida' | 'cancelada';
/** Sesión concreta (instancia de un Schedule en una fecha). */
export interface ClassSession extends Tenant {
  id: ID; groupId: ID; teacherId: ID; classroomId: ID; date: ISODate; start: string; end: string; status: ClassStatus; topic?: string;
}

export type EnrollmentStatus = 'solicitud' | 'revision' | 'aceptada' | 'matriculada' | 'activa' | 'baja' | 'rechazada';
/** Datos del solicitante mientras aún no existe como alumno. */
export interface Applicant { name: string; email: string; phone: string; birthDate?: ISODate; course: string; source?: 'web' | 'lista_espera' | 'presencial';
  /** Solicitudes del formulario público: mensaje libre, tutor (si es menor) y cuándo aceptó el tratamiento de datos. */
  message?: string; guardianName?: string; guardianPhone?: string; consentAt?: ISODate;
  /** El solicitante aceptó (casilla aparte, opcional) recibir avisos por WhatsApp. */ whatsappConsent?: boolean }
export interface Enrollment extends Tenant {
  id: ID; studentId?: ID; applicant?: Applicant; groupId?: ID; status: EnrollmentStatus; createdAt: ISODate; updatedAt: ISODate;
}

export type WaitlistStatus = 'pendiente' | 'contactado' | 'aceptado' | 'rechazado' | 'matriculado';
export interface WaitlistEntry extends Tenant {
  id: ID; name: string; phone: string; email: string; course: string; level: string;
  requestedAt: ISODate; priority: 'baja' | 'media' | 'alta'; status: WaitlistStatus; birthDate?: ISODate; studentId?: ID;
}

export type AttendanceStatus = 'presente' | 'ausente' | 'retraso' | 'justificado';
export interface Attendance extends Tenant { id: ID; classId: ID; studentId: ID; status: AttendanceStatus }

export type ExamStatus = 'pendiente' | 'realizado' | 'corregido';
export interface Exam extends Tenant {
  id: ID; title: string; subjectId: ID; groupId: ID; teacherId: ID; classroomId: ID;
  date: ISODate; start: string; durationMin: number; description: string; status: ExamStatus;
}
export interface Grade extends Tenant { id: ID; examId: ID; studentId: ID; score: number | null }

export type PaymentStatus = 'pagado' | 'pendiente' | 'vencido';
export interface Payment extends Tenant {
  id: ID; studentId: ID; concept: string; amount: number; dueDate: ISODate; paidAt?: ISODate; status: PaymentStatus; method?: 'efectivo' | 'tarjeta' | 'transferencia' | 'domiciliacion'; invoiceNo?: string; remindedAt?: ISODate;
}

export type IncidentPriority = 'baja' | 'media' | 'alta' | 'critica';
export type IncidentStatus = 'pendiente' | 'en_proceso' | 'resuelto';
export interface Incident extends Tenant {
  id: ID; title: string; type: string; priority: IncidentPriority; status: IncidentStatus;
  assigneeId?: ID; createdBy?: ID; createdAt: ISODate; description: string; relatedStudentId?: ID; relatedTeacherId?: ID;
}

export type DocumentOwner = 'student' | 'teacher' | 'group' | 'enrollment';
export interface DocumentFile extends Tenant {
  id: ID; name: string; kind: 'pdf' | 'imagen' | 'documento'; ownerType: DocumentOwner; ownerId: ID; sizeKb: number; uploadedAt: ISODate;
}

export type Channel = 'app' | 'email' | 'whatsapp' | 'sms' | 'push';
export interface Notification extends Tenant {
  id: ID; title: string; body: string; level: 'info' | 'warning' | 'success'; createdAt: ISODateTime; read: boolean; href?: string;
}
export interface Message extends Tenant {
  id: ID; fromUserId: ID; toUserIds: ID[]; subject: string; body: string; channel: Channel; sentAt: ISODateTime;
  kind?: 'message' | 'announcement'; audienceGroupId?: ID; readBy?: ID[];
}

export interface ActivityLog extends Tenant {
  id: ID; at: ISODateTime; actorId: ID; actorName: string; action: string; entityType: string; entityId?: ID; summary: string;
}

/** Autoescuela: coche de prácticas. */
export type VehicleStatus = 'activo' | 'taller' | 'baja';
export interface Vehicle extends Tenant { id: ID; plate: string; model: string; km: number; status: VehicleStatus; itvDue?: ISODate; insuranceDue?: ISODate; notes?: string; color: string }
/** Autoescuela: práctica 1 a 1 (alumno + profesor + coche). */
export type PracticeStatus = 'programada' | 'hecha' | 'cancelada';
export interface Practice extends Tenant { id: ID; studentId: ID; teacherId: ID; vehicleId?: ID; date: ISODate; start: string; end: string; status: PracticeStatus; km?: number; notes?: string; seriesId?: ID;
  /** Cuándo se envió el recordatorio automático (para no repetirlo). */ remindedAt?: ISODateTime;
  /** Firmas táctiles (PNG en data URL). En el snapshot solo viaja `signed`; las imágenes se piden aparte. */
  studentSig?: string; teacherSig?: string; signed?: boolean }
