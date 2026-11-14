import { Badge } from '@/components/ui/primitives';
import type { PayState } from '@/lib/people';
import type { StudentStatus } from '@/types';

export function StudentStatusBadge({ status }: { status: StudentStatus }) {
  const m = { activo: ['ok', 'Activo'], nuevo: ['brand', 'Nuevo'], inactivo: ['neutral', 'Inactivo'], baja: ['bad', 'Baja'] } as const;
  return <Badge tone={m[status][0]}>{m[status][1]}</Badge>;
}
export function PayBadge({ pay }: { pay: PayState }) {
  const m = { al_dia: ['ok', 'Al día'], pendiente: ['warn', 'Pendiente'], moroso: ['bad', 'Moroso'], sin_datos: ['neutral', '—'] } as const;
  return <Badge tone={m[pay][0]}>{m[pay][1]}</Badge>;
}
export function AttendanceCell({ pct, low }: { pct: number | null; low?: boolean }) {
  if (pct === null) return <span className="text-muted">—</span>;
  return <span className={`tnum ${low ? 'font-medium text-warn' : ''}`}>{Math.round(pct)} %{low && <span className="sr-only"> (por debajo del umbral)</span>}</span>;
}
