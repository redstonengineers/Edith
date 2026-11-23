// Topes de plan en el servidor (docs/EDITH-planes-y-precios.pdf): alumnos activos, usuarios del equipo y módulos fuera de plan.
// Uso: npx tsx tests/planes.ts
import { generateDatabase } from '../src/data/seed';
import { installDatabase, getDatabase } from '../src/services/database';
import * as M from '../src/services/mutations.local';
import { PLANS } from '../src/config/plans';

let fails = 0; const ok = (c: boolean, m: string) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const err = async (f: () => unknown) => { try { await f(); return null; } catch (e) { return e instanceof M.DomainError ? e.message : 'OTRO: ' + (e as Error).message; } };
installDatabase(generateDatabase(new Date()), () => undefined); const db = getDatabase();
const acad = db.academies.find((a) => a.type === 'autoescuela') ?? db.academies[0]; const admin = db.users.find((u) => u.academyId === acad.id && u.role === 'ADMIN')!;
const stu = (n: number) => ({ firstName: 'Test', lastName: `Alumno${n}`, birthDate: '2000-01-01', email: `t${n}@x.test`, phone: '600000000' });
ok(PLANS.basic.limits.students === 150 && PLANS.basic.limits.users === 4 && PLANS.pro.limits.students === 500 && PLANS.pro.limits.users === null && PLANS.premium.limits.students === null, 'los topes coinciden con el PDF (150/4, 500/∞, ∞/∞)');

// Alumnos: Esencial = 150 activos
acad.plan = 'basic'; const active = () => db.students.filter((s) => s.academyId === acad.id && s.status !== 'baja' && s.status !== 'inactivo').length;
let i = 0; while (active() < 150) M.createStudent(admin, stu(i++) as never);
const before = db.students.length; const e1 = await err(() => M.createStudent(admin, stu(999) as never));
ok(!!e1 && /tope de tu plan Esencial: 150 alumnos activos/.test(e1) && /No se ha perdido ningún dato/.test(e1) && /Profesional/.test(e1), 'al llegar al tope de alumnos: mensaje claro con el plan siguiente');
ok(db.students.length === before, 'y no se pierde ni se crea nada');
const e2 = await err(() => M.importStudents(admin, [stu(1001), stu(1002)] as never)); ok(!!e2 && db.students.length === before, 'importar en lote es todo o nada');
const old = db.students.find((s) => s.academyId === acad.id && s.status === 'activo')!; M.setStudentStatus(admin, old.id, 'baja'); ok(active() === 149, 'dar de baja libera plaza');
M.createStudent(admin, stu(2000) as never); ok(active() === 150, 'y se puede añadir uno nuevo');
const e3 = await err(() => M.setStudentStatus(admin, old.id, 'activo')); ok(!!e3 && /tope/.test(e3), 'reactivar a un alumno de baja también respeta el tope');
acad.plan = 'pro'; M.createStudent(admin, stu(2001) as never); ok(active() === 151, 'con Profesional (500) se puede seguir');
acad.plan = 'premium'; ok((await err(() => M.createStudent(admin, stu(2002) as never))) === null, 'Premium no tiene tope');

// Usuarios: Esencial = 4 del equipo
acad.plan = 'basic'; const team = () => db.users.filter((u) => u.academyId === acad.id && !u.disabled && u.role !== 'ALUMNO' && u.role !== 'TUTOR').length;
let k = 0; while (team() < 4) await M.createUser(admin, { name: `Equipo ${k}`, email: `eq${k++}@x.test`, role: 'SECRETARIA', password: 'Clave2026ok!' });
const e4 = await err(() => M.createUser(admin, { name: 'Otro', email: 'otro@x.test', role: 'PROFESOR', password: 'Clave2026ok!' })); ok(!!e4 && /4 usuarios del equipo/.test(e4), 'al llegar al tope de usuarios del equipo: mensaje claro');
ok((await err(() => M.createUser(admin, { name: 'Alumno acc', email: 'al@x.test', role: 'ALUMNO', password: 'Clave2026ok!' }))) === null, 'las cuentas de alumnos y tutores no cuentan para el tope');
const off = db.users.find((u) => u.academyId === acad.id && u.role === 'SECRETARIA' && u.id !== admin.id)!; M.updateUser(admin, off.id, { disabled: true }); await M.createUser(admin, { name: 'Sustituto', email: 'sust@x.test', role: 'SECRETARIA', password: 'Clave2026ok!' });
const e5 = await err(() => M.updateUser(admin, off.id, { disabled: false })); ok(!!e5 && /tope/.test(e5), 'reactivar un usuario respeta el tope');
acad.plan = 'pro'; ok((await err(() => M.createUser(admin, { name: 'Pro 1', email: 'pro1@x.test', role: 'PROFESOR', password: 'Clave2026ok!' }))) === null, 'Profesional: usuarios ilimitados');

// Módulos fuera de plan
acad.plan = 'basic'; const st = db.settings.find((s) => s.academyId === acad.id)!; st.modules.ai = false; st.modules.avisos = false; st.modules.permissions = false;
const e6 = await err(() => M.setModules(admin, { ...st.modules, ai: true })); ok(!!e6 && /Asistente.*no está incluido en tu plan/.test(e6), 'no se puede activar el Asistente de IA en Esencial');
const e7 = await err(() => M.setModules(admin, { ...st.modules, avisos: true })); ok(!!e7 && /no está incluido/.test(e7), 'ni el WhatsApp automático');
const e8 = await err(() => M.setModules(admin, { ...st.modules, permissions: true })); ok(!!e8, 'ni los permisos por rol (solo Profesional y Premium)');
acad.plan = 'pro'; ok((await err(() => M.setModules(admin, { ...st.modules, avisos: true, permissions: true }))) === null, 'en Profesional sí: avisos y permisos');
ok(!!(await err(() => M.setModules(admin, { ...st.modules, ai: true }))), 'pero el Asistente de IA sigue siendo solo de Premium');
acad.plan = 'premium'; ok((await err(() => M.setModules(admin, { ...st.modules, ai: true }))) === null, 'Premium: todo');
console.log(fails ? `${fails} FALLOS` : 'TODO OK'); process.exit(fails ? 1 : 0);
