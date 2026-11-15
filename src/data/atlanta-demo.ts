import { addDays, differenceInCalendarDays, format, subYears } from 'date-fns';
import type { Database } from './db';
import type { DrivingExam, Enrollment, Guardian, Incident, Payment, Practice, Student, Teacher, Vehicle } from '@/types';
import { createRng } from './rng';

const d = (x: Date) => format(x, 'yyyy-MM-dd');
const FIRST = ['Lucía', 'Pablo', 'Carmen', 'Álvaro', 'Marta', 'Sergio', 'Irene', 'Hugo', 'Paula', 'Daniel', 'Sara', 'Adrián', 'Laura', 'Iván', 'Elena', 'Rubén', 'Andrea', 'Javier', 'Noelia', 'Marcos', 'Claudia', 'Diego', 'Alba', 'Raúl', 'Nuria', 'Alejandro', 'Cristina', 'Mario', 'Rocío', 'Samuel', 'Inés', 'Gonzalo', 'Teresa', 'Óscar', 'Beatriz', 'Fran'];
const LAST = ['Fernández', 'Jiménez', 'Ortiz', 'Castillo', 'Delgado', 'Molina', 'Navarro', 'Romero', 'Herrera', 'Vega', 'Aguilar', 'Serrano', 'Cabrera', 'Moreno', 'Prieto', 'Santos', 'Reyes', 'Gallego', 'Campos', 'Lara', 'Crespo', 'Flores', 'Peña', 'Rojas', 'Mora', 'Ibáñez', 'Cortés', 'Soto'];
const SIG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '');

/**
 * Llena una Autoescuela Atlanta VACÍA con datos ficticios creíbles para enseñarla a clientes: profesores, coches, ~46 alumnos
 * con su progreso, prácticas de las últimas semanas y las próximas, exámenes de la DGT con resultados, cobros, incidencias y avisos.
 * No hace nada si la academia ya tiene alumnos o prácticas, ni si ya se rellenó antes (así no pisa datos reales ni vuelve a
 * aparecer tras borrarlos). Devuelve true si ha añadido datos.
 */
export function fillAtlantaDemo(db: Database, academyId: string, today: Date = new Date()): boolean {
  const A = academyId; const acad = db.academies.find((a) => a.id === A); if (!acad || acad.demoSeeded) return false;
  /* Fichas «de relleno» que crean las altas de cuentas (alumno/profesor/tutor vacíos, de cualquier versión) y lo que cuelga de ellas
     (prácticas de prueba, cobros…) no cuentan como datos reales. */
  const ph = (x: { id: string; email?: string; firstName?: string; lastName?: string; name?: string }) => /_(stu|tea|gua)_demo$/.test(x.id) || /^(alumno|profesor|padre)@[^@]+\.(local|demo)$/i.test(x.email ?? '')
    || (/^(alumno|profesor)$/i.test(x.firstName ?? '') && /^(atlanta)?$/i.test((x.lastName ?? '').trim())) || /^padre( atlanta)?$/i.test((x.name ?? '').trim());
  const gone = new Set<string>([...db.students.filter((x) => x.academyId === A && ph(x)).map((x) => x.id), ...db.teachers.filter((x) => x.academyId === A && ph(x)).map((x) => x.id)]);
  const mine = (t: { academyId: string }[]) => t.filter((x) => x.academyId === A);
  if (db.students.some((s) => s.academyId === A && !gone.has(s.id)) || db.teachers.some((t) => t.academyId === A && !gone.has(t.id)) || db.practices.some((p) => p.academyId === A && !gone.has(p.studentId) && !gone.has(p.teacherId)) || mine(db.vehicles).length) return false;
  const drop = <T extends { academyId: string }>(arr: T[], dead: (x: T) => boolean) => { for (let i = arr.length - 1; i >= 0; i--) if (arr[i].academyId === A && dead(arr[i])) arr.splice(i, 1); };
  drop(db.students, (x) => gone.has(x.id)); drop(db.teachers, (x) => gone.has(x.id)); drop(db.guardians, (x) => ph(x)); drop(db.practices, (x) => gone.has(x.studentId) || gone.has(x.teacherId)); drop(db.payments, (x) => gone.has(x.studentId));
  drop(db.enrollments, (x) => gone.has(x.studentId as string)); drop(db.attendance, (x) => gone.has(x.studentId as string)); drop(db.grades, (x) => gone.has(x.studentId as string));
  const rng = createRng(5150); const uid = (p: string, i: number) => `${A}_dm_${p}_${String(i + 1).padStart(3, '0')}`; const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()); const todayS = d(t0);

  /* Profesores */
  const T: Teacher[] = [['David', 'Ruiz', 'Permiso B'], ['Marta', 'Cano', 'Permiso B'], ['Javier', 'Pozo', 'Permiso B'], ['Elena', 'Muñoz', 'Permiso A2 y AM (moto)']].map(([f, l, sp], i) => ({
    academyId: A, id: uid('tea', i), firstName: f, lastName: l, email: `${norm(f)}@autoescuelaatlanta.test`, phone: `6${rng.int(10, 99)} ${rng.int(100, 999)} ${rng.int(100, 999)}`, specialty: sp, subjectIds: [], weeklyHoursTarget: 30, active: true, avatarHue: [205, 25, 150, 320][i], availability: [1, 2, 3, 4, 5],
  }));
  db.teachers.push(...T);

  /* Vehículos */
  const V: Vehicle[] = [
    { plate: '1234 KLM', model: 'Seat Ibiza', km: 84210, status: 'activo', itvDue: d(addDays(t0, 18)), insuranceDue: d(addDays(t0, 140)), color: '#22c8ff' },
    { plate: '5678 PRT', model: 'Renault Clio', km: 61350, status: 'activo', itvDue: d(addDays(t0, 210)), insuranceDue: d(addDays(t0, 25)), color: '#a78bfa' },
    { plate: '9012 BCD', model: 'Opel Corsa', km: 120480, status: 'taller', itvDue: d(addDays(t0, 90)), insuranceDue: d(addDays(t0, 200)), notes: 'Cambio de embrague (vuelve en 3 días)', color: '#fbbf24' },
    { plate: '3456 HJN', model: 'Toyota Yaris', km: 38920, status: 'activo', itvDue: d(addDays(t0, 330)), insuranceDue: d(addDays(t0, 300)), color: '#34d399' },
    { plate: '7788 MXZ', model: 'Yamaha MT-125', km: 15440, status: 'activo', itvDue: d(addDays(t0, 120)), insuranceDue: d(addDays(t0, 60)), color: '#f87171' },
  ].map((v, i) => ({ academyId: A, id: uid('veh', i), ...(v as Omit<Vehicle, 'academyId' | 'id'>) }));
  db.vehicles.push(...V);
  const carOf = [V[0], V[1], V[3], V[4]]; // coche habitual de cada profesor

  /* Permisos (asignaturas), aula y grupos de teórico */
  const SUB = [['Permiso B', 'B', '#22c8ff'], ['Permiso A2', 'A2', '#f87171'], ['Permiso AM', 'AM', '#fbbf24']].map(([name, code, color], i) => ({ academyId: A, id: uid('sub', i), name, code, color }));
  db.subjects.push(...SUB); db.classrooms.push({ academyId: A, id: uid('room', 0), name: 'Aula de teoría', capacity: 24 });
  const GR = [{ name: 'Teórico B · Mañanas', sub: 0, t: 0, slots: [{ weekday: 2, start: '10:00', end: '11:30' }, { weekday: 4, start: '10:00', end: '11:30' }] }, { name: 'Teórico B · Tardes', sub: 0, t: 1, slots: [{ weekday: 1, start: '19:30', end: '21:00' }, { weekday: 3, start: '19:30', end: '21:00' }] }, { name: 'Teórico moto A2/AM', sub: 1, t: 3, slots: [{ weekday: 5, start: '18:00', end: '19:30' }] }]
    .map((g, i) => ({ academyId: A, id: uid('grp', i), name: g.name, subjectId: SUB[g.sub].id, teacherId: T[g.t].id, classroomId: uid('room', 0), capacity: 24, slots: g.slots, active: true }));
  db.groups.push(...GR);

  /* Alumnos */
  const names = new Set<string>(); const S: Student[] = []; const G: Guardian[] = []; const COUNT = 46;
  while (S.length < COUNT) {
    const f = rng.pick(FIRST); const l1 = rng.pick(LAST); const l2 = rng.pick(LAST); const key = `${f} ${l1} ${l2}`; if (names.has(key)) continue; names.add(key);
    const i = S.length; const moto = i % 7 === 3; const minor = moto && i % 14 === 3; const age = i === 0 ? 22 : minor ? rng.int(15, 17) : moto ? rng.int(18, 30) : rng.int(18, 42);
    const enrolled = i === 0 ? -95 : i === 3 ? -70 : -rng.int(i < 5 ? 3 : 8, 230);
    let guardianId: string | undefined;
    if (minor) { const g: Guardian = { academyId: A, id: uid('gua', G.length), name: `${rng.pick(FIRST)} ${l1} ${rng.pick(LAST)}`, phone: `6${rng.int(10, 99)} ${rng.int(100, 999)} ${rng.int(100, 999)}`, email: `familia.${norm(l1)}${i}@correo.test`, relation: rng.pick(['Madre', 'Padre']) }; G.push(g); guardianId = g.id; }
    const teacher = moto ? T[3] : T[i % 3];
    S.push({
      academyId: A, id: uid('stu', i), firstName: f, lastName: `${l1} ${l2}`, birthDate: d(subYears(t0, age)), email: `${norm(f)}.${norm(l1)}${i}@correo.test`, phone: `6${rng.int(10, 99)} ${rng.int(100, 999)} ${rng.int(100, 999)}`, guardianId, groupIds: [moto ? GR[2].id : i % 2 ? GR[1].id : GR[0].id],
      status: enrolled > -20 ? 'nuevo' : 'activo', enrolledAt: d(addDays(t0, enrolled)), lastActivityAt: addDays(t0, -rng.int(0, 6)).toISOString(), notes: '', avatarHue: rng.int(0, 360), targetHours: moto ? 12 : rng.pick([20, 20, 25]), permit: moto ? (minor ? 'AM' : 'A2') : 'B', assignedTeacherId: teacher.id,
      notifyVia: rng.pick(['ambos', 'ambos', 'whatsapp', 'correo']),
    });
  }
  db.guardians.push(...G);

  /* Exámenes de la DGT: teórico → práctico, con suspensos y repeticiones. */
  const passedPractical = new Map<string, string>();
  S.forEach((s) => {
    const exams: DrivingExam[] = []; let n = 0; const enr = differenceInCalendarDays(t0, new Date(s.enrolledAt)); if (enr < 28) { s.driving = exams; return; }
    const mk = (kind: DrivingExam['kind'], dayOffset: number, pass: number): boolean | null => {
      let off = dayOffset; for (let tries = 0; tries < 3; tries++) {
        if (off > 45) return null; const date = d(addDays(new Date(s.enrolledAt), off)); const future = date > todayS;
        if (future) { exams.push({ id: uid(`exa${s.id.slice(-3)}`, n++), kind, date, result: 'pendiente' }); return null; }
        const ok = rng.chance(pass); exams.push({ id: uid(`exa${s.id.slice(-3)}`, n++), kind, date, result: ok ? 'aprobado' : 'suspendido' }); if (ok) return true; off += rng.int(18, 35);
      } return false;
    };
    const t1 = mk('teorico', enr > 60 ? rng.int(22, 55) : rng.int(24, 40), .8);
    if (t1) { const last = exams[exams.length - 1].date; const base = differenceInCalendarDays(new Date(last), new Date(s.enrolledAt)); const t2 = mk('practico', base + rng.int(25, 60), .74); if (t2) passedPractical.set(s.id, exams[exams.length - 1].date); }
    s.driving = exams;
  });
  /* Alumno modelo (el que ve la cuenta «alumno»): teórico aprobado y práctico fijado la semana próxima. */
  S[0].driving = [{ id: uid('exa000', 0), kind: 'teorico', date: d(addDays(new Date(S[0].enrolledAt), 38)), result: 'aprobado' }, { id: uid('exa000', 1), kind: 'practico', date: d(addDays(t0, 9)), result: 'pendiente' }];
  passedPractical.delete(S[0].id);

  /* Al menos ~9 exámenes este mes para que el parte tenga cifras reales (con algún suspenso). */
  const inMonth = () => S.reduce((a, s) => a + (s.driving ?? []).filter((e) => e.date.slice(0, 7) === todayS.slice(0, 7) && e.result !== 'pendiente').length, 0);
  const monthStart = new Date(t0.getFullYear(), t0.getMonth(), 1); const span = Math.max(1, differenceInCalendarDays(t0, monthStart));
  for (const s of S) {
    if (inMonth() >= 9) break; const ex = s.driving ?? []; const th = ex.filter((e) => e.kind === 'teorico'); if (!th.some((e) => e.result === 'aprobado') || ex.some((e) => e.kind === 'practico')) continue;
    const date = d(addDays(monthStart, rng.int(0, span - 1))); if (date <= th[th.length - 1].date) continue;
    const ok = rng.chance(.82); ex.push({ id: uid(`exb${s.id.slice(-3)}`, 0), kind: 'practico', date, result: ok ? 'aprobado' : 'suspendido' }); s.driving = ex; if (ok) passedPractical.set(s.id, date);
  }
  db.students.push(...S);

  /* Prácticas: seis semanas hechas y dos programadas, sin choques de profesor, coche ni alumno. */
  const SLOTS = [['09:00', '10:00', '11:00', '16:00', '17:00'], ['10:00', '11:00', '12:00', '17:00', '18:00'], ['09:00', '11:00', '12:00', '16:00', '18:00'], ['10:00', '12:00', '17:00', '18:00', '19:00']]; const P: Practice[] = []; let n = 0; const busy = new Set<string>();
  for (let off = -42; off <= 14; off++) {
    const day = addDays(t0, off); const wd = day.getDay(); if (wd === 0) continue; const ds = d(day);
    T.forEach((tc, ti) => SLOTS[ti].forEach((s, si) => {
      if (wd === 6 && (ti === 1 || ti === 2 || Number(s.slice(0, 2)) > 12)) return; /* sábados: solo mañana y dos profesores */
      if (rng.chance(ti === 3 ? .5 : .3)) return;
      const nowH = new Date().getHours(); const past = off < 0 || (off === 0 && Number(s.slice(0, 2)) <= nowH);
      const pool = S.filter((x) => x.assignedTeacherId === tc.id && x.enrolledAt <= ds && x.status !== 'baja' && !busy.has(`${x.id}|${ds}`) && !(passedPractical.get(x.id) && passedPractical.get(x.id)! < ds));
      if (!pool.length) return; const stu = pool[(off + 60 + si * 5 + ti * 7) % pool.length]; busy.add(`${stu.id}|${ds}`);
      const end = `${String(Number(s.slice(0, 2)) + 1).padStart(2, '0')}:00`; const cancelled = rng.chance(.03);
      P.push({ academyId: A, id: uid('prc', n++), studentId: stu.id, teacherId: tc.id, vehicleId: carOf[ti].id, date: ds, start: s, end, status: cancelled ? 'cancelada' : past ? 'hecha' : 'programada', km: !cancelled && past ? (ti === 3 ? rng.int(10, 22) : rng.int(16, 44)) : undefined, ...(!cancelled && past && rng.chance(.85) ? { studentSig: SIG, teacherSig: SIG } : {}) });
    }));
  }
  /* Clases fijadas para el alumno modelo (S[0]) y la familia del menor (S[3]): a las 13:00 / 14:00, huecos que nadie más usa. */
  const showcase: [Student, number, string][] = [[S[0], 0, '13:00'], [S[3], 3, '14:00']]; let added = 0;
  for (const [stu, ti, hr] of showcase) for (let off = 1, k = 0; k < 3 && off < 14; off++) { const day = addDays(t0, off); if (day.getDay() === 0 || day.getDay() === 6) continue; k++; added++;
    P.push({ academyId: A, id: uid('prc', n++), studentId: stu.id, teacherId: T[ti].id, vehicleId: carOf[ti].id, date: d(day), start: hr, end: `${String(Number(hr.slice(0, 2)) + 1).padStart(2, '0')}:00`, status: 'programada' }); }
  for (const [stu, ti, hr] of showcase) for (let off = -12, k = 0; k < 4 && off < 0; off += 3) { const day = addDays(t0, off); if (day.getDay() === 0) continue; k++;
    P.push({ academyId: A, id: uid('prc', n++), studentId: stu.id, teacherId: T[ti].id, vehicleId: carOf[ti].id, date: d(day), start: hr, end: `${String(Number(hr.slice(0, 2)) + 1).padStart(2, '0')}:00`, status: 'hecha', km: rng.int(20, 38), studentSig: SIG, teacherSig: SIG }); }
  db.practices.push(...P);

  /* Cobros: matrícula + pack de prácticas en dos plazos (algunos vencidos para enseñar el seguimiento). */
  const pay: Payment[] = []; let pn = 0; let inv = 1;
  const addPay = (stu: Student, concept: string, amount: number, due: Date, paid: boolean) => {
    const m = rng.pick(['tarjeta', 'efectivo', 'transferencia', 'domiciliacion'] as const); const dueS = d(due);
    pay.push({ academyId: A, id: uid('pay', pn++), studentId: stu.id, concept, amount, dueDate: dueS, status: paid ? 'pagado' : dueS < todayS ? 'vencido' : 'pendiente', ...(paid ? { paidAt: dueS, method: m, invoiceNo: `ATL-${t0.getFullYear()}-${String(inv++).padStart(4, '0')}` } : {}) });
  };
  S.forEach((stu, i) => {
    const enr = new Date(stu.enrolledAt); const moto = stu.permit !== 'B';
    addPay(stu, 'Matrícula y tasas DGT', moto ? 150 : 180, enr, true);
    const pack = moto ? 420 : stu.targetHours === 25 ? 640 : 560; const half = pack / 2;
    addPay(stu, `${moto ? 'Pack prácticas moto' : `Pack ${stu.targetHours} prácticas`} · 1.er plazo`, half, addDays(enr, 7), true);
    const due2 = addDays(enr, 45); addPay(stu, `${moto ? 'Pack prácticas moto' : `Pack ${stu.targetHours} prácticas`} · 2.º plazo`, half, due2, due2 < t0 ? i === 0 || i % 6 !== 0 : false);
    if (stu.driving?.some((e) => e.kind === 'practico' && e.result !== 'pendiente') && i % 3 === 0) addPay(stu, 'Tasa examen práctico', 94.05, addDays(t0, -rng.int(2, 25)), true);
  });
  S.filter((_, i) => i % 1 === 0 && rng.chance(.85)).forEach((stu) => { addPay(stu, 'Práctica suelta (1 h)', 30, addDays(t0, -rng.int(0, 60)), true); });
  db.payments.push(...pay);

  /* Incidencias y avisos */
  const inc: Omit<Incident, 'academyId' | 'id'>[] = [
    { title: 'Opel Corsa en el taller', type: 'Vehículo', priority: 'media', status: 'en_proceso', createdAt: d(addDays(t0, -4)), description: 'Cambio de embrague. Se reasignan las prácticas de Javier al Toyota Yaris.', relatedTeacherId: T[2].id },
    { title: 'Reclamación de plazo de examen', type: 'Exámenes', priority: 'alta', status: 'pendiente', createdAt: d(addDays(t0, -1)), description: 'Un alumno pide adelantar la fecha del práctico por motivos laborales. Consultar con Tráfico.', relatedStudentId: S[7].id },
    { title: 'Revisión ITV del Seat Ibiza', type: 'Vehículo', priority: 'media', status: 'pendiente', createdAt: d(addDays(t0, -2)), description: 'Pedir cita previa en la ITV antes de que venza.' },
    { title: 'Retraso del alumno a la práctica del martes', type: 'Prácticas', priority: 'baja', status: 'resuelto', createdAt: d(addDays(t0, -9)), description: 'Llegó 20 min tarde; se recuperó el tiempo al final de la sesión.', relatedStudentId: S[11].id },
  ];
  db.incidents.push(...inc.map((x, i) => ({ academyId: A, id: uid('inc', i), ...x }) as Incident));
  const overdue = pay.filter((p) => p.status === 'vencido').length;
  const nowIso = new Date().toISOString();
  db.notifications.push(
    { academyId: A, id: uid('ntf', 0), title: 'ITV próxima', body: 'La ITV del Seat Ibiza vence en 18 días.', level: 'warning', createdAt: nowIso, read: false, href: '/coches' },
    { academyId: A, id: uid('ntf', 1), title: 'Seguro a punto de vencer', body: 'El seguro del Renault Clio vence en 25 días.', level: 'warning', createdAt: nowIso, read: false, href: '/coches' },
    { academyId: A, id: uid('ntf', 2), title: `${overdue} cobros vencidos`, body: 'Hay plazos de matrícula sin cobrar. Revisa Cobros.', level: 'warning', createdAt: nowIso, read: false, href: '/pagos' },
    { academyId: A, id: uid('ntf', 3), title: 'Resultados de examen', body: 'Se han anotado nuevos resultados de la DGT.', level: 'success', createdAt: nowIso, read: true, href: '/alumnos' },
  );
  acad.demoSeeded = true;
  return true;
}

/** Solicitudes de matrícula ficticias (web y presenciales) en todos los estados, para que Matrículas se vea viva. Solo si no hay ninguna. */
export function fillAtlantaEnrollments(db: Database, academyId: string, today: Date = new Date()): boolean {
  const A = academyId; const acad = db.academies.find((a) => a.id === A); if (!acad?.demoSeeded || db.enrollments.some((e) => e.academyId === A)) return false;
  const day = (off: number) => format(addDays(today, off), 'yyyy-MM-dd'); const mine = db.students.filter((s) => s.academyId === A).sort((a, b) => b.enrolledAt.localeCompare(a.enrolledAt));
  const grp = db.groups.find((g) => g.academyId === A)?.id;
  type Row = { n: string; e: string; p: string; b?: string; c: string; st: Enrollment['status']; off: number; src: 'web' | 'presencial'; msg?: string; g?: [string, string]; stu?: number };
  const rows: Row[] = [
    { n: 'Nerea Campos Gil', e: 'nerea.campos@correo.test', p: '611 204 587', b: '2004-03-12', c: 'Permiso B', st: 'solicitud', off: 0, src: 'web', msg: 'Trabajo por las mañanas, ¿tenéis clases de tarde? Me gustaría empezar este mes.' },
    { n: 'Pablo Serrano Ruiz', e: 'pablo.serrano@correo.test', p: '622 118 903', b: '1999-11-02', c: 'Permiso B', st: 'solicitud', off: -1, src: 'web' },
    { n: 'Hugo Prieto Lara', e: 'familia.prieto@correo.test', p: '633 770 142', b: d(subYears(today, 16)), c: 'Permiso AM', st: 'solicitud', off: -1, src: 'web', msg: 'Es para mi hijo, quiere sacarse el AM en verano.', g: ['Marta Lara Ortiz', '633 770 142'] },
    { n: 'Sofía Delgado Mora', e: 'sofia.delgado@correo.test', p: '644 391 276', b: '2001-07-25', c: 'Permiso A2', st: 'revision', off: -3, src: 'web', msg: '¿Qué precio tiene el pack de moto?' },
    { n: 'Iván Molina Vega', e: 'ivan.molina@correo.test', p: '655 062 418', b: '1995-01-30', c: 'Permiso B', st: 'revision', off: -4, src: 'presencial' },
    { n: 'Carla Navarro Peña', e: 'carla.navarro@correo.test', p: '666 845 093', b: '2003-09-08', c: 'Permiso B', st: 'aceptada', off: -6, src: 'web' },
    { n: 'Rubén Castillo Soto', e: 'ruben.castillo@correo.test', p: '677 513 720', b: '1998-05-17', c: 'Permiso B', st: 'matriculada', off: -9, src: 'presencial', stu: 0 },
    { n: 'Alba Herrera Cano', e: 'alba.herrera@correo.test', p: '688 427 361', b: '2002-12-21', c: 'Permiso B', st: 'activa', off: -20, src: 'web', stu: 1 },
    { n: 'Diego Romero Aguilar', e: 'diego.romero@correo.test', p: '699 306 854', b: '1997-04-04', c: 'Permiso B', st: 'activa', off: -26, src: 'presencial', stu: 2 },
    { n: 'Lola Ibáñez Cortés', e: 'lola.ibanez@correo.test', p: '610 998 235', b: '1990-08-14', c: 'Permiso B', st: 'rechazada', off: -12, src: 'web', msg: 'Busco clases solo los fines de semana.' },
  ];
  rows.forEach((r, i) => {
    const stu = r.stu !== undefined ? mine[r.stu] : undefined; const at = day(r.off);
    db.enrollments.push({ academyId: A, id: `${A}_dm_enr_${String(i + 1).padStart(3, '0')}`, status: r.st, createdAt: at, updatedAt: day(Math.min(0, r.off + (r.st === 'solicitud' ? 0 : 2))), studentId: stu?.id, groupId: r.st === 'activa' ? grp : undefined,
      applicant: { name: r.n, email: r.e, phone: r.p, birthDate: r.b, course: r.c, source: r.src, message: r.msg, guardianName: r.g?.[0], guardianPhone: r.g?.[1], consentAt: r.src === 'web' ? at : undefined } });
  });
  return true;
}
