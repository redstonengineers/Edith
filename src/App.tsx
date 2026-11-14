import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { LoadingState } from '@/components/ui/primitives';
import { MODULES, type ModuleDef } from '@/config/modules';
import { isModuleEnabled } from '@/hooks';
import { can } from '@/lib/permissions';
import { useSession } from '@/store/session';
import type { ModuleId } from '@/types';
import { ForbiddenPage, NotFoundPage } from '@/pages/Status';
import LoginPage from '@/pages/Login';
import ModulePlaceholder from '@/pages/ModulePlaceholder';

const OnboardingPage = lazy(() => import('@/pages/onboarding'));
const DashboardPage = lazy(() => import('@/pages/DashboardRouter'));

/** Registro de pantallas implementadas. Lo que no esté aquí muestra el placeholder de su fase. */
const PAGES: Partial<Record<ModuleId, React.ComponentType>> = {
  dashboard: DashboardPage,
  students: lazy(() => import('@/pages/students')),
  teachers: lazy(() => import('@/pages/teachers')),
  groups: lazy(() => import('@/pages/groups')),
  subjects: lazy(() => import('@/pages/subjects')),
  schedule: lazy(() => import('@/pages/schedule')),
  classes: lazy(() => import('@/pages/classes')),
  attendance: lazy(() => import('@/pages/attendance')),
  exams: lazy(() => import('@/pages/exams')),
  grades: lazy(() => import('@/pages/grades')),
  waitlist: lazy(() => import('@/pages/admission/WaitlistPage')),
  applications: lazy(() => import('@/pages/admission/ApplicationsPage')),
  enrollments: lazy(() => import('@/pages/admission/EnrollmentsPage')),
  payments: lazy(() => import('@/pages/payments')),
  billing: lazy(() => import('@/pages/billing')),
  incidents: lazy(() => import('@/pages/incidents')),
  documents: lazy(() => import('@/pages/documents')),
  practicas: lazy(() => import('@/pages/practicas')),
  messages: lazy(() => import('@/pages/messages')),
  announcements: lazy(() => import('@/pages/announcements')),
  notifications: lazy(() => import('@/pages/notifications')),
  customization: lazy(() => import('@/pages/customization')),
  settings: lazy(() => import('@/pages/settings')),
  users: lazy(() => import('@/pages/users')),
  permissions: lazy(() => import('@/pages/permissions')),
  platform: lazy(() => import('@/pages/platform')),
  ai: lazy(() => import('@/pages/ai')),
  statistics: lazy(() => import('@/pages/statistics')),
  reports: lazy(() => import('@/pages/reports')),
};

function Guard({ m }: { m: ModuleDef }) {
  const user = useSession((s) => s.user);
  const settings = useSession((s) => s.data?.settings);
  if (!settings) return null;
  if (!isModuleEnabled(settings, m)) return <ForbiddenPage reason="disabled" />;
  if (!can(user, m.permission)) return <ForbiddenPage reason="denied" />;
  const Page = PAGES[m.id];
  return Page ? <Page /> : <ModulePlaceholder module={m} />;
}

function Protected() {
  const { status, data, dataError, reload } = useSession();
  if (status === 'loading') return <div className="p-8"><LoadingState label="Iniciando sesión…" /></div>;
  if (status === 'anon') return <Navigate to="/login" replace />;
  if (!data) return <div className="p-8"><p role="alert" className="text-bad">{dataError ?? 'No se pudieron cargar los datos'} <button className="underline" onClick={() => void reload()}>Reintentar</button></p></div>;
  return <AppShell />;
}

export default function App() {
  const init = useSession((s) => s.init);
  useEffect(() => { void init(); }, [init]);
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/onboarding" element={<Suspense fallback={<div className="p-8"><LoadingState /></div>}><OnboardingPage /></Suspense>} />
        <Route element={<Protected />}>
          {MODULES.map((m) => (<Route key={m.id} path={m.path === '/' ? undefined : `${m.path}/*`} index={m.path === '/'} element={<Guard m={m} />} />))}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
