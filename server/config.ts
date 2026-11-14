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
  /** Alta automática de una academia al arrancar (idempotente): la contraseña solo vive en esta variable de entorno. */
  provision: process.env.PROVISION_ADMIN_EMAIL && process.env.PROVISION_ADMIN_PASSWORD && process.env.PROVISION_ACADEMY_NAME ? { academyName: process.env.PROVISION_ACADEMY_NAME, type: (process.env.PROVISION_ACADEMY_TYPE ?? 'autoescuela') as import('../src/types').AcademyType, adminName: process.env.PROVISION_ADMIN_NAME ?? 'Director', adminEmail: process.env.PROVISION_ADMIN_EMAIL, adminPassword: process.env.PROVISION_ADMIN_PASSWORD, primary: process.env.PROVISION_PRIMARY } : null,
  production: process.env.NODE_ENV === 'production',
  seedDemo: bool(process.env.SEED_DEMO),
  reseed: bool(process.env.RESEED),
  /** Cookie Secure: por defecto activa en producción (requiere HTTPS). */
  cookieSecure: process.env.COOKIE_SECURE !== undefined ? bool(process.env.COOKIE_SECURE) : process.env.NODE_ENV === 'production',
  sessionHours: Number(process.env.SESSION_HOURS ?? 12),
  bootstrapEmail: process.env.BOOTSTRAP_ADMIN_EMAIL,
  bootstrapPassword: process.env.BOOTSTRAP_ADMIN_PASSWORD,
  /** Detrás de un proxy inverso confiable (nginx, Caddy…) para leer la IP real. */
  trustProxy: bool(process.env.TRUST_PROXY),
};
