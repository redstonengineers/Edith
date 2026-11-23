import { resolve } from 'node:path';

const bool = (v: string | undefined) => v === '1' || v === 'true';
export const config = {
  port: Number(process.env.PORT ?? 4000),
  host: process.env.HOST ?? '127.0.0.1',
  dbPath: resolve(process.env.DB_PATH ?? './data/academy.db'),
  /** Copias automáticas de la base: cada BACKUP_HOURS h (0 = desactivadas) en BACKUP_DIR, conservando BACKUP_KEEP. */
  backupHours: Number(process.env.BACKUP_HOURS ?? 24),
  backupKeep: Number(process.env.BACKUP_KEEP ?? 7),
  backupDir: resolve(process.env.BACKUP_DIR ?? resolve(process.env.DB_PATH ?? './data/academy.db', '..', 'backups')),
  /** Alta automática de la academia real (Atlanta) al arrancar, idempotente. */
  provision: process.env.PROVISION_ADMIN_EMAIL && process.env.PROVISION_ACADEMY_NAME ? { academyName: process.env.PROVISION_ACADEMY_NAME, type: (process.env.PROVISION_ACADEMY_TYPE ?? 'autoescuela') as import('../src/types').AcademyType, adminName: process.env.PROVISION_ADMIN_NAME ?? 'Director', adminEmail: process.env.PROVISION_ADMIN_EMAIL, primary: process.env.PROVISION_PRIMARY } : null,
  /** Negocios con acceso propio (Atlanta, Academia, Clínica): se preparan al arrancar si hay PROVISION_* o TENANTS=1. */
  tenants: bool(process.env.TENANTS) || !!(process.env.PROVISION_ADMIN_EMAIL && process.env.PROVISION_ACADEMY_NAME),
  /** Cifrado de datos personales y de salud (AES-256-GCM). En producción es obligatoria; DATA_ENCRYPTION_KEY_PREVIOUS (separadas por comas) permite rotarla. */
  dataKey: process.env.DATA_ENCRYPTION_KEY?.trim() || null,
  dataKeyPrevious: (process.env.DATA_ENCRYPTION_KEY_PREVIOUS ?? '').split(',').map((x) => x.trim()).filter(Boolean),
  sentryDsn: process.env.SENTRY_DSN?.trim() || null,
  production: process.env.NODE_ENV === 'production',
  seedDemo: bool(process.env.SEED_DEMO),
  reseed: bool(process.env.RESEED),
  /** Cookie Secure: por defecto activa en producción (requiere HTTPS). */
  cookieSecure: process.env.COOKIE_SECURE !== undefined ? bool(process.env.COOKIE_SECURE) : process.env.NODE_ENV === 'production',
  sessionHours: Number(process.env.SESSION_HOURS ?? 12),
  /** Duración de la sesión cuando la persona marca «mantener la sesión iniciada». */
  rememberDays: Number(process.env.REMEMBER_DAYS ?? 30),
  /** Intentos de acceso fallidos por IP en 15 minutos, sumando todas las cuentas (frena probar muchas cuentas desde una misma red). */
  loginFailsPerIp: Number(process.env.LOGIN_FAILS_PER_IP ?? 30),
  /** Días que se conserva el registro de accesos. */
  accessLogDays: Number(process.env.ACCESS_LOG_DAYS ?? 730),
  /** Peticiones a /api por IP y minuto (los archivos estáticos no cuentan). */
  apiPerMinute: Number(process.env.API_RATE_PER_MINUTE ?? 600),
  /** Aperturas de sesión demo por IP y hora (las pruebas automáticas necesitan más). */
  demoPerHour: Number(process.env.DEMO_RATE_PER_HOUR ?? 40),
  bootstrapEmail: process.env.BOOTSTRAP_ADMIN_EMAIL,
  bootstrapPassword: process.env.BOOTSTRAP_ADMIN_PASSWORD,
  /** Detrás de un proxy inverso confiable (nginx, Caddy…) para leer la IP real. */
  trustProxy: bool(process.env.TRUST_PROXY),
};
