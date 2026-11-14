import { Hammer } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/ui/primitives';
import { LinkButton } from '@/components/ui/Button';
import type { ModuleDef } from '@/config/modules';
import { useModuleTitle } from '@/hooks';

/** Pantalla honesta para módulos cuya implementación llega en una fase posterior. */
export default function ModulePlaceholder({ module: m }: { module: ModuleDef }) {
  const title = useModuleTitle();
  return (
    <>
      <PageHeader title={title(m)} description={m.description} />
      <div className="panel">
        <EmptyState icon={Hammer} title={`${title(m)} llega en la Fase ${m.phase}`} description="El módulo está registrado, activo y protegido por permisos; su pantalla se construye en la fase indicada del plan." action={<LinkButton to="/" variant="primary">Volver al Command Center</LinkButton>} />
      </div>
    </>
  );
}
