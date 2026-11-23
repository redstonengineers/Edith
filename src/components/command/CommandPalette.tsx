import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CornerDownLeft, Search } from 'lucide-react';
import { Modal } from '@/components/ui/Overlay';
import { Kbd } from '@/components/ui/primitives';
import { useHotkey } from '@/hooks';
import { buildIndex, searchIndex, type SearchGroup } from '@/lib/search';
import { useSession } from '@/store/session';
import { useUi } from '@/store/ui';
import { norm } from '@/utils/format';
import { cn } from '@/utils/cn';
import { useCommands, type Command } from './useCommands';
import { Users, GraduationCap, UsersRound, FileText, FolderOpen, AlertTriangle, Hourglass, type LucideIcon } from 'lucide-react';

const GROUP_META: Record<SearchGroup, { title: (l: NonNullable<ReturnType<typeof useSession.getState>['data']>['settings']['labels']) => string; icon: LucideIcon }> = {
  students: { title: (l) => l.student.plural, icon: Users },
  teachers: { title: (l) => l.teacher.plural, icon: GraduationCap },
  groups: { title: (l) => l.group.plural, icon: UsersRound },
  exams: { title: (l) => l.exam.plural, icon: FileText },
  documents: { title: (l) => l.document.plural, icon: FolderOpen },
  incidents: { title: (l) => l.incident.plural, icon: AlertTriangle },
  waitlist: { title: () => 'Lista de espera', icon: Hourglass },
};

interface Row { key: string; group: string; title: string; subtitle?: string; icon: LucideIcon; run: () => void }

export function CommandPalette() {
  const open = useUi((s) => s.paletteOpen);
  const setOpen = useUi((s) => s.setPalette);
  const data = useSession((s) => s.data);
  const navigate = useNavigate();
  const commands = useCommands();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);

  useHotkey('k', (e) => { e.preventDefault(); setOpen(!useUi.getState().paletteOpen); }, { mod: true });
  useEffect(() => { setQ(''); setActive(0); }, [open]); // se limpia también al cerrar, para que al reabrir con una tecla rápida no se mezcle con la búsqueda anterior

  const index = useMemo(() => (data ? buildIndex(data) : []), [data]);

  const rows = useMemo<Row[]>(() => {
    if (!data) return [];
    const close = () => setOpen(false);
    const toRow = (c: Command): Row => ({ key: c.id, group: c.group, title: c.title, subtitle: c.hint, icon: c.icon, run: () => { close(); c.run(); } });
    const tokens = norm(q).split(/\s+/).filter(Boolean);
    let cmds = commands;
    if (tokens.length) {
      // Relevancia: coincidencia en el título pesa más que en las palabras clave; empezar por la palabra, más aún.
      const rel = (c: Command) => { const t = norm(c.title); return tokens.reduce((n, k) => n + (t.split(/\s+/).some((w) => w.startsWith(k)) ? 3 : t.includes(k) ? 2 : 0), 0); };
      cmds = commands.filter((c) => { const h = norm(`${c.title} ${c.keywords}`); return tokens.every((t) => h.includes(t)); }).map((c, i) => ({ c, i, r: rel(c) })).sort((a, b) => b.r - a.r || a.i - b.i).map((x) => x.c);
    }
    else cmds = [...commands.filter((c) => c.quick), ...commands.filter((c) => !c.quick).slice(0, 5)];
    const res: Row[] = cmds.slice(0, 9).map(toRow);
    for (const e of searchIndex(index, q)) {
      const meta = GROUP_META[e.group];
      res.push({ key: `${e.group}-${e.id}`, group: meta.title(data.settings.labels).toUpperCase(), title: e.title, subtitle: e.subtitle, icon: meta.icon, run: () => { close(); navigate(e.href); } });
    }
    return res;
  }, [q, commands, index, data, navigate, setOpen]);

  useEffect(() => { setActive(0); }, [q]);
  useEffect(() => { listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' }); }, [active]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(rows.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); rows[active]?.run(); }
  };

  let lastGroup = '';
  return (
    <Modal open={open} onClose={() => setOpen(false)} label="Buscador global y comandos" className="max-w-2xl overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line px-4">
        <Search size={18} className="text-muted" aria-hidden />
        <input data-autofocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder="Busca alumnos, grupos, exámenes… o escribe una acción"
          role="combobox" aria-expanded aria-controls={listId} aria-activedescendant={rows[active] ? `${listId}-${active}` : undefined} aria-autocomplete="list" aria-label="Buscar o ejecutar comando"
          className="h-14 w-full bg-transparent text-[15px] outline-none placeholder:text-muted" />
        <Kbd>Esc</Kbd>
      </div>
      <ul id={listId} ref={listRef} role="listbox" aria-label="Resultados" className="max-h-[52vh] overflow-y-auto p-2">
        {rows.length === 0 && <li className="px-4 py-10 text-center text-sm text-muted">Sin resultados para «{q}». Prueba con otro nombre o “nuevo alumno”.</li>}
        {rows.map((r, i) => {
          const header = r.group !== lastGroup; lastGroup = r.group;
          const Icon = r.icon;
          return (
            <li key={r.key} role="presentation">
              {header && <div role="presentation" className="px-3 pt-3 pb-1 text-xs font-semibold text-muted">{r.group}</div>}
              <div id={`${listId}-${i}`} data-idx={i} role="option" aria-selected={i === active} onMouseMove={() => setActive(i)} onClick={r.run}
                className={cn('flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5', i === active ? 'bg-brand/12 text-fg' : 'text-fg/90')}>
                <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-md border', i === active ? 'border-brand/40 text-brand-text' : 'border-line text-muted')}><Icon size={16} aria-hidden /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm">{r.title}</span>{r.subtitle && <span className="block truncate text-xs text-muted">{r.subtitle}</span>}</span>
                {i === active && <CornerDownLeft size={14} className="text-muted" aria-hidden />}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center gap-4 border-t border-line px-4 py-2 text-xs text-muted">
        <span><Kbd>↑</Kbd> <Kbd>↓</Kbd> navegar</span><span><Kbd>↵</Kbd> abrir</span><span className="ml-auto"><Kbd>Ctrl</Kbd> <Kbd>K</Kbd></span>
      </div>
    </Modal>
  );
}
