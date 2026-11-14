import { format, formatDistanceToNowStrict, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export const todayISO = (now = new Date()) => format(now, 'yyyy-MM-dd');
export const tomorrowISO = (now = new Date()) => format(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1), 'yyyy-MM-dd');
export const fmtDate = (iso: string, pattern = "d 'de' MMMM") => format(parseISO(iso), pattern, { locale: es });
export const fmtLongToday = (now = new Date()) => format(now, "EEEE, d 'de' MMMM", { locale: es });
export const fmtAgo = (iso: string) => formatDistanceToNowStrict(parseISO(iso), { locale: es, addSuffix: true });
export const fmtMoney = (n: number, currency = 'EUR', locale = 'es-ES') =>
  new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
export const fmtPct = (n: number) => `${Math.round(n)} %`;

export function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 6 ? 'Buenas noches' : h < 13 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches';
}

/** Minúsculas sin acentos, para búsqueda tolerante. */
export const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export const hhmmToMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
export const initials = (name: string) => name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
