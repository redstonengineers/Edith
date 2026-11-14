import { useMemo, useState } from 'react';
import { Field, Select } from '@/components/ui/form';
import { FormModal } from '@/components/ui/FormModal';
import { groupOccupancy } from '@/lib/metrics';
import { useLabels, useSnapshot } from '@/hooks';
import { norm } from '@/utils/format';

/** Selector de grupo con plazas libres; sugiere el que coincide con el curso solicitado. */
export function GroupSelect({ value, onChange, course, error }: { value: string; onChange: (v: string) => void; course?: string; error?: string }) {
  const snap = useSnapshot(); const L = useLabels();
  const occ = useMemo(() => groupOccupancy(snap), [snap]);
  const match = course ? norm(course) : '';
  const sorted = [...occ].sort((a, b) => Number(norm(b.group.name).includes(match)) - Number(norm(a.group.name).includes(match)));
  return (
    <Field label={L.group.singular} error={error} hint={course ? `Solicitó: ${course}. Los grupos relacionados aparecen primero.` : undefined}>
      {(p) => <Select {...p} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Sin asignar todavía</option>
        {sorted.map((o) => <option key={o.group.id} value={o.group.id} disabled={o.full}>{o.group.name} — {o.full ? 'completo' : `${o.group.capacity - o.count} plazas`}</option>)}
      </Select>}
    </Field>
  );
}

export function AssignGroupModal({ title, course, onClose, onConfirm, required = true }: { title: string; course?: string; onClose: () => void; onConfirm: (groupId: string) => void | Promise<void>; required?: boolean }) {
  const [g, setG] = useState(''); const [err, setErr] = useState('');
  return (
    <FormModal open onClose={onClose} title={title} submitLabel="Confirmar" onSubmit={async () => { if (required && !g) return setErr('Selecciona un grupo con plazas'); await onConfirm(g); }}>
      <GroupSelect value={g} onChange={setG} course={course} error={err} />
    </FormModal>
  );
}
