import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { BellRing, CreditCard, Plus, Trash2 } from 'lucide-react';
import { addDays, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { FilterChips, SearchInput } from '@/components/ui/controls';
import { Field, Input, Select } from '@/components/ui/form';
import { FormModal } from '@/components/ui/FormModal';
import { ConfirmDialog } from '@/components/ui/Overlay';
import { Badge } from '@/components/ui/primitives';
import { useAction, useCan, usePersistentState, useSettings, useSnapshot, useUser } from '@/hooks';
import { fullName } from '@/lib/people';
import { fieldErrors, markPaidSchema, paymentSchema } from '@/lib/schemas';
import { createPayment, markPaid, sendPaymentReminder, voidPayment } from '@/services/mutations';
import type { Payment } from '@/types';
import { fmtDate, fmtMoney, norm, todayISO } from '@/utils/format';

const tone = { pagado: 'ok', pendiente: 'warn', vencido: 'bad' } as const;
type F = 'todos' | 'pendiente' | 'vencido' | 'pagado';

function NewPayment({ onClose }: { onClose: () => void }) {
  const snap = useSnapshot(); const user = useUser(); const run = useAction();
  const [f, setF] = useState({ studentId: '', concept: `Mensualidad ${format(new Date(), 'MMMM yyyy', { locale: es })}`, amount: '', dueDate: format(addDays(new Date(), 5), 'yyyy-MM-dd') }); const [err, setErr] = useState<Record<string, string>>({});
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = async () => { const p = paymentSchema.safeParse(f); if (!p.success) return setErr(fieldErrors(p.error)); if (await run(() => createPayment(user, p.data), 'Cobro creado')) onClose(); };
  return (
    <FormModal open onClose={onClose} title="Nuevo cobro" onSubmit={submit}>
      <Field label="Alumno" required error={err.studentId}>{(p) => <Select {...p} data-autofocus value={f.studentId} onChange={set('studentId')}><option value="">Seleccionar…</option>{snap.students.filter((s) => s.status !== 'baja').sort((a, b) => a.lastName.localeCompare(b.lastName, 'es')).map((s) => <option key={s.id} value={s.id}>{fullName(s)}</option>)}</Select>}</Field>
      <Field label="Concepto" required error={err.concept}>{(p) => <Input {...p} value={f.concept} onChange={set('concept')} />}</Field>
      <div className="grid grid-cols-2 gap-3"><Field label="Importe (€)" required error={err.amount}>{(p) => <Input {...p} type="number" min={0} step="0.01" value={f.amount} onChange={set('amount')} />}</Field><Field label="Vencimiento" required error={err.dueDate}>{(p) => <Input {...p} type="date" value={f.dueDate} onChange={set('dueDate')} />}</Field></div>
    </FormModal>
  );
}

function Collect({ p, onClose }: { p: Payment; onClose: () => void }) {
  const user = useUser(); const run = useAction(); const { currency } = useSettings();
  const [f, setF] = useState({ paidAt: todayISO(), method: 'transferencia' }); const [err, setErr] = useState<Record<string, string>>({});
  const submit = async () => { const v = markPaidSchema.safeParse(f); if (!v.success) return setErr(fieldErrors(v.error)); if (await run(() => markPaid(user, p.id, v.data), 'Pago registrado')) onClose(); };
  return (
    <FormModal open onClose={onClose} title="Registrar cobro" description={`${p.concept} · ${fmtMoney(p.amount, currency)}`} submitLabel="Registrar pago" onSubmit={submit}>
      <Field label="Fecha de cobro" required error={err.paidAt}>{(x) => <Input {...x} data-autofocus type="date" value={f.paidAt} onChange={(e) => setF({ ...f, paidAt: e.target.value })} />}</Field>
      <Field label="Método" required>{(x) => <Select {...x} value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}><option value="transferencia">Transferencia</option><option value="tarjeta">Tarjeta</option><option value="efectivo">Efectivo</option><option value="domiciliacion">Domiciliación</option></Select>}</Field>
    </FormModal>
  );
}

export default function PaymentsPage() {
  const snap = useSnapshot(); const { currency } = useSettings(); const can = useCan(); const user = useUser(); const run = useAction(); const [sp, setSp] = useSearchParams();
  const [f, setF] = usePersistentState<F>('ac.pay.f', 'todos'); const [q, setQ] = usePersistentState('ac.pay.q', '');
  const [collect, setCollect] = useState<Payment | null>(null); const [del, setDel] = useState<Payment | null>(null);
  const write = can('payments:write'); const today = todayISO(); const monthStart = today.slice(0, 8) + '01';
  const name = (id: string) => { const s = snap.students.find((x) => x.id === id); return s ? fullName(s) : '—'; };
  const sum = (xs: Payment[]) => xs.reduce((a, p) => a + p.amount, 0);
  const paidMonth = snap.payments.filter((p) => p.status === 'pagado' && p.paidAt && p.paidAt >= monthStart && p.paidAt <= today);
  const pending = snap.payments.filter((p) => p.status !== 'pagado'); const overdue = snap.payments.filter((p) => p.status === 'vencido');
  const nq = norm(q).split(/\s+/).filter(Boolean);
  const rows = useMemo(() => snap.payments.filter((p) => f === 'todos' || p.status === f).filter((p) => { const h = norm(`${name(p.studentId)} ${p.concept}`); return nq.every((t) => h.includes(t)); }), [snap, f, nq.join(' ')]); // eslint-disable-line
  const cols: Column<Payment>[] = [
    { key: 's', header: 'Alumno', sort: (a, b) => name(a.studentId).localeCompare(name(b.studentId), 'es'), cell: (p) => <Link to={`/alumnos/${p.studentId}`} className="font-medium hover:text-brand-text">{name(p.studentId)}</Link> },
    { key: 'c', header: 'Concepto', hide: 'md', cell: (p) => <span className="capitalize text-muted">{p.concept}</span> },
    { key: 'a', header: 'Importe', sort: (a, b) => a.amount - b.amount, cell: (p) => <span className="tnum">{fmtMoney(p.amount, currency)}</span> },
    { key: 'd', header: 'Vencimiento', sort: (a, b) => a.dueDate.localeCompare(b.dueDate), cell: (p) => <span className="tnum text-muted">{fmtDate(p.dueDate)}</span> },
    { key: 'st', header: 'Estado', cell: (p) => <Badge tone={tone[p.status]}>{p.status}{p.status === 'pagado' && p.method ? ` · ${p.method}` : ''}</Badge> },
    ...(write ? [{ key: 'x', header: 'Acciones', align: 'right', cell: (p: Payment) => p.status === 'pagado' ? null : (
      <div className="flex justify-end gap-1.5"><Button size="sm" variant="primary" onClick={() => setCollect(p)}>Cobrar</Button>
        <Button size="sm" aria-label={`Enviar recordatorio a ${name(p.studentId)}`} title={p.remindedAt ? `Recordado el ${fmtDate(p.remindedAt)}` : 'Enviar recordatorio'} onClick={() => void run(() => sendPaymentReminder(user, p.id), 'Recordatorio enviado')}><BellRing size={14} /></Button>
        <Button size="sm" variant="ghost" aria-label={`Anular cobro de ${name(p.studentId)}`} onClick={() => setDel(p)}><Trash2 size={14} /></Button></div>) } as Column<Payment>] : []),
  ];
  const opt = (id: F, label: string) => ({ id, label, count: id === 'todos' ? snap.payments.length : snap.payments.filter((p) => p.status === id).length });
  return (
    <>
      <PageHeader title="Pagos" description="Cobros, pendientes y vencidos." actions={write && <Button variant="primary" onClick={() => setSp({ nuevo: '1' })}><Plus size={16} />Nuevo cobro</Button>} />
      <div className="mb-4 grid grid-cols-3 gap-2 sm:mb-6 sm:gap-4">
        <div className="panel p-3 sm:p-5"><p className="text-xs text-muted">Ingresos del mes</p><p className="tnum mt-1 text-lg font-semibold sm:text-3xl text-ok">{fmtMoney(sum(paidMonth), currency)}</p><p className="mt-1 text-xs text-muted">{paidMonth.length} cobros</p></div>
        <div className="panel p-3 sm:p-5"><p className="text-xs text-muted">Pendiente de cobro</p><p className="tnum mt-1 text-lg font-semibold sm:text-3xl">{fmtMoney(sum(pending), currency)}</p><p className="mt-1 text-xs text-muted">{pending.length} recibos</p></div>
        <div className="panel p-3 sm:p-5"><p className="text-xs text-muted">Pagos vencidos</p><p className={`tnum mt-1 text-lg font-semibold sm:text-3xl ${overdue.length ? 'text-bad' : ''}`}>{fmtMoney(sum(overdue), currency)}</p><p className="mt-1 text-xs text-muted">{overdue.length} recibos · {new Set(overdue.map((p) => p.studentId)).size} alumnos</p></div>
      </div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><FilterChips<F> label="Estado" value={f} onChange={setF} options={[opt('todos', 'Todos'), opt('vencido', 'Vencidos'), opt('pendiente', 'Pendientes'), opt('pagado', 'Pagados')]} /><SearchInput value={q} onChange={setQ} placeholder="Buscar alumno o concepto…" label="Buscar pagos" /></div>
      <DataTable label="Pagos" rows={rows} columns={cols} rowKey={(p) => p.id} defaultSort={{ key: 'd', dir: 'asc' }} empty={{ icon: CreditCard, title: 'Sin pagos', description: 'Nada con este filtro.' }} />
      {sp.get('nuevo') === '1' && <NewPayment onClose={() => { sp.delete('nuevo'); setSp(sp, { replace: true }); }} />}
      {collect && <Collect p={collect} onClose={() => setCollect(null)} />}
      <ConfirmDialog open={!!del} danger title="¿Anular este cobro?" description={del ? `${del.concept} · ${fmtMoney(del.amount, currency)}. Se eliminará del sistema.` : undefined} confirmLabel="Anular" onClose={() => setDel(null)} onConfirm={() => del && void run(() => voidPayment(user, del.id), 'Cobro anulado')} />
    </>
  );
}
