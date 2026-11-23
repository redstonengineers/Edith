import { useState } from 'react';
import { MessageSquare, Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/form';
import { FormModal } from '@/components/ui/FormModal';
import { Avatar, EmptyState } from '@/components/ui/primitives';
import { useAction, useCan, useSnapshot, useUser } from '@/hooks';
import { fieldErrors, messageSchema } from '@/lib/schemas';
import { markMessageRead, sendMessage } from '@/services/mutations';
import { useSession } from '@/store/session';
import { useUi } from '@/store/ui';
import { fmtAgo } from '@/utils/format';
import { cn } from '@/utils/cn';

function Compose({ onClose }: { onClose: () => void }) {
  const snap = useSnapshot(); const user = useUser(); const reload = useSession((s) => s.reload); const toast = useUi((s) => s.toast);
  const [f, setF] = useState({ subject: '', body: '' }); const [to, setTo] = useState<string[]>([]); const [err, setErr] = useState<Record<string, string>>({});
  const users = snap.users.filter((u) => u.id !== user.id && u.role !== 'SUPER_ADMIN');
  const submit = async () => {
    const p = messageSchema.safeParse({ ...f, toUserIds: to }); const e = p.success ? {} : fieldErrors(p.error); if (!to.length) e.to = 'Selecciona al menos un destinatario'; setErr(e); if (Object.keys(e).length || !p.success) return;
    try { await sendMessage(user, { ...p.data, channel: 'app' }); await reload(); toast({ kind: 'success', title: 'Mensaje enviado' }); onClose(); } catch (x) { toast({ kind: 'error', title: 'No se pudo enviar', description: (x as Error).message }); }
  };
  return (
    <FormModal open onClose={onClose} title="Nuevo mensaje" submitLabel="Enviar" onSubmit={submit} wide>
      <fieldset><legend className="mb-1.5 text-[13px] font-medium">Para <span className="text-bad">*</span></legend>
        <div className="flex flex-wrap gap-1.5">{users.map((u) => <button type="button" key={u.id} aria-pressed={to.includes(u.id)} onClick={() => setTo(to.includes(u.id) ? to.filter((x) => x !== u.id) : [...to, u.id])} className={cn('h-8 rounded-full border px-3 text-[13px]', to.includes(u.id) ? 'border-brand/50 bg-brand/12' : 'border-line text-muted hover:text-fg')}>{u.name}</button>)}</div>
        {err.to && <p role="alert" className="mt-1 text-xs text-bad">{err.to}</p>}</fieldset>
      <Field label="Asunto" required error={err.subject}>{(p) => <Input {...p} data-autofocus value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} />}</Field>
      <Field label="Mensaje" required error={err.body}>{(p) => <Textarea {...p} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} className="min-h-32" />}</Field>
    </FormModal>
  );
}

export default function MessagesPage() {
  const snap = useSnapshot(); const user = useUser(); const can = useCan(); const reload = useSession((s) => s.reload); useAction();
  const [sel, setSel] = useState<string | null>(null); const [composing, setComposing] = useState(false);
  const msgs = snap.messages.filter((m) => m.kind !== 'announcement').sort((a, b) => b.sentAt.localeCompare(a.sentAt));
  const cur = msgs.find((m) => m.id === sel);
  const who = (id: string) => snap.users.find((u) => u.id === id);
  const unread = (m: (typeof msgs)[number]) => m.toUserIds.includes(user.id) && !(m.readBy ?? []).includes(user.id);
  const open = (id: string) => { setSel(id); const m = msgs.find((x) => x.id === id); if (m && unread(m)) { void Promise.resolve(markMessageRead(user, id)).then(() => reload()); } };
  return (
    <>
      <PageHeader title="Mensajes" description="Mensajería interna del equipo." actions={can('messages:write') && <Button variant="primary" onClick={() => setComposing(true)}><Plus size={16} />Nuevo mensaje</Button>} />
      {msgs.length === 0 ? <div className="panel"><EmptyState icon={MessageSquare} title="Sin mensajes" description="Cuando envíes o recibas mensajes aparecerán aquí." /></div> : (
        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <ul className="panel divide-y divide-line overflow-hidden" aria-label="Mensajes">{msgs.map((m) => { const from = who(m.fromUserId); return (
            <li key={m.id}><button onClick={() => open(m.id)} aria-current={sel === m.id} className={cn('flex w-full gap-3 px-4 py-3 text-left hover:bg-surface-2', sel === m.id && 'bg-brand/8')}>
              <Avatar name={from?.name ?? '?'} hue={from?.avatarHue ?? 200} size={32} />
              <span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className={cn('truncate text-sm', unread(m) && 'font-semibold')}>{m.fromUserId === user.id ? 'Tú' : from?.name}</span>{unread(m) && <span aria-label="Sin leer" className="h-2 w-2 rounded-full bg-brand" />}</span><span className="block truncate text-[13px]">{m.subject}</span><span className="text-xs text-muted">{fmtAgo(m.sentAt)}</span></span></button></li>); })}</ul>
          <div className="panel p-6">{cur ? (<article><h2 className="text-lg font-semibold">{cur.subject}</h2><p className="mt-1 text-xs text-muted">De {who(cur.fromUserId)?.name} · para {cur.toUserIds.map((id) => who(id)?.name).filter(Boolean).join(', ') || 'todos'} · {fmtAgo(cur.sentAt)}</p><p className="mt-5 text-sm whitespace-pre-wrap">{cur.body}</p></article>) : <EmptyState title="Selecciona un mensaje" />}</div>
        </div>)}
      {composing && <Compose onClose={() => setComposing(false)} />}
    </>
  );
}
