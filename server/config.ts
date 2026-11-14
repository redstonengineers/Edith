import { resolve } from 'node:path';

const bool = (v: string | undefined) => v === '1' || v === 'true';
export const config = {
  port: Number(process.env.PORT ?? 4000),
  host: process.env.HOST ?? '127.0.0.1',
  dbPath: resolve(process.env.DB_PATH ?? './data/academy.db'),
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
