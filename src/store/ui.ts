import { create } from 'zustand';
import type { ThemeMode } from '@/types';

export interface Toast { id: number; kind: 'success' | 'error' | 'info'; title: string; description?: string }

interface UiState {
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  paletteOpen: boolean;
  aiOpen: boolean;
  shortcutsOpen: boolean;
  setShortcuts(v: boolean): void;
  /** Preferencia del usuario; si es null manda el tema por defecto de la academia. */
  theme: ThemeMode | null;
  toasts: Toast[];
  toggleSidebar(): void;
  setMobileNav(v: boolean): void;
  setPalette(v: boolean): void;
  setAi(v: boolean): void;
  setTheme(t: ThemeMode): void;
  toast(t: Omit<Toast, 'id'>): void;
  dismissToast(id: number): void;
}

const load = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; } };
let seq = 1;

export const useUi = create<UiState>((set, get) => ({
  sidebarCollapsed: load('ac.sidebar', false),
  mobileNavOpen: false,
  paletteOpen: false,
  aiOpen: false,
  shortcutsOpen: false,
  setShortcuts: (shortcutsOpen) => set({ shortcutsOpen }),
  theme: load<ThemeMode | null>('ac.theme', null),
  toasts: [],
  toggleSidebar: () => { const v = !get().sidebarCollapsed; localStorage.setItem('ac.sidebar', JSON.stringify(v)); set({ sidebarCollapsed: v }); },
  setMobileNav: (mobileNavOpen) => set({ mobileNavOpen }),
  setPalette: (paletteOpen) => set({ paletteOpen }),
  setAi: (aiOpen) => set({ aiOpen }),
  setTheme: (theme) => { localStorage.setItem('ac.theme', JSON.stringify(theme)); set({ theme }); },
  toast: (t) => {
    const id = seq++;
    set((s) => ({ toasts: [...s.toasts, { ...t, id }].slice(-4) }));
    setTimeout(() => get().dismissToast(id), 4500);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));
