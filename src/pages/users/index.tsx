import { useState } from 'react';
import { Plus, UserCog } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Field, Input, Select } from '@/components/ui/form';
import { FormModal } from '@/components/ui/FormModal';
import { Avatar, Badge } from '@/components/ui/primitives';
import { useAction, useCan, useLabels, useSnapshot, useUser } from '@/hooks';
import { fullName } from '@/lib/people';
import { ROLE_LABELS } from '@/lib/permissions';
import { fieldErrors, userSchema } from '@/lib/schemas';
import { createUser, updateUser } from '@/services/mutations';
import type { RoleId, User } from '@/types';

type Row = Omit<User, 'pwd'>;
const ROLES: RoleId[] = ['ADMIN', 'SECRETARIA', 'PROFESOR', 'ALUMNO', 'TUTOR'];

function NewUser({ onClose }: { onClose: () => void }) {
  const snap = useSnapshot(); const me = useUser(); const run = useAction(); const L = useLabels();
  const [f, setF] = useState({ name: '', email: '', role: 'SECRETARIA' as RoleId, teacherId: '', studentId: '', password: '' }); const [err, setErr] = useState<Record<string, string>>({}); const [top, setTop] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = async () => { const p = userSchema.safeParse(f); if (!p.success) return setErr(fieldErrors(p.error)); setErr({});
    try { if (await run(() => createUser(me, p.data), 'Usuario creado')) onClose(); } catch (e) { setTop((e as Error).message); } };
  return (
    <FormModal open onClose={onClose} title="Nuevo usuario" description="Tendrá que cambiar la contraseña inicial cuando el backend esté conectado." onSubmit={submit} error={top} wide>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" required error={err.name}>{(p) => <Input {...p} data-autofocus value={f.name} onChange={set('name')} />}</Field>
        <Field label="Correo" required error={err.email}>{(p) => <Input {...p} type="email" autoComplete="off" value={f.email} onChange={set('email')} />}</Field>
        <Field label="Rol" required>{(p) => <Select {...p} value={f.role} onChange={set('role')}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</Select>}</Field>
        <Field label="Contraseña inicial" required error={err.password} hint="Mínimo 8 caracteres, con letras y números.">{(p) => <Input {...p} type="password" autoComplete="new-password" value={f.password} onChange={set('password')} />}</Field>
        {f.role === 'PROFESOR' && <Field label={`Vincular con ${L.teacher.singular.toLowerCase()}`} className="sm:col-span-2" hint="Limita lo que ve a sus grupos.">{(p) => <Select {...p} value={f.teacherId} onChange={set('teacherId')}><option value="">Sin vincular</option>{snap.teachers.map((t) => <option key={t.id} value={t.id}>{fullName(t)}</option>)}</Select>}</Field>}
        {f.role === 'ALUMNO' && <Field label={`Vincular con ${L.student.singular.toLowerCase()}`} className="sm:col-span-2">{(p) => <Select {...p} value={f.studentId} onChange={set('studentId')}><option value="">Sin vincular</option>{snap.students.map((s) => <option key={s.id} value={s.id}>{fullName(s)}</option>)}</Select>}</Field>}
      </div>
    </FormModal>
  );
}

export default function UsersPage() {
  const snap = useSnapshot(); const me = useUser(); const can = useCan(); const run = useAction(); const [adding, setAdding] = useState(false); const write = can('users:write');
  const rows: Row[] = snap.users.filter((u) => u.role !== 'SUPER_ADMIN');
  const cols: Column<Row>[] = [
    { key: 'n', header: 'Usuario', sort: (a, b) => a.name.localeCompare(b.name, 'es'), cell: (u) => <span className="flex items-center gap-3"><Avatar name={u.name} hue={u.avatarHue} size={30} /><span><span className="block font-medium">{u.name}{u.id === me.id && <span className="ml-2 text-xs text-muted">(tú)</span>}</span><span className="text-xs text-muted">{u.email}</span></span></span> },
    { key: 'r', header: 'Rol', cell: (u) => write && u.id !== me.id ? <select aria-label={`Rol de ${u.name}`} value={u.role} onChange={(e) => void run(() => updateUser(me, u.id, { role: e.target.value as RoleId }), 'Rol actualizado')} className="h-8 rounded-md border border-line bg-bg px-1.5 text-xs">{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select> : <Badge tone="brand">{ROLE_LABELS[u.role]}</Badge> },
    { key: 'l', header: 'Vinculado a', hide: 'md', cell: (u) => <span className="text-muted">{u.teacherId ? fullName(snap.teachers.find((t) => t.id === u.teacherId) ?? { firstName: '—', lastName: '' }) : u.studentId ? fullName(snap.students.find((s) => s.id === u.studentId) ?? { firstName: '—', lastName: '' }) : '—'}</span> },
    { key: 's', header: 'Estado', cell: (u) => <Badge tone={u.disabled ? 'neutral' : 'ok'}>{u.disabled ? 'Desactivado' : 'Activo'}</Badge> },
    ...(write ? [{ key: 'a', header: '', align: 'right', cell: (u: Row) => u.id === me.id ? null : <Button size="sm" variant="ghost" onClick={() => void run(() => updateUser(me, u.id, { disabled: !u.disabled }), u.disabled ? 'Usuario activado' : 'Usuario desactivado')}>{u.disabled ? 'Activar' : 'Desactivar'}</Button> } as Column<Row>] : []),
  ];
  return (
    <>
      <PageHeader title="Usuarios" description="Cuentas con acceso a la academia." actions={write && <Button variant="primary" onClick={() => setAdding(true)}><Plus size={16} />Nuevo usuario</Button>} />
      <DataTable label="Usuarios" rows={rows} columns={cols} rowKey={(u) => u.id} defaultSort={{ key: 'n', dir: 'asc' }} empty={{ icon: UserCog, title: 'Sin usuarios' }} />
      {adding && <NewUser onClose={() => setAdding(false)} />}
    </>
  );
}
