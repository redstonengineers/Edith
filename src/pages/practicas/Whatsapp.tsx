import { useMemo, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { Textarea } from '@/components/ui/form';
import { Modal } from '@/components/ui/Overlay';
import { useSnapshot } from '@/hooks';
import type { Practice } from '@/types';
import { fmtDate } from '@/utils/format';
import { usePracticeNames } from './PracticeForm';

/** Número español a formato internacional para wa.me (acepta 9 dígitos o ya con prefijo). */
export const waNumber = (phone: string) => { const d = phone.replace(/\D/g, ''); return d.length === 9 ? `34${d}` : d.replace(/^00/, ''); };
export const waLink = (phone: string, text: string) => `https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(text)}`;

type Kind = 'recordatorio' | 'cancelada' | 'cambio';
/** Mensaje ya escrito para avisar al alumno; lo envía la persona desde WhatsApp (la app no envía nada). */
export function WhatsappSheet({ practice, onClose }: { practice: Practice; onClose: () => void }) {
  const snap = useSnapshot(); const names = usePracticeNames(); const stu = snap.students.find((s) => s.id === practice.studentId); const school = snap.academy.name;
  const day = fmtDate(practice.date, "EEEE d 'de' MMMM"); const first = stu?.firstName ?? '';
  const templates = useMemo<Record<Kind, string>>(() => ({
    recordatorio: `Hola ${first}, te recuerdo tu práctica de conducir el ${day} a las ${practice.start} con ${names.teacher(practice.teacherId)}. Si no puedes venir, avísanos. — ${school}`,
    cancelada: `Hola ${first}, tenemos que cancelar tu práctica del ${day} a las ${practice.start}. Te propondremos otra hora enseguida. Disculpa las molestias. — ${school}`,
    cambio: `Hola ${first}, cambiamos tu práctica del ${day}: ahora será a las ${practice.start}. ¿Te viene bien? — ${school}`,
  }), [first, day, practice, names, school]);
  const [kind, setKind] = useState<Kind>(practice.status === 'cancelada' ? 'cancelada' : 'recordatorio'); const [edited, setEdited] = useState<string | null>(null); const text = edited ?? templates[kind];
  return (
    <Modal open onClose={onClose} label="Avisar por WhatsApp" className="max-w-lg">
      <div className="space-y-3 p-6">
        <h2 className="flex items-center gap-2 text-base font-semibold"><MessageCircle size={18} aria-hidden />Avisar a {first || 'el alumno'} por WhatsApp</h2>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Tipo de mensaje">{(['recordatorio', 'cancelada', 'cambio'] as Kind[]).map((k) => <button key={k} type="button" aria-pressed={kind === k} onClick={() => { setKind(k); setEdited(null); }} className={`h-8 rounded-full border px-3 text-xs ${kind === k ? 'border-brand bg-brand/15 text-brand-text' : 'border-line text-muted hover:bg-surface-2'}`}>{{ recordatorio: 'Recordatorio', cancelada: 'Clase cancelada', cambio: 'Cambio de hora' }[k]}</button>)}</div>
        <Textarea aria-label="Mensaje" rows={5} value={text} onChange={(e) => setEdited(e.target.value)} />
        <p className="text-xs text-muted">Puedes cambiar el texto. Se abrirá WhatsApp con el mensaje preparado y lo envías tú; EDITH no manda nada por su cuenta.</p>
        <div className="flex justify-end gap-2"><button className="h-9 rounded-lg border border-line px-3.5 text-sm hover:bg-surface-2" onClick={onClose}>Cerrar</button>
          {stu?.phone ? <a href={waLink(stu.phone, text)} target="_blank" rel="noopener noreferrer" onClick={onClose} className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-3.5 text-sm font-medium text-on-brand">Abrir WhatsApp</a> : <span className="self-center text-sm text-warn">El alumno no tiene teléfono.</span>}</div>
      </div>
    </Modal>
  );
}
