import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { File, FileImage, FileText, FolderOpen, Trash2, Upload } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { FilterChips, SearchInput } from '@/components/ui/controls';
import { Field, Select } from '@/components/ui/form';
import { FormModal } from '@/components/ui/FormModal';
import { ConfirmDialog } from '@/components/ui/Overlay';
import { useAction, useCan, useLabels, usePersistentState, useSnapshot, useUser } from '@/hooks';
import { fullName } from '@/lib/people';
import { addDocument, deleteDocument, DOC_MAX_KB } from '@/services/mutations';
import type { DocumentFile, DocumentOwner } from '@/types';
import { fmtDate, norm } from '@/utils/format';

const OWNERS: { id: DocumentOwner; label: string; path: string }[] = [{ id: 'student', label: 'Alumnos', path: '/alumnos' }, { id: 'teacher', label: 'Profesores', path: '/profesores' }, { id: 'group', label: 'Grupos', path: '/grupos' }, { id: 'enrollment', label: 'Matrículas', path: '/matriculas' }];
const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.odt,.txt';

function useOwnerOptions() {
  const snap = useSnapshot();
  return (t: DocumentOwner): { id: string; label: string }[] => t === 'student' ? snap.students.map((s) => ({ id: s.id, label: fullName(s) })) : t === 'teacher' ? snap.teachers.map((x) => ({ id: x.id, label: fullName(x) })) : t === 'group' ? snap.groups.map((g) => ({ id: g.id, label: g.name })) : snap.enrollments.map((e) => ({ id: e.id, label: e.applicant?.name ?? (snap.students.find((s) => s.id === e.studentId) ? fullName(snap.students.find((s) => s.id === e.studentId)!) : e.id) }));
}

function UploadForm({ onClose }: { onClose: () => void }) {
  const user = useUser(); const run = useAction(); const owners = useOwnerOptions(); const ref = useRef<HTMLInputElement>(null);
  const [t, setT] = useState<DocumentOwner>('student'); const [o, setO] = useState(''); const [file, setFile] = useState<File | null>(null); const [err, setErr] = useState<Record<string, string>>({}); const [top, setTop] = useState<string | null>(null);
  const submit = async () => {
    const e: Record<string, string> = {}; if (!o) e.o = 'Selecciona a quién pertenece'; if (!file) e.f = 'Selecciona un archivo'; setErr(e); if (Object.keys(e).length) return;
    try { if (await run(() => addDocument(user, { name: file!.name, mime: file!.type || 'text/plain', sizeKb: Math.max(1, Math.round(file!.size / 1024)), ownerType: t, ownerId: o }), 'Documento añadido')) onClose(); } catch (x) { setTop((x as Error).message); }
  };
  return (
    <FormModal open onClose={onClose} title="Subir documento" description={`PDF, imagen o documento · máx. ${DOC_MAX_KB / 1024} MB`} submitLabel="Subir" onSubmit={submit} error={top}>
      <Field label="Asociar a">{(p) => <Select {...p} value={t} onChange={(e) => { setT(e.target.value as DocumentOwner); setO(''); }}>{OWNERS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</Select>}</Field>
      <Field label="Elemento" required error={err.o}>{(p) => <Select {...p} value={o} onChange={(e) => setO(e.target.value)}><option value="">Seleccionar…</option>{owners(t).map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</Select>}</Field>
      <Field label="Archivo" required error={err.f}>{(p) => <input {...p} ref={ref} type="file" accept={ACCEPT} onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm file:mr-3 file:h-9 file:rounded-lg file:border file:border-line file:bg-surface-2 file:px-3 file:text-sm file:text-fg" />}</Field>
      <p className="text-xs text-muted">En esta versión se registran los metadatos del archivo; el almacenamiento real se conectará con el backend (URLs firmadas).</p>
    </FormModal>
  );
}

export default function DocumentsPage() {
  const snap = useSnapshot(); const L = useLabels(); const can = useCan(); const user = useUser(); const run = useAction(); const owners = useOwnerOptions();
  const [t, setT] = usePersistentState<DocumentOwner | 'todos'>('ac.docs.t', 'todos'); const [q, setQ] = usePersistentState('ac.docs.q', ''); const [up, setUp] = useState(false); const [del, setDel] = useState<DocumentFile | null>(null);
  const ownerName = (d: DocumentFile) => owners(d.ownerType).find((x) => x.id === d.ownerId)?.label ?? '—';
  const nq = norm(q).split(/\s+/).filter(Boolean);
  const rows = useMemo(() => snap.documents.filter((d) => t === 'todos' || d.ownerType === t).filter((d) => nq.every((x) => norm(`${d.name} ${ownerName(d)}`).includes(x))), [snap, t, nq.join(' ')]); // eslint-disable-line
  const Icon = { pdf: FileText, imagen: FileImage, documento: File } as const;
  const write = can('documents:write');
  const cols: Column<DocumentFile>[] = [
    { key: 'n', header: 'Documento', sort: (a, b) => a.name.localeCompare(b.name, 'es'), cell: (d) => { const I = Icon[d.kind]; return <span className="flex items-center gap-2.5 font-medium"><I size={16} className="text-muted" aria-hidden />{d.name}</span>; } },
    { key: 'o', header: 'Asociado a', cell: (d) => { const o = OWNERS.find((x) => x.id === d.ownerType)!; return <span className="text-muted">{o.label.slice(0, -1)}: <Link to={d.ownerType === 'enrollment' ? o.path : `${o.path}/${d.ownerId}`} className="text-fg hover:text-brand-text">{ownerName(d)}</Link></span>; } },
    { key: 'z', header: 'Tamaño', hide: 'md', sort: (a, b) => a.sizeKb - b.sizeKb, cell: (d) => <span className="tnum text-muted">{d.sizeKb >= 1024 ? `${(d.sizeKb / 1024).toFixed(1)} MB` : `${d.sizeKb} KB`}</span> },
    { key: 'f', header: 'Subido', hide: 'md', sort: (a, b) => a.uploadedAt.localeCompare(b.uploadedAt), cell: (d) => <span className="tnum text-muted">{fmtDate(d.uploadedAt)}</span> },
    ...(write ? [{ key: 'x', header: '', align: 'right', cell: (d: DocumentFile) => <button aria-label={`Eliminar ${d.name}`} onClick={() => setDel(d)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-bad/10 hover:text-bad"><Trash2 size={15} /></button> } as Column<DocumentFile>] : []),
  ];
  return (
    <>
      <PageHeader title={L.document.plural} description="Archivo documental organizado por alumno, profesor, grupo o matrícula." actions={write && <Button variant="primary" onClick={() => setUp(true)}><Upload size={16} />Subir documento</Button>} />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FilterChips<DocumentOwner | 'todos'> label="Carpeta" value={t} onChange={setT} options={[{ id: 'todos', label: 'Todos', count: snap.documents.length }, ...OWNERS.map((o) => ({ id: o.id as DocumentOwner | 'todos', label: o.label, count: snap.documents.filter((d) => d.ownerType === o.id).length }))]} />
        <SearchInput value={q} onChange={setQ} placeholder="Buscar documento…" label="Buscar documentos" />
      </div>
      <DataTable label="Documentos" rows={rows} columns={cols} rowKey={(d) => d.id} defaultSort={{ key: 'f', dir: 'desc' }} empty={{ icon: FolderOpen, title: 'Sin documentos', description: 'Sube el primero para empezar a organizar el archivo.' }} />
      {up && <UploadForm onClose={() => setUp(false)} />}
      <ConfirmDialog open={!!del} danger title="¿Eliminar documento?" description={del?.name} confirmLabel="Eliminar" onClose={() => setDel(null)} onConfirm={() => del && void run(() => deleteDocument(user, del.id), 'Documento eliminado')} />
    </>
  );
}
