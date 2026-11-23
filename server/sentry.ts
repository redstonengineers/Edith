import { config } from './config';
import { sendError } from '../src/lib/errorReport';

/** Envía un error a Sentry (si hay SENTRY_DSN) con los datos de personas ya tachados. Nunca lanza. */
export const reportError = (error: unknown, url?: string) => { if (!config.sentryDsn) return; void sendError(config.sentryDsn, { error, where: 'server', url, environment: config.production ? 'production' : 'development', release: process.env.SOURCE_COMMIT ?? process.env.npm_package_version }); };
export const installProcessHandlers = () => {
  if (!config.sentryDsn) return;
  process.on('uncaughtException', (e) => { reportError(e); console.error(e); });
  process.on('unhandledRejection', (e) => { reportError(e); console.error(e); });
};
