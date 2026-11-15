import { getDatabase } from '../src/services/database';
import { mailEnabled, sendMail } from './mailer';

/**
 * Entrega de los avisos a alumnos (bandeja `outbox`): correo con Resend y WhatsApp con la API Cloud de Meta.
 * Entorno del servidor (nunca en el frontend):
 *   WHATSAPP_TOKEN, WHATSAPP_PHONE_ID   token permanente y «Phone number ID» de WhatsApp Business
 *   WHATSAPP_TEMPLATE                   plantilla aprobada con UN parámetro de cuerpo ({{1}} = el texto del aviso).
 *                                       Sin plantilla se envía texto libre, que Meta solo admite si el alumno escribió en las últimas 24 h.
 *   WHATSAPP_LANG                       idioma de la plantilla (por defecto es)
 * Sin claves, los avisos quedan en la página «Avisos» y WhatsApp se envía con un toque (wa.me).
 */
const TOKEN = process.env.WHATSAPP_TOKEN; const PHONE_ID = process.env.WHATSAPP_PHONE_ID; const TEMPLATE = process.env.WHATSAPP_TEMPLATE; const LANG = process.env.WHATSAPP_LANG ?? 'es';
const BASE = process.env.WHATSAPP_API_BASE ?? 'https://graph.facebook.com/v21.0';
export const whatsappEnabled = () => !!TOKEN && !!PHONE_ID;
export const waNumber = (phone: string) => { const d = phone.replace(/\D/g, ''); return d.length === 9 ? `34${d}` : d.replace(/^00/, ''); };
const MAX_ATTEMPTS = 3;

async function sendWhatsapp(phone: string, text: string): Promise<string | null> {
  const to = waNumber(phone); if (to.length < 9) return `Teléfono no válido (${phone})`;
  const payload = TEMPLATE
    ? { messaging_product: 'whatsapp', to, type: 'template', template: { name: TEMPLATE, language: { code: LANG }, components: [{ type: 'body', parameters: [{ type: 'text', text: text.replace(/\s*\n+\s*/g, ' · ').slice(0, 1000) }] }] } }
    : { messaging_product: 'whatsapp', to, type: 'text', text: { body: text.slice(0, 3000) } };
  try {
    const r = await fetch(`${BASE}/${PHONE_ID}/messages`, { method: 'POST', headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(15_000) });
    if (r.ok) return null; const j = (await r.json().catch(() => ({}))) as { error?: { message?: string } }; return `WhatsApp HTTP ${r.status}${j.error?.message ? `: ${j.error.message}` : ''}`;
  } catch (e) { return (e as Error).message; }
}

let running = false;
/** Entrega lo pendiente. Un fallo se reintenta (hasta 3 veces) antes de quedar «fallido». */
export async function deliverOutbox(flush: () => void): Promise<number> {
  if (running) return 0; running = true; let n = 0;
  try {
    for (const o of getDatabase().outbox ?? []) {
      if (o.emailStatus !== 'pendiente' && o.waStatus !== 'pendiente') continue; const notes: string[] = []; o.attempts++;
      if (o.emailStatus === 'pendiente') {
        const addrs = [...new Set(o.to.map((t) => t.email).filter(Boolean) as string[])];
        const r = mailEnabled() && addrs.length ? await sendMail(addrs, o.subject, o.body) : { ok: false, error: 'Correo no configurado' };
        if (r.ok) o.emailStatus = 'enviado'; else { notes.push(r.error ?? 'Correo no enviado'); if (o.attempts >= MAX_ATTEMPTS) o.emailStatus = 'fallido'; }
      }
      if (o.waStatus === 'pendiente') {
        const errs: string[] = []; for (const t of o.to) if (t.phone) { const e = await sendWhatsapp(t.phone, o.body); if (e) errs.push(e); }
        if (!errs.length) o.waStatus = 'enviado'; else { notes.push(errs[0]); if (o.attempts >= MAX_ATTEMPTS) o.waStatus = 'fallido'; }
      }
      o.note = notes.join(' · ') || undefined; n++;
    }
  } finally { running = false; }
  if (n) flush();
  return n;
}
