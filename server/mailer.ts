import type { ChannelAdapter } from '../src/services/channels';
import { getDatabase } from '../src/services/database';

/**
 * Email transaccional con Resend (https://resend.com). Configuración solo por entorno del servidor:
 *   RESEND_API_KEY  clave de la API (nunca en el frontend)
 *   MAIL_FROM       remitente verificado, p. ej. "EDITH <avisos@edith.redstonengineers.com>"
 * Sin clave el canal sigue marcado como no conectado y el aviso queda registrado en la app.
 */
const KEY = process.env.RESEND_API_KEY;
const FROM = process.env.MAIL_FROM ?? 'EDITH <onboarding@resend.dev>';
export const mailEnabled = () => !!KEY;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

export async function sendMail(to: string[], subject: string, text: string): Promise<{ ok: boolean; error?: string }> {
  if (!KEY) return { ok: false, error: 'Correo no configurado' };
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#17122b">${esc(text).replace(/\n/g, '<br>')}</div>`;
  try {
    // Un correo por destinatario (no se exponen direcciones entre sí); lotes de 100 con el endpoint batch.
    for (let i = 0; i < to.length; i += 100) {
      const batch = to.slice(i, i + 100).map((addr) => ({ from: FROM, to: [addr], subject, text, html }));
      const res = await fetch(`${process.env.MAIL_API_BASE ?? 'https://api.resend.com'}/emails/batch`, { method: 'POST', headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/json' }, body: JSON.stringify(batch), signal: AbortSignal.timeout(15_000) });
      if (!res.ok) return { ok: false, error: `Proveedor de correo: HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}

export const emailChannel: ChannelAdapter = {
  id: 'email', label: 'Correo electrónico', live: mailEnabled(),
  async send(msg) {
    const db = getDatabase(); const addrs = [...new Set(msg.toUserIds.map((id) => db.users.find((u) => u.id === id && u.academyId === msg.academyId && !u.disabled)?.email).filter(Boolean) as string[])];
    if (!addrs.length) return { delivered: false, note: 'Ningún destinatario tiene correo.' };
    const r = await sendMail(addrs, msg.subject, msg.body);
    return r.ok ? { delivered: true } : { delivered: false, note: r.error };
  },
};
