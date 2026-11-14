import { lazy, Suspense } from 'react';
import { LoadingState } from '@/components/ui/primitives';
import { useUser } from '@/hooks';

const Staff = lazy(() => import('./Dashboard'));
const Portal = lazy(() => import('./PortalDashboard'));
/** Elige la portada según el rol: Command Center para el equipo, "Mi espacio" para alumno/tutor. */
export default function DashboardRouter() {
  const u = useUser();
  return <Suspense fallback={<LoadingState />}>{u.role === 'ALUMNO' || u.role === 'TUTOR' ? <Portal /> : <Staff />}</Suspense>;
}
