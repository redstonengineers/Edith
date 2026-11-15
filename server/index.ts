import { generateDatabase } from '../src/data/seed';
import type { Database } from '../src/data/db';
import { setHasher, hashPassword } from '../src/services/crypto';
import { installDatabase, getDatabase } from '../src/services/database';
import { DEFAULT_LABELS } from '../src/config/presets';
import { MODULES } from '../src/config/modules';
import { PRESETS } from '../src/config/presets';
import { provisionTenants } from './provision';
import { createAcademy } from '../src/services/mutations.local';
import { buildApp } from './app';
import { registerChannel } from '../src/services/channels';
import { emailChannel, mailEnabled } from './mailer';
import { whatsappEnabled } from './notifier';
import { AUTO } from '../src/services/channels';
import { config } from './config';
import { scryptHasher } from './password';
import { Store } from './store';

setHasher(scryptHasher);
const store = new Store(config.dbPath);
if (config.reseed) store.wipe();

let db: Database;
if (!store.isEmpty()) db = store.load();
else if (config.seedDemo) {
  db = generateDatabase(new Date());
  const pwd = await hashPassword('demo'); // misma sal para todas las cuentas demo: solo en demo
  for (const u of db.users) u.pwd = await hashPassword('demo', pwd.salt);
  console.warn('⚠ SEED_DEMO=1: cuentas de demostración con contraseña "demo". No usar en producción.');
} else {
  db = Object.fromEntries(['academies', 'settings', 'users', 'students', 'guardians', 'teachers', 'subjects', 'classrooms', 'groups', 'classes', 'enrollments', 'waitlist', 'attendance', 'exams', 'grades', 'payments', 'incidents', 'documents', 'notifications', 'messages', 'activity', 'vehicles', 'practices', 'outbox'].map((t) => [t, []])) as unknown as Database;
  if (config.bootstrapEmail && config.bootstrapPassword) {
    db.academies.push({ id: 'acad_platform', name: 'Plataforma', type: 'otro', plan: 'pro', status: 'active', createdAt: new Date().toISOString().slice(0, 10) });
    db.settings.push({ academyId: 'acad_platform', branding: { name: 'Plataforma', tagline: '', primary: '#8b7bff', secondary: '#f472b6', theme: 'dark' }, labels: DEFAULT_LABELS, modules: Object.fromEntries(MODULES.map((m) => [m.id, true])), locale: 'es-ES', currency: 'EUR', attendanceAlertThreshold: 75 });
    db.users.push({ academyId: 'acad_platform', id: 'acad_platform_usr_001', name: 'Propietario', email: config.bootstrapEmail, role: 'SUPER_ADMIN', avatarHue: 200, pwd: await hashPassword(config.bootstrapPassword) });
    console.warn('Super Admin creado a partir de BOOTSTRAP_ADMIN_*.');
  } else console.warn('Base vacía y sin BOOTSTRAP_ADMIN_EMAIL/PASSWORD ni SEED_DEMO: solo se podrán crear academias desde el onboarding.');
}
installDatabase(db, () => store.flush(getDatabase()));
if (config.provision) {
  const pv = config.provision;
  if (getDatabase().users.some((u) => u.email.toLowerCase() === pv.adminEmail.toLowerCase())) console.warn(`Alta automática omitida: ya existe ${pv.adminEmail}.`);
  else { await createAcademy({ academyName: pv.academyName, type: pv.type, modules: PRESETS[pv.type].modules, adminName: pv.adminName, adminEmail: pv.adminEmail, adminPassword: config.tenantPassword, primary: pv.primary ?? '#f97316' }); console.warn(`Academia «${pv.academyName}» creada con administrador ${pv.adminEmail}.`); }
}
if (config.tenants) { const r = await provisionTenants({ password: config.tenantPassword, atlantaAdminEmail: config.provision?.adminEmail }); if (r.length) console.warn(`Negocios preparados: ${r.join(', ')}`); }
store.flush(getDatabase());

if (mailEnabled()) registerChannel(emailChannel);
AUTO.email = mailEnabled(); AUTO.whatsapp = whatsappEnabled();
const app = buildApp(store);
await app.listen({ port: config.port, host: config.host });
if (config.backupHours > 0) {
  const snap = () => { try { const f = store.backup(config.backupDir, config.backupKeep); console.warn(`Copia de seguridad: ${f}`); } catch (e) { console.error('Copia de seguridad fallida', e); } };
  setTimeout(snap, 30_000).unref(); setInterval(snap, config.backupHours * 3_600_000).unref();
}
for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => void app.close().then(() => process.exit(0)));
