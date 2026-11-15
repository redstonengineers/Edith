import type { NoticeSettings, Settings } from '@/types';

/** Catálogo de avisos automáticos a alumnos. Cada evento tiene un texto por defecto que cada academia puede cambiar. */
export interface NoticeEvent { key: string; label: string; group: 'Prácticas' | 'Exámenes' | 'Clases'; subject: string; body: string; vars: string[] }
const PV = ['nombre', 'fecha', 'hora', 'profesor', 'escuela'];
export const NOTICE_EVENTS: NoticeEvent[] = [
  { key: 'practica_nueva', label: 'Práctica nueva', group: 'Prácticas', subject: 'Nueva práctica de conducir', body: 'Hola {nombre}, tienes una práctica de conducir el {fecha} a las {hora} con {profesor}.', vars: PV },
  { key: 'practica_serie', label: 'Prácticas semanales', group: 'Prácticas', subject: 'Prácticas de conducir cada semana', body: 'Hola {nombre}, te hemos apuntado {cantidad} prácticas de conducir, una por semana: desde el {fecha} a las {hora} con {profesor}.', vars: [...PV, 'cantidad'] },
  { key: 'practica_cambio', label: 'Cambio de hora o profesor', group: 'Prácticas', subject: 'Cambio en tu práctica de conducir', body: 'Hola {nombre}, hemos cambiado tu práctica de conducir: ahora es el {fecha} a las {hora} con {profesor}.', vars: PV },
  { key: 'practica_cancelada', label: 'Práctica cancelada', group: 'Prácticas', subject: 'Práctica de conducir cancelada', body: 'Hola {nombre}, tenemos que cancelar tu práctica de conducir del {fecha} a las {hora}. Te propondremos otra hora enseguida. Disculpa las molestias.', vars: PV },
  { key: 'practica_restaurada', label: 'Práctica restaurada', group: 'Prácticas', subject: 'Práctica de conducir confirmada', body: 'Hola {nombre}, tu práctica de conducir del {fecha} a las {hora} sigue en pie.', vars: PV },
  { key: 'practica_recordatorio', label: 'Recordatorio antes de la práctica', group: 'Prácticas', subject: 'Recordatorio de tu práctica', body: 'Hola {nombre}, te recordamos tu práctica de conducir {cuando} a las {hora} con {profesor}. Si no puedes venir, avísanos.', vars: [...PV, 'cuando'] },
  { key: 'examen_nuevo', label: 'Examen anotado', group: 'Exámenes', subject: 'Examen {tipo}', body: 'Hola {nombre}, tienes el examen {tipo} de conducir el {fecha}. ¡Mucho ánimo!', vars: ['nombre', 'fecha', 'tipo', 'escuela'] },
  { key: 'examen_aprobado', label: 'Examen aprobado', group: 'Exámenes', subject: 'Resultado de tu examen {tipo}', body: 'Hola {nombre}, ¡enhorabuena! Has aprobado el examen {tipo} de conducir.', vars: ['nombre', 'tipo', 'escuela'] },
  { key: 'examen_suspendido', label: 'Examen suspendido', group: 'Exámenes', subject: 'Resultado de tu examen {tipo}', body: 'Hola {nombre}, el examen {tipo} de conducir no ha salido esta vez. No pasa nada: hablamos para preparar el siguiente.', vars: ['nombre', 'tipo', 'escuela'] },
  { key: 'clase_cancelada', label: 'Clase cancelada', group: 'Clases', subject: 'Clase cancelada', body: 'Hola {nombre}, se cancela la clase de {materia} del {fecha} a las {hora}. Te avisaremos de la nueva fecha.', vars: ['nombre', 'materia', 'fecha', 'hora', 'escuela'] },
  { key: 'clase_cambio', label: 'Clase cambiada de día u hora', group: 'Clases', subject: 'Cambio en tu clase', body: 'Hola {nombre}, hemos cambiado la clase de {materia}: ahora es el {fecha} a las {hora}.', vars: ['nombre', 'materia', 'fecha', 'hora', 'escuela'] },
];
export const EVENT_BY_KEY = Object.fromEntries(NOTICE_EVENTS.map((e) => [e.key, e])) as Record<string, NoticeEvent>;

/** Sustituye {variables}; las que no se conocen se dejan vacías (nunca se enseña una llave sin resolver). */
export function renderTemplate(tpl: string, vars: Record<string, string | number | undefined>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? '')).replace(/[ \t]+/g, ' ').replace(/ +([.,;:!?])/g, '$1').trim();
}

export interface ResolvedNotice { enabled: boolean; subject: string; body: string }
export function resolveNotice(settings: Pick<Settings, 'notices'> | undefined, key: string): ResolvedNotice {
  const d = EVENT_BY_KEY[key]; const c = settings?.notices?.events?.[key];
  return { enabled: c?.enabled !== false, subject: c?.subject?.trim() || d.subject, body: c?.body?.trim() || d.body };
}
export const noticeChannels = (n?: NoticeSettings) => ({ email: n?.channels?.email !== false, whatsapp: n?.channels?.whatsapp !== false, webhook: n?.channels?.webhook !== false });
export const reminderHours = (n?: NoticeSettings) => { const h = n?.reminderHours; return typeof h === 'number' && h >= 0 && h <= 168 ? h : 24; };
export const quietHours = (n?: NoticeSettings) => ({ enabled: n?.quiet?.enabled !== false, from: n?.quiet?.from ?? '22:00', to: n?.quiet?.to ?? '08:00' });

/** ¿Es ahora hora de descanso? (comparando HH:MM; admite tramo que cruza la medianoche). */
export function inQuietHours(q: { enabled: boolean; from: string; to: string }, hhmm: string): boolean {
  if (!q.enabled || q.from === q.to) return false;
  return q.from < q.to ? hhmm >= q.from && hhmm < q.to : hhmm >= q.from || hhmm < q.to;
}
