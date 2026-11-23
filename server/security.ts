import { config } from './config';

/** Host del DSN de Sentry (si hay), para permitir el envío de errores desde el navegador. */
export const sentryHost = (dsn = config.sentryDsn): string | null => { try { return dsn ? new URL(dsn).origin : null; } catch { return null; } };

/** CSP: solo recursos propios; sin scripts en línea ni de terceros, sin plugins, sin <base> ajeno. Los estilos en línea son de React (atributo style). */
export const csp = (dsn = config.sentryDsn) => [
  "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:", "font-src 'self' data:",
  `connect-src 'self'${sentryHost(dsn) ? ' ' + sentryHost(dsn) : ''}`, "media-src 'self' blob:", "worker-src 'self'", "manifest-src 'self'",
  "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
].join('; ');

/** Funciones del navegador desactivadas salvo las que usa la app (micrófono solo en el modo personal: voz de JARVIS). */
export const PERMISSIONS_POLICY = 'camera=(), microphone=(self), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), midi=(), magnetometer=(), gyroscope=(), accelerometer=(), display-capture=(), browsing-topics=(), interest-cohort=()';

export const securityHeaders = (production = config.production): Record<string, string> => ({
  'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer', 'Cross-Origin-Resource-Policy': 'same-origin', 'Cross-Origin-Opener-Policy': 'same-origin',
  'Permissions-Policy': PERMISSIONS_POLICY, 'Content-Security-Policy': csp(),
  ...(production ? { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' } : {}),
});
