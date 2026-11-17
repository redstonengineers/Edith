import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, Copy, ExternalLink } from 'lucide-react';
import { useUi } from '@/store/ui';
import { ContextMenu, type MenuItem } from './ContextMenu';
import { cn } from '@/utils/cn';
import { EmptyState } from './primitives';
import type { LucideIcon } from 'lucide-react';

export interface Column<T> { key: string; header: string; cell: (row: T) => ReactNode; sort?: (a: T, b: T) => number; className?: string; hide?: 'md' | 'lg' | 'xl'; align?: 'right' }

const hideCls = { md: 'hidden md:table-cell', lg: 'hidden lg:table-cell', xl: 'hidden xl:table-cell' };

/** Tabla genérica: ordenación, paginación y fila clicable (la 1.ª columna debe contener el enlace accesible). */
export function DataTable<T>({ rows, columns, rowKey, onRowClick, rowMenu, pageSize = 12, label, empty, defaultSort }: {
  rows: T[]; columns: Column<T>[]; rowKey: (r: T) => string; onRowClick?: (r: T) => void; /** Acciones extra del menú contextual (clic derecho / pulsación larga). «Abrir» y «Copiar fila» van siempre. */ rowMenu?: (r: T) => MenuItem[]; pageSize?: number; label: string;
  empty?: { icon?: LucideIcon; title: string; description?: string; action?: ReactNode }; defaultSort?: { key: string; dir: 'asc' | 'desc' };
}) {
  const [sort, setSort] = useState(defaultSort ?? null);
  const [page, setPage] = useState(0);
  const toast = useUi((s) => s.toast); const [menu, setMenu] = useState<{ at: { x: number; y: number }; items: MenuItem[] } | null>(null); const press = useRef<number | null>(null);
  const openMenu = (r: T, x: number, y: number, tr: HTMLElement) => {
    const items: MenuItem[] = [];
    if (onRowClick) items.push({ label: 'Abrir', icon: <ExternalLink size={14} />, onSelect: () => onRowClick(r) });
    items.push(...(rowMenu?.(r) ?? []));
    items.push({ label: 'Copiar fila', icon: <Copy size={14} />, onSelect: () => { const t = [...tr.querySelectorAll('td')].map((c) => c.innerText.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\t'); void navigator.clipboard?.writeText(t).then(() => toast({ kind: 'success', title: 'Fila copiada' }), () => toast({ kind: 'error', title: 'No se pudo copiar' })); } });
    setMenu({ at: { x, y }, items });
  };
  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort?.key);
    if (!col?.sort) return rows;
    const out = [...rows].sort(col.sort);
    return sort!.dir === 'desc' ? out.reverse() : out;
  }, [rows, sort, columns]);
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  useEffect(() => { if (page >= pages) setPage(0); }, [pages, page]);
  useEffect(() => { setPage(0); }, [rows.length]);
  const view = sorted.slice(page * pageSize, page * pageSize + pageSize);

  if (!rows.length) return <div className="panel"><EmptyState icon={empty?.icon} title={empty?.title ?? 'Sin resultados'} description={empty?.description} action={empty?.action} /></div>;

  const toggle = (k: string) => setSort((s) => (s?.key === k ? (s.dir === 'asc' ? { key: k, dir: 'desc' } : null) : { key: k, dir: 'asc' }));
  return (
    <div className="panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm" aria-label={label}>
          <thead>
            <tr className="border-b border-line text-[11px] tracking-[0.1em] text-muted uppercase">
              {columns.map((c) => {
                const active = sort?.key === c.key;
                return (
                  <th key={c.key} scope="col" aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined} className={cn('px-4 py-3 font-semibold', c.hide && hideCls[c.hide], c.align === 'right' && 'text-right')}>
                    {c.sort ? (
                      <button onClick={() => toggle(c.key)} className="inline-flex items-center gap-1 uppercase hover:text-fg">
                        {c.header}{active ? (sort!.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ChevronsUpDown size={12} className="opacity-40" />}
                      </button>) : c.header}
                  </th>);
              })}
            </tr>
          </thead>
          <tbody>
            {view.map((r) => (
              <tr key={rowKey(r)} onClick={onRowClick ? () => onRowClick(r) : undefined}
                onContextMenu={(e) => { e.preventDefault(); openMenu(r, e.clientX, e.clientY, e.currentTarget); }}
                onPointerDown={(e) => { if (e.pointerType !== 'touch') return; const tr = e.currentTarget; const x = e.clientX, y = e.clientY; press.current = window.setTimeout(() => openMenu(r, x, y, tr), 550); }}
                onPointerUp={() => { if (press.current) clearTimeout(press.current); }} onPointerMove={() => { if (press.current) clearTimeout(press.current); }} onPointerCancel={() => { if (press.current) clearTimeout(press.current); }}
                className={cn('border-b border-line/60 last:border-0', onRowClick && 'cursor-pointer hover:bg-surface-2/70')}>
                {columns.map((c) => <td key={c.key} className={cn('px-4 py-3 align-middle', c.hide && hideCls[c.hide], c.align === 'right' && 'text-right', c.className)}>{c.cell(r)}</td>)}
              </tr>))}
          </tbody>
        </table>
      </div>
      {menu && <ContextMenu at={menu.at} items={menu.items} onClose={() => setMenu(null)} />}
      <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-xs text-muted">
        <span aria-live="polite">{sorted.length} {sorted.length === 1 ? 'resultado' : 'resultados'}{pages > 1 && ` · página ${page + 1} de ${pages}`}</span>
        {pages > 1 && (
          <div className="flex gap-1">
            <button aria-label="Página anterior" disabled={page === 0} onClick={() => setPage(page - 1)} className="grid h-7 w-7 place-items-center rounded-md border border-line hover:bg-surface-2 disabled:opacity-40"><ChevronLeft size={14} /></button>
            <button aria-label="Página siguiente" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} className="grid h-7 w-7 place-items-center rounded-md border border-line hover:bg-surface-2 disabled:opacity-40"><ChevronRight size={14} /></button>
          </div>)}
      </div>
    </div>
  );
}
