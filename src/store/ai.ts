import { create } from 'zustand';
import { aiProvider, type AIAnswer } from '@/lib/ai';
import type { Snapshot } from '@/services/repositories';
import type { User } from '@/types';

export interface Msg { id: number; role: 'user' | 'ai'; text: string; items?: AIAnswer['items']; suggestions?: string[]; kind?: AIAnswer['kind'] }
const key = (u: User) => `ac.ai.${u.academyId}.${u.id}`;
const load = (u: User): Msg[] => { try { return JSON.parse(localStorage.getItem(key(u)) ?? '[]') as Msg[]; } catch { return []; } };
let seq = Date.now();

interface AiState { owner: string | null; msgs: Msg[]; busy: boolean; hydrate(u: User): void; ask(q: string, snap: Snapshot, u: User): Promise<void>; clear(u: User): void }

/** Historial por usuario y academia (nunca se mezcla entre tenants). */
export const useAi = create<AiState>((set, get) => ({
  owner: null, msgs: [], busy: false,
  hydrate: (u) => { if (get().owner !== key(u)) set({ owner: key(u), msgs: load(u) }); },
  async ask(q, snap, u) {
    const text = q.trim(); if (!text || get().busy) return;
    const persist = (m: Msg[]) => { try { localStorage.setItem(key(u), JSON.stringify(m.slice(-40))); } catch { /* sin cuota */ } };
    const withUser = [...get().msgs, { id: ++seq, role: 'user' as const, text }]; set({ msgs: withUser, busy: true });
    try {
      const a = await aiProvider.ask({ question: text, history: withUser.map((m) => ({ role: m.role, text: m.text })), snapshot: snap, user: u });
      const all = [...get().msgs, { id: ++seq, role: 'ai' as const, ...a }]; set({ msgs: all }); persist(all);
    } catch (e) { const all = [...get().msgs, { id: ++seq, role: 'ai' as const, text: (e as Error).message || 'No he podido procesar la consulta.', kind: 'unknown' as const }]; set({ msgs: all }); persist(all); }
    finally { set({ busy: false }); }
  },
  clear: (u) => { localStorage.removeItem(key(u)); set({ msgs: [] }); },
}));
