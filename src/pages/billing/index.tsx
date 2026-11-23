import { useMemo, useState } from 'react';
import { Printer, Receipt as ReceiptIcon } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { SearchInput } from '@/components/ui/controls';
import { Modal } from '@/components/ui/Overlay';
import { useSettings, useSnapshot } from '@/hooks';
import { fullName } from '@/lib/people';
import type { Payment } from '@/types';
import { fmtDate, fmtMoney, norm } from '@/utils/format';

type R = Payment & { no: string };
export default function BillingPage() {
  const snap = useSnapshot(); const { currency, branding } = useSettings(); const [q, setQ] = useState(''); const [sel, setSel] = useState<R | null>(null);
  const receipts: R[] = useMemo(() => {
    const paid = snap.payments.filter((p) => p.status === 'pagado' && p.paidAt).sort((a, b) => a.paidAt!.localeCompare(b.paidAt!));
    const seq = new Map<string, number>();
    return paid.map((p) => { if (p.invoiceNo) return { ...p, no: p.invoiceNo }; const y = p.paidAt!.slice(0, 4); const n = (seq.get(y) ?? 0) + 1; seq.set(y, n); return { ...p, no: `REC-${y}-${String(n).padStart(4, '0')}` }; }).reverse();
  }, [snap.payments]);
  const student = (id: string) => snap.students.find((s) => s.id === id);
  const nq = norm(q).split(/\s+/).filter(Boolean);
  const rows = receipts.filter((r) => { const s = student(r.studentId); return nq.every((t) => norm(`${r.no} ${r.concept} ${s ? fullName(s) : ''}`).includes(t)); });
  const total = rows.reduce((a, r) => a + r.amount, 0);
  const cols: Column<R>[] = [
    { key: 'no', header: 'Recibo', sort: (a, b) => a.no.localeCompare(b.no), cell: (r) => <button onClick={() => setSel(r)} className="tnum font-medium hover:text-brand-text">{r.no}</button> },
    { key: 'd', header: 'Fecha', sort: (a, b) => a.paidAt!.localeCompare(b.paidAt!), cell: (r) => <span className="tnum text-muted">{fmtDate(r.paidAt!)}</span> },
    { key: 's', header: 'Alumno', cell: (r) => { const s = student(r.studentId); return s ? fullName(s) : '—'; } },
    { key: 'c', header: 'Concepto', hide: 'md', cell: (r) => <span className="capitalize text-muted">{r.concept}</span> },
    { key: 'a', header: 'Importe', sort: (a, b) => a.amount - b.amount, cell: (r) => <span className="tnum">{fmtMoney(r.amount, currency)}</span> },
  ];
  return (
    <>
      <PageHeader title="Facturación" description={`${rows.length} recibos · ${fmtMoney(total, currency)} cobrados`} />
      <div className="mb-4"><SearchInput value={q} onChange={setQ} placeholder="Buscar recibo, alumno…" label="Buscar recibos" /></div>
      <DataTable label="Recibos" rows={rows} columns={cols} rowKey={(r) => r.id} onRowClick={setSel} defaultSort={{ key: 'd', dir: 'desc' }} empty={{ icon: ReceiptIcon, title: 'Sin recibos', description: 'Aparecen al registrar cobros.' }} />
      <Modal open={!!sel} onClose={() => setSel(null)} label="Recibo" className="max-w-lg">
        {sel && (
          <div>
            <div className="print-area p-8">
              <p className="text-xs opacity-60">Recibo</p>
              <h2 className="mt-1 text-2xl font-semibold">{branding.name}</h2>
              <p className="tnum mt-1 text-sm opacity-70">{sel.no} · {fmtDate(sel.paidAt!, "d 'de' MMMM 'de' yyyy")}</p>
              <dl className="mt-6 space-y-2 border-t border-current/20 pt-4 text-sm">
                <div className="flex justify-between"><dt className="opacity-70">Alumno</dt><dd>{(() => { const s = student(sel.studentId); return s ? fullName(s) : '—'; })()}</dd></div>
                <div className="flex justify-between"><dt className="opacity-70">Concepto</dt><dd className="capitalize">{sel.concept}</dd></div>
                <div className="flex justify-between"><dt className="opacity-70">Método</dt><dd className="capitalize">{sel.method ?? '—'}</dd></div>
                <div className="flex justify-between border-t border-current/20 pt-3 text-lg font-semibold"><dt>Total</dt><dd className="tnum">{fmtMoney(sel.amount, currency)}</dd></div>
              </dl>
            </div>
            <div className="flex justify-end gap-2 border-t border-line px-6 py-3"><Button onClick={() => setSel(null)}>Cerrar</Button><Button variant="primary" onClick={() => window.print()}><Printer size={15} />Imprimir</Button></div>
          </div>)}
      </Modal>
    </>
  );
}
