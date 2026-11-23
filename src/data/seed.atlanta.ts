import { addDays, format, subYears } from 'date-fns';
import type { ID, Practice, Student, Teacher, Vehicle } from '@/types';
import { DEFAULT_LABELS, PRESETS } from '@/config/presets';
import type { Database } from './db';
import { createRng } from './rng';

const d = (x: Date) => format(x, 'yyyy-MM-dd');
const NAMES = ['Lucía Fernández Mora', 'Pablo Jiménez Ríos', 'Carmen Ortiz Luna', 'Álvaro Castillo Peña', 'Marta Delgado Cruz', 'Sergio Molina Vera', 'Irene Navarro Gil', 'Hugo Romero Sáez', 'Paula Herrera Díaz', 'Daniel Ruiz Campos', 'Sara Medina Ortega', 'Adrián Vega Torres', 'Noa Cabrera León', 'Iván Soto Marín'];

/** Autoescuela Atlanta (Córdoba): demo híbrida EDITH + gestión de prácticas. Usuarios @atlanta.demo. */
export function buildAtlanta(db: Database, today: Date) {
  const A = 'acad_atlanta'; const rng = createRng(4004); const uid = (p: string, i: number) => `${A}_${p}_${String(i + 1).padStart(3, '0')}`; const preset = PRESETS.autoescuela;
  db.academies.push({ id: A, name: 'Autoescuela Atlanta', type: 'autoescuela', plan: 'pro', status: 'active', isDemo: true, createdAt: d(subYears(today, 1)) });
  db.settings.push({ academyId: A, branding: { name: 'Autoescuela Atlanta', tagline: 'Prácticas, exámenes y gestión de tu autoescuela', primary: '#f97316', secondary: '#38bdf8', theme: 'light' }, labels: { ...DEFAULT_LABELS, ...preset.labels }, modules: Object.fromEntries(preset.modules.map((m) => [m, true])), locale: 'es-ES', currency: 'EUR', attendanceAlertThreshold: 75 });

  const teachers: Teacher[] = [['David', 'Ruiz'], ['Marta', 'Cano']].map(([f, l], i) => ({ academyId: A, id: uid('tea', i), firstName: f, lastName: l, email: `${f.toLowerCase()}@atlanta.demo`, phone: `6${rng.int(10, 99)} ${rng.int(100, 999)} ${rng.int(100, 999)}`, specialty: 'Permiso B', subjectIds: [], weeklyHoursTarget: 30, active: true, avatarHue: i === 0 ? 205 : 25, availability: [1, 2, 3, 4, 5] }));
  db.teachers.push(...teachers);
  db.users.push(
    { academyId: A, id: uid('usr', 0), name: 'Director Atlanta', email: 'director@atlanta.demo', role: 'ADMIN', avatarHue: 20 },
    { academyId: A, id: uid('usr', 1), name: 'David Ruiz', email: 'david@atlanta.demo', role: 'PROFESOR', teacherId: teachers[0].id, avatarHue: 205 },
    { academyId: A, id: uid('usr', 2), name: 'Marta Cano', email: 'marta@atlanta.demo', role: 'PROFESOR', teacherId: teachers[1].id, avatarHue: 25 },
  );
  const vehicles: Vehicle[] = [
    { plate: '1234 KLM', model: 'Seat Ibiza', km: 84210, status: 'activo', itvDue: d(addDays(today, 18)), insuranceDue: d(addDays(today, 140)), color: '#22c8ff' },
    { plate: '5678 PRT', model: 'Renault Clio', km: 61350, status: 'activo', itvDue: d(addDays(today, 210)), insuranceDue: d(addDays(today, 25)), color: '#a78bfa' },
    { plate: '9012 BCD', model: 'Opel Corsa', km: 120480, status: 'taller', itvDue: d(addDays(today, 90)), insuranceDue: d(addDays(today, 200)), notes: 'Cambio de embrague', color: '#fbbf24' },
  ].map((v, i) => ({ academyId: A, id: uid('veh', i), ...(v as Omit<Vehicle, 'academyId' | 'id'>) }));
  db.vehicles.push(...vehicles);

  const students: Student[] = NAMES.map((n, i) => { const [first, ...rest] = n.split(' '); return {
    academyId: A, id: uid('stu', i), firstName: first, lastName: rest.join(' '), birthDate: d(subYears(today, rng.int(18, 40))), email: `${first.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')}${i}@correo.test`, phone: `6${rng.int(10, 99)} ${rng.int(100, 999)} ${rng.int(100, 999)}`,
    groupIds: [], status: i === 13 ? 'nuevo' : 'activo', enrolledAt: d(addDays(today, -rng.int(20, 120))), lastActivityAt: today.toISOString(), notes: '', avatarHue: rng.int(0, 360), targetHours: i % 5 === 4 ? 25 : 20, permit: 'B', assignedTeacherId: teachers[i % 2].id,
  }; });
  db.students.push(...students);

  // Prácticas: tres semanas hechas y dos programadas, sin choques (cada profesor con su coche y su franja).
  const slots = ['10:00', '11:00', '16:00', '17:00']; const practices: Practice[] = []; let n = 0;
  for (let off = -21; off <= 14; off++) {
    const day = addDays(today, off); const wd = day.getDay(); if (wd === 0 || wd === 6) continue;
    teachers.forEach((t, ti) => slots.forEach((s, si) => {
      if (rng.chance(0.3)) return; const mine = students.filter((_, i) => i % 2 === ti); const stu = mine[(off + 40 + si * 3 + ti) % mine.length]; const past = off < 0 || (off === 0 && si < 2);
      const [h, m] = s.split(':').map(Number); const end = `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      practices.push({ academyId: A, id: uid('prc', n++), studentId: stu.id, teacherId: t.id, vehicleId: vehicles[ti].id, date: d(day), start: s, end, status: past ? 'hecha' : 'programada', km: past ? rng.int(18, 42) : undefined });
    }));
  }
  db.practices.push(...practices);
  db.notifications.push({ academyId: A, id: uid('ntf', 0), title: 'ITV próxima', body: 'La ITV del Seat Ibiza vence en 18 días.', level: 'warning', createdAt: today.toISOString(), read: false, href: '/coches' });
  return { teachers: teachers.map((t) => t.id) as ID[] };
}
