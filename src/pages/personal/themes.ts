import { create } from 'zustand';

/** Paletas del HUD. `rgb` va como "r g b" para usarlo en rgb(var(--h) / .3). */
export interface HudTheme { id: string; name: string; hex: string; hex2: string; rgb: string; rgb2: string; text: string; onBrand: string }
export const THEMES: HudTheme[] = [
  { id: 'stark', name: 'Stark', hex: '#22c8ff', hex2: '#3b82f6', rgb: '34 200 255', rgb2: '59 130 246', text: '#d8f3ff', onBrand: '#00131f' },
  { id: 'ambar', name: 'Ámbar', hex: '#ffb020', hex2: '#ff6a1f', rgb: '255 176 32', rgb2: '255 106 31', text: '#fff0d6', onBrand: '#1f1200' },
  { id: 'esmeralda', name: 'Esmeralda', hex: '#2ee6a6', hex2: '#14b8a6', rgb: '46 230 166', rgb2: '20 184 166', text: '#d9fff0', onBrand: '#00170f' },
  { id: 'violeta', name: 'Violeta', hex: '#a78bfa', hex2: '#f472b6', rgb: '167 139 250', rgb2: '244 114 182', text: '#efe9ff', onBrand: '#120a2a' },
  { id: 'carmesi', name: 'Carmesí', hex: '#ff4d6d', hex2: '#ff9f1c', rgb: '255 77 109', rgb2: '255 159 28', text: '#ffe3e8', onBrand: '#220008' },
  { id: 'hielo', name: 'Hielo', hex: '#e2f1ff', hex2: '#8fb8ff', rgb: '226 241 255', rgb2: '143 184 255', text: '#f4faff', onBrand: '#07101c' },
];
export type Quality = 'alta' | 'media' | 'baja';
interface HudSettings { theme: string; quality: Quality; sound: boolean; motion: boolean; voice: boolean; voiceURI: string; voiceRate: number; setVoice: (b: boolean) => void; setVoiceURI: (u: string) => void; setVoiceRate: (n: number) => void; setTheme: (t: string) => void; setQuality: (q: Quality) => void; setSound: (b: boolean) => void; setMotion: (b: boolean) => void }

const KEY = 'edith.hud.v1';
const saved = (() => { try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<HudSettings>; } catch { return {}; } })();
const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const useHud = create<HudSettings>((set, get) => {
  const persist = () => { const { theme, quality, sound, motion, voice, voiceURI, voiceRate } = get(); try { localStorage.setItem(KEY, JSON.stringify({ theme, quality, sound, motion, voice, voiceURI, voiceRate })); } catch { /* sin almacenamiento */ } };
  return {
    theme: THEMES.some((t) => t.id === saved.theme) ? saved.theme! : 'stark', quality: saved.quality ?? (typeof window !== 'undefined' && Math.min(window.innerWidth, window.innerHeight) < 600 ? 'media' : 'alta'), sound: saved.sound ?? true, motion: saved.motion ?? !reduced,
    voice: saved.voice ?? false, voiceURI: saved.voiceURI ?? '', voiceRate: saved.voiceRate ?? 1,
    setVoice: (voice) => { set({ voice }); persist(); }, setVoiceURI: (voiceURI) => { set({ voiceURI }); persist(); }, setVoiceRate: (voiceRate) => { set({ voiceRate }); persist(); },
    setTheme: (theme) => { set({ theme }); persist(); }, setQuality: (quality) => { set({ quality }); persist(); },
    setSound: (sound) => { set({ sound }); persist(); }, setMotion: (motion) => { set({ motion }); persist(); },
  };
});
export const themeOf = (id: string) => THEMES.find((t) => t.id === id) ?? THEMES[0];

export function applyTheme(id: string) {
  const t = themeOf(id); const s = document.documentElement.style;
  s.setProperty('--hud', t.hex); s.setProperty('--hud2', t.hex2); s.setProperty('--h', t.rgb); s.setProperty('--h2', t.rgb2); s.setProperty('--text', t.text); s.setProperty('--on-brand', t.onBrand);
  s.setProperty('--brand', t.hex); s.setProperty('--brand-2', t.hex2); s.setProperty('--brand-text', t.hex);
}
export function clearTheme() { const s = document.documentElement.style; ['--hud', '--hud2', '--h', '--h2', '--text', '--on-brand', '--brand', '--brand-2', '--brand-text'].forEach((k) => s.removeProperty(k)); }
