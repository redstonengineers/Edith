import { useEffect, useState } from 'react';
import { BellRing, Mail, MessageCircle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/primitives';
import { Badge } from '@/components/ui/primitives';
import { useAction, useCan, useSnapshot, useUser } from '@/hooks';
import { fullName } from '@/lib/people';
import { dismissNotice, markNoticeSent } from '@/services/mutations';
import { IS_API } from '@/services/mode';
import { get } from '@/services/http';
import type { DeliveryStatus } from '@/types';
import { fmtAgo } from '@/utils/format';
import { waLink } from '../practicas/Whatsapp';

const LABEL: Record<DeliveryStatus, string> = { pendiente: 'enviando…', enviado: 'enviado', fallido: 'falló', manual: 'por enviar', no: '—' };
const TONE: Record<DeliveryStatus, 'neutral' | 'ok' | 'bad' | 'warn'> = { pendiente: 'warn', enviado: 'ok', fallido: 'bad', manual: 'warn', no: 'neutral' };

/** Avisos al alumno por cambios que le afectan: qué se avisó, por qué canal y si llegó. WhatsApp sin conexión automática se envía con un toque. */
export default function AvisosPage() {
  const snap = useSnapshot(); const run = useAction(); const can = useCan(); const user = useUser(); const write = can('practicas:write');
  const [chan, setChan] = useState<{ email: boolean; whatsapp: boolean }>({ email: false, whatsapp: false });
  useEffect(() => { if (IS_API) void get<{ email: boolean; whatsapp: boolean }>('/channels/status').then(setChan).catch(() => undefined); }, []);
  const rows = [...snap.outbox].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const stu = (id: string) => { const s = snap.students.find((x) => x.id === id); return s ? fullName(s) : 'Alumno'; };
  const toSend = rows.filter((r) => r.waStatus === 'manual').length;
  return (
    <>
      <PageHeader title="Avisos a alumnos" description="Cada cambio que afecta al alumno (práctica nueva, cambiada o cancelada; exámenes y resultados) se le avisa solo." />
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div className="panel flex items-center gap-3 p-4"><Mail size={18} aria-hidden /><div><p className="text-sm font-medium">Correo · {chan.email ? 'automático' : 'no conectado'}</p><p className="text-xs text-muted">{chan.email ? 'Se envía solo al alumno (y a su tutor si es menor).' : 'Falta conectar el servicio de correo (RESEND_API_KEY).'}</p></div></div>
        <div className="panel flex items-center gap-3 p-4"><MessageCircle size={18} aria-hidden /><div><p className="text-sm font-medium">WhatsApp · {chan.whatsapp ? 'automático' : 'con un toque'}</p><p className="text-xs text-muted">{chan.whatsapp ? 'Se envía solo desde el número de la autoescuela.' : 'El mensaje sale ya escrito: pulsa «Enviar» y se abre WhatsApp.'}</p></div></div>
      </div>
      {toSend > 0 && <p className="mb-3 rounded-lg border border-line bg-surface-2 px-4 py-2.5 text-sm" role="status"><BellRing size={14} className="mr-2 inline" aria-hidden />Tienes <b>{toSend}</b> {toSend === 1 ? 'aviso' : 'avisos'} de WhatsApp por enviar.</p>}
      {rows.length === 0 ? <EmptyState icon={BellRing} title="Aún no hay avisos" description="Cuando apuntes, cambies o canceles una práctica, o anotes un examen, el aviso aparecerá aquí." /> : (
        <ul className="panel divide-y divide-line">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-start gap-3 px-5 py-3.5">
              <div className="min-w-0 flex-1"><p className="text-sm font-medium">{r.subject} <span className="font-normal text-muted">· {stu(r.studentId)}</span></p><p className="mt-0.5 text-sm whitespace-pre-line text-muted">{r.body}</p><p className="mt-1 text-xs text-muted">{fmtAgo(r.createdAt)}{r.note ? ` · ${r.note}` : ''}</p></div>
              <div className="flex flex-wrap items-center gap-2"><Badge tone={TONE[r.emailStatus]}><Mail size={11} aria-hidden />{LABEL[r.emailStatus]}</Badge><Badge tone={TONE[r.waStatus]}><MessageCircle size={11} aria-hidden />{LABEL[r.waStatus]}</Badge>
                {write && r.waStatus === 'manual' && r.to.filter((t) => t.phone).map((t) => <a key={t.phone} href={waLink(t.phone!, r.body)} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-medium hover:bg-surface-2" onClick={() => void run(() => markNoticeSent(user, r.id), 'Marcado como enviado')}>Enviar a {t.name}</a>)}
                {write && <Button aria-label="Quitar aviso" onClick={() => void run(() => dismissNotice(user, r.id), 'Aviso quitado')}>Quitar</Button>}</div>
            </li>))}
        </ul>)}
    </>
  );
}
