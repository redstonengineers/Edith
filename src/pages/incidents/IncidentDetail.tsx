import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Field, Select, Textarea } from '@/components/ui/form';
import { Badge, Panel } from '@/components/ui/primitives';
import { useAction, useCan, useLabels, useSnapshot, useUser } from '@/hooks';
import { fullName } from '@/lib/people';
import { updateIncident } from '@/services/mutations';
import type { IncidentStatus } from '@/types';
import { fmtAgo, fmtDate } from '@/utils/format';
import { cn } from '@/utils/cn';
import { ForbiddenPage } from '../Status';
import { PRIORITIES, prioLabel, prioTone, statusLabel, statusTone } from './IncidentForm';

const FLOW: IncidentStatus[] = ['pendiente', 'en_proceso', 'resuelto'];
export default function IncidentDetail() {
  const { id } = useParams(); const snap = useSnapshot(); const L = useLabels(); const can = useCan(); const user = useUser(); const run = useAction();
  const i = snap.incidents.find((x) => x.id === id); const [desc, setDesc] = useState(i?.description ?? '');
  if (!i) return <ForbiddenPage reason="denied" />;
  const write = can('incidents:write'); const st = snap.students.find((s) => s.id === i.relatedStudentId); const tc = snap.teachers.find((t) => t.id === i.relatedTeacherId);
  const log = snap.activity.filter((a) => a.entityId === i.id);
  const upd = (patch: Parameters<typeof updateIncident>[2], msg: string) => void run(() => updateIncident(user, i.id, patch), msg);
  return (
    <>
      <PageHeader breadcrumbs={[{ label: L.incident.plural, to: '/incidencias' }, { label: i.title }]} title={<span className="flex flex-wrap items-center gap-3">{i.title}<Badge tone={prioTone[i.priority]}>{prioLabel[i.priority]}</Badge><Badge tone={statusTone[i.status]}>{statusLabel[i.status]}</Badge></span>} description={`${i.type} · abierta el ${fmtDate(i.createdAt, "d 'de' MMMM 'de' yyyy")}`}
        actions={write && i.status !== 'resuelto' && <Button variant="primary" onClick={() => upd({ status: 'resuelto' }, 'Marcada como resuelta')}><CheckCircle2 size={15} />Resolver</Button>} />
      <ol aria-label="Estado" className="mb-6 flex gap-2">{FLOW.map((s) => (
        <li key={s} className="flex-1"><button disabled={!write} aria-current={i.status === s ? 'step' : undefined} onClick={() => i.status !== s && upd({ status: s }, `Estado: ${statusLabel[s]}`)} className={cn('h-10 w-full rounded-lg border text-sm', i.status === s ? 'border-brand/60 bg-brand/12 font-medium' : 'border-line text-muted hover:text-fg disabled:hover:text-muted')}>{statusLabel[s]}</button></li>))}</ol>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Panel title="Descripción"><Textarea aria-label="Descripción" value={desc} onChange={(e) => setDesc(e.target.value)} disabled={!write} />{write && <Button className="mt-2" size="sm" disabled={desc === i.description || desc.trim().length < 5} onClick={() => upd({ description: desc.trim() }, 'Descripción guardada')}>Guardar</Button>}</Panel>
          <Panel title="Historial">{log.length === 0 ? <p className="text-sm text-muted">Sin movimientos registrados.</p> : <ol className="space-y-3">{log.map((a) => <li key={a.id} className="text-sm">{a.summary} <span className="text-xs text-muted">· {fmtAgo(a.at)}</span></li>)}</ol>}</Panel>
        </div>
        <div className="space-y-6">
          <Panel title="Gestión"><div className="space-y-4">
            <Field label="Prioridad">{(p) => <Select {...p} disabled={!write} value={i.priority} onChange={(e) => upd({ priority: e.target.value as typeof i.priority }, 'Prioridad actualizada')}>{PRIORITIES.map((x) => <option key={x} value={x}>{prioLabel[x]}</option>)}</Select>}</Field>
            <Field label="Responsable">{(p) => <Select {...p} disabled={!write} value={i.assigneeId ?? ''} onChange={(e) => upd({ assigneeId: e.target.value }, 'Responsable actualizado')}><option value="">Sin asignar</option>{snap.users.filter((u) => u.role !== 'SUPER_ADMIN').map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select>}</Field>
          </div></Panel>
          {(st || tc) && <Panel title="Relacionado">{st && <p className="text-sm"><span className="text-muted">{L.student.singular}: </span><Link className="hover:text-brand-text" to={`/alumnos/${st.id}`}>{fullName(st)}</Link></p>}{tc && <p className="text-sm"><span className="text-muted">{L.teacher.singular}: </span><Link className="hover:text-brand-text" to={`/profesores/${tc.id}`}>{fullName(tc)}</Link></p>}</Panel>}
        </div>
      </div>
    </>
  );
}
