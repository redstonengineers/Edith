import type { Database } from './db';
/** En modo API los datos viven en el servidor: el generador demo no se incluye en el bundle del navegador. */
export function generateDatabase(): Database { throw new Error('Los datos demo no están disponibles en modo API'); }
