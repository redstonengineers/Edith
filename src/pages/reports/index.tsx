import { useMemo, useState } from 'react';
import { Download, FileBarChart, Printer } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { useCan, useSettings, useSnapshot, useUser } from '@/hooks';
import { REPORTS, downloadCsv } from '@/lib/reports';
import { recordExport } from '@/services/mutations';
import { cn } from '@/utils/cn';

export default function ReportsPage() {
  const snap = useSnapshot(); const can = useCan(); const user = useUser(); const { branding } = useSettings();
  const list = REPORTS.filter((r) => !r.needs || can(r.needs));
  const [id, setId] = useState(list[0]?.id); const rep = list.find((r) => r.id === id) ?? list[0];
  const data = useMemo(() => rep?.build(snap), [rep, snap]);
  const cols: Column<(string | number)[]>[] = (data?.columns ?? []).map((c, i) => ({ key: String(i), header: c, sort: (a, b) => (typeof a[i] === 'number' && typeof b[i] === 'number' ? (a[i] as number) - (b[i] as number) : String(a[i]).localeCompare(String(b[i]), 'es')), cell: (r) => <span className={typeof r[i] === 'number' ? 'tnum' : ''}>{r[i]}</span> }));
  return (
    <>
      <PageHeader title="Informes" description="Consulta, imprime o exporta a CSV." actions={rep && data && <><Button onClick={() => window.print()}><Printer size={15} />Imprimir</Button><Button variant="primary" onClick={() => { downloadCsv(rep.id, data); void recordExport(user, rep.title); }}><Download size={15} />Exportar CSV</Button></>} />
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <ul className="space-y-2" aria-label="Informes disponibles">{list.map((r) => (
          <li key={r.id}><button onClick={() => setId(r.id)} aria-pressed={r.id === rep?.id} className={cn('panel w-full p-3.5 text-left transition-colors', r.id === rep?.id ? 'border-brand/60 bg-brand/8' : 'hover:border-line-strong')}><p className="text-sm font-medium">{r.title}</p><p className="mt-0.5 text-xs text-muted">{r.description}</p></button></li>))}</ul>
        <div className="print-area">
          {rep && data && <><h2 className="mb-1 hidden text-xl font-semibold print:block">{branding.name} · {rep.title}</h2>
            <DataTable label={rep.title} rows={data.rows} columns={cols} rowKey={(r) => r.join('|')} pageSize={15} empty={{ icon: FileBarChart, title: 'Sin datos para este informe' }} /></>}
        </div>
      </div>
    </>
  );
}
