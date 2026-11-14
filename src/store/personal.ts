import { create } from 'zustand';
import { personalApi } from '@/services/personalApi';

export type Profile = 'gazael' | 'hokage';
export const PROFILES: Record<Profile, { name: string; tag: string }> = { gazael: { name: 'Gazael', tag: 'Perfil 01' }, hokage: { name: 'Hokage', tag: 'Perfil 02' } };

export interface Task { id: string; title: string; due?: string; done: boolean; subjectId?: string; priority: 'alta' | 'media' | 'baja' }
export interface Ev { id: string; title: string; date: string; time?: string }
export interface Subj { id: string; name: string; color: string }
export interface Grade { id: string; subjectId: string; title: string; score: number; weight: number; date: string }
export interface Habit { id: string; name: string; log: string[] }
export interface Note { id: string; title: string; body: string; updated: string }
export interface Expense { id: string; concept: string; amount: number; date: string; category: string; income?: boolean }
export interface Slot { id: string; title: string; day: number; start: string; end: string; place?: string; color: string }
/** Excepción de una semana concreta (week = lunes ISO): mover o cancelar una clase recurrente, o añadir una clase suelta. */
export interface SlotEx { id: string; week: string; kind: 'move' | 'cancel' | 'extra'; slotId?: string; day?: number; start?: string; end?: string; place?: string; title?: string; color?: string }
export type Repeat = 'no' | 'diario' | 'semanal' | 'mensual';
export interface Reminder { id: string; title: string; date: string; time?: string; done: boolean; repeat: Repeat }
export interface Goal { id: string; title: string; progress: number; due?: string }
export interface Study { id: string; subjectId?: string; minutes: number; date: string }
export interface PData { tasks: Task[]; events: Ev[]; subjects: Subj[]; grades: Grade[]; habits: Habit[]; notes: Note[]; expenses: Expense[]; goals: Goal[]; study: Study[]; budget: number; schedule: Slot[]; schedEx: SlotEx[]; reminders: Reminder[] }
export const EMPTY: PData = { tasks: [], events: [], subjects: [], grades: [], habits: [], notes: [], expenses: [], goals: [], study: [], budget: 0, schedule: [], schedEx: [], reminders: [] };
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

interface PState {
  status: 'loading' | 'anon' | 'choose' | 'ready'; profile: Profile | null; data: PData; rev: number; sync: 'ok' | 'saving' | 'error' | 'conflict'; error?: string;
  init: () => Promise<void>; login: (u: string, p: string) => Promise<void>; choose: (p: Profile) => Promise<void>; logout: () => Promise<void>; switchProfile: () => Promise<void>;
  update: (fn: (d: PData) => PData) => void;
}
let timer: ReturnType<typeof setTimeout> | undefined;

async function load(set: (p: Partial<PState>) => void) {
  const r = await personalApi.load();
  set({ status: 'ready', rev: r.rev, data: { ...EMPTY, ...(r.data as Partial<PData> | null) }, sync: 'ok' });
}

export const usePersonal = create<PState>((set, get) => ({
  status: 'loading', profile: null, data: EMPTY, rev: 0, sync: 'ok',
  async init() {
    try { const me = await personalApi.me(); if (!me.authed) return set({ status: 'anon' }); if (!me.profile) return set({ status: 'choose' }); set({ profile: me.profile as Profile }); await load(set); }
    catch { set({ status: 'anon' }); }
  },
  async login(u, p) { await personalApi.login(u, p); set({ status: 'choose' }); },
  async choose(p) { await personalApi.profile(p); set({ profile: p, status: 'loading' }); await load(set); },
  async logout() { try { await personalApi.logout(); } catch { /* ya sin sesión */ } clearTimeout(timer); set({ status: 'anon', profile: null, data: EMPTY, rev: 0 }); },
  async switchProfile() { clearTimeout(timer); if (get().sync === 'saving') { try { const r = await personalApi.save(get().rev, get().data); set({ rev: r.rev, sync: 'ok' }); } catch { /* se reintentará al volver */ } } set({ status: 'choose', data: EMPTY, rev: 0 }); },
  update(fn) {
    set({ data: fn(get().data), sync: 'saving' }); clearTimeout(timer);
    timer = setTimeout(async () => {
      try { const r = await personalApi.save(get().rev, get().data); set({ rev: r.rev, sync: 'ok' }); }
      catch (e) { set({ sync: (e as { status?: number }).status === 409 ? 'conflict' : 'error', error: (e as Error).message }); }
    }, 700);
  },
}));
