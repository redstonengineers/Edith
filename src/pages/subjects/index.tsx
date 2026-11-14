import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { nuevo } from '@/lib/labels';
import { BookOpen, Pencil, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Field, Input } from '@/components/ui/form';
import { FormModal } from '@/components/ui/FormModal';
import { ConfirmDialog } from '@/components/ui/Overlay';
import { useAction, useCan, useLabels, useSnapshot, useUser } from '@/hooks';
import { fieldErrors, subjectSchema } from '@/lib/schemas';
import { createSubject, deleteSubject, updateSubject } from '@/services/mutations';
import type { Subject } from '@/types';

const COLORS = ['#38bdf8', '#a78bfa', '#f472b6', '#34d399', '#fbbf24', '#fb923c', '#4ade80', '#f87171'];

function SubjectForm({ subject, onClose }: { subject?: Subject; onClose: () => void }) {
  const user = useUser(); const L = useLabels(); const run = useAction();
  const [f, setF] = useState({ name: subject?.name ?? '', code: subject?.code ?? '', level: subject?.level ?? '', color: subject?.color ?? COLORS[0] });
  const [err, setErr] = useState<Record<string, string>>({}); const [top, setTop] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = async () => {
    const p = subjectSchema.safeParse(f); if (!p.success) return setErr(fieldErrors(p.error)); setErr({});
    try { const r = subject ? await run(() => updateSubject(user, subject.id, p.data), 'Guardado') : await run(() => createSubject(user, p.data), `${L.subject.singular} creado`); if (r) onClose(); } catch (e) { setTop((e as Error).message); }
  };
  return (
    <FormModal open onClose={onClose} title={subject ? `Editar ${L.subject.singular.toLowerCase()}` : `${nuevo(L.subject)}`} onSubmit={submit} error={top}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" required error={err.name} className="sm:col-span-2">{(p) => <Input {...p} data-autofocus value={f.name} onChange={set('name')} />}</Field>
        <Field label="Código" required error={err.code}>{(p) => <Input {...p} value={f.code} onChange={set('code')} maxLength={6} />}</Field>
        <Field label="Nivel" error={err.level}>{(p) => <Input {...p} value={f.level} onChange={set('level')} />}</Field>
      </div>
      <fieldset><legend className="mb-1.5 text-[13px] font-medium">Color</legend>
        <div className="flex flex-wrap gap-2">{COLORS.map((c) => <button type="button" key={c} onClick={() => setF({ ...f, color: c })} aria-label={`Color ${c}`} aria-pressed={f.color === c} className="h-7 w-7 rounded-full ring-offset-2 ring-offset-surface aria-pressed:ring-2 aria-pressed:ring-fg" style={{ background: c }} />)}</div></fieldset>
    </FormModal>
  );
}

export default function SubjectsPage() {
  const snap = useSnapshot(); const L = useLabels(); const can = useCan(); const user = useUser(); const run = useAction(); const [sp, setSp] = useSearchParams();
  const [edit, setEdit] = useState<Subject | 'new' | null>(null); const [del, setDel] = useState<Subject | null>(null);
  const write = can('subjects:write');
  type R = { s: Subject; groups: number; teachers: number };
  const rows: R[] = snap.subjects.map((s) => ({ s, groups: snap.groups.filter((g) => g.subjectId === s.id).length, teachers: snap.teachers.filter((t) => t.subjectIds.includes(s.id)).length }));
  const cols: Column<R>[] = [
    { key: 'name', header: L.subject.singular, sort: (a, b) => a.s.name.localeCompare(b.s.name, 'es'), cell: (r) => <span className="flex items-center gap-2.5 font-medium"><span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: r.s.color }} />{r.s.name}</span> },
    { key: 'code', header: 'Código', hide: 'md', cell: (r) => <span className="tnum text-muted">{r.s.code}</span> },
    { key: 'level', header: 'Nivel', hide: 'md', cell: (r) => <span className="text-muted">{r.s.level ?? '—'}</span> },
    { key: 'g', header: L.group.plural, sort: (a, b) => a.groups - b.groups, cell: (r) => <span className="tnum">{r.groups}</span> },
    { key: 't', header: L.teacher.plural, sort: (a, b) => a.teachers - b.teachers, hide: 'md', cell: (r) => <span className="tnum">{r.teachers}</span> },
    ...(write ? [{ key: 'act', header: '', align: 'right', cell: (r: R) => (<span className="inline-flex gap-1"><button aria-label={`Editar ${r.s.name}`} onClick={() => setEdit(r.s)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg"><Pencil size={15} /></button><button aria-label={`Eliminar ${r.s.name}`} onClick={() => setDel(r.s)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-bad/10 hover:text-bad"><Trash2 size={15} /></button></span>) } as Column<R>] : []),
  ];
  const editing = typeof edit === 'object' && edit !== null ? edit : undefined;
  const creating = edit === 'new' || sp.get('nuevo') === '1';
  const close = () => { setEdit(null); if (sp.has('nuevo')) { sp.delete('nuevo'); setSp(sp, { replace: true }); } };
  return (
    <>
      <PageHeader title={L.subject.plural} description={`${rows.length} en el catálogo`} actions={write && <Button variant="primary" onClick={() => setEdit('new')}><Plus size={16} />{nuevo(L.subject)}</Button>} />
      <DataTable label={L.subject.plural} rows={rows} columns={cols} rowKey={(r) => r.s.id} defaultSort={{ key: 'name', dir: 'asc' }} empty={{ icon: BookOpen, title: `Sin ${L.subject.plural.toLowerCase()}`, description: 'Crea el primero para poder montar grupos.' }} />
      {(creating || editing) && <SubjectForm subject={editing} onClose={close} />}
      <ConfirmDialog open={!!del} danger title={`¿Eliminar ${del?.name}?`} description="Esta acción no se puede deshacer. Si hay grupos que la usan, no se podrá eliminar." confirmLabel="Eliminar" onClose={() => setDel(null)} onConfirm={() => del && void run(() => deleteSubject(user, del.id), 'Eliminado')} />
    </>
  );
}
