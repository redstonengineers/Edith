/** Entorno seguro: en Node (servidor) import.meta.env no existe. */
const env = ((import.meta as unknown as { env?: Record<string, string | undefined> }).env) ?? {};
/** "mock": datos en el navegador (demo). "api": backend real vía /api (sesión por cookie httpOnly). */
export const IS_API = env.VITE_DATA_MODE === 'api';
export const API_BASE = env.VITE_API_URL ?? '/api';
export const AI_PROVIDER = env.VITE_AI_PROVIDER;
