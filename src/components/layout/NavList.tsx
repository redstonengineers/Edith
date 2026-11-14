import { NavLink } from 'react-router-dom';
import { SECTION_ORDER, SECTION_TITLES, type ModuleDef } from '@/config/modules';
import { useModuleTitle, useVisibleModules } from '@/hooks';
import { cn } from '@/utils/cn';

/** Lista de navegación generada desde el registro de módulos. Compartida por sidebar y drawer móvil. */
export function NavList({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const modules = useVisibleModules();
  const title = useModuleTitle();
  const grouped = SECTION_ORDER.map((s) => ({ s, items: modules.filter((m) => m.section === s) })).filter((g) => g.items.length);

  const item = (m: ModuleDef) => {
    const Icon = m.icon;
    return (
      <NavLink key={m.id} to={m.path} end={m.path === '/'} onClick={onNavigate} title={collapsed ? title(m) : undefined} aria-label={collapsed ? title(m) : undefined}
        className={({ isActive }) => cn('group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13.5px] transition-colors', collapsed && 'justify-center px-0',
          isActive ? 'bg-brand/12 font-medium text-fg' : 'text-muted hover:bg-surface-2 hover:text-fg')}>
        {({ isActive }) => (
          <>
            {isActive && <span aria-hidden className="absolute top-1.5 bottom-1.5 -left-3 w-[3px] rounded-full bg-brand" />}
            <Icon size={18} className={cn('shrink-0', isActive && 'text-brand-text')} aria-hidden />
            {!collapsed && <span className="truncate">{title(m)}</span>}
          </>
        )}
      </NavLink>
    );
  };

  return (
    <nav aria-label="Navegación principal" className="flex flex-col gap-5 px-3 py-3">
      {grouped.map(({ s, items }) => (
        <div key={s}>
          {s !== 'core' && (collapsed ? <hr className="mx-2 mb-2 border-line" /> : <h3 className="mb-1.5 px-2.5 text-[10px] font-semibold tracking-[0.16em] text-muted uppercase">{SECTION_TITLES[s]}</h3>)}
          <div className="flex flex-col gap-0.5">{items.map(item)}</div>
        </div>
      ))}
    </nav>
  );
}
