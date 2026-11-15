import type { AcademyType, RoleId, Student, User } from '@/types';
import type { Database } from './db';

/** Negocios con acceso propio en la pantalla de inicio de sesión. Cada uno es EDITH con los módulos y perfiles que necesita. */
export interface TenantProfile { username: string; role: RoleId; label: string }
export interface TenantDef {
  slug: 'atlanta' | 'academia' | 'clinica'; card: string; name: string; tagline: string; blurb: string; type: AcademyType;
  primary: string; secondary: string; theme: 'dark' | 'light'; logo: string; profiles: TenantProfile[];
}
export const TENANTS: TenantDef[] = [
  { slug: 'atlanta', card: 'Autoescuela Atlanta', name: 'Autoescuela Atlanta', tagline: 'Prácticas, exámenes y gestión de tu autoescuela', blurb: 'Agenda de prácticas, coches, parte mensual y avisos a tus alumnos.', type: 'autoescuela', primary: '#f97316', secondary: '#38bdf8', theme: 'dark', logo: '/brand/atlanta.svg',
    profiles: [{ username: 'director', role: 'ADMIN', label: 'Director' }, { username: 'secretaria', role: 'SECRETARIA', label: 'Secretaría' }, { username: 'profesor', role: 'PROFESOR', label: 'Profesor' }, { username: 'alumno', role: 'ALUMNO', label: 'Alumno' }, { username: 'padre', role: 'TUTOR', label: 'Padre' }] },
  { slug: 'academia', card: 'Academia', name: 'Academia Horizonte', tagline: 'Refuerzo, idiomas y preparación académica', blurb: 'Grupos, horarios, asistencia, notas y pagos de tu academia.', type: 'educativa', primary: '#8b7bff', secondary: '#f472b6', theme: 'dark', logo: '/brand/academia.svg',
    profiles: [{ username: 'director', role: 'ADMIN', label: 'Director' }, { username: 'secretaria', role: 'SECRETARIA', label: 'Secretaría' }, { username: 'profesor', role: 'PROFESOR', label: 'Profesor' }, { username: 'alumno', role: 'ALUMNO', label: 'Alumno' }, { username: 'padre', role: 'TUTOR', label: 'Padre' }] },
  { slug: 'clinica', card: 'Clínica', name: 'Clínica Vitalia', tagline: 'Fisioterapia, rehabilitación y bienestar', blurb: 'Pacientes, sesiones, bonos, cabinas e informes de tu clínica.', type: 'fisioterapia', primary: '#14b8a6', secondary: '#38bdf8', theme: 'light', logo: '/brand/clinica.svg',
    profiles: [{ username: 'director', role: 'ADMIN', label: 'Director' }, { username: 'recepcion', role: 'SECRETARIA', label: 'Recepción' }, { username: 'doctor', role: 'PROFESOR', label: 'Doctor' }, { username: 'paciente', role: 'ALUMNO', label: 'Paciente' }, { username: 'familiar', role: 'TUTOR', label: 'Familiar' }] },
];
export const tenantBySlug = (slug: string) => TENANTS.find((t) => t.slug === slug);

/**
 * Garantiza (idempotente) una cuenta por perfil en cada negocio con `slug`: usuario = nombre del perfil, vinculada a una ficha
 * (profesor/alumno/tutor). Reutiliza las cuentas que ya existan con ese rol; crea lo que falte. Devuelve los usuarios nuevos o cambiados.
 * `pwd`: contraseña ya cifrada (el mismo hash para todas las cuentas de demostración); sin ella las cuentas usan la contraseña de demo del modo local.
 */
export function applyTenantAccounts(db: Database, pwd?: { salt: string; hash: string }): User[] {
  const changed: User[] = [];
  for (const def of TENANTS) {
    const acad = db.academies.find((a) => a.slug === def.slug); if (!acad) continue; const A = acad.id;
    const mine = () => db.users.filter((u) => u.academyId === A);
    const teachers = () => db.teachers.filter((t) => t.academyId === A); const students = () => db.students.filter((s) => s.academyId === A);
    const hue = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
    const ensureTeacher = () => teachers()[0] ?? (() => { const t = { academyId: A, id: `${A}_tea_demo`, firstName: 'Profesor', lastName: def.card, email: `profesor@${def.slug}.demo`, phone: '600000001', specialty: 'General', subjectIds: [], weeklyHoursTarget: 30, active: true, avatarHue: 30, availability: [1, 2, 3, 4, 5] }; db.teachers.push(t); return t; })();
    const ensureStudent = (): Student => students().find((s) => s.status !== 'baja') ?? (() => { const s: Student = { academyId: A, id: `${A}_stu_demo`, firstName: 'Alumno', lastName: def.card, birthDate: '2010-01-01', email: `alumno@${def.slug}.demo`, phone: '600000002', groupIds: [], status: 'activo', enrolledAt: new Date().toISOString().slice(0, 10), lastActivityAt: new Date().toISOString(), notes: '', avatarHue: 200 }; db.students.push(s); return s; })();
    for (const p of def.profiles) {
      let u = mine().find((x) => x.username === p.username) ?? mine().find((x) => x.role === p.role && !x.username && !x.disabled);
      let touched = false;
      if (!u) { u = { academyId: A, id: `${A}_usr_${p.username}`, name: p.label, email: `${p.username}@${def.slug}.demo`, role: p.role, avatarHue: hue(p.username) }; db.users.push(u); touched = true; }
      if (u.username !== p.username) { u.username = p.username; touched = true; }
      if (p.role === 'PROFESOR' && !(u.teacherId && teachers().some((t) => t.id === u!.teacherId))) { u.teacherId = ensureTeacher().id; touched = true; }
      if (p.role === 'ALUMNO' && !(u.studentId && students().some((s) => s.id === u!.studentId))) { u.studentId = ensureStudent().id; touched = true; }
      if (p.role === 'TUTOR' && !(u.guardianOf?.length && u.guardianOf.every((id) => students().some((s) => s.id === id)))) {
        const kid = students().find((s) => s.guardianId) ?? ensureStudent();
        if (!kid.guardianId) { const g = { academyId: A, id: `${A}_gua_demo`, name: `Padre de ${kid.firstName}`, phone: '600000003', email: `padre@${def.slug}.demo`, relation: 'Padre' }; db.guardians.push(g); kid.guardianId = g.id; }
        u.guardianOf = [kid.id]; touched = true;
      }
      if (pwd && !u.pwd) { u.pwd = { ...pwd }; touched = true; }
      if (touched) changed.push(u);
    }
    // Marca y módulos del perfil del negocio: solo rellena lo que falte (no pisa lo que el negocio haya personalizado).
    const st = db.settings.find((x) => x.academyId === A);
    if (st) { if (!st.branding.logoUrl) st.branding.logoUrl = def.logo; }
  }
  return changed;
}

/** Ficha pública de un negocio para la pantalla de acceso (sin datos de personas ni secretos). */
export interface PublicTenant { slug: TenantDef['slug']; card: string; name: string; tagline: string; blurb: string; type: AcademyType; primary: string; secondary: string; theme: 'dark' | 'light'; logo: string; profiles: TenantProfile[] }
export function publicTenants(db: Database): PublicTenant[] {
  const out: PublicTenant[] = [];
  for (const def of TENANTS) {
    const a = db.academies.find((x) => x.slug === def.slug && x.status === 'active'); const b = a && db.settings.find((s) => s.academyId === a.id)?.branding; if (!a || !b) continue;
    out.push({ slug: def.slug, card: def.card, name: b.name, tagline: b.tagline || def.tagline, blurb: def.blurb, type: a.type, primary: b.primary, secondary: b.secondary, theme: b.theme === 'light' ? 'light' : 'dark', logo: b.logoUrl ?? def.logo, profiles: def.profiles });
  }
  return out;
}
