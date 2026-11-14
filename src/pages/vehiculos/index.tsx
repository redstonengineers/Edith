import { useState } from 'react';
import { AlertTriangle, Car, Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import { FormModal } from '@/components/ui/FormModal';
import { Badge } from '@/components/ui/primitives';
import { useAction, useCan, useSnapshot, useUser } from '@/hooks';
import { daysTo, hoursOf } from '@/lib/practices';
import { fieldErrors, vehicleSchema } from '@/lib/schemas';
import { createVehicle, updateVehicle } from '@/services/mutations';
import type { Vehicle } from '@/types';
import { fmtDate } from '@/utils/format';

const dueTone = (n: number | null) => n === null ? 'neutral' as const : n < 0 ? 'bad' as const : n <= 30 ? 'warn' as const : 'ok' as const;
const dueText = (iso?: string) => { const n = daysTo(iso); return iso && n !== null ? `${fmtDate(iso, 'd MMM yyyy')} · ${n < 0 ? `venció hace ${-n} d` : n === 0 ? 'vence hoy' : `en ${n} d`}` : '—'; };

export default function VehiculosPage() {
  const snap = useSnapshot(); const can = useCan(); const write = can('vehiculos:write'); const [open, setOpen] = useState<string | 'new' | null>(null);
  const alerts = snap.vehicles.filter((v) => v.status !== 'baja').flatMap((v) => (['itvDue', 'insuranceDue'] as const).map((k) => ({ v, k, n: daysTo(v[k]) })).filter((x) => x.n !== null && x.n <= 30).map((x) => ({ id: `${v.id}${x.k}`, text: `${x.k === 'itvDue' ? 'ITV' : 'Seguro'} de ${v.model} (${v.plate}): ${x.n! < 0 ? `vencido hace ${-x.n!} d` : x.n === 0 ? 'vence hoy' : `vence en ${x.n} d`}`, bad: x.n! < 0 })));
  const hoursBy = (id: string) => snap.practices.filter((p) => p.vehicleId === id && p.status === 'hecha').reduce((a, p) => a + hoursOf(p), 0);
  const cols: Column<Vehicle>[] = [
    { key: 'car', header: 'Coche', sort: (a, b) => a.model.localeCompare(b.model), cell: (v) => <button onClick={() => setOpen(v.id)} className="text-left font-medium hover:text-brand-text"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: v.color }} />{v.model}<span className="ml-2 text-xs text-muted">{v.plate}</span></button> },
    { key: 'st', header: 'Estado', cell: (v) => <Badge tone={v.status === 'activo' ? 'ok' : v.status === 'taller' ? 'warn' : 'neutral'}>{v.status === 'taller' ? 'En el taller' : v.status === 'baja' ? 'Ya no se usa' : 'Activo'}</Badge> },
    { key: 'km', header: 'Kilómetros', hide: 'md', sort: (a, b) => a.km - b.km, cell: (v) => <span className="tnum">{v.km.toLocaleString('es-ES')} km</span> },
    { key: 'h', header: 'Horas dadas', hide: 'lg', cell: (v) => <span className="tnum text-muted">{Math.round(hoursBy(v.id) * 10) / 10} h</span> },
    { key: 'itv', header: 'ITV', hide: 'lg', cell: (v) => <Badge tone={dueTone(daysTo(v.itvDue))}>{dueText(v.itvDue)}</Badge> },
    { key: 'seg', header: 'Seguro', hide: 'xl', cell: (v) => <Badge tone={dueTone(daysTo(v.insuranceDue))}>{dueText(v.insuranceDue)}</Badge> },
  ];
  return (
    <>
      <PageHeader title="Coches" description="Flota de prácticas: kilómetros, taller y vencimientos de ITV y seguro." actions={write && <Button variant="primary" onClick={() => setOpen('new')}><Plus size={16} />Añadir coche</Button>} />
      {alerts.length > 0 && <div role="status" className="mb-4 space-y-1.5 rounded-xl border border-warn/40 bg-warn/10 p-3.5 text-sm">{alerts.map((a) => <p key={a.id} className={`flex items-center gap-2 ${a.bad ? 'font-semibold text-bad' : 'text-warn'}`}><AlertTriangle size={14} aria-hidden />{a.text}</p>)}</div>}
      <DataTable label="Coches" rows={snap.vehicles} columns={cols} rowKey={(v) => v.id} onRowClick={(v) => setOpen(v.id)} empty={{ icon: Car, title: 'Aún no hay coches', description: 'Añade los coches de prácticas para controlar kilómetros y vencimientos.' }} />
      {open && <VehicleForm key={open} vehicle={open === 'new' ? undefined : snap.vehicles.find((v) => v.id === open)} onClose={() => setOpen(null)} />}
    </>
  );
}

function VehicleForm({ vehicle, onClose }: { vehicle?: Vehicle; onClose: () => void }) {
  const user = useUser(); const run = useAction(); const write = useCan()('vehiculos:write');
  const [f, setF] = useState({ plate: vehicle?.plate ?? '', model: vehicle?.model ?? '', km: String(vehicle?.km ?? 0), status: vehicle?.status ?? 'activo', itvDue: vehicle?.itvDue ?? '', insuranceDue: vehicle?.insuranceDue ?? '', notes: vehicle?.notes ?? '' });
  const [err, setErr] = useState<Record<string, string>>({}); const [top, setTop] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = async () => {
    setTop(null); const p = vehicleSchema.safeParse(f); if (!p.success) return setErr(fieldErrors(p.error)); setErr({});
    try { const r = vehicle ? await run(() => updateVehicle(user, vehicle.id, p.data), 'Coche actualizado') : await run(() => createVehicle(user, p.data), 'Coche añadido'); if (r) onClose(); } catch (e) { setTop((e as Error).message); }
  };
  return (
    <FormModal open onClose={onClose} title={vehicle ? `${vehicle.model} · ${vehicle.plate}` : 'Añadir coche'} onSubmit={submit} error={top} submitLabel={write ? 'Guardar' : 'Cerrar'}>
      <fieldset disabled={!write} className="grid gap-4 sm:grid-cols-2">
        <Field label="Matrícula" required error={err.plate}>{(p) => <Input {...p} data-autofocus value={f.plate} onChange={set('plate')} placeholder="1234 ABC" />}</Field>
        <Field label="Modelo" required error={err.model}>{(p) => <Input {...p} value={f.model} onChange={set('model')} placeholder="Seat Ibiza" />}</Field>
        <Field label="Kilómetros" error={err.km}>{(p) => <Input {...p} type="number" min={0} value={f.km} onChange={set('km')} />}</Field>
        <Field label="Estado">{(p) => <Select {...p} value={f.status} onChange={set('status')}><option value="activo">Activo</option><option value="taller">En el taller</option><option value="baja">Ya no se usa</option></Select>}</Field>
        <Field label="Vence la ITV" error={err.itvDue}>{(p) => <Input {...p} type="date" value={f.itvDue} onChange={set('itvDue')} />}</Field>
        <Field label="Vence el seguro" error={err.insuranceDue}>{(p) => <Input {...p} type="date" value={f.insuranceDue} onChange={set('insuranceDue')} />}</Field>
        <Field label="Notas" className="sm:col-span-2" error={err.notes}>{(p) => <Textarea {...p} rows={2} value={f.notes} onChange={set('notes')} />}</Field>
      </fieldset>
    </FormModal>
  );
}
