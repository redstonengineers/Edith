import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Hourglass, Phone, Plus, UserCheck } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { FilterChips, SearchInput } from '@/components/ui/controls';
import { Field, Input, Select } from '@/components/ui/form';
import { FormModal } from '@/components/ui/FormModal';
import { Badge } from '@/components/ui/primitives';
import { useAction, useCan, useLabels, usePersistentState, useSnapshot, useUser } from '@/hooks';
import { fieldErrors, convertSchema, waitlistSchema } from '@/lib/schemas';
import { convertWaitlist, createWaitlistEntry, setWaitlistPriority, setWaitlistStatus } from '@/services/mutations';
import type { WaitlistEntry, WaitlistStatus } from '@/types';
import { fmtDate, norm } from '@/utils/format';
import { GroupSelect } from './shared';
import { useNavigate } from 'react-router-dom';

const tone = { pendiente: 'warn', contactado: 'info', aceptado: 'brand', rechazado: 'neutral', matriculado: 'ok' } as const;
const PRI = { alta: 0, media: 1, baja: 2 } as const;
type F = 'abiertos' | WaitlistStatus | 'todos';

function NewEntry({ onClose }: { onClose: () => void }) {
  const user = useUser(); const run = useAction();
  const [f, setF] = useState({ name: '', email: '', phone: '', course: '', level: 'Inicial', priority: 'media', birthDate: '' }); const [err, setErr] = useState<Record<string, string>>({});
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = async () => { const p = waitlistSchema.safeParse(f); if (!p.success) return setErr(fieldErrors(p.error)); if (await run(() => createWaitlistEntry(user, p.data), 'Añadido a la lista de espera')) onClose(); };
  return (
    <FormModal open onClose={onClose} title="Añadir a la lista de espera" onSubmit={submit} wide>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre completo" required error={err.name} className="sm:col-span-2">{(p) => <Input {...p} data-autofocus value={f.name} onChange={set('name')} />}</Field>
        <Field label="Correo" required error={err.email}>{(p) => <Input {...p} type="email" value={f.email} onChange={set('email')} />}</Field>
        <Field label="Teléfono" required error={err.phone}>{(p) => <Input {...p} type="tel" value={f.phone} onChange={set('phone')} />}</Field>
        <Field label="Curso" required error={err.course}>{(p) => <Input {...p} value={f.course} onChange={set('course')} />}</Field>
        <Field label="Nivel" required error={err.level}>{(p) => <Input {...p} value={f.level} onChange={set('level')} />}</Field>
        <Field label="Prioridad">{(p) => <Select {...p} value={f.priority} onChange={set('priority')}><option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option></Select>}</Field>
        <Field label="Fecha de nacimiento (opcional)" error={err.birthDate} hint="Evita pedirla al convertir en alumno.">{(p) => <Input {...p} type="date" value={f.birthDate} onChange={set('birthDate')} />}</Field>
      </div>
    </FormModal>
  );
}

function Convert({ w, onClose }: { w: WaitlistEntry; onClose: () => void }) {
  const user = useUser(); const run = useAction(); const L = useLabels(); const nav = useNavigate();
  const [birth, setBirth] = useState(w.birthDate ?? ''); const [g, setG] = useState(''); const [err, setErr] = useState<Record<string, string>>({}); const [top, setTop] = useState<string | null>(null);
  const submit = async () => {
    const p = convertSchema.safeParse({ birthDate: birth, groupId: g || undefined }); if (!p.success) return setErr(fieldErrors(p.error)); setErr({});
    try { const s = await run(() => convertWaitlist(user, w.id, p.data), `${w.name} ya es ${L.student.singular.toLowerCase()}`); if (s) { onClose(); nav(`/alumnos/${s.id}`); } } catch (e) { setTop((e as Error).message); }
  };
  return (
    <FormModal open onClose={onClose} title={`Convertir en ${L.student.singular.toLowerCase()}`} description="Se reutilizan sus datos de contacto; solo falta lo imprescindible." submitLabel="Crear ficha" onSubmit={submit} error={top}>
      <div className="rounded-lg border border-line bg-surface-2/50 p-3 text-sm"><p className="font-medium">{w.name}</p><p className="text-muted">{w.email} · {w.phone}</p><p className="text-muted">{w.course} · {w.level}</p></div>
      <Field label="Fecha de nacimiento" required error={err.birthDate}>{(p) => <Input {...p} data-autofocus type="date" value={birth} onChange={(e) => setBirth(e.target.value)} />}</Field>
      <GroupSelect value={g} onChange={setG} course={w.course} error={err.groupId} />
    </FormModal>
  );
}

export default function WaitlistPage() {
  const snap = useSnapshot(); const L = useLabels(); const can = useCan(); const user = useUser(); const run = useAction();
  const [f, setF] = usePersistentState<F>('ac.wl.f', 'abiertos'); const [q, setQ] = usePersistentState('ac.wl.q', '');
  const [adding, setAdding] = useState(false); const [conv, setConv] = useState<WaitlistEntry | null>(null);
  const write = can('waitlist:write');
  const open = (w: WaitlistEntry) => w.status === 'pendiente' || w.status === 'contactado' || w.status === 'aceptado';
  const nq = norm(q).split(/\s+/).filter(Boolean);
  const rows = useMemo(() => snap.waitlist.filter((w) => (f === 'todos' ? true : f === 'abiertos' ? open(w) : w.status === f)).filter((w) => { const h = norm(`${w.name} ${w.course} ${w.email}`); return nq.every((t) => h.includes(t)); }), [snap.waitlist, f, nq.join(' ')]);
  const cnt = (s: F) => snap.waitlist.filter((w) => (s === 'todos' ? true : s === 'abiertos' ? open(w) : w.status === s)).length;
  const st = (w: WaitlistEntry, s: 'contactado' | 'aceptado' | 'rechazado', msg: string) => void run(() => setWaitlistStatus(user, w.id, s), msg);

  const cols: Column<WaitlistEntry>[] = [
    { key: 'n', header: 'Persona', sort: (a, b) => a.name.localeCompare(b.name, 'es'), cell: (w) => <div><p className="font-medium">{w.name}</p><p className="text-xs text-muted">{w.phone} · {w.email}</p></div> },
    { key: 'c', header: 'Curso / nivel', hide: 'md', cell: (w) => <div><p>{w.course}</p><p className="text-xs text-muted">{w.level}</p></div> },
    { key: 'd', header: 'Solicitud', hide: 'lg', sort: (a, b) => a.requestedAt.localeCompare(b.requestedAt), cell: (w) => <span className="tnum text-muted">{fmtDate(w.requestedAt)}</span> },
    { key: 'p', header: 'Prioridad', sort: (a, b) => PRI[a.priority] - PRI[b.priority], cell: (w) => write && open(w) ? <select aria-label={`Prioridad de ${w.name}`} value={w.priority} onChange={(e) => void run(() => setWaitlistPriority(user, w.id, e.target.value as WaitlistEntry['priority']), 'Prioridad actualizada')} className="h-8 rounded-md border border-line bg-bg px-1.5 text-xs"><option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option></select> : <Badge tone={w.priority === 'alta' ? 'bad' : w.priority === 'media' ? 'warn' : 'neutral'}>{w.priority}</Badge> },
    { key: 's', header: 'Estado', cell: (w) => <Badge tone={tone[w.status]}>{w.status}</Badge> },
    ...(write ? [{ key: 'a', header: 'Acciones', align: 'right', cell: (w: WaitlistEntry) => w.status === 'matriculado' ? (w.studentId ? <Link to={`/alumnos/${w.studentId}`} className="text-xs text-brand-text hover:underline">Ver ficha</Link> : null) : (
      <div className="flex flex-wrap justify-end gap-1.5">
        {w.status === 'pendiente' && <Button size="sm" onClick={() => st(w, 'contactado', 'Marcado como contactado')}><Phone size={13} />Contactado</Button>}
        {(w.status === 'pendiente' || w.status === 'contactado') && <Button size="sm" onClick={() => st(w, 'aceptado', 'Aceptado')}>Aceptar</Button>}
        {w.status !== 'rechazado' && <Button size="sm" variant="ghost" onClick={() => st(w, 'rechazado', 'Rechazado')}>Rechazar</Button>}
        {can('students:write') && w.status !== 'rechazado' && <Button size="sm" variant="primary" onClick={() => setConv(w)}><UserCheck size={13} />Convertir en {L.student.singular.toLowerCase()}</Button>}
      </div>) } as Column<WaitlistEntry>] : []),
  ];
  return (
    <>
      <PageHeader title="Lista de espera" description={`${cnt('abiertos')} personas pendientes de plaza`} actions={write && <Button variant="primary" onClick={() => setAdding(true)}><Plus size={16} />Añadir</Button>} />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FilterChips<F> label="Estado" value={f} onChange={setF} options={[{ id: 'abiertos', label: 'Abiertos', count: cnt('abiertos') }, ...(['pendiente', 'contactado', 'aceptado', 'rechazado', 'matriculado'] as const).map((s) => ({ id: s as F, label: s[0].toUpperCase() + s.slice(1), count: cnt(s) })), { id: 'todos', label: 'Todos' }]} />
        <SearchInput value={q} onChange={setQ} placeholder="Buscar persona o curso…" label="Buscar en la lista de espera" />
      </div>
      <DataTable label="Lista de espera" rows={rows} columns={cols} rowKey={(w) => w.id} defaultSort={{ key: 'p', dir: 'asc' }} empty={{ icon: Hourglass, title: 'Lista vacía', description: 'No hay personas con este filtro.' }} />
      {adding && <NewEntry onClose={() => setAdding(false)} />}
      {conv && <Convert w={conv} onClose={() => setConv(null)} />}
    </>
  );
}
