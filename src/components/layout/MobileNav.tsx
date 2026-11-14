import { NavLink } from 'react-router-dom';
import { LayoutGrid } from 'lucide-react';
import { Drawer } from '@/components/ui/Overlay';
import { useModuleTitle, useSettings, useVisibleModules } from '@/hooks';
import { useUi } from '@/store/ui';
import { cn } from '@/utils/cn';
import { BrandMark } from './Brand';
import { NavList } from './NavList';

const PREFERRED = ['dashboard', 'students', 'schedule', 'attendance', 'payments'];

export function MobileNav() {
  const open = useUi((s) => s.mobileNavOpen);
  const setOpen = useUi((s) => s.setMobileNav);
  const modules = useVisibleModules();
  const title = useModuleTitle();
  const { branding } = useSettings();
  const bar = PREFERRED.map((id) => modules.find((m) => m.id === id)).filter(Boolean).slice(0, 4) as typeof modules;
  return (
    <>
      <Drawer open={open} onClose={() => setOpen(false)} label="Menú de navegación" side="left" className="w-[min(86vw,320px)]">
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-line px-4"><BrandMark /><p className="truncate text-sm font-semibold">{branding.name}</p></div>
        <div className="min-h-0 flex-1 overflow-y-auto"><NavList onNavigate={() => setOpen(false)} /></div>
      </Drawer>
      <nav aria-label="Acceso rápido" className="fixed inset-x-0 bottom-0 z-30 grid border-t border-line bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden" style={{ gridTemplateColumns: `repeat(${bar.length + 1}, 1fr)` }}>
        {bar.map((m) => { const Icon = m.icon; return (
          <NavLink key={m.id} to={m.path} end={m.path === '/'} className={({ isActive }) => cn('flex flex-col items-center gap-0.5 py-2 text-[10.5px]', isActive ? 'text-brand-text' : 'text-muted')}>
            <Icon size={20} aria-hidden /><span className="max-w-full truncate px-1">{m.id === 'dashboard' ? 'Inicio' : title(m)}</span>
          </NavLink>); })}
        <button onClick={() => setOpen(true)} className="flex flex-col items-center gap-0.5 py-2 text-[10.5px] text-muted"><LayoutGrid size={20} aria-hidden />Más</button>
      </nav>
    </>
  );
}
