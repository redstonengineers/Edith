import { useRef, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/form';
import { Modal } from '@/components/ui/Overlay';
import { SignaturePad, type PadHandle } from '@/components/ui/SignaturePad';
import { useSnapshot, useUser } from '@/hooks';
import { fmtHours, hoursOf } from '@/lib/practices';
import { closePractice } from '@/services/offline';
import { useSession } from '@/store/session';
import { useUi } from '@/store/ui';
import type { Practice } from '@/types';
import { fmtDate } from '@/utils/format';
import { usePracticeNames } from './PracticeForm';

/** «Terminar clase y firmar»: pantalla limpia para pasar el móvil. Firma el alumno, luego el profesor, y se guarda. */
export function SignFlow({ practice, onClose, onDone }: { practice: Practice; onClose: () => void; onDone: () => void }) {
  const user = useUser(); const reload = useSession((s) => s.reload); const toast = useUi((s) => s.toast); const names = usePracticeNames(); const snap = useSnapshot(); const pad = useRef<PadHandle>(null);
  const [step, setStep] = useState<'alumno' | 'entrega' | 'profesor'>('alumno'); const [empty, setEmpty] = useState(true); const [stuSig, setStuSig] = useState<string | null>(null); const [km, setKm] = useState(practice.km ? String(practice.km) : ''); const [busy, setBusy] = useState(false);
  const v = snap.vehicles.find((x) => x.id === practice.vehicleId);
  const next = () => { const s = pad.current?.toDataURL(); if (!s) return; setStuSig(s); setEmpty(true); setStep('entrega'); };
  const save = async () => {
    const s = pad.current?.toDataURL(); if (!s || !stuSig) return; setBusy(true);
    try {
      const how = await closePractice(user, practice, `${names.student(practice.studentId)} · ${fmtDate(practice.date, 'd MMM')} ${practice.start}`, { km: km ? Number(km) : undefined, studentSig: stuSig, teacherSig: s });
      await reload().catch(() => undefined);
      toast(how === 'sent' ? { kind: 'success', title: 'Práctica firmada y guardada' } : { kind: 'success', title: 'Firma guardada en este móvil', description: 'Se enviará sola cuando vuelva la conexión.' });
      onDone();
    } catch (e) { toast({ kind: 'error', title: 'No se pudo completar', description: (e as Error).message }); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} label="Firmar práctica" className="max-w-lg">
      <div className="space-y-4 p-6">
        {step !== 'entrega' && (<>
          <div><p className="text-xs text-muted">{step === 'alumno' ? 'Firma del alumno' : 'Firma del profesor'}</p>
            <p className="mt-1 text-lg font-semibold">{names.student(practice.studentId)}</p>
            <p className="text-sm text-muted">Práctica del {fmtDate(practice.date, "EEEE d 'de' MMMM")} · {practice.start}–{practice.end} ({fmtHours(hoursOf(practice))}){v ? ` · ${v.model} ${v.plate}` : ''} · {names.teacher(practice.teacherId)}</p></div>
          <SignaturePad key={step} ref={pad} label={`Firma del ${step}`} onChange={setEmpty} />
          {step === 'profesor' && <label className="block text-sm">Kilómetros de la práctica<Input type="number" min={0} value={km} onChange={(e) => setKm(e.target.value)} className="mt-1 w-32" /></label>}
          <div className="flex justify-end gap-2"><Button onClick={onClose}>Cancelar</Button>
            {step === 'alumno' ? <Button variant="primary" disabled={empty} onClick={next}>Firmar</Button> : <Button variant="primary" disabled={empty || busy} onClick={() => void save()}>Guardar clase firmada</Button>}</div>
        </>)}
        {step === 'entrega' && (
          <div className="py-6 text-center"><CheckCircle2 size={40} className="mx-auto text-ok" aria-hidden /><p className="mt-3 text-lg font-semibold">Firma recibida</p><p className="mt-1 text-sm text-muted">Devuelve el móvil a tu profesor.</p>
            <Button variant="primary" className="mt-5" onClick={() => setStep('profesor')}>Soy el profesor · Continuar</Button></div>)}
      </div>
    </Modal>
  );
}
