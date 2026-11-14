const rgb = (hex: string): [number, number, number] => { const h = hex.replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number]; };
const lin = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
export const luminance = (hex: string) => { const [r, g, b] = rgb(hex); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
export const contrast = (a: string, b: string) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
/** Color de texto legible sobre un fondo de marca (oscuro o blanco, el que más contraste dé). */
export const onColor = (bg: string) => (contrast(bg, '#04121c') >= contrast(bg, '#ffffff') ? '#04121c' : '#ffffff');
export const SURFACES = { dark: '#0d1320', light: '#ffffff' } as const;
