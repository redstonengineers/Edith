import type { Permission } from '@/lib/permissions';
import type { Snapshot } from '@/services/repositories';
import type { User } from '@/types';
import { fmtDate, fmtMoney, norm, tomorrowISO } from '@/utils/format';
import { computeAnalytics } from '../analytics';
import { computeDashboard, groupOccupancy, lowAttendanceStudents, todayAgenda } from '../metrics';
import { fullName, studentRows } from '../people';
import { buildIndex, searchIndex } from '../search';
import type { AIAnswer } from './types';

export interface Ctx { snap: Snapshot; user: User; q: string; nq: string }
export interface Intent { id: string; keywords: string[][]; needs?: Permission; run(c: Ctx): AIAnswer }

const lab = (c: Ctx) => c.snap.settings.labels;
const list = <T,>(xs: T[], n = 8) => xs.slice(0, n);

/** Todas las palabras de al menos un grupo deben aparecer (prefijo tolerante a plurales). */
export const matches = (nq: string, groups: string[][]) => groups.some((g) => g.every((w) => nq.includes(w)));

export const INTENTS: Intent[] = [
  { id: 'review', keywords: [['revisar'], ['atencion'], ['prioridad'], ['resumen'], ['pendiente', 'hoy'], ['que', 'deberia']], run: ({ snap }) => {
    const d = computeDashboard(snap);
    if (!d.alerts.length) return { text: 'Todo en orden: no hay cuestiones que requieran atención ahora mismo.', suggestions: ['¿Qué clases tengo hoy?'] };
    return { text: `Hay ${d.alerts.length} ${d.alerts.length === 1 ? 'cuestión' : 'cuestiones'} que requieren atención:`, items: d.alerts.map((a) => ({ label: a.text, href: a.href })), suggestions: ['¿Qué alumnos tienen baja asistencia?', '¿Cuánto dinero está pendiente de cobrar?'] };
  } },
  { id: 'count', keywords: [['cuantos', 'alumn'], ['cuantas', 'alumn'], ['alumnos', 'tenemos'], ['alumnos', 'activos'], ['numero', 'alumn']], run: (c) => {
    const d = computeDashboard(c.snap); const L = lab(c);
    return { text: `Hay ${d.activeStudents} ${L.student.plural.toLowerCase()} activos (${d.newStudents} nuevos), repartidos en ${c.snap.groups.filter((g) => g.active).length} ${L.group.plural.toLowerCase()}. Ocupación global: ${Math.round(d.occupancyPct)} %.`, suggestions: ['¿Qué grupos están completos?', 'Altas y bajas de este mes'] };
  } },
  { id: 'classes_tomorrow', keywords: [['manana', 'clase'], ['clases', 'manana'], ['agenda', 'manana']], run: (c) => {
    const a = todayAgenda(c.snap, new Date(), tomorrowISO()).filter((x) => x.status !== 'cancelled');
    return a.length ? { text: `Mañana hay ${a.length} ${lab(c).class.plural.toLowerCase()}:`, items: a.map((x) => ({ label: `${x.start} · ${x.title} (${x.room}, ${x.subtitle})`, href: '/horarios' })) } : { text: 'Mañana no hay clases programadas.' };
  } },
  { id: 'classes_today', keywords: [['hoy', 'clase'], ['clases', 'hoy'], ['agenda', 'hoy'], ['que', 'tengo', 'hoy']], run: (c) => {
    const a = todayAgenda(c.snap); return a.length ? { text: `Hoy hay ${a.length} ${lab(c).class.plural.toLowerCase()}:`, items: a.map((x) => ({ label: `${x.start} · ${x.title} (${x.room})${x.status === 'live' ? ' · en curso' : x.status === 'done' ? ' · terminada' : ''}`, href: '/horarios' })) } : { text: 'Hoy no hay clases programadas.', suggestions: ['¿Qué clases tengo mañana?'] };
  } },
  { id: 'attendance_low', keywords: [['asistencia', 'baja'], ['baja', 'asistencia'], ['faltan', 'mucho'], ['asistencia', 'inferior'], ['alumnos', 'asistencia']], needs: 'attendance:read', run: (c) => {
    const l = lowAttendanceStudents(c.snap); const th = c.snap.settings.attendanceAlertThreshold;
    if (!l.length) return { text: `Ningún ${lab(c).student.singular.toLowerCase()} está por debajo del ${th} % de asistencia.` };
    return { text: `${l.length} ${lab(c).student.plural.toLowerCase()} tienen asistencia inferior al ${th} %:`, items: list(l, 10).map((x) => ({ label: `${fullName(x.student)} — ${Math.round(x.rate!.pct)} %`, href: `/alumnos/${x.student.id}` })), suggestions: ['Abrir estadísticas de asistencia'] };
  } },
  { id: 'groups_full', keywords: [['grupos', 'complet'], ['completos'], ['llenos'], ['sin', 'plazas']], run: (c) => {
    const f = groupOccupancy(c.snap).filter((g) => g.full);
    return { text: f.length ? `${f.length} ${lab(c).group.plural.toLowerCase()} completos:` : 'No hay grupos completos.', items: f.map((g) => ({ label: `${g.group.name} (${g.count}/${g.group.capacity})`, href: `/grupos/${g.group.id}` })), suggestions: ['¿Qué grupos tienen plazas libres?'] };
  } },
  { id: 'groups_free', keywords: [['plazas', 'libres'], ['grupos', 'plazas'], ['hueco'], ['disponibles']], run: (c) => {
    const f = groupOccupancy(c.snap).filter((g) => !g.full).sort((a, b) => a.pct - b.pct);
    return { text: `${f.length} grupos tienen plazas libres (primero los menos ocupados):`, items: list(f, 8).map((g) => ({ label: `${g.group.name} — ${g.group.capacity - g.count} libres`, href: `/grupos/${g.group.id}` })) };
  } },
  { id: 'money', keywords: [['dinero'], ['cobrar'], ['pendiente', 'cobro'], ['impago'], ['moroso'], ['deben'], ['pagos', 'vencid'], ['quien', 'debe']], needs: 'payments:read', run: (c) => {
    const d = computeDashboard(c.snap); const cur = c.snap.settings.currency; const rows = studentRows(c.snap).filter((r) => r.overdueAmount > 0).sort((a, b) => b.overdueAmount - a.overdueAmount);
    return { text: `Pendiente de cobro: ${fmtMoney(d.pendingAmount, cur)}, de los cuales ${fmtMoney(d.overdueAmount, cur)} están vencidos (${d.overdueCount} recibos, ${rows.length} ${lab(c).student.plural.toLowerCase()}).`, items: [...list(rows, 6).map((r) => ({ label: `${r.name} — ${fmtMoney(r.overdueAmount, cur)}`, href: `/alumnos/${r.student.id}` })), { label: 'Abrir pagos', href: '/pagos' }] };
  } },
  { id: 'revenue', keywords: [['ingresos'], ['facturado'], ['cuanto', 'hemos', 'cobrado'], ['recaudado']], needs: 'payments:read', run: (c) => {
    const a = computeAnalytics(c.snap); const cur = c.snap.settings.currency; const d = a.kpis.revenue - a.kpis.revenuePrev;
    return { text: `Ingresos de este mes: ${fmtMoney(a.kpis.revenue, cur)} (${d >= 0 ? '+' : ''}${fmtMoney(d, cur)} respecto al mes anterior).`, items: [{ label: 'Ver evolución mensual', href: '/estadisticas' }] };
  } },
  { id: 'teacher_hours', keywords: [['horas', 'profesor'], ['profesores', 'horas'], ['mas', 'horas'], ['carga', 'docente']], needs: 'teachers:read', run: (c) => {
    const t = computeAnalytics(c.snap).teachers;
    return { text: `${lab(c).teacher.plural} con más horas esta semana:`, items: list(t, 6).map((x) => ({ label: `${x.name} — ${x.week.toFixed(1)} h (objetivo ${x.target} h)`, href: `/profesores/${x.id}` })) };
  } },
  { id: 'waitlist', keywords: [['lista', 'espera'], ['espera']], needs: 'waitlist:read', run: (c) => {
    const w = c.snap.waitlist.filter((x) => x.status === 'pendiente' || x.status === 'contactado');
    return { text: w.length ? `Hay ${w.length} personas en lista de espera:` : 'La lista de espera está vacía.', items: list(w, 8).map((x) => ({ label: `${x.name} · ${x.course} (${x.status}, prioridad ${x.priority})`, href: '/lista-espera' })) };
  } },
  { id: 'exams', keywords: [['proximos', 'examen'], ['examenes', 'proxim'], ['examen', 'semana'], ['hay', 'examen']], needs: 'exams:read', run: (c) => {
    const d = computeDashboard(c.snap);
    return d.upcomingExams.length ? { text: `${d.upcomingExams.length} ${lab(c).exam.plural.toLowerCase()} en los próximos 7 días:`, items: d.upcomingExams.map((e) => ({ label: `${fmtDate(e.date, 'EEE d MMM')} · ${e.title}`, href: `/examenes/${e.id}` })) } : { text: 'No hay exámenes en los próximos 7 días.' };
  } },
  { id: 'grading', keywords: [['sin', 'calificar'], ['por', 'calificar'], ['corregir'], ['pendientes', 'nota']], needs: 'grades:read', run: (c) => {
    const e = c.snap.exams.filter((x) => x.status === 'realizado');
    return e.length ? { text: `${e.length} exámenes pendientes de calificar:`, items: e.map((x) => ({ label: `${x.title} (${fmtDate(x.date)})`, href: `/examenes/${x.id}` })) } : { text: 'Todos los exámenes realizados están calificados.' };
  } },
  { id: 'incidents', keywords: [['incidencia'], ['problema'], ['averia']], needs: 'incidents:read', run: (c) => {
    const o = c.snap.incidents.filter((i) => i.status !== 'resuelto').sort((a, b) => ['critica', 'alta', 'media', 'baja'].indexOf(a.priority) - ['critica', 'alta', 'media', 'baja'].indexOf(b.priority));
    return o.length ? { text: `${o.length} incidencias abiertas (por prioridad):`, items: list(o, 8).map((i) => ({ label: `[${i.priority}] ${i.title}`, href: `/incidencias/${i.id}` })) } : { text: 'No hay incidencias abiertas.' };
  } },
  { id: 'growth', keywords: [['altas', 'bajas'], ['matriculas', 'mes'], ['evolucion'], ['crecimiento'], ['bajas']], needs: 'statistics:read', run: (c) => {
    const a = computeAnalytics(c.snap).kpis; return { text: `Este mes: ${a.newCur} altas y ${a.bajasCur} bajas (mes anterior: ${a.newPrev} y ${a.bajasPrev}).`, items: [{ label: 'Ver estadísticas', href: '/estadisticas' }] };
  } },
];

/** Resuelve menciones por nombre (alumno, profesor, grupo) y resume la ficha. */
export function entityAnswer(c: Ctx): AIAnswer | null {
  const stop = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'que', 'sobre', 'como', 'esta', 'cuantos', 'cuantas', 'dime', 'ficha', 'info', 'informacion']);
  const words = c.nq.split(/\s+/).filter((w) => w.length > 2 && !stop.has(w));
  if (!words.length) return null;
  const idx = buildIndex(c.snap); const hits = searchIndex(idx, words.slice(0, 3).join(' '), 3);
  const best = hits.find((h) => h.group === 'students' || h.group === 'teachers' || h.group === 'groups');
  if (!best) return null;
  const L = lab(c);
  if (best.group === 'students') {
    const r = studentRows(c.snap).find((x) => x.student.id === best.id); if (!r) return null;
    const pay = c.snap.payments.length ? ` Pagos: ${r.pay === 'moroso' ? `vencidos (${fmtMoney(r.overdueAmount, c.snap.settings.currency)})` : r.pay === 'pendiente' ? 'pendientes' : 'al día'}.` : '';
    return { text: `${r.name}: ${r.age} años, estado ${r.student.status}. ${L.group.plural}: ${r.groups.map((g) => g.name).join(', ') || 'ninguno'}. Asistencia: ${r.attendancePct === null ? 'sin datos' : `${Math.round(r.attendancePct)} %`}.${pay}`, items: [{ label: 'Abrir ficha', href: `/alumnos/${r.student.id}` }] };
  }
  if (best.group === 'teachers') { const t = computeAnalytics(c.snap).teachers.find((x) => x.id === best.id); return t ? { text: `${t.name}: ${t.week.toFixed(1)} h esta semana (objetivo ${t.target} h) y ${t.taught} clases impartidas.`, items: [{ label: 'Abrir ficha', href: `/profesores/${t.id}` }] } : null; }
  const g = groupOccupancy(c.snap).find((x) => x.group.id === best.id); return g ? { text: `${g.group.name}: ${g.count}/${g.group.capacity} plazas (${Math.round(g.pct)} %).`, items: [{ label: 'Abrir grupo', href: `/grupos/${g.group.id}` }] } : null;
}

export const normQ = (q: string) => norm(q).replace(/[¿?¡!.,;:]/g, ' ').replace(/\s+/g, ' ').trim();
