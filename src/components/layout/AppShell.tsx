import { Suspense, useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AiPanel } from '@/components/ai/AiPanel';
import { CommandPalette } from '@/components/command/CommandPalette';
import { Toaster } from '@/components/ui/Toaster';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { ShortcutsDialog } from '@/components/ui/ShortcutsDialog';
import { MODULES } from '@/config/modules';
import { LoadingState } from '@/components/ui/primitives';
import { useSettings } from '@/hooks';
import { applyBranding } from '@/lib/branding';
import { useUi } from '@/store/ui';
import { Header } from './Header';
import { OfflineBanner } from './OfflineBanner';
import { MobileNav } from './MobileNav';
import { Sidebar } from './Sidebar';

export function AppShell() {
  const settings = useSettings();
  const pref = useUi((s) => s.theme);
  const theme = pref ?? settings.branding.theme;
  const { pathname } = useLocation();
  const setMobileNav = useUi((s) => s.setMobileNav);
  useEffect(() => { applyBranding(settings, theme); }, [settings, theme]);
  const main = useRef<HTMLElement>(null); const first = useRef(true);
  useEffect(() => {
    // Foco y scroll al inicio en cada cambio de ruta (lectores de pantalla y teclado).
    setMobileNav(false);
    if (!first.current) { main.current?.scrollTo(0, 0); main.current?.focus({ preventScroll: true }); } first.current = false;
  }, [pathname, setMobileNav]);
  useEffect(() => {
    const m = [...MODULES].sort((a, b) => b.path.length - a.path.length).find((x) => (x.path === '/' ? pathname === '/' : pathname.startsWith(x.path)));
    document.title = `${m && m.id !== 'dashboard' ? (m.labelKey ? settings.labels[m.labelKey].plural : m.title) + ' · ' : ''}${settings.branding.name}`;
  }, [pathname, settings]);

  return (
    <div className="ambient flex h-full">
      <a href="#main" className="sr-only z-[100] rounded bg-brand px-3 py-2 text-on-brand focus:not-sr-only focus:fixed focus:top-2 focus:left-2">Saltar al contenido</a>
      <Sidebar />
      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <Header theme={theme} />
        <OfflineBanner />
        <main ref={main} id="main" tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto px-4 pt-6 pb-24 outline-none sm:px-6 lg:px-8 lg:pb-10">
          <div key={pathname} className="anim-rise mx-auto w-full max-w-[1400px]">
            <ErrorBoundary><Suspense fallback={<LoadingState />}><Outlet /></Suspense></ErrorBoundary>
          </div>
        </main>
      </div>
      <MobileNav />
      <CommandPalette />
      <AiPanel />
      <ShortcutsDialog />
      <Toaster />
    </div>
  );
}
