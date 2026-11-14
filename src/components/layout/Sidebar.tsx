import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useSettings } from '@/hooks';
import { useUi } from '@/store/ui';
import { cn } from '@/utils/cn';
import { BrandMark } from './Brand';
import { NavList } from './NavList';

export function Sidebar() {
  const collapsed = useUi((s) => s.sidebarCollapsed);
  const toggle = useUi((s) => s.toggleSidebar);
  const { branding } = useSettings();
  return (
    <aside aria-label="Barra lateral" className={cn('relative z-10 hidden shrink-0 flex-col border-r border-line bg-surface/80 backdrop-blur-xl transition-[width] duration-200 lg:flex', collapsed ? 'w-[68px]' : 'w-[248px]')}>
      <div className={cn('flex h-16 items-center gap-3 border-b border-line px-4', collapsed && 'justify-center px-0')}>
        <BrandMark />
        {!collapsed && <div className="min-w-0"><p className="truncate text-sm leading-tight font-semibold">{branding.name}</p><p className="text-[10px] tracking-[0.14em] text-muted uppercase">EDITH</p></div>}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto"><NavList collapsed={collapsed} /></div>
      <div className="border-t border-line p-3">
        <button onClick={toggle} aria-label={collapsed ? 'Expandir barra lateral' : 'Plegar barra lateral'} aria-expanded={!collapsed}
          className={cn('flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] text-muted hover:bg-surface-2 hover:text-fg', collapsed && 'justify-center px-0')}>
          {collapsed ? <PanelLeftOpen size={18} /> : <><PanelLeftClose size={18} /><span>Plegar</span></>}
        </button>
      </div>
    </aside>
  );
}
