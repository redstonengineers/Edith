import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard, Users, GraduationCap, UsersRound, CalendarDays, BookOpen, Clock, FileText, Award,
  CheckSquare, Inbox, Hourglass, ClipboardCheck, CreditCard, Receipt, FolderOpen, AlertTriangle,
  MessageSquare, Megaphone, Bell, BarChart3, FileBarChart, Settings, UserCog, ShieldCheck, Palette,
  Sparkles, Building2, Car,
} from 'lucide-react';
import type { LabelKey, ModuleId } from '@/types';
import type { Permission } from '@/lib/permissions';

export type NavSection = 'core' | 'management' | 'evaluation' | 'admission' | 'admin' | 'communication' | 'analytics' | 'system' | 'platform';

export interface ModuleDef {
  id: ModuleId;
  path: string;
  icon: LucideIcon;
  section: NavSection;
  /** Título por defecto; si hay `labelKey` se sustituye por la etiqueta de la academia. */
  title: string;
  labelKey?: LabelKey;
  permission: Permission;
  /** Siempre activo (no se puede desactivar). */
  core?: boolean;
  /** Fase en la que se implementa la pantalla real. */
  phase: number;
  keywords?: string[];
  description: string;
}

export const SECTION_TITLES: Record<NavSection, string> = {
  core: 'Command Center', management: 'Gestión', evaluation: 'Evaluación', admission: 'Admisión',
  admin: 'Administración', communication: 'Comunicación', analytics: 'Analítica', system: 'Sistema', platform: 'Plataforma',
};
export const SECTION_ORDER: NavSection[] = ['core', 'management', 'evaluation', 'admission', 'admin', 'communication', 'analytics', 'system', 'platform'];

/** Registro único: sidebar, router, buscador y command palette se generan de aquí. */
export const MODULES: ModuleDef[] = [
  { id: 'dashboard', path: '/', icon: LayoutDashboard, section: 'core', title: 'Command Center', permission: 'dashboard:read', core: true, phase: 1, description: 'Estado global de la academia.' },
  { id: 'students', path: '/alumnos', icon: Users, section: 'management', title: 'Alumnos', labelKey: 'student', permission: 'students:read', phase: 2, description: 'Fichas, estado, asistencia y pagos.' },
  { id: 'teachers', path: '/profesores', icon: GraduationCap, section: 'management', title: 'Profesores', labelKey: 'teacher', permission: 'teachers:read', phase: 2, description: 'Equipo docente, disponibilidad y carga.' },
  { id: 'groups', path: '/grupos', icon: UsersRound, section: 'management', title: 'Grupos', labelKey: 'group', permission: 'groups:read', phase: 2, description: 'Grupos, aulas y ocupación.' },
  { id: 'classes', path: '/clases', icon: CalendarDays, section: 'management', title: 'Clases', labelKey: 'class', permission: 'classes:read', phase: 3, description: 'Sesiones programadas e impartidas.' },
  { id: 'subjects', path: '/asignaturas', icon: BookOpen, section: 'management', title: 'Asignaturas', labelKey: 'subject', permission: 'subjects:read', phase: 2, description: 'Catálogo de asignaturas, cursos o permisos.' },
  { id: 'schedule', path: '/horarios', icon: Clock, section: 'management', title: 'Horarios', permission: 'schedule:read', phase: 3, keywords: ['calendario'], description: 'Calendario con detección de conflictos.' },
  { id: 'exams', path: '/examenes', icon: FileText, section: 'evaluation', title: 'Exámenes', labelKey: 'exam', permission: 'exams:read', phase: 3, description: 'Convocatorias y corrección.' },
  { id: 'grades', path: '/calificaciones', icon: Award, section: 'evaluation', title: 'Calificaciones', permission: 'grades:read', phase: 3, keywords: ['notas'], description: 'Notas por examen y alumno.' },
  { id: 'attendance', path: '/asistencia', icon: CheckSquare, section: 'evaluation', title: 'Asistencia', permission: 'attendance:read', phase: 3, keywords: ['faltas'], description: 'Registro rápido por clase.' },
  { id: 'applications', path: '/solicitudes', icon: Inbox, section: 'admission', title: 'Solicitudes', permission: 'applications:read', phase: 4, description: 'Solicitudes de admisión.' },
  { id: 'waitlist', path: '/lista-espera', icon: Hourglass, section: 'admission', title: 'Lista de espera', permission: 'waitlist:read', phase: 4, description: 'Candidatos pendientes de plaza.' },
  { id: 'enrollments', path: '/matriculas', icon: ClipboardCheck, section: 'admission', title: 'Matrículas', labelKey: 'enrollment', permission: 'enrollments:read', phase: 4, description: 'Flujo de matrícula.' },
  { id: 'payments', path: '/pagos', icon: CreditCard, section: 'admin', title: 'Pagos', labelKey: 'payment', permission: 'payments:read', phase: 4, description: 'Cobros, pendientes y vencidos.' },
  { id: 'billing', path: '/facturacion', icon: Receipt, section: 'admin', title: 'Facturación', permission: 'billing:read', phase: 4, description: 'Facturas y recibos.' },
  { id: 'vehiculos', path: '/coches', icon: Car, section: 'management', title: 'Coches', permission: 'vehiculos:read', phase: 10, keywords: ['vehiculos', 'flota', 'itv', 'seguro', 'taller'], description: 'Flota: kilómetros, taller y vencimientos de ITV y seguro.' },
  { id: 'avisos', path: '/avisos-alumnos', icon: Bell, section: 'communication', title: 'Avisos a alumnos', permission: 'practicas:write', phase: 10, keywords: ['avisos', 'whatsapp', 'correo', 'notificar', 'alumno'], description: 'Avisos automáticos al alumno por correo y WhatsApp.' },
  { id: 'parte', path: '/parte', icon: FileBarChart, section: 'analytics', title: 'Parte mensual', permission: 'reports:read', phase: 10, keywords: ['informe', 'parte', 'csv', 'mensual'], description: 'Parte mensual de prácticas: horas, kilómetros y firmas, en pantalla, CSV e impresión.' },
  { id: 'practicas', path: '/practicas', icon: Car, section: 'management', title: 'Prácticas', permission: 'practicas:read', phase: 10, keywords: ['practicas', 'conducir', 'clases'], description: 'Calendario de prácticas 1 a 1: alumno, profesor y coche, con avisos de choque.' },
  { id: 'documents', path: '/documentos', icon: FolderOpen, section: 'admin', title: 'Documentos', labelKey: 'document', permission: 'documents:read', phase: 4, description: 'Archivo documental por entidad.' },
  { id: 'incidents', path: '/incidencias', icon: AlertTriangle, section: 'admin', title: 'Incidencias', labelKey: 'incident', permission: 'incidents:read', phase: 4, description: 'Seguimiento de incidencias.' },
  { id: 'messages', path: '/mensajes', icon: MessageSquare, section: 'communication', title: 'Mensajes', permission: 'messages:read', phase: 4, description: 'Mensajería interna.' },
  { id: 'announcements', path: '/avisos', icon: Megaphone, section: 'communication', title: 'Avisos', permission: 'announcements:read', phase: 4, description: 'Comunicados a grupos.' },
  { id: 'notifications', path: '/notificaciones', icon: Bell, section: 'communication', title: 'Notificaciones', permission: 'notifications:read', phase: 4, description: 'Centro de notificaciones.' },
  { id: 'statistics', path: '/estadisticas', icon: BarChart3, section: 'analytics', title: 'Estadísticas', permission: 'statistics:read', phase: 5, description: 'Métricas y evolución.' },
  { id: 'reports', path: '/informes', icon: FileBarChart, section: 'analytics', title: 'Informes', permission: 'reports:read', phase: 5, description: 'Informes exportables.' },
  { id: 'ai', path: '/jarvis', icon: Sparkles, section: 'analytics', title: 'JARVIS AI', permission: 'ai:read', phase: 6, keywords: ['ia', 'asistente'], description: 'Asistente inteligente.' },
  { id: 'settings', path: '/configuracion', icon: Settings, section: 'system', title: 'Configuración', permission: 'settings:read', core: true, phase: 7, description: 'Ajustes generales.' },
  { id: 'users', path: '/usuarios', icon: UserCog, section: 'system', title: 'Usuarios', permission: 'users:read', phase: 8, description: 'Cuentas de acceso.' },
  { id: 'permissions', path: '/permisos', icon: ShieldCheck, section: 'system', title: 'Permisos', permission: 'permissions:read', phase: 8, description: 'Matriz de roles.' },
  { id: 'customization', path: '/personalizacion', icon: Palette, section: 'system', title: 'Personalización', permission: 'customization:read', core: true, phase: 7, keywords: ['marca', 'colores', 'logo'], description: 'Marca, colores, etiquetas y módulos.' },
  { id: 'platform', path: '/plataforma', icon: Building2, section: 'platform', title: 'Plataforma (Super Admin)', permission: 'platform:read', core: true, phase: 7, description: 'Academias, suscripciones y uso.' },
];

export const MODULE_BY_ID = Object.fromEntries(MODULES.map((m) => [m.id, m])) as Record<ModuleId, ModuleDef>;
