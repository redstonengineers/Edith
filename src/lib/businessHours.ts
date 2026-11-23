import type { Snapshot } from '@/services/repositories';

const toMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return (h || 0) * 60 + (m || 0); };

/**
 * Franja horaria visible del calendario, ajustada al horario real del negocio: de la primera hora en que empieza algo (clases, prácticas,
 * exámenes, huecos de los grupos) hasta la última en que acaba, con una hora de margen. Sin datos: 8:00–20:00. Siempre entre 6:00 y 24:00 y de al menos 6 h.
 */
export function businessHours(snap: Pick<Snapshot, 'classes' | 'practices' | 'exams' | 'groups'>): [number, number] {
  const starts: number[] = []; const ends: number[] = [];
  for (const c of snap.classes) { starts.push(toMin(c.start)); ends.push(toMin(c.end)); }
  for (const p of snap.practices) { starts.push(toMin(p.start)); ends.push(toMin(p.end)); }
  for (const e of snap.exams) { starts.push(toMin(e.start)); ends.push(toMin(e.start) + e.durationMin); }
  for (const g of snap.groups) for (const s of g.slots) { starts.push(toMin(s.start)); ends.push(toMin(s.end)); }
  if (!starts.length) return [8, 20];
  let h0 = Math.max(6, Math.floor(Math.min(...starts) / 60) - 1); let h1 = Math.min(24, Math.ceil(Math.max(...ends) / 60) + 1);
  if (h1 - h0 < 6) h1 = Math.min(24, h0 + 6); if (h1 - h0 < 6) h0 = Math.max(6, h1 - 6);
  return [h0, h1];
}
