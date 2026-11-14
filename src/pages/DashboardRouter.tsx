import { lazy, Suspense } from 'react';
import { LoadingState } from '@/components/ui/primitives';
import { useSnapshot, useUser } from '@/hooks';

const Staff = lazy(() => import('./Dashboard'));
const Portal = lazy(() => import('./PortalDashboard'));
const Driving = lazy(() => import('./DashboardAutoescuela'));
/** Elige la portada según el rol: Command Center para el equipo, "Mi espacio" para alumno/tutor. */
export default function DashboardRouter() {
  const u = useUser(); const snap = useSnapshot();
  return <Suspense fallback={<LoadingState />}>{u.role === 'ALUMNO' || u.role === 'TUTOR' ? <Portal /> : snap.academy.type === 'autoescuela' ? <Driving /> : <Staff />}</Suspense>;
}
