import { Select } from '@/components/ui/form';
import { Panel } from '@/components/ui/primitives';
import { useAction, useCan, useUser } from '@/hooks';
import { setStudentTraining } from '@/services/mutations';
import type { Student } from '@/types';

/** Cómo avisar a esta persona de los cambios que le afectan (clases, citas…). */
export function NoticePref({ student: s }: { student: Student }) {
  const user = useUser(); const run = useAction(); const edit = useCan()('students:write');
  return (
    <Panel title="Avisos">
      <label className="block text-xs text-muted">Avisar por<Select aria-label="Avisar por" disabled={!edit} value={s.notifyVia ?? 'ambos'} onChange={(e) => void run(() => setStudentTraining(user, s.id, { notifyVia: e.target.value as 'ambos' | 'correo' | 'whatsapp' | 'nada' }), 'Preferencia de avisos guardada')} className="mt-1"><option value="ambos">Correo y WhatsApp</option><option value="correo">Solo correo</option><option value="whatsapp">Solo WhatsApp</option><option value="nada">No avisar</option></Select></label>
    </Panel>
  );
}
