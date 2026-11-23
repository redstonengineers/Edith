// Migración de isDemo y arranque que no toca clientes. Uso: npx tsx tests/acceso-migracion.ts
import { generateDatabase } from '../src/data/seed';
import { migrateDemoFlags } from '../server/access';
import { prepareDemos } from '../server/provision';

let fails = 0; const ok = (c: boolean, m: string) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const db = generateDatabase(new Date());
// Base «heredada»: sin el campo isDemo (como la de producción antes de este cambio), cuentas con contraseña y negocios de cliente de por medio.
for (const a of db.academies) delete a.isDemo;
for (const u of db.users) u.pwd = { salt: 'aa', hash: 'bb' };
const mk = (id: string, name: string, slug?: string) => { db.academies.push({ id, name, type: 'educativa', plan: 'pro', status: 'active', createdAt: '2026-01-01', ...(slug ? { slug } : {}) }); db.users.push({ academyId: id, id: `${id}_u1`, name: 'Admin', email: `admin@${id}.test`, role: 'ADMIN', avatarHue: 1, pwd: { salt: 'cc', hash: `dd-${id}` }, mustChangePassword: true }); };
mk('acad_sol', 'Autoescuela Sol'); mk('acad_fake', 'Autoescuela Atlanta Norte', 'atlanta-norte'); mk('acad_demo_name', 'Clínica Demo', undefined);
db.users.push({ academyId: 'acad_demo_name', id: 'x_u2', name: 'Parece demo', email: 'director@clinica.demo', role: 'ADMIN', avatarHue: 2, pwd: { salt: 'ee', hash: 'ff' } });
const sol = JSON.stringify(db.users.filter((u) => ['acad_sol', 'acad_fake', 'acad_demo_name'].includes(u.academyId)));

const r1 = migrateDemoFlags(db);
const demos = db.academies.filter((a) => a.isDemo === true).map((a) => a.slug).sort();
ok(demos.join() === 'academia,atlanta,clinica', 'la migración marca isDemo en Atlanta, Academia y Clínica');
ok(db.academies.filter((a) => a.isDemo !== true).every((a) => a.isDemo === undefined), 'y en nada más (los demás quedan sin marcar)');
ok(['acad_sol', 'acad_fake', 'acad_demo_name'].every((id) => r1.unmarked.some((x) => x.includes(id))), 'lista los negocios sin marcar (también los que parecen demo por nombre, correo o slug parecido)');
const r2 = migrateDemoFlags(db); ok(r2.marked.length === 0 && r2.unmarked.length === r1.unmarked.length, 'es idempotente');
const at = db.academies.find((a) => a.slug === 'atlanta')!; at.isDemo = false; migrateDemoFlags(db); ok(at.isDemo === false, 'no vuelve a marcar Atlanta si se decidió que es un cliente real');
at.isDemo = true;

prepareDemos(db, { atlantaDemo: true });
ok(JSON.stringify(db.users.filter((u) => ['acad_sol', 'acad_fake', 'acad_demo_name'].includes(u.academyId))) === sol, 'el arranque no toca cuentas, contraseñas ni avisos de cambio de los clientes');
ok(db.users.filter((u) => db.academies.find((a) => a.id === u.academyId)?.isDemo === true).every((u) => !u.pwd), 'las cuentas de los negocios demo no conservan contraseña');
at.isDemo = false; for (const u of db.users.filter((x) => x.academyId === at.id)) u.pwd = { salt: 'zz', hash: 'yy' };
const before = JSON.stringify(db.users.filter((u) => u.academyId === at.id)); prepareDemos(db, { atlantaDemo: true });
ok(JSON.stringify(db.users.filter((u) => u.academyId === at.id)) === before, 'si Atlanta pasa a cliente (isDemo:false), el arranque deja de tocar sus cuentas');
console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK'); process.exit(fails ? 1 : 0);
