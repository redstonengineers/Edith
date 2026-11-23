import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/utils/cn';

export interface Series { id: string; label: string; color: string; values: (number | null)[] }
/** Máximo del eje = 4 escalones "limpios" (1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10 × 10^n); mínimo 1 por escalón. */
const nice = (max: number) => { const raw = Math.max(1, max / 4); const p = Math.pow(10, Math.floor(Math.log10(raw))); const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((m) => m * p).find((x) => x >= raw - 1e-9)!; return Math.max(4, step * 4); };

function useWidth() {
  const ref = useRef<HTMLDivElement>(null); const [w, setW] = useState(600);
  useEffect(() => { if (!ref.current) return; const ro = new ResizeObserver(([e]) => setW(Math.max(200, e.contentRect.width))); ro.observe(ref.current); return () => ro.disconnect(); }, []);
  return [ref, w] as const;
}

/** Tarjeta de gráfico: título, leyenda (siempre con ≥2 series) y alternancia gráfico/tabla accesible. */
export function ChartCard({ title, subtitle, legend, table, children, className }: { title: string; subtitle?: string; legend?: { label: string; color: string }[]; table: { columns: string[]; rows: (string | number)[][] }; children: ReactNode; className?: string }) {
  const [asTable, setAsTable] = useState(false); const id = useId();
  return (
    <section aria-labelledby={id} className={cn('panel flex flex-col', className)}>
      <header className="flex items-start justify-between gap-3 px-5 pt-4">
        <div><h2 id={id} className="text-xs font-semibold text-muted">{title}</h2>{subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}</div>
        <button onClick={() => setAsTable(!asTable)} aria-pressed={asTable} className="shrink-0 rounded-md border border-line px-2 py-1 text-xs text-muted hover:text-fg">{asTable ? 'Ver gráfico' : 'Ver tabla'}</button>
      </header>
      {legend && legend.length >= 2 && !asTable && <ul className="flex flex-wrap gap-x-4 gap-y-1 px-5 pt-2 text-xs">{legend.map((l) => <li key={l.label} className="flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: l.color }} />{l.label}</li>)}</ul>}
      <div className="flex-1 px-5 pt-3 pb-5">
        {asTable ? (
          <div className="max-h-64 overflow-auto"><table className="w-full text-left text-[13px]"><thead><tr className="text-xs text-muted">{table.columns.map((c) => <th key={c} scope="col" className="py-1.5 pr-3 font-semibold">{c}</th>)}</tr></thead>
            <tbody>{table.rows.map((r, i) => <tr key={i} className="border-t border-line/60">{r.map((c, j) => <td key={j} className="tnum py-1.5 pr-3">{c}</td>)}</tr>)}</tbody></table></div>
        ) : children}
      </div>
    </section>
  );
}

interface Tip { x: number; y: number; title: string; rows: { color: string; label: string; value: string }[] }
function Tooltip({ tip, width }: { tip: Tip | null; width: number }) {
  if (!tip) return null;
  const left = Math.min(Math.max(tip.x, 70), width - 70);
  return (
    <div role="status" className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-xs shadow-xl" style={{ left, top: tip.y - 8 }}>
      <p className="mb-0.5 font-medium capitalize">{tip.title}</p>
      {tip.rows.map((r) => <p key={r.label} className="flex items-center gap-1.5 whitespace-nowrap"><span aria-hidden className="h-2 w-2 rounded-sm" style={{ background: r.color }} /><span className="text-muted">{r.label}</span><span className="tnum ml-auto pl-3 font-semibold">{r.value}</span></p>)}
    </div>
  );
}

const PAD = { l: 38, r: 8, t: 8, b: 24 };

/** Líneas (1-3 series). Crosshair + tooltip con todas las series. Marcas finas, rejilla recesiva. */
export function LineChart({ labels, series, format = (v) => String(v), height = 200, area, max: fixedMax, ariaLabel }: { labels: string[]; series: Series[]; format?: (v: number) => string; height?: number; area?: boolean; max?: number; ariaLabel: string }) {
  const [ref, w] = useWidth(); const [hover, setHover] = useState<number | null>(null);
  const vals = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const max = fixedMax ?? nice(Math.max(1, ...vals)); const iw = w - PAD.l - PAD.r, ih = height - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (labels.length === 1 ? iw / 2 : (i / (labels.length - 1)) * iw); const y = (v: number) => PAD.t + ih - (v / max) * ih;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  return (
    <div ref={ref} className="relative" onMouseLeave={() => setHover(null)}>
      <svg width={w} height={height} role="img" aria-label={ariaLabel}>
        {ticks.map((t) => <g key={t}><line x1={PAD.l} x2={w - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} /><text x={PAD.l - 6} y={y(t) + 3} textAnchor="end" fontSize={10} fill="var(--muted)" className="tnum">{format(Math.round(t * 10) / 10)}</text></g>)}
        {labels.map((l, i) => <text key={i} x={x(i)} y={height - 6} textAnchor="middle" fontSize={10} fill="var(--muted)">{l}</text>)}
        {series.map((s) => {
          const pts = s.values.map((v, i) => (v === null ? null : [x(i), y(v)] as const));
          const d = pts.reduce((acc, p) => (p ? acc + `${acc && !acc.endsWith('Z') ? 'L' : 'M'}${p[0]},${p[1]}` : acc), '');
          const first = pts.find(Boolean), last = [...pts].reverse().find(Boolean);
          return (<g key={s.id}>
            {area && first && last && <path d={`${d}L${last[0]},${y(0)}L${first[0]},${y(0)}Z`} fill={s.color} opacity={0.12} />}
            <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {pts.map((p, i) => p && <circle key={i} cx={p[0]} cy={p[1]} r={hover === i ? 5 : 3.5} fill={s.color} stroke="var(--surface)" strokeWidth={2} />)}
          </g>);
        })}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={PAD.t + ih} stroke="var(--line-strong)" strokeWidth={1} />}
        {labels.map((_, i) => <rect key={i} x={x(i) - iw / labels.length / 2} y={PAD.t} width={Math.max(8, iw / labels.length)} height={ih} fill="transparent" tabIndex={0} role="img" aria-label={`${labels[i]}: ${series.map((s) => `${s.label} ${s.values[i] === null ? 'sin datos' : format(s.values[i]!)}`).join(', ')}`} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} />)}
      </svg>
      <Tooltip width={w} tip={hover === null ? null : { x: x(hover), y: PAD.t + 24, title: labels[hover], rows: series.map((s) => ({ color: s.color, label: s.label, value: s.values[hover] === null ? '—' : format(s.values[hover]!) })) }} />
    </div>
  );
}

/** Barras verticales agrupadas (1-3 series). Extremo redondeado de 4 px anclado a la base, 2 px de separación. */
export function BarChart({ labels, series, format = (v) => String(v), height = 200, highlightLast, ariaLabel }: { labels: string[]; series: Series[]; format?: (v: number) => string; height?: number; highlightLast?: boolean; ariaLabel: string }) {
  const [ref, w] = useWidth(); const [hover, setHover] = useState<number | null>(null);
  const max = nice(Math.max(1, ...series.flatMap((s) => s.values.map((v) => v ?? 0)))); const iw = w - PAD.l - PAD.r, ih = height - PAD.t - PAD.b;
  const band = iw / labels.length; const bw = Math.min(28, (band * 0.62) / series.length - 2); const y = (v: number) => PAD.t + ih - (v / max) * ih;
  return (
    <div ref={ref} className="relative" onMouseLeave={() => setHover(null)}>
      <svg width={w} height={height} role="img" aria-label={ariaLabel}>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => <g key={t}><line x1={PAD.l} x2={w - PAD.r} y1={y(t * max)} y2={y(t * max)} stroke="var(--line)" /><text x={PAD.l - 6} y={y(t * max) + 3} textAnchor="end" fontSize={10} fill="var(--muted)" className="tnum">{format(Math.round(t * max * 10) / 10)}</text></g>)}
        {labels.map((l, i) => {
          const cx = PAD.l + band * i + band / 2; const total = series.length * (bw + 2) - 2;
          return (<g key={i}>
            <text x={cx} y={height - 6} textAnchor="middle" fontSize={10} fill="var(--muted)">{l}</text>
            {series.map((s, k) => { const v = s.values[i] ?? 0; const bx = cx - total / 2 + k * (bw + 2); const h = Math.max(v > 0 ? 2 : 0, (v / max) * ih); const r = Math.min(4, h, bw / 2);
              return <path key={s.id} d={`M${bx},${PAD.t + ih}V${PAD.t + ih - h + r}Q${bx},${PAD.t + ih - h} ${bx + r},${PAD.t + ih - h}H${bx + bw - r}Q${bx + bw},${PAD.t + ih - h} ${bx + bw},${PAD.t + ih - h + r}V${PAD.t + ih}Z`} fill={s.color} opacity={highlightLast && i < labels.length - 1 ? 0.55 : hover !== null && hover !== i ? 0.5 : 1} />; })}
            <rect x={PAD.l + band * i} y={PAD.t} width={band} height={ih} fill="transparent" tabIndex={0} role="img" aria-label={`${labels[i]}: ${series.map((s) => `${s.label} ${format(s.values[i] ?? 0)}`).join(', ')}`} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} />
          </g>);
        })}
      </svg>
      <Tooltip width={w} tip={hover === null ? null : { x: PAD.l + band * hover + band / 2, y: Math.max(30, y(Math.max(...series.map((s) => s.values[hover] ?? 0)))), title: labels[hover], rows: series.map((s) => ({ color: s.color, label: s.label, value: format(s.values[hover] ?? 0) })) }} />
    </div>
  );
}

/** Ranking horizontal en HTML (accesible). `marker` pinta una referencia (p. ej. objetivo). */
export function RankBars({ items, format = (v) => String(v), color = 'var(--brand)', max, warnOver }: { items: { id: string; label: string; value: number; marker?: number; sub?: string }[]; format?: (v: number) => string; color?: string; max?: number; warnOver?: boolean }) {
  const m = max ?? Math.max(1, ...items.map((i) => Math.max(i.value, i.marker ?? 0))) * 1.1;
  return (
    <ul className="space-y-2.5">{items.map((it) => (
      <li key={it.id} className="grid grid-cols-[minmax(0,9.5rem)_1fr_auto] items-center gap-3 text-[13px]" title={it.sub}>
        <span className="truncate">{it.label}</span>
        <span className="relative h-2.5 rounded-full bg-line/70" role="img" aria-label={`${it.label}: ${format(it.value)}${it.marker ? ` de ${format(it.marker)}` : ''}`}>
          <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(100, (it.value / m) * 100)}%`, background: warnOver && it.marker && it.value > it.marker ? 'var(--warn)' : color }} />
          {it.marker !== undefined && <span aria-hidden className="absolute -top-1 -bottom-1 w-0.5 rounded bg-fg/70" style={{ left: `${Math.min(100, (it.marker / m) * 100)}%` }} />}
        </span>
        <span className="tnum w-20 text-right font-medium">{format(it.value)}</span>
      </li>))}</ul>
  );
}

/** Barra apilada de composición, con 2 px de separación y leyenda con cifras. */
export function StackedBar({ parts, ariaLabel }: { parts: { label: string; value: number; color: string }[]; ariaLabel: string }) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  return (
    <div>
      <div role="img" aria-label={ariaLabel} className="flex h-5 gap-0.5 overflow-hidden rounded-md">{parts.filter((p) => p.value > 0).map((p) => <span key={p.label} title={`${p.label}: ${p.value}`} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} />)}</div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-3">{parts.map((p) => <li key={p.label} className="flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} /><span className="text-muted">{p.label}</span><span className="tnum ml-auto font-medium">{p.value}</span></li>)}</ul>
    </div>
  );
}
