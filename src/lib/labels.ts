import type { EntityLabel } from '@/types';

/** ¿La etiqueta es femenina? Usa el indicador explícito y, si falta, infiere por la terminación. */
export const isFeminine = (l: EntityLabel) => l.f ?? /(a|ión|dad|tad|tud|umbre|ase|ule)$/i.test(l.singular.trim());
/** «Nuevo alumno» / «Nueva sesión», con el género correcto para el vocabulario de cada centro. */
export const nuevo = (l: EntityLabel) => `${isFeminine(l) ? 'Nueva' : 'Nuevo'} ${l.singular.toLowerCase()}`;
