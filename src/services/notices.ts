import { differenceInYears, parseISO } from 'date-fns';
import type { ID } from '@/types';
import { noticeChannels, renderTemplate, resolveNotice } from '@/lib/notices';
import { AUTO } from './channels';
import { getDatabase } from './database';

let n = 0;
/**
 * Pone en la bandeja de salida el aviso de un evento para el alumno (y su tutor si es menor).
 * Respeta: el evento activado o no y su texto (ajustes de la academia), los canales de la academia y la preferencia del alumno.
 * Un cambio sobre lo mismo (`ref`) antes de que salga el aviso anterior lo sustituye en vez de duplicarlo.
 * El servidor entrega la bandeja (correo, WhatsApp, webhook); sin conexión, WhatsApp queda «por enviar» con un toque.
 */
export function queueNotice(academyId: string, studentId: ID, kind: 'practica' | 'examen' | 'clase', event: string, ref: ID, vars: Record<string, string | number | undefined> = {}): boolean {
  const db = getDatabase(); const s = db.students.find((x) => x.id === studentId && x.academyId === academyId); if (!s || s.status === 'baja') return false;
  const settings = db.settings.find((x) => x.academyId === academyId); const tpl = resolveNotice(settings, event); if (!tpl.enabled) return false;
  const via = s.notifyVia ?? 'ambos'; if (via === 'nada') return false; const ch = noticeChannels(settings?.notices);
  const to: { name: string; email?: string; phone?: string }[] = [{ name: s.firstName, email: s.email || undefined, phone: s.phone || undefined }];
  const g = s.guardianId ? db.guardians.find((x) => x.id === s.guardianId && x.academyId === academyId) : undefined;
  if (g && differenceInYears(new Date(), parseISO(s.birthDate)) < 18) to.push({ name: g.name, email: g.email || undefined, phone: g.phone || undefined });
  const wantMail = ch.email && (via === 'ambos' || via === 'correo') && to.some((t) => t.email); const wantWa = ch.whatsapp && (via === 'ambos' || via === 'whatsapp') && to.some((t) => t.phone); const wantHook = ch.webhook && AUTO.webhook;
  if (!wantMail && !wantWa && !wantHook) return false;
  const school = settings?.branding.name ?? db.academies.find((a) => a.id === academyId)?.name ?? '';
  const all = { nombre: s.firstName, escuela: school, ...vars };
  const subject = renderTemplate(tpl.subject, all); const body = `${renderTemplate(tpl.body, all)}\n— ${school}`;
  const emailStatus = wantMail && AUTO.email ? 'pendiente' as const : 'no' as const; const waStatus = wantWa ? (AUTO.whatsapp ? 'pendiente' as const : 'manual' as const) : 'no' as const; const hookStatus = wantHook ? 'pendiente' as const : 'no' as const;
  const box = (db.outbox ??= []); const open = box.find((o) => o.academyId === academyId && o.ref === ref && o.attempts === 0 && o.emailStatus !== 'enviado' && o.waStatus !== 'enviado' && o.hookStatus !== 'enviado');
  const now = new Date().toISOString();
  if (open) { Object.assign(open, { subject, body, to, emailStatus, waStatus, hookStatus, event, createdAt: now }); return true; }
  box.unshift({ academyId, id: `${academyId}_avi_${Date.now().toString(36)}${(n++).toString(36)}`, studentId, kind, ref, event, to, subject, body, createdAt: now, emailStatus, waStatus, hookStatus, attempts: 0 });
  if (box.length > 500) box.length = 500;
  return true;
}
