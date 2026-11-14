import type { Snapshot } from '@/services/repositories';
import { norm } from '@/utils/format';

export type SearchGroup = 'students' | 'teachers' | 'groups' | 'exams' | 'documents' | 'incidents' | 'waitlist';
export interface SearchEntry { id: string; group: SearchGroup; title: string; subtitle?: string; href: string; haystack: string }

/** Índice plano del tenant. En backend real será un endpoint /search con los mismos filtros de permisos. */
export function buildIndex(snap: Snapshot): SearchEntry[] {
  const e: SearchEntry[] = [];
  const grp = (id: string) => snap.groups.find((g) => g.id === id)?.name;
  for (const s of snap.students) e.push({ id: s.id, group: 'students', title: `${s.firstName} ${s.lastName}`, subtitle: grp(s.groupIds[0]) ?? s.status, href: `/alumnos/${s.id}`, haystack: norm(`${s.firstName} ${s.lastName} ${s.email}`) });
  for (const t of snap.teachers) e.push({ id: t.id, group: 'teachers', title: `${t.firstName} ${t.lastName}`, subtitle: t.specialty, href: `/profesores/${t.id}`, haystack: norm(`${t.firstName} ${t.lastName} ${t.specialty}`) });
  for (const g of snap.groups) e.push({ id: g.id, group: 'groups', title: g.name, subtitle: snap.classrooms.find((r) => r.id === g.classroomId)?.name, href: `/grupos/${g.id}`, haystack: norm(g.name) });
  for (const x of snap.exams) e.push({ id: x.id, group: 'exams', title: x.title, subtitle: x.date, href: `/examenes/${x.id}`, haystack: norm(`${x.title} ${x.description}`) });
  for (const d of snap.documents) e.push({ id: d.id, group: 'documents', title: d.name, subtitle: d.kind.toUpperCase(), href: '/documentos', haystack: norm(d.name) });
  for (const i of snap.incidents) e.push({ id: i.id, group: 'incidents', title: i.title, subtitle: i.type, href: `/incidencias/${i.id}`, haystack: norm(`${i.title} ${i.type}`) });
  for (const w of snap.waitlist) e.push({ id: w.id, group: 'waitlist', title: w.name, subtitle: w.course, href: '/lista-espera', haystack: norm(`${w.name} ${w.course}`) });
  return e;
}

/** Todos los tokens deben aparecer; prefijo de palabra puntúa más. */
export function searchIndex(index: SearchEntry[], query: string, limitPerGroup = 4): SearchEntry[] {
  const tokens = norm(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const scored: { e: SearchEntry; s: number }[] = [];
  for (const e of index) {
    if (!tokens.every((t) => e.haystack.includes(t))) continue;
    const words = e.haystack.split(/\s+/);
    const s = tokens.reduce((a, t) => a + (words.some((w) => w.startsWith(t)) ? 2 : 1), 0) - e.haystack.length / 1000;
    scored.push({ e, s });
  }
  scored.sort((a, b) => b.s - a.s);
  const counts: Record<string, number> = {};
  return scored.filter(({ e }) => (counts[e.group] = (counts[e.group] ?? 0) + 1) <= limitPerGroup).map((x) => x.e);
}
