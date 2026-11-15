import { useEffect, useMemo, useState } from 'react';
import { BellRing, MessageCircle, RotateCcw } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge, EmptyState, Panel } from '@/components/ui/primitives';
import { Tabs } from '@/components/ui/controls';
import { Input, Textarea } from '@/components/ui/form';
import { useAction, useCan, useLabels, useSettings, useSnapshot, useUser } from '@/hooks';
import { NOTICE_EVENTS, noticeChannels, quietHours, reminderHours, renderTemplate } from '@/lib/notices';
import { fullName } from '@/lib/people';
import { dismissNotice, markNoticeSent, retryNotice, updateNoticeSettings } from '@/services/mutations';
import { IS_API } from '@/services/mode';
import { get, post } from '@/services/http';
import type { DeliveryStatus, NoticeSettings } from '@/types';
import { fmtAgo } from '@/utils/format';
import { waLink } from '../practicas/Whatsapp';

const LABEL: Record<DeliveryStatus, string> = { pendiente: 'enviando…', enviado: 'enviado', fallido: 'falló', manual: 'por enviar', no: '—' };
const TONE: Record<DeliveryStatus, 'neutral' | 'ok' | 'bad' | 'warn'> = { pendiente: 'warn', enviado: 'ok', fallido: 'bad', manual: 'warn', no: 'neutral' };

/** Avisos al alumno por cambios que le afectan: qué se avisó, por qué canal y si llegó. WhatsApp sin conexión automática se envía con un toque. */
type Chan = { email: boolean; whatsapp: boolean; webhook: boolean };
function useChannels() { const [chan, setChan] = useState<Chan>({ email: false, whatsapp: false, webhook: false }); useEffect(() => { if (IS_API) void get<Chan>('/channels/status').then(setChan).catch(() => undefined); }, []); return chan; }

export default function AvisosPage() {
  const L = useLabels(); const can = useCan(); const who = L.student.plural.toLowerCase();
  return (
    <>
      <PageHeader title={`Avisos a ${who}`} description={`Cada cambio que afecta al ${L.student.singular.toLowerCase()} se le avisa solo, por correo y WhatsApp.`} />
      {can('settings:write') ? <Tabs tabs={[{ id: 'bandeja', label: 'Bandeja', content: <Inbox /> }, { id: 'config', label: 'Configuración', content: <Config /> }]} /> : <Inbox />}
    </>
  );
}

function Inbox() {
  const snap = useSnapshot(); const run = useAction(); const can = useCan(); const user = useUser(); const write = can('practicas:write'); const chan = useChannels();
  const rows = [...snap.outbox].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const stu = (id: string) => { const s = snap.students.find((x) => x.id === id); return s ? fullName(s) : 'Alumno'; };
  const toSend = rows.filter((r) => r.waStatus === 'manual').length;
  return (
    <>
      <div className="mb-4 grid gap-3">
        <div className="panel flex items-center gap-3 p-4"><MessageCircle size={18} aria-hidden /><div><p className="text-sm font-medium">WhatsApp · {chan.whatsapp ? 'automático' : 'con un toque'}</p><p className="text-xs text-muted">{chan.whatsapp ? 'Se envía solo desde el número del negocio.' : 'El mensaje sale ya escrito: pulsa «Enviar» y se abre WhatsApp.'}</p></div></div>
      </div>
      {toSend > 0 && <p className="mb-3 rounded-lg border border-line bg-surface-2 px-4 py-2.5 text-sm" role="status"><BellRing size={14} className="mr-2 inline" aria-hidden />Tienes <b>{toSend}</b> {toSend === 1 ? 'aviso' : 'avisos'} de WhatsApp por enviar.</p>}
      {rows.length === 0 ? <EmptyState icon={BellRing} title="Aún no hay avisos" description="Cuando apuntes, cambies o canceles una práctica, o anotes un examen, el aviso aparecerá aquí." /> : (
        <ul className="panel divide-y divide-line">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-start gap-3 px-5 py-3.5">
              <div className="min-w-0 flex-1"><p className="text-sm font-medium">{r.subject} <span className="font-normal text-muted">· {stu(r.studentId)}</span></p><p className="mt-0.5 text-sm whitespace-pre-line text-muted">{r.body}</p><p className="mt-1 text-xs text-muted">{fmtAgo(r.createdAt)}{r.note ? ` · ${r.note}` : ''}</p></div>
              <div className="flex flex-wrap items-center gap-2"><Badge tone={TONE[r.waStatus]}><MessageCircle size={11} aria-hidden />{LABEL[r.waStatus]}</Badge>
                {write && r.waStatus === 'manual' && r.to.filter((t) => t.phone).map((t) => <a key={t.phone} href={waLink(t.phone!, r.body)} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-medium hover:bg-surface-2" onClick={() => void run(() => markNoticeSent(user, r.id), 'Marcado como enviado')}>Enviar a {t.name}</a>)}
                {write && r.waStatus === 'fallido' && <Button aria-label="Reintentar aviso" onClick={() => void run(() => retryNotice(user, r.id), 'Reintentando')}><RotateCcw size={13} aria-hidden />Reintentar</Button>}
                {write && <Button aria-label="Quitar aviso" onClick={() => void run(() => dismissNotice(user, r.id), 'Aviso quitado')}>Quitar</Button>}</div>
            </li>))}
        </ul>)}
    </>
  );
}


const SAMPLE = { nombre: 'Lucía', escuela: 'tu negocio', fecha: 'lunes 3 de marzo', hora: '10:00', profesor: 'David Ruiz', cantidad: 4, tipo: 'teórico', cuando: 'mañana', materia: 'Matemáticas' };
const TZ_HINT = 'Hora local del negocio.';

/** Ajustes de los avisos: qué se avisa y con qué texto, canales, recordatorio automático y horas de descanso. */
function Config() {
  const st = useSettings(); const user = useUser(); const run = useAction(); const chan = useChannels(); const L = useLabels();
  const [n, setN] = useState<NoticeSettings>(() => JSON.parse(JSON.stringify(st.notices ?? {})) as NoticeSettings);
  const ch = noticeChannels(n); const q = quietHours(n); const rem = reminderHours(n);
  const groups = useMemo(() => { const g: Record<string, typeof NOTICE_EVENTS> = {}; for (const e of NOTICE_EVENTS) if (e.group === 'Clases' ? st.modules.classes : st.modules.practicas) (g[e.group] ??= []).push(e); return g; }, [st.modules]);
  const setEv = (key: string, patch: { enabled?: boolean; subject?: string; body?: string }) => setN((x) => ({ ...x, events: { ...x.events, [key]: { ...x.events?.[key], ...patch } } }));
  const [test, setTest] = useState({ email: '', phone: '' }); const [res, setRes] = useState<Record<string, string> | null>(null); const [busy, setBusy] = useState(false);
  const Toggle = ({ on, set, label }: { on: boolean; set: (b: boolean) => void; label: string }) => <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => set(!on)} className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors ${on ? 'border-brand bg-brand' : 'border-line bg-surface-2'}`}><span className={`absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} /></button>;
  const save = () => void run(() => updateNoticeSettings(user, n), 'Ajustes de avisos guardados');
  const sendTest = async () => { setBusy(true); try { setRes(await post<Record<string, string>>('/notices/test', test)); } catch (e) { setRes({ error: (e as Error).message }); } finally { setBusy(false); } };
  return (
    <div className="space-y-5">
      <Panel title="Canales">
        <ul className="divide-y divide-line text-sm">
          {([['whatsapp', 'WhatsApp', MessageCircle, chan.whatsapp, 'Sin conexión automática: queda «por enviar» con un toque.']] as const).map(([k, label, Icon, live, hint]) => (
            <li key={k} className="flex items-center gap-3 py-3"><Icon size={16} aria-hidden /><div className="flex-1"><p className="font-medium">{label} <Badge tone={live ? 'ok' : 'neutral'}>{live ? 'conectado' : 'no conectado'}</Badge></p><p className="text-xs text-muted">{live ? 'Se envía desde el servidor.' : hint}</p></div><Toggle on={ch[k]} set={(b) => setN((x) => ({ ...x, channels: { ...x.channels, [k]: b } }))} label={`${label} activado`} /></li>))}
        </ul>
        <p className="mt-2 text-xs text-muted">Además cuenta la preferencia de cada {L.student.singular.toLowerCase()} (en su ficha). Quien elige «No avisar» no recibe nada.</p>
      </Panel>
      <Panel title="Recordatorio y descanso">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">Recordatorio automático<span className="mt-1 flex items-center gap-2"><Input type="number" min={0} max={168} value={rem} aria-label="Horas de antelación del recordatorio" onChange={(e) => setN((x) => ({ ...x, reminderHours: Math.max(0, Math.min(168, Math.round(Number(e.target.value) || 0))) }))} className="w-24" /><span className="text-muted">horas antes de la práctica (0 = sin recordatorio)</span></span></label>
          <div className="text-sm"><p className="flex items-center gap-3">Horas de descanso <Toggle on={q.enabled} set={(b) => setN((x) => ({ ...x, quiet: { ...x.quiet, enabled: b } }))} label="Horas de descanso" /></p><p className="mt-1 flex items-center gap-2"><Input type="time" aria-label="Descanso desde" value={q.from} onChange={(e) => setN((x) => ({ ...x, quiet: { ...x.quiet, from: e.target.value } }))} className="w-28" disabled={!q.enabled} /><span className="text-muted">a</span><Input type="time" aria-label="Descanso hasta" value={q.to} onChange={(e) => setN((x) => ({ ...x, quiet: { ...x.quiet, to: e.target.value } }))} className="w-28" disabled={!q.enabled} /></p><p className="mt-1 text-xs text-muted">No se envían avisos en este tramo: esperan a que acabe. {TZ_HINT}</p></div>
        </div>
      </Panel>
      {Object.entries(groups).map(([group, evs]) => (
        <Panel key={group} title={`Avisos de ${group.toLowerCase()}`}>
          <ul className="divide-y divide-line">
            {evs.map((e) => { const c = n.events?.[e.key]; const on = c?.enabled !== false; const subject = c?.subject ?? e.subject; const body = c?.body ?? e.body; return (
              <li key={e.key} className="py-4">
                <div className="flex items-center gap-3"><p className="flex-1 text-sm font-medium">{e.label}</p>{(c?.subject || c?.body) && <button type="button" className="text-xs text-muted hover:text-fg" onClick={() => setEv(e.key, { subject: undefined, body: undefined })}>Restaurar texto</button>}<Toggle on={on} set={(b) => setEv(e.key, { enabled: b })} label={`Avisar: ${e.label}`} /></div>
                {on && (<div className="mt-3 space-y-2">
                  <Input aria-label={`Asunto: ${e.label}`} value={subject} onChange={(ev) => setEv(e.key, { subject: ev.target.value })} />
                  <Textarea aria-label={`Texto: ${e.label}`} rows={2} value={body} onChange={(ev) => setEv(e.key, { body: ev.target.value })} />
                  <p className="text-xs text-muted">Variables: {e.vars.map((v) => `{${v}}`).join(' ')}</p>
                  <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted"><b className="text-fg">Vista previa:</b> {renderTemplate(body, SAMPLE)}</p>
                </div>)}
              </li>); })}
          </ul>
        </Panel>))}
      <div className="flex justify-end"><Button variant="primary" onClick={save}>Guardar ajustes de avisos</Button></div>
      {IS_API && (
        <Panel title="Probar los canales">
          <p className="mb-3 text-sm text-muted">Envía un WhatsApp de prueba para comprobar que la conexión funciona.</p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-muted">Teléfono<Input type="tel" aria-label="Teléfono de prueba" value={test.phone} onChange={(e) => setTest({ ...test, phone: e.target.value })} placeholder="600 123 456" className="mt-1 w-44" /></label>
            <Button onClick={() => void sendTest()} disabled={busy}>Enviar prueba</Button>
          </div>
          {res && <ul className="mt-3 text-sm" aria-live="polite">{Object.entries(res).filter(([k]) => k === 'whatsapp' || k === 'error').map(([k, v]) => <li key={k}><b className="capitalize">{k}</b>: <span className={v === 'enviado' ? 'text-ok' : 'text-muted'}>{v}</span></li>)}</ul>}
        </Panel>)}
    </div>
  );
}
