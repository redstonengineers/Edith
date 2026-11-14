import { useMemo, useState } from 'react';
import { addMonths, format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Download, Printer } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/primitives';
import { useSnapshot } from '@/hooks';
import { fullName } from '@/lib/people';
import { fmtHours, hoursOf } from '@/lib/practices';
import { downloadCsv } from '@/lib/reports';
import { fmtDate } from '@/utils/format';

/** Parte mensual de prácticas: lo hecho en el mes (horas, kilómetros, firmas) por profesor y por coche. En pantalla, CSV e impresión. */
export default function ParteMensualPage() {
  const snap = useSnapshot(); const [month, setMonth] = useState(() => format(new Date(), 'yyyy-MM')); const base = parseISO(`${month}-01`);
  const rows = useMemo(() => snap.practices.filter((p) => p.status === 'hecha' && p.date.startsWith(month)).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)), [snap.practices, month]);
  const stu = (id: string) => { const s = snap.students.find((x) => x.id === id); return s ? `${s.firstName} ${s.lastName}` : '—'; };
  const tea = (id: string) => { const t = snap.teachers.find((x) => x.id === id); return t ? fullName(t) : '—'; };
  const veh = (id?: string) => snap.vehicles.find((x) => x.id === id);
  const agg = <K extends string>(key: (p: (typeof rows)[number]) => K) => { const m = new Map<K, { h: number; km: number; n: number }>(); rows.forEach((p) => { const c = m.get(key(p)) ?? { h: 0, km: 0, n: 0 }; c.h += hoursOf(p); c.km += p.km ?? 0; c.n++; m.set(key(p), c); }); return [...m.entries()].sort((a, b) => b[1].h - a[1].h); };
  const byTeacher = agg((p) => p.teacherId); const byCar = agg((p) => (p.vehicleId ?? '') as string); const total = rows.reduce((a, p) => a + hoursOf(p), 0); const km = rows.reduce((a, p) => a + (p.km ?? 0), 0);
  const unsigned = rows.filter((p) => !p.signed).length; const title = format(base, 'LLLL yyyy', { locale: es });
  const csv = () => downloadCsv(`parte-${month}`, { columns: ['Fecha', 'Inicio', 'Fin', 'Horas', 'Alumno', 'Profesor', 'Coche', 'Matrícula', 'Km', 'Firmada'], rows: rows.map((p) => [p.date, p.start, p.end, hoursOf(p), stu(p.studentId), tea(p.teacherId), veh(p.vehicleId)?.model ?? '', veh(p.vehicleId)?.plate ?? '', p.km ?? 0, p.signed ? 'sí' : 'no']) });
  return (
    <>
      <PageHeader title="Parte mensual" description="Prácticas hechas en el mes: horas, kilómetros y firmas." actions={<><Button onClick={csv} disabled={!rows.length}><Download size={15} />CSV</Button><Button variant="primary" onClick={() => window.print()} disabled={!rows.length}><Printer size={15} />Imprimir</Button></>} />
      <div className="mb-4 flex items-center gap-2" role="group" aria-label="Mes">
        <button className="grid h-9 w-9 place-items-center rounded-lg border border-line hover:bg-surface-2" aria-label="Mes anterior" onClick={() => setMonth(format(addMonths(base, -1), 'yyyy-MM'))}><ChevronLeft size={16} /></button>
        <input type="month" aria-label="Mes del parte" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="h-9 rounded-lg border border-line bg-surface px-3 text-sm" />
        <button className="grid h-9 w-9 place-items-center rounded-lg border border-line hover:bg-surface-2" aria-label="Mes siguiente" onClick={() => setMonth(format(addMonths(base, 1), 'yyyy-MM'))}><ChevronRight size={16} /></button>
      </div>
      <div className="print-area space-y-5">
        <div className="hidden print:block"><p className="text-xs tracking-[0.14em] uppercase">{snap.academy.name}</p><h1 className="text-2xl font-semibold">Parte mensual de prácticas · <span className="capitalize">{title}</span></h1></div>
        <div className="grid gap-3 sm:grid-cols-4">
          {[['Prácticas hechas', String(rows.length)], ['Horas', fmtHours(total)], ['Kilómetros', `${km.toLocaleString('es-ES')} km`], ['Sin firma', String(unsigned)]].map(([l, v]) => <div key={l} className="panel p-4"><p className="tnum text-2xl font-semibold">{v}</p><p className="text-xs tracking-[0.12em] text-muted uppercase">{l}</p></div>)}
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <Panel title="Por profesor">{byTeacher.length === 0 ? <p className="py-3 text-sm text-muted">Sin prácticas hechas este mes.</p> : <ul className="divide-y divide-line text-sm">{byTeacher.map(([id, c]) => <li key={id} className="flex justify-between py-2"><span>{tea(id)}</span><span className="tnum text-muted">{c.n} prácticas · {fmtHours(c.h)} · {c.km} km</span></li>)}</ul>}</Panel>
          <Panel title="Por coche">{byCar.length === 0 ? <p className="py-3 text-sm text-muted">Sin prácticas hechas este mes.</p> : <ul className="divide-y divide-line text-sm">{byCar.map(([id, c]) => <li key={id || 'none'} className="flex justify-between py-2"><span>{veh(id)?.model ?? 'Sin coche'} <span className="text-muted">{veh(id)?.plate}</span></span><span className="tnum text-muted">{c.n} prácticas · {fmtHours(c.h)} · {c.km} km</span></li>)}</ul>}</Panel>
        </div>
        <Panel title={`Prácticas de ${title}`}>
          {rows.length === 0 ? <p className="py-6 text-center text-sm text-muted">No hay prácticas hechas en este mes.</p> : (
            <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs tracking-[0.1em] text-muted uppercase"><tr><th className="py-2 pr-3">Fecha</th><th className="pr-3">Hora</th><th className="pr-3">Alumno</th><th className="pr-3">Profesor</th><th className="pr-3">Coche</th><th className="pr-3 text-right">Km</th><th>Firma</th></tr></thead>
              <tbody className="divide-y divide-line">{rows.map((p) => <tr key={p.id}><td className="tnum py-2 pr-3">{fmtDate(p.date, 'd MMM')}</td><td className="tnum pr-3">{p.start}–{p.end}</td><td className="pr-3">{stu(p.studentId)}</td><td className="pr-3">{tea(p.teacherId)}</td><td className="pr-3">{veh(p.vehicleId)?.plate ?? '—'}</td><td className="tnum pr-3 text-right">{p.km ?? '—'}</td><td>{p.signed ? '✓' : <span className="text-warn">pendiente</span>}</td></tr>)}</tbody></table></div>)}
        </Panel>
      </div>
    </>
  );
}
