import type { Channel, Message } from '@/types';

/**
 * Punto de integración para canales de comunicación. Hoy solo "app" entrega de verdad (queda en el buzón);
 * el resto son adaptadores simulados que se sustituirán por proveedores reales (email, WhatsApp Business, SMS, push)
 * ejecutados en el backend con cola de envío y credenciales fuera del frontend.
 */
export interface ChannelAdapter { id: Channel; label: string; live: boolean; send(msg: Message): Promise<{ delivered: boolean; note?: string }> }

const simulated = (id: Channel, label: string): ChannelAdapter => ({ id, label, live: false, async send() { return { delivered: false, note: `Canal «${label}» aún no conectado: el aviso queda registrado en la app.` }; } });
export const CHANNELS: Record<Channel, ChannelAdapter> = {
  app: { id: 'app', label: 'En la app', live: true, async send() { return { delivered: true }; } },
  email: simulated('email', 'Correo electrónico'), whatsapp: simulated('whatsapp', 'WhatsApp'), sms: simulated('sms', 'SMS'), push: simulated('push', 'Notificación push'),
};
