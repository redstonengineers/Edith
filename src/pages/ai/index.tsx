import { Eraser } from 'lucide-react';
import { Chat } from '@/components/ai/Chat';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/primitives';
import { useCan, useUser } from '@/hooks';
import { aiProvider } from '@/lib/ai';
import { useAi } from '@/store/ai';

export default function AiPage() {
  const can = useCan(); const user = useUser(); const { msgs, clear } = useAi();
  const scope = [['students:read', 'Alumnos y fichas'], ['teachers:read', 'Profesores y carga docente'], ['classes:read', 'Clases y horarios'], ['attendance:read', 'Asistencia'], ['exams:read', 'Exámenes y notas'], ['payments:read', 'Pagos y morosidad'], ['waitlist:read', 'Lista de espera'], ['incidents:read', 'Incidencias'], ['statistics:read', 'Estadísticas']] as const;
  return (
    <>
      <PageHeader title="JARVIS AI" description="Pregunta en lenguaje natural sobre tu academia." actions={msgs.length > 0 && <Button onClick={() => clear(user)}><Eraser size={15} />Borrar conversación</Button>} />
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="panel flex h-[68vh] min-h-[420px] flex-col"><Chat autoFocus /></div>
        <div className="space-y-6">
          <Panel title="Puede consultar">
            <ul className="space-y-1.5 text-sm">{scope.filter(([p]) => can(p)).map(([, l]) => <li key={l} className="flex items-center gap-2"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ok" />{l}</li>)}</ul>
            <p className="mt-3 text-xs text-muted">Solo ve datos de tu academia y a los que tu rol tiene acceso.</p>
          </Panel>
          <Panel title="Motor">
            <p className="text-sm">{aiProvider.label}</p>
            <p className="mt-1 text-xs text-muted">{aiProvider.id === 'mock' ? 'Respuestas calculadas localmente con tus datos, sin modelo de lenguaje. Se conecta a una API de IA real desde el backend (VITE_AI_PROVIDER=http) sin cambiar la interfaz.' : 'Conectado al servidor.'}</p>
          </Panel>
        </div>
      </div>
    </>
  );
}
