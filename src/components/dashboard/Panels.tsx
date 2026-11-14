import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarX, CheckCircle2, ChevronRight, Info, ListTodo, OctagonAlert } from 'lucide-react';
import { Badge, Avatar, EmptyState, Panel, Timeline } from '@/components/ui/primitives';
import { useCommands } from '@/components/command/useCommands';
import { useLabels, useSnapshot } from '@/hooks';
import type { Dashboard } from '@/lib/metrics';
import { fmtAgo } from '@/utils/format';
import { cn } from '@/utils/cn';

export function QuickActions() {
  const quick = useCommands().filter((c) => c.quick);
  if (!quick.length) return null;
  return (
    <section aria-label="Acciones rápidas" className="flex flex-wrap gap-2">
      {quick.map((c) => { const Icon = c.icon; return (
        <button key={c.id} onClick={c.run} className="group flex h-10 items-center gap-2 rounded-xl border border-line bg-surface/70 px-3.5 text-sm transition-colors hover:border-brand/40 hover:bg-brand/8">
          <Icon size={16} className="text-brand-text" aria-hidden />{c.title}
        </button>); })}
    </section>
  );
}

export function AgendaToday({ d }: { d: Dashboard }) {
  const labels = useLabels();
  return (
    <Panel id="agenda" title="Agenda de hoy" action={<Link to="/horarios" className="text-xs text-muted hover:text-fg">Ver calendario</Link>}>
      {d.agenda.length === 0 ? <EmptyState icon={CalendarX} title={`Hoy no hay ${labels.class.plural.toLowerCase()}`} description="Disfruta del día o revisa la agenda de mañana." /> : (
        <Timeline items={d.agenda.map((a) => ({
          id: a.id, time: a.start, dot: a.color, state: a.status === 'next' ? 'next' : a.status,
          title: (
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn('text-sm font-medium', a.status === 'cancelled' && 'line-through')}>{a.title}</span>
              {a.status === 'live' && <Badge tone="ok">En curso</Badge>}
              {a.status === 'next' && <Badge tone="brand">Siguiente</Badge>}
              {a.status === 'cancelled' && <Badge tone="bad">Cancelada</Badge>}
            </div>),
          meta: <p className="text-xs text-muted">{a.start}–{a.end} · {a.subtitle} · {a.room}</p>,
        }))} />
      )}
    </Panel>
  );
}

const alertIcon = { danger: OctagonAlert, warning: AlertTriangle, info: Info } as const;
const alertColor = { danger: 'text-bad', warning: 'text-warn', info: 'text-info' } as const;

export function AlertsPanel({ d }: { d: Dashboard }) {
  return (
    <Panel id="alerts" title="Requiere atención" action={d.alerts.length ? <Badge tone="warn">{d.alerts.length}</Badge> : undefined} bodyClassName="px-2 pb-2">
      {d.alerts.length === 0 ? <EmptyState icon={CheckCircle2} title="Todo en orden" description="No hay alertas pendientes." /> : (
        <ul>{d.alerts.map((a) => { const Icon = alertIcon[a.level]; return (
          <li key={a.id}><Link to={a.href} className="group flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-surface-2">
            <Icon size={16} className={cn('shrink-0', alertColor[a.level])} aria-label={a.level === 'danger' ? 'Crítico' : a.level === 'warning' ? 'Aviso' : 'Información'} />
            <span className="flex-1 text-[13.5px]">{a.text}</span><ChevronRight size={14} className="text-muted opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
          </Link></li>); })}</ul>
      )}
    </Panel>
  );
}

export function TasksPanel({ d }: { d: Dashboard }) {
  return (
    <Panel id="tasks" title="Próximas tareas">
      {d.tasks.length === 0 ? <EmptyState icon={ListTodo} title="Sin tareas pendientes" /> : (
        <ul className="space-y-1">{d.tasks.map((t) => (
          <li key={t.id}><Link to={t.href} className="flex items-start gap-3 rounded-lg px-1 py-1.5 text-[13.5px] hover:text-brand-text"><span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full border border-brand" />{t.text}</Link></li>
        ))}</ul>
      )}
    </Panel>
  );
}

export function ActivityFeed() {
  const { activity, users } = useSnapshot();
  return (
    <Panel id="activity" title="Actividad reciente">
      {activity.length === 0 ? <EmptyState title="Sin actividad todavía" /> : (
        <ul className="space-y-3.5">{activity.slice(0, 6).map((a) => { const u = users.find((x) => x.id === a.actorId); return (
          <li key={a.id} className="flex items-start gap-3">
            <Avatar name={a.actorName} hue={u?.avatarHue ?? 200} size={26} />
            <div className="min-w-0"><p className="text-[13.5px] leading-snug">{a.summary}</p><p className="text-[11px] text-muted">{fmtAgo(a.at)}</p></div>
          </li>); })}</ul>
      )}
    </Panel>
  );
}
