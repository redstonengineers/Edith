import type { AcademyType, LabelKey, EntityLabel, ModuleId } from '@/types';

type Labels = Record<LabelKey, EntityLabel>;
const L = (singular: string, plural: string): EntityLabel => ({ singular, plural });

export const DEFAULT_LABELS: Labels = {
  student: L('Alumno', 'Alumnos'), teacher: L('Profesor', 'Profesores'), group: L('Grupo', 'Grupos'),
  class: L('Clase', 'Clases'), subject: L('Asignatura', 'Asignaturas'), exam: L('Examen', 'Exámenes'),
  classroom: L('Aula', 'Aulas'), enrollment: L('Matrícula', 'Matrículas'), payment: L('Pago', 'Pagos'),
  incident: L('Incidencia', 'Incidencias'), document: L('Documento', 'Documentos'),
};

export const ALL_OPTIONAL_MODULES: ModuleId[] = [
  'students', 'teachers', 'groups', 'classes', 'subjects', 'schedule', 'exams', 'grades', 'attendance',
  'applications', 'waitlist', 'enrollments', 'payments', 'billing', 'documents', 'incidents',
  'messages', 'announcements', 'notifications', 'statistics', 'reports', 'ai', 'users', 'permissions',
];

export interface Preset { label: string; labels: Partial<Labels>; modules: ModuleId[] }
const base: ModuleId[] = ['students', 'teachers', 'groups', 'classes', 'schedule', 'attendance', 'payments', 'incidents', 'notifications', 'statistics', 'ai', 'users', 'permissions'];

/** Plantillas por tipo de academia para el onboarding. */
export const PRESETS: Record<AcademyType, Preset> = {
  educativa: { label: 'Academia educativa', labels: {}, modules: [...base, 'subjects', 'exams', 'grades', 'waitlist', 'enrollments', 'applications', 'billing', 'documents', 'messages', 'announcements', 'reports'] },
  idiomas: { label: 'Idiomas', labels: { subject: L('Curso', 'Cursos'), group: L('Grupo', 'Grupos') }, modules: [...base, 'subjects', 'exams', 'grades', 'waitlist', 'enrollments', 'applications', 'announcements'] },
  musica: { label: 'Música', labels: { subject: L('Instrumento', 'Instrumentos'), class: L('Lección', 'Lecciones') }, modules: [...base, 'subjects', 'exams', 'enrollments', 'announcements'] },
  oposiciones: { label: 'Oposiciones', labels: { student: L('Opositor', 'Opositores'), subject: L('Temario', 'Temarios'), exam: L('Simulacro', 'Simulacros') }, modules: [...base, 'subjects', 'exams', 'grades', 'enrollments', 'documents'] },
  refuerzo: { label: 'Refuerzo', labels: {}, modules: [...base, 'subjects', 'exams', 'grades', 'messages', 'announcements'] },
  autoescuela: { label: 'Autoescuela', labels: { student: L('Alumno / Conductor', 'Alumnos / Conductores'), subject: L('Permiso', 'Permisos'), teacher: L('Profesor', 'Profesores'), class: L('Práctica', 'Prácticas') }, modules: [...base, 'subjects', 'exams', 'enrollments', 'documents'] },
  otro: { label: 'Otro', labels: {}, modules: base },
};
