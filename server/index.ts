import { generateDatabase } from '../src/data/seed';
import type { Database } from '../src/data/db';
import { setHasher, hashPassword } from '../src/services/crypto';
import { migrateDemoFlags, stripDemoPasswords } from './access';
import { scheduleDemoReset } from './demo';
import { installDatabase, getDatabase } from '../src/services/database';
import { DEFAULT_LABELS } from '../src/config/presets';
import { MODULES } from '../src/config/modules';
import { PRESETS } from '../src/config/presets';
import { provisionTenants } from './provision';
import { createAcademy } from '../src/services/mutations.local';
import { buildApp } from './app';
import { registerChannel } from '../src/services/channels';
import { emailChannel, mailEnabled } from './mailer';
import { webhookEnabled, whatsappEnabled } from './notifier';
import { AUTO } from '../src/services/channels';
import { config } from './config';
import { scryptHasher } from './password';
import { Store } from './store';
import { randomBytes } from 'node:crypto';

setHasher(scryptHasher);
const store = new Store(config.dbPath);
if (config.reseed) store.wipe();

/** Cuenta del propietario de la plataforma (Super Admin) a partir de BOOTSTRAP_ADMIN_*: la única cuenta con contraseña que no es de un cliente. */
async function bootstrapOwner(d: Database) {
  if (!config.bootstrapEmail || !config.bootstrapPassword) return false;
  d.academies.push({ id: 'acad_platform', name: 'Plataforma', type: 'otro', plan: 'pro', status: 'active', isDemo: false, createdAt: new Date().toISOString().slice(0, 10) });
  d.settings.push({ academyId: 'acad_platform', branding: { name: 'Plataforma', tagline: '', primary: '#8b7bff', secondary: '#f472b6', theme: 'dark' }, labels: DEFAULT_LABELS, modules: Object.fromEntries(MODULES.map((m) => [m.id, true])), locale: 'es-ES', currency: 'EUR', attendanceAlertThreshold: 75 });
  d.users.push({ academyId: 'acad_platform', id: 'acad_platform_usr_001', name: 'Propietario', email: config.bootstrapEmail, role: 'SUPER_ADMIN', avatarHue: 200, pwd: await hashPassword(config.bootstrapPassword) });
  console.warn('Super Admin creado a partir de BOOTSTRAP_ADMIN_*.'); return true;
}

let db: Database;
if (!store.isEmpty()) db = store.load();
else if (config.seedDemo) {
  db = generateDatabase(new Date()); // todos los negocios sembrados son demos (isDemo) y sus cuentas no tienen contraseña: se entra por /api/auth/demo
  console.warn('⚠ SEED_DEMO=1: datos de demostración abiertos (sin contraseña). No usar en producción.');
  await bootstrapOwner(db); // opcional: con BOOTSTRAP_ADMIN_* también hay propietario de plataforma (con contraseña)
} else {
  db = Object.fromEntries(['academies', 'settings', 'users', 'students', 'guardians', 'teachers', 'subjects', 'classrooms', 'groups', 'classes', 'enrollments', 'waitlist', 'attendance', 'exams', 'grades', 'payments', 'incidents', 'documents', 'notifications', 'messages', 'activity', 'vehicles', 'practices', 'outbox'].map((t) => [t, []])) as unknown as Database;
  if (!(await bootstrapOwner(db))) console.warn('Base vacía y sin BOOTSTRAP_ADMIN_EMAIL/PASSWORD ni SEED_DEMO: solo se podrán crear academias desde el onboarding.');
}
installDatabase(db, () => store.flush(getDatabase()));
// Migración de acceso (idempotente): marca isDemo en Atlanta, Academia y Clínica y en nada más; los demás negocios son clientes.
{
  const m = migrateDemoFlags(getDatabase()); if (m.marked.length) console.warn(`isDemo marcado en: ${m.marked.join(', ')}`);
  const clients = getDatabase().academies.filter((a) => a.isDemo !== true).map((a) => `${a.name} (${a.id})`); if (clients.length) console.warn(`Negocios SIN isDemo (se tratan como clientes con contraseña): ${clients.join(', ')}`);
}
if (config.provision) {
  const pv = config.provision;
  if (getDatabase().users.some((u) => u.email.toLowerCase() === pv.adminEmail.toLowerCase())) console.warn(`Alta automática omitida: ya existe ${pv.adminEmail}.`);
  else {
    // PROVISION_* describe la academia de demostración Atlanta: nace como demo y su administrador no tiene contraseña (se entra por el acceso demo).
    const admin = await createAcademy({ academyName: pv.academyName, type: pv.type, modules: PRESETS[pv.type].modules, adminName: pv.adminName, adminEmail: pv.adminEmail, adminPassword: randomBytes(24).toString('base64url'), primary: pv.primary ?? '#f97316' });
    const acad = getDatabase().academies.find((a) => a.id === admin.academyId)!; acad.isDemo = true; stripDemoPasswords(getDatabase());
    console.warn(`Academia de demostración «${pv.academyName}» creada con administrador ${pv.adminEmail}.`);
  }
}
if (config.tenants) { const r = await provisionTenants({ atlantaAdminEmail: config.provision?.adminEmail, atlantaDemo: process.env.ATLANTA_DEMO !== '0' }); if (r.length) console.warn(`Negocios de demostración preparados: ${r.join(', ')}`); }
store.flush(getDatabase());

if (mailEnabled()) registerChannel(emailChannel);
AUTO.email = mailEnabled(); AUTO.whatsapp = whatsappEnabled(); AUTO.webhook = webhookEnabled();
const app = buildApp(store);
await app.listen({ port: config.port, host: config.host });
scheduleDemoReset(store, (fn) => app.runExclusive(fn)); // restauración diaria de los datos de las demos
if (config.backupHours > 0) {
  const snap = () => { try { const f = store.backup(config.backupDir, config.backupKeep); console.warn(`Copia de seguridad: ${f}`); } catch (e) { console.error('Copia de seguridad fallida', e); } };
  setTimeout(snap, 30_000).unref(); setInterval(snap, config.backupHours * 3_600_000).unref();
}
for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => void app.close().then(() => process.exit(0)));
