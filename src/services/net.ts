import { create } from 'zustand';

/** Estado de la conexión y de lo guardado en este dispositivo para enviar más tarde (sin dependencias para evitar ciclos). */
export interface PendingItem { id: string; label: string; error?: string }
interface NetState {
  offline: boolean;
  /** Cuándo se guardaron los datos que se están viendo, si vienen de la copia local (no de internet). */
  staleAt: number | null;
  pending: PendingItem[];
  syncing: boolean;
  /** Última vez que se recibieron datos del servidor. */
  syncedAt: number | null;
}
export const useNet = create<NetState>(() => ({ offline: typeof navigator !== 'undefined' && navigator.onLine === false, staleAt: null, pending: [], syncing: false, syncedAt: null }));
export const setOffline = (offline: boolean) => { if (useNet.getState().offline !== offline) useNet.setState(offline ? { offline } : { offline, staleAt: null }); };
