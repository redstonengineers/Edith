import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { SECTION_ORDER, SECTION_TITLES, type ModuleDef } from '@/config/modules';
import { useModuleTitle, useVisibleModules } from '@/hooks';
import { cn } from '@/utils/cn';

/** Lista de navegación generada desde el registro de módulos. Compartida por sidebar y drawer móvil. */
const KEY = 'ac.nav.closed';
const readClosed = (): string[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; } };
export function NavList({ collapsed = false, onNavigate, editorial = false }: { collapsed?: boolean; onNavigate?: () => void; editorial?: boolean }) {
  const { pathname } = useLocation(); const [closed, setClosed] = useState<string[]>(readClosed);
  const toggleSec = (s: string) => setClosed((c) => { const n = c.includes(s) ? c.filter((x) => x !== s) : [...c, s]; localStorage.setItem(KEY, JSON.stringify(n)); return n; });
  const modules = useVisibleModules();
  const title = useModuleTitle();
  const grouped = SECTION_ORDER.map((s) => ({ s, items: modules.filter((m) => m.section === s) })).filter((g) => g.items.length);

  // En modo editorial, la sección de la página actual se abre sola.
  useEffect(() => {
    if (!editorial) return; const cur = grouped.find((g) => g.items.some((m) => (m.path === '/' ? pathname === '/' : pathname.startsWith(m.path))));
    if (cur && closed.includes(cur.s)) setClosed((c) => c.filter((x) => x !== cur.s));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, editorial]);
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
    <nav aria-label="Navegación principal" className={cn('flex flex-col px-3 py-3', editorial && !collapsed ? 'nav-editorial gap-1' : 'gap-5')}>
      {grouped.map(({ s, items }) => {
        if (editorial && !collapsed && s !== 'core') {
          const open = !closed.includes(s); const id = `nav-sec-${s}`;
          return (
            <div key={s} className="nav-sec" data-open={open}>
              <button type="button" className="nav-sec-h" aria-expanded={open} aria-controls={id} onClick={() => toggleSec(s)}>
                <ChevronRight size={12} aria-hidden className="nav-sec-chev" /><span>{SECTION_TITLES[s]}</span><span className="nav-sec-n" aria-hidden>{items.length}</span>
              </button>
              <div id={id} className="nav-sec-body" role="group" aria-label={SECTION_TITLES[s]} inert={!open}><div className="nav-sec-inner flex flex-col gap-0.5">{items.map(item)}</div></div>
            </div>);
        }
        return (
          <div key={s}>
            {s !== 'core' && (collapsed ? <hr className="mx-2 mb-2 border-line" /> : <h3 className="mb-1.5 px-2.5 text-xs font-semibold tracking-[0.16em] text-muted uppercase">{SECTION_TITLES[s]}</h3>)}
            <div className="flex flex-col gap-0.5">{items.map(item)}</div>
          </div>);
      })}
    </nav>
  );
}
