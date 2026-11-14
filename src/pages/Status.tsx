import { Lock, SearchX } from 'lucide-react';
import { EmptyState } from '@/components/ui/primitives';
import { LinkButton } from '@/components/ui/Button';

export function NotFoundPage() {
  return <div className="panel"><EmptyState icon={SearchX} title="Página no encontrada" description="La dirección no existe o ha cambiado." action={<LinkButton to="/" variant="primary">Ir al Command Center</LinkButton>} /></div>;
}
export function ForbiddenPage({ reason }: { reason: 'disabled' | 'denied' }) {
  return <div className="panel"><EmptyState icon={Lock} title={reason === 'disabled' ? 'Módulo no activado' : 'Sin permisos'} description={reason === 'disabled' ? 'Este módulo no está activo en tu academia. Un administrador puede activarlo en Personalización.' : 'Tu rol no tiene acceso a esta sección.'} action={<LinkButton to="/" variant="primary">Volver al inicio</LinkButton>} /></div>;
}
