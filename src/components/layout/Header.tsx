import { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, LogOut, Menu, Moon, Palette, Search, Sparkles, Sun } from 'lucide-react';
import { Dropdown } from '@/components/ui/Dropdown';
import { Avatar, Kbd, StatusIndicator } from '@/components/ui/primitives';
import { useSettings, useSnapshot, useUser, useVisibleModules } from '@/hooks';
import { ROLE_LABELS } from '@/lib/permissions';
import { useSession } from '@/store/session';
import { useUi } from '@/store/ui';
import { fmtAgo } from '@/utils/format';
import { cn } from '@/utils/cn';
import { BrandMark } from './Brand';

const iconBtn = 'relative grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg';

export function Header({ theme }: { theme: 'dark' | 'light' }) {
  const user = useUser();
  const snap = useSnapshot();
  const { branding } = useSettings();
  const navigate = useNavigate();
  const { setPalette, setMobileNav, setAi, setTheme } = useUi();
  const signOut = useSession((s) => s.signOut);
  const modules = useVisibleModules();
  const unread = snap.notifications.filter((n) => !n.read).length;
  const bell = useRef<HTMLSpanElement>(null);
  useEffect(() => { if (unread && bell.current) { bell.current.classList.remove('anim-bell'); void bell.current.offsetWidth; bell.current.classList.add('anim-bell'); } }, [unread]);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-bg/75 px-3 backdrop-blur-xl sm:px-5">
      <button className={cn(iconBtn, 'lg:hidden')} onClick={() => setMobileNav(true)} aria-label="Abrir menú"><Menu size={20} /></button>
      <div className="flex items-center gap-2 lg:hidden"><BrandMark size={28} /></div>

      <button onClick={() => setPalette(true)} aria-label="Buscar o ejecutar un comando (Ctrl K)"
        className="mx-auto hidden h-10 w-full max-w-xl items-center gap-3 rounded-xl border border-line bg-surface/70 px-3.5 text-left text-sm text-muted transition-colors hover:border-line-strong md:flex">
        <Search size={16} aria-hidden /><span className="flex-1 truncate">Buscar o escribir una acción…</span><span className="flex gap-1"><Kbd>Ctrl</Kbd><Kbd>K</Kbd></span>
      </button>
      <div className="flex-1 md:hidden" />
      <button onClick={() => setPalette(true)} aria-label="Buscar" className={cn(iconBtn, 'md:hidden')}><Search size={19} /></button>

      <div className="hidden xl:block"><StatusIndicator label="System online" /></div>

      {modules.some((m) => m.id === 'ai') && (
        <button onClick={() => setAi(true)} className="hidden h-9 items-center gap-2 rounded-lg border border-brand/30 bg-brand/10 px-3 text-[13px] font-medium text-brand-text hover:bg-brand/15 sm:flex"><Sparkles size={15} aria-hidden />JARVIS</button>
      )}

      <Dropdown label="Notificaciones" width="w-[min(92vw,360px)]"
        trigger={({ props, open }) => (
          <button {...props} aria-label={`Notificaciones${unread ? `, ${unread} sin leer` : ''}`} className={cn(iconBtn, open && 'bg-surface-2 text-fg')}>
            <span ref={bell}><Bell size={19} /></span>
            {unread > 0 && <span className="absolute top-1.5 right-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-on-brand">{unread}</span>}
          </button>
        )}>
        {(close) => (
          <div>
            <div className="flex items-center justify-between border-b border-line px-4 py-3"><p className="text-sm font-semibold">Notificaciones</p><span className="text-xs text-muted">{unread} sin leer</span></div>
            <ul className="max-h-80 overflow-y-auto">
              {snap.notifications.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted">Sin notificaciones</li>}
              {snap.notifications.map((n) => (
                <li key={n.id}><button role="menuitem" onClick={() => { close(); if (n.href) navigate(n.href); }} className="flex w-full gap-3 px-4 py-3 text-left hover:bg-surface-2">
                  <span aria-hidden className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.read ? 'bg-line-strong' : 'bg-brand')} />
                  <span className="min-w-0"><span className="block text-sm font-medium">{n.title}</span><span className="block text-[13px] text-muted">{n.body}</span><span className="mt-0.5 block text-[11px] text-muted">{fmtAgo(n.createdAt)}</span></span>
                </button></li>
              ))}
            </ul>
          </div>
        )}
      </Dropdown>

      <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className={iconBtn} aria-label={`Cambiar a tema ${theme === 'dark' ? 'claro' : 'oscuro'}`}>{theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}</button>

      <Dropdown label="Menú de usuario" width="w-64"
        trigger={({ props }) => (
          <button {...props} aria-label="Menú de usuario" className="flex items-center gap-2 rounded-full p-0.5 pr-1 hover:bg-surface-2"><Avatar name={user.name} hue={user.avatarHue} size={34} /></button>
        )}>
        {(close) => (
          <div>
            <div className="border-b border-line px-4 py-3"><p className="text-sm font-semibold">{user.name}</p><p className="text-xs text-muted">{ROLE_LABELS[user.role]} · {branding.name}</p></div>
            <div className="p-1.5">
              {modules.some((m) => m.id === 'customization') && <Link role="menuitem" to="/personalizacion" onClick={close} className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm hover:bg-surface-2"><Palette size={16} aria-hidden />Personalización</Link>}
              <button role="menuitem" onClick={() => { close(); void signOut(); }} className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-bad hover:bg-bad/10"><LogOut size={16} aria-hidden />Cerrar sesión</button>
            </div>
          </div>
        )}
      </Dropdown>
    </header>
  );
}
