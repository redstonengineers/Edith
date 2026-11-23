import { useState } from 'react';
import { Megaphone, Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import { FormModal } from '@/components/ui/FormModal';
import { Badge, EmptyState } from '@/components/ui/primitives';
import { useCan, useLabels, useSnapshot, useUser } from '@/hooks';
import { announcementSchema, fieldErrors } from '@/lib/schemas';
import { CHANNELS } from '@/services/channels';
import { sendMessage } from '@/services/mutations';
import { useSession } from '@/store/session';
import { useUi } from '@/store/ui';
import type { Channel } from '@/types';
import { fmtAgo } from '@/utils/format';

function NewAnnouncement({ onClose }: { onClose: () => void }) {
  const snap = useSnapshot(); const user = useUser(); const L = useLabels(); const reload = useSession((s) => s.reload); const toast = useUi((s) => s.toast);
  const [f, setF] = useState({ subject: '', body: '', audienceGroupId: '', channel: 'app' }); const [err, setErr] = useState<Record<string, string>>({});
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = async () => {
    const p = announcementSchema.safeParse({ ...f, audienceGroupId: f.audienceGroupId || undefined }); if (!p.success) return setErr(fieldErrors(p.error));
    try { const r = await sendMessage(user, { subject: p.data.subject, body: p.data.body, toUserIds: [], kind: 'announcement', channel: p.data.channel, audienceGroupId: p.data.audienceGroupId }); await reload(); toast({ kind: r.delivered ? 'success' : 'info', title: 'Aviso publicado', description: r.note }); onClose(); } catch (x) { toast({ kind: 'error', title: 'No se pudo publicar', description: (x as Error).message }); }
  };
  return (
    <FormModal open onClose={onClose} title="Nuevo aviso" submitLabel="Publicar" onSubmit={submit} wide>
      <Field label="Título" required error={err.subject}>{(p) => <Input {...p} data-autofocus value={f.subject} onChange={set('subject')} />}</Field>
      <Field label="Mensaje" required error={err.body}>{(p) => <Textarea {...p} value={f.body} onChange={set('body')} className="min-h-28" />}</Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Destinatarios">{(p) => <Select {...p} value={f.audienceGroupId} onChange={set('audienceGroupId')}><option value="">Toda la academia</option>{snap.groups.map((g) => <option key={g.id} value={g.id}>{L.group.singular}: {g.name}</option>)}</Select>}</Field>
        <Field label="Canal" hint={CHANNELS[f.channel as Channel].live ? undefined : 'Canal aún no conectado: se registra en la app.'}>{(p) => <Select {...p} value={f.channel} onChange={set('channel')}>{Object.values(CHANNELS).map((c) => <option key={c.id} value={c.id}>{c.label}{c.live ? '' : ' (próximamente)'}</option>)}</Select>}</Field>
      </div>
    </FormModal>
  );
}

export default function AnnouncementsPage() {
  const snap = useSnapshot(); const can = useCan(); const L = useLabels(); const [adding, setAdding] = useState(false);
  const items = snap.messages.filter((m) => m.kind === 'announcement').sort((a, b) => b.sentAt.localeCompare(a.sentAt));
  return (
    <>
      <PageHeader title="Avisos" description="Comunicados a toda la academia o a un grupo." actions={can('announcements:write') && <Button variant="primary" onClick={() => setAdding(true)}><Plus size={16} />Nuevo aviso</Button>} />
      {items.length === 0 ? <div className="panel"><EmptyState icon={Megaphone} title="Sin avisos" description="Publica el primero para informar a tu comunidad." /></div> : (
        <ul className="space-y-4">{items.map((m) => (
          <li key={m.id} className="panel p-5"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{m.subject}</h2><div className="flex items-center gap-2"><Badge>{m.audienceGroupId ? snap.groups.find((g) => g.id === m.audienceGroupId)?.name ?? L.group.singular : 'Toda la academia'}</Badge><Badge tone={CHANNELS[m.channel].live ? 'ok' : 'neutral'}>{CHANNELS[m.channel].label}</Badge></div></div>
            <p className="mt-2 text-sm whitespace-pre-wrap text-muted">{m.body}</p><p className="mt-3 text-xs text-muted">{snap.users.find((u) => u.id === m.fromUserId)?.name} · {fmtAgo(m.sentAt)}</p></li>))}</ul>)}
      {adding && <NewAnnouncement onClose={() => setAdding(false)} />}
    </>
  );
}
