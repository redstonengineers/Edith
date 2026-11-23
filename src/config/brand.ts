import type { AcademyType } from '@/types';

/** Nombre del producto (único sitio donde se escribe). Se puede cambiar sin tocar el resto del código. */
export const PRODUCT_NAME = 'EDITH';
/** Nombre del asistente de IA que ven los negocios (clientes y demos). */
export const ASSISTANT_NAME = 'Asistente';
/** Nombre del asistente del modo personal del propietario: solo se usa allí. */
export const PERSONAL_ASSISTANT_NAME = 'JARVIS';

const PANEL: Partial<Record<AcademyType, string>> = {
  autoescuela: 'Panel de la autoescuela', fisioterapia: 'Panel de la clínica', psicologia: 'Panel de la clínica', estetica: 'Panel del centro', fitness: 'Panel del gimnasio',
  educativa: 'Panel de la academia', idiomas: 'Panel de la academia', oposiciones: 'Panel de la academia', refuerzo: 'Panel de la academia', formacion: 'Panel de la academia',
  musica: 'Panel de la escuela', danza: 'Panel de la escuela', deportiva: 'Panel del club', infantil: 'Panel del centro', nautica: 'Panel de la escuela náutica', canina: 'Panel del centro', artes: 'Panel de la escuela',
};
/** Título del panel principal según el tipo de negocio («Panel de la clínica», «Panel de la autoescuela»…). */
export const panelTitle = (type?: AcademyType) => (type && PANEL[type]) || 'Panel de control';
