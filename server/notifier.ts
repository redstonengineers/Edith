import { createHmac } from 'node:crypto';
import { addHours, format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { inQuietHours, quietHours, reminderHours } from '../src/lib/notices';
import { queueNotice } from '../src/services/notices';
import { getDatabase } from '../src/services/database';
import { mailEnabled, sendMail } from './mailer';

/**
 * Entrega de los avisos a alumnos (bandeja `outbox`). Cada canal es un «proveedor» que se activa solo si tiene sus claves en el entorno del servidor
 * (nunca en el frontend); sin claves, el aviso queda en la página «Avisos» y WhatsApp se envía con un toque (wa.me).
 *
 *  Correo (Resend)        RESEND_API_KEY, MAIL_FROM
 *  WhatsApp (Meta Cloud)  WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, WHATSAPP_TEMPLATE (plantilla aprobada con UN parámetro {{1}}), WHATSAPP_LANG (es)
 *                         Sin plantilla se envía texto libre, que Meta solo admite si el alumno escribió en las últimas 24 h.
 *  Webhook firmado        NOTIFY_WEBHOOK_URL, NOTIFY_WEBHOOK_SECRET — cada aviso se envía como JSON a Make, Zapier, n8n o a tu propio servicio,
 *                         con las cabeceras X-Edith-Timestamp y X-Edith-Signature (sha256=HMAC de «timestamp.cuerpo»). Sirve para conectar
 *                         cualquier app de mensajería (Telegram, SMS, Slack…) sin tocar el código.
 *  Zona horaria           NOTICES_TZ (por defecto Europe/Madrid): para las horas de descanso y los recordatorios.
 */
const TOKEN = process.env.WHATSAPP_TOKEN; const PHONE_ID = process.env.WHATSAPP_PHONE_ID; const TEMPLATE = process.env.WHATSAPP_TEMPLATE; const LANG = process.env.WHATSAPP_LANG ?? 'es';
const BASE = process.env.WHATSAPP_API_BASE ?? 'https://graph.facebook.com/v21.0';
const HOOK = process.env.NOTIFY_WEBHOOK_URL; const HOOK_SECRET = process.env.NOTIFY_WEBHOOK_SECRET ?? '';
const TZ = process.env.NOTICES_TZ ?? 'Europe/Madrid';
export const whatsappEnabled = () => !!TOKEN && !!PHONE_ID;
export const webhookEnabled = () => !!HOOK;
export const waNumber = (phone: string) => { const d = phone.replace(/\D/g, ''); return d.length === 9 ? `34${d}` : d.replace(/^00/, ''); };
const MAX_ATTEMPTS = 3;

/** Fecha y hora locales (de la zona de los avisos) como texto, para comparar con las de prácticas (que son «de reloj»). */
export function localNow(at = new Date()): { date: string; time: string } {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(at).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

export async function sendWhatsapp(phone: string, text: string): Promise<string | null> {
  if (!whatsappEnabled()) return 'WhatsApp no configurado';
  const to = waNumber(phone); if (to.length < 9) return `Teléfono no válido (${phone})`;
  const payload = TEMPLATE
    ? { messaging_product: 'whatsapp', to, type: 'template', template: { name: TEMPLATE, language: { code: LANG }, components: [{ type: 'body', parameters: [{ type: 'text', text: text.replace(/\s*\n+\s*/g, ' · ').slice(0, 1000) }] }] } }
    : { messaging_product: 'whatsapp', to, type: 'text', text: { body: text.slice(0, 3000) } };
  try {
    const r = await fetch(`${BASE}/${PHONE_ID}/messages`, { method: 'POST', headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(15_000) });
    if (r.ok) return null; const j = (await r.json().catch(() => ({}))) as { error?: { message?: string } }; return `WhatsApp HTTP ${r.status}${j.error?.message ? `: ${j.error.message}` : ''}`;
  } catch (e) { return (e as Error).message; }
}

export async function sendWebhook(payload: Record<string, unknown>): Promise<string | null> {
  if (!HOOK) return 'Webhook no configurado';
  const body = JSON.stringify(payload); const ts = String(Math.floor(Date.now() / 1000));
  const sig = createHmac('sha256', HOOK_SECRET).update(`${ts}.${body}`).digest('hex');
  try {
    const r = await fetch(HOOK, { method: 'POST', headers: { 'content-type': 'application/json', 'x-edith-timestamp': ts, 'x-edith-signature': `sha256=${sig}`, 'user-agent': 'EDITH-notices/1' }, body, signal: AbortSignal.timeout(15_000) });
    return r.ok ? null : `Webhook HTTP ${r.status}`;
  } catch (e) { return (e as Error).message; }
}

/** Prueba de envío (solo administradores): manda un mensaje de ejemplo por cada canal conectado y cuenta cómo ha ido. */
export async function testChannels(target: { email?: string; phone?: string }, academy: string): Promise<Record<'email' | 'whatsapp' | 'webhook', string>> {
  const text = `Prueba de avisos de ${academy}: si lees esto, el canal funciona.`;
  const res = { email: 'no conectado', whatsapp: 'no conectado', webhook: 'no conectado' };
  if (mailEnabled()) { if (!target.email) res.email = 'indica un correo'; else { const r = await sendMail([target.email], 'Prueba de avisos', text); res.email = r.ok ? 'enviado' : r.error ?? 'falló'; } }
  if (whatsappEnabled()) { if (!target.phone) res.whatsapp = 'indica un teléfono'; else res.whatsapp = (await sendWhatsapp(target.phone, text)) ?? 'enviado'; }
  if (webhookEnabled()) res.webhook = (await sendWebhook({ type: 'test', academy, text, at: new Date().toISOString() })) ?? 'enviado';
  return res;
}

let running = false;
/** Entrega lo pendiente. Respeta las horas de descanso de cada academia. Un fallo se reintenta (hasta 3 veces) antes de quedar «fallido». */
export async function deliverOutbox(flush: () => void): Promise<number> {
  if (running) return 0; running = true; let n = 0;
  try {
    const db = getDatabase(); const hhmm = localNow().time;
    for (const o of db.outbox ?? []) {
      if (o.emailStatus !== 'pendiente' && o.waStatus !== 'pendiente' && o.hookStatus !== 'pendiente') continue;
      // Los negocios de demostración NUNCA envían nada real (ni correo, ni WhatsApp, ni webhook): el aviso se da por entregado en simulación.
      if (db.academies.find((a) => a.id === o.academyId)?.isDemo === true) {
        if (o.emailStatus === 'pendiente') o.emailStatus = 'enviado'; if (o.waStatus === 'pendiente') o.waStatus = 'enviado'; if (o.hookStatus === 'pendiente') o.hookStatus = 'enviado';
        o.note = 'Simulado (demo): no se ha enviado nada real'; n++; continue;
      }
      const st = db.settings.find((s) => s.academyId === o.academyId); if (inQuietHours(quietHours(st?.notices), hhmm)) continue; // espera a que acabe el descanso
      const notes: string[] = []; o.attempts++;
      if (o.emailStatus === 'pendiente') {
        const addrs = [...new Set(o.to.map((t) => t.email).filter(Boolean) as string[])];
        const r = mailEnabled() && addrs.length ? await sendMail(addrs, o.subject, o.body) : { ok: false, error: 'Correo no configurado' };
        if (r.ok) o.emailStatus = 'enviado'; else { notes.push(r.error ?? 'Correo no enviado'); if (o.attempts >= MAX_ATTEMPTS) o.emailStatus = 'fallido'; }
      }
      if (o.waStatus === 'pendiente') {
        const errs: string[] = []; const acad = db.academies.find((a) => a.id === o.academyId);
        for (const t of o.to) if (t.phone) { const e = await sendWhatsapp(t.phone, o.body); if (e) errs.push(e); else if (acad) { const m = localNow().date.slice(0, 7); acad.waUsage = { ...acad.waUsage, [m]: (acad.waUsage?.[m] ?? 0) + 1 }; } }
        if (!errs.length) o.waStatus = 'enviado'; else { notes.push(errs[0]); if (o.attempts >= MAX_ATTEMPTS) o.waStatus = 'fallido'; }
      }
      if (o.hookStatus === 'pendiente') {
        const stu = db.students.find((s) => s.id === o.studentId); const e = await sendWebhook({ type: 'notice', id: o.id, academyId: o.academyId, academy: st?.branding.name, event: o.event, kind: o.kind, createdAt: o.createdAt, student: { id: o.studentId, name: stu ? `${stu.firstName} ${stu.lastName}` : undefined }, to: o.to, subject: o.subject, body: o.body });
        if (!e) o.hookStatus = 'enviado'; else { notes.push(e); if (o.attempts >= MAX_ATTEMPTS) o.hookStatus = 'fallido'; }
      }
      o.note = notes.join(' · ') || undefined; n++;
    }
  } finally { running = false; }
  if (n) flush();
  return n;
}

/** Recordatorio automático: avisa de las prácticas que empiezan dentro de las próximas N horas (por academia; 0 = desactivado). Una sola vez por práctica. */
export function queueReminders(at = new Date()): number {
  const db = getDatabase(); const { date: today, time } = localNow(at); const nowLocal = parseISO(`${today}T${time}:00`); let n = 0;
  for (const a of db.academies) {
    const st = db.settings.find((s) => s.academyId === a.id); const hours = reminderHours(st?.notices); if (!hours || a.status !== 'active') continue;
    const limit = addHours(nowLocal, hours); const tomorrow = format(addHours(parseISO(`${today}T12:00:00`), 24), 'yyyy-MM-dd');
    for (const p of db.practices) {
      if (p.academyId !== a.id || p.status !== 'programada' || p.remindedAt) continue;
      const start = parseISO(`${p.date}T${p.start}:00`); if (start <= nowLocal || start > limit) continue;
      const t = db.teachers.find((x) => x.id === p.teacherId); const fecha = format(parseISO(p.date), "EEEE d 'de' MMMM", { locale: es });
      const cuando = p.date === today ? 'hoy' : p.date === tomorrow ? 'mañana' : `el ${fecha}`;
      p.remindedAt = at.toISOString();
      if (queueNotice(a.id, p.studentId, 'practica', 'practica_recordatorio', `rem_${p.id}`, { fecha, hora: p.start, cuando, profesor: t ? `${t.firstName} ${t.lastName}` : 'tu profesor' })) n++;
    }
  }
  return n;
}
