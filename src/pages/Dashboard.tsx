import { useMemo } from 'react';
import { AgendaToday, ActivityFeed, AlertsPanel, QuickActions, TasksPanel } from '@/components/dashboard/Panels';
import { CommandCenter } from '@/components/dashboard/CommandCenter';
import { useNow, useSnapshot, useUser } from '@/hooks';
import { computeDashboard, contextMessage } from '@/lib/metrics';
import { fmtLongToday, greeting } from '@/utils/format';

export default function DashboardPage() {
  const snap = useSnapshot();
  const user = useUser();
  const now = useNow(30_000);
  const d = useMemo(() => computeDashboard(snap, now), [snap, now]);
  const first = user.name.split(' ')[0];
  const msg = contextMessage(d, snap.settings.labels);
  const allClear = d.alerts.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs tracking-[0.14em] text-muted uppercase first-letter:uppercase">{fmtLongToday(now)}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">{greeting(now)}, {first}.</h1>
        <p className="mt-1 text-[15px] text-muted">{allClear && msg !== 'Todo bajo control.' ? `Todo bajo control. ${msg}` : msg}</p>
      </div>
      <CommandCenter d={d} />
      <QuickActions />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2"><AgendaToday d={d} /><ActivityFeed /></div>
        <div className="space-y-6"><AlertsPanel d={d} /><TasksPanel d={d} /></div>
      </div>
    </div>
  );
}
