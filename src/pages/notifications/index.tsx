import { Link } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/primitives';
import { useAction, useSnapshot, useUser } from '@/hooks';
import { markNotificationsRead } from '@/services/mutations';
import { fmtAgo } from '@/utils/format';
import { cn } from '@/utils/cn';

export default function NotificationsPage() {
  const snap = useSnapshot(); const user = useUser(); const run = useAction();
  const unread = snap.notifications.filter((n) => !n.read).length;
  const tone = { info: 'bg-info', warning: 'bg-warn', success: 'bg-ok' } as const;
  return (
    <>
      <PageHeader title="Notificaciones" description={unread ? `${unread} sin leer` : 'Estás al día.'} actions={unread > 0 && <Button onClick={() => void run(() => markNotificationsRead(user), 'Todas marcadas como leídas')}><CheckCheck size={15} />Marcar todas como leídas</Button>} />
      {snap.notifications.length === 0 ? <div className="panel"><EmptyState icon={Bell} title="Sin notificaciones" /></div> : (
        <ul className="panel divide-y divide-line">{snap.notifications.map((n) => (
          <li key={n.id} className="flex items-start gap-3 px-5 py-3.5"><span aria-hidden className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.read ? 'bg-line-strong' : tone[n.level])} />
            <div className="min-w-0 flex-1"><p className={cn('text-sm', !n.read && 'font-semibold')}>{n.title}</p><p className="text-[13px] text-muted">{n.body}</p><p className="mt-0.5 text-xs text-muted">{fmtAgo(n.createdAt)}</p></div>
            {n.href && <Link to={n.href} onClick={() => void markNotificationsRead(user, n.id)} className="text-xs text-brand-text hover:underline">Abrir</Link>}</li>))}</ul>)}
    </>
  );
}
