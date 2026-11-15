import { differenceInYears, parseISO } from 'date-fns';
import type { Database } from '@/data/db';
import type { Academy, AcademyType, Enrollment } from '@/types';
import { publicApplySchema } from '@/lib/schemas';

/**
 * Solicitud de matrícula pública: un formulario por negocio (`/matricula/<slug o id>`) que cualquiera puede rellenar sin cuenta.
 * La lógica es común al servidor (modo API) y al modo local de demostración. No toca el disco: quien la llama guarda los cambios.
 */
export interface PublicApplyInfo {
  key: string; name: string; tagline: string; logoUrl?: string; primary: string; secondary: string; theme: 'dark' | 'light';
  /** «Alumno», «Paciente», «Socio»… según el tipo de negocio. */ studentLabel: string;
  message: string; interestLabel: string; interests: string[]; showBirth: boolean;
}
export class PublicApplyError extends Error { constructor(message: string, public status: 400 | 404 | 422 = 400) { super(message); } }

/** Cómo se pregunta «qué te interesa» en cada tipo de negocio. */
const INTEREST: Partial<Record<AcademyType, string>> = {
  autoescuela: 'Permiso que quieres sacar', fisioterapia: 'Motivo de la consulta', psicologia: 'Motivo de la consulta', fitness: 'Actividad que te interesa', danza: 'Estilo de baile', deportiva: 'Deporte o equipo',
  infantil: 'Servicio que buscas', idiomas: 'Idioma o curso', musica: 'Instrumento o curso', oposiciones: 'Oposición', refuerzo: 'Asignatura o curso', educativa: 'Curso o asignatura', formacion: 'Curso', nautica: 'Titulación', canina: 'Servicio para tu perro', estetica: 'Servicio que buscas', artes: 'Taller que te interesa',
};

const academyOf = (db: Database, key: string): Academy | undefined => db.academies.find((a) => a.status === 'active' && (a.slug === key || a.id === key));

/** Datos públicos del formulario, o null si el negocio no existe o lo tiene desactivado. Nunca incluye datos de personas. */
export function publicApplyInfo(db: Database, key: string): PublicApplyInfo | null {
  const a = academyOf(db, key); const st = a && db.settings.find((s) => s.academyId === a.id); if (!a || !st || st.apply?.enabled === false) return null;
  const subjects = [...new Set(db.subjects.filter((s) => s.academyId === a.id).map((s) => s.name))].slice(0, 30);
  const own = (st.apply?.interests ?? []).map((x) => x.trim()).filter(Boolean).slice(0, 30);
  return {
    key, name: st.branding.name, tagline: st.branding.tagline, logoUrl: st.branding.logoUrl, primary: st.branding.primary, secondary: st.branding.secondary, theme: st.branding.theme,
    studentLabel: st.labels.student.singular, message: st.apply?.message?.trim() || `Rellena el formulario y ${st.branding.name} se pondrá en contacto contigo lo antes posible.`,
    interestLabel: INTEREST[a.type] ?? '¿Qué te interesa?', interests: own.length ? own : subjects, showBirth: true,
  };
}

export interface PublicApplyResult { ok: true; created: boolean; academyId: string; academyName: string; applicantName: string; applicantEmail: string; course: string; enrollmentId?: string }

/** Valida y registra una solicitud como «solicitud» en Matrículas, y avisa al equipo con una notificación dentro de la app. */
export function submitPublicApplication(db: Database, key: string, raw: unknown, now = new Date()): PublicApplyResult {
  const info = publicApplyInfo(db, key); const a = info && academyOf(db, key); if (!info || !a) throw new PublicApplyError('Este formulario no está disponible.', 404);
  const p = publicApplySchema.safeParse(raw); if (!p.success) throw new PublicApplyError(p.error.issues[0]?.message ?? 'Datos no válidos');
  const v = p.data; const res = (created: boolean, enrollmentId?: string): PublicApplyResult => ({ ok: true, created, academyId: a.id, academyName: info.name, applicantName: v.name, applicantEmail: v.email, course: v.interest, enrollmentId });
  // Anti-spam: señuelo relleno o envío instantáneo → se responde «ok» para no dar pistas, pero no se guarda nada.
  if (v.website || (v.elapsed !== undefined && v.elapsed < 2500)) return res(false);
  const minor = !!v.birthDate && differenceInYears(now, parseISO(v.birthDate)) < 18;
  if (minor && (!v.guardianName || (v.guardianPhone ?? '').replace(/\D/g, '').length < 9)) throw new PublicApplyError('Al ser menor de edad necesitamos el nombre y el teléfono de su madre, padre o tutor.', 422);
  // Si la misma persona ya tiene una solicitud web abierta (mismo correo o teléfono, últimos 7 días), no se duplica.
  const phone = v.phone.replace(/\D/g, ''); const since = new Date(now.getTime() - 7 * 86_400_000).toISOString().slice(0, 10);
  const dup = db.enrollments.some((e) => e.academyId === a.id && e.applicant?.source === 'web' && (e.status === 'solicitud' || e.status === 'revision') && e.createdAt >= since
    && (e.applicant.email.toLowerCase() === v.email || e.applicant.phone.replace(/\D/g, '') === phone));
  if (dup) return res(false);
  const day = now.toISOString().slice(0, 10);
  const e: Enrollment = { academyId: a.id, id: `${a.id}_enr_w${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 5)}`, status: 'solicitud', createdAt: day, updatedAt: day,
    applicant: { name: v.name, email: v.email, phone: v.phone, birthDate: v.birthDate || undefined, course: v.interest, source: 'web', message: v.message || undefined, guardianName: minor ? v.guardianName : undefined, guardianPhone: minor ? v.guardianPhone : undefined, consentAt: day, whatsappConsent: !!v.whatsappConsent } };
  db.enrollments.push(e);
  db.notifications.unshift({ academyId: a.id, id: `${a.id}_ntf_w${now.getTime().toString(36)}`, title: 'Nueva solicitud de matrícula', body: `${v.name} quiere información sobre «${v.interest}» (formulario web).`, level: 'info', createdAt: now.toISOString(), read: false, href: '/matriculas' });
  db.activity.unshift({ academyId: a.id, id: `${a.id}_act_w${now.getTime().toString(36)}`, at: now.toISOString(), actorId: 'public', actorName: 'Formulario web', action: 'creó', entityType: 'enrollment', entityId: e.id, summary: `Solicitud web de ${v.name}` });
  return res(true, e.id);
}
