import type { Snapshot } from '@/services/repositories';
import type { Practice, User } from '@/types';
import { completePractice } from './mutations';
import { DomainError } from './mutations.local';
import { ApiError, get, OfflineError, rpc } from './http';
import { idb } from './idb';
import { IS_API } from './mode';
import { useNet, type PendingItem } from './net';

/**
 * Cierres de práctica firmados que se guardan primero en este dispositivo y se envían cuando hay red.
 * Cada cierre lleva un id propio (`opId`): el servidor lo reconoce y un reintento nunca duplica kilómetros ni firmas.
 */
export interface ClosePayload { km?: number; notes?: string; studentSig: string; teacherSig: string; opId: string; signedAt: string }
interface OutboxRow { k: string; userId: string; practiceId: string; label: string; payload: ClosePayload; createdAt: number; error?: string }

let currentUser: string | null = null;
export const setOfflineUser = (id: string | null) => { currentUser = id; void refreshPending(); };

const newOpId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`);
const mine = async () => (await idb.all<OutboxRow>('outbox').catch(() => [] as OutboxRow[])).filter((r) => r.userId === currentUser).sort((a, b) => a.createdAt - b.createdAt);

export async function refreshPending() {
  const rows = currentUser ? await mine() : [];
  const pending: PendingItem[] = rows.map((r) => ({ id: r.k, label: r.label, error: r.error }));
  useNet.setState({ pending });
}

/** Cierra una práctica con firmas: en modo demo se aplica al momento; con servidor se guarda en el dispositivo y se envía (ya, o al volver la red). */
export async function closePractice(user: User, practice: Practice, label: string, data: { km?: number; studentSig: string; teacherSig: string }): Promise<'sent' | 'queued'> {
  const payload: ClosePayload = { ...data, opId: newOpId(), signedAt: new Date().toISOString() };
  if (!IS_API) { completePractice(user, practice.id, payload); return 'sent'; }
  await idb.put('outbox', { k: payload.opId, userId: user.id, practiceId: practice.id, label, payload, createdAt: Date.now() } as OutboxRow);
  await refreshPending();
  await syncOutbox();
  const left = (await mine()).find((r) => r.k === payload.opId);
  if (!left) return 'sent';
  // Rechazo definitivo del servidor estando conectado (p. ej. práctica cancelada): se avisa al momento y no se guarda.
  if (left.error) { await idb.del('outbox', left.k); await refreshPending(); throw new DomainError(left.error); }
  return 'queued';
}

let running: Promise<number> | null = null;
/** Envía lo pendiente de este usuario, en orden. Se detiene ante falta de red, sesión caducada o fallo del servidor; un rechazo definitivo se conserva con su motivo. */
export function syncOutbox(): Promise<number> {
  running ??= (async () => {
    let sent = 0; useNet.setState({ syncing: true });
    try {
      for (const r of await mine()) {
        if (r.error) continue;
        try { await rpc('completePractice', [r.practiceId, r.payload]); await idb.del('outbox', r.k); sent++; }
        catch (e) {
          if (e instanceof OfflineError) break;
          if (e instanceof ApiError && (e.status === 401 || e.status === 429 || e.status >= 500)) break;
          await idb.put('outbox', { ...r, error: (e as Error).message });
        }
      }
    } finally { running = null; useNet.setState({ syncing: false }); await refreshPending(); }
    if (sent) window.dispatchEvent(new Event('ac:synced'));
    return sent;
  })();
  return running;
}
export async function retryClosure(id: string) { const r = await idb.get<OutboxRow>('outbox', id); if (r) { const { error: _e, ...rest } = r; await idb.put('outbox', rest as OutboxRow); await refreshPending(); await syncOutbox(); } }
export async function discardClosure(id: string) { await idb.del('outbox', id); await refreshPending(); window.dispatchEvent(new Event('ac:synced')); }

/** Muestra como «hechas» (con el marcador de pendiente) las prácticas cuyo cierre aún está en este dispositivo. */
export async function withPending(snap: Snapshot, userId: string): Promise<Snapshot> {
  const rows = (await idb.all<OutboxRow>('outbox').catch(() => [] as OutboxRow[])).filter((r) => r.userId === userId);
  if (!rows.length) return snap;
  const by = new Map(rows.map((r) => [r.practiceId, r]));
  return { ...snap, practices: snap.practices.map((p) => { const r = by.get(p.id); return r ? { ...p, status: 'hecha' as const, km: r.payload.km ?? p.km, signed: true, pendingSync: true } : p; }) };
}

/** Si estamos sin conexión, comprueba cada cierto tiempo si ha vuelto (sin enviar nada). */
export async function probe(): Promise<void> { if (useNet.getState().offline) { await get('/auth/me').catch(() => undefined); if (!useNet.getState().offline) window.dispatchEvent(new Event('ac:synced')); } }
