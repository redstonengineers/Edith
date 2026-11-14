/** Voz de EDITH: síntesis de voz del sistema (Web Speech API, speechSynthesis). Sin servicios externos ni claves. */
export const voiceSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

/** Voces del sistema, primero las españolas (es-ES antes que es-MX…). */
export function listVoices(): SpeechSynthesisVoice[] {
  if (!voiceSupported()) return [];
  return [...speechSynthesis.getVoices()].sort((a, b) => Number(b.lang.toLowerCase().startsWith('es')) - Number(a.lang.toLowerCase().startsWith('es')) || Number(b.lang === 'es-ES') - Number(a.lang === 'es-ES') || a.name.localeCompare(b.name));
}

/** Limpia el texto para que se lea bien: sin markdown, enlaces ni emojis sueltos. */
export function speakable(t: string) {
  return t.replace(/```[\s\S]*?```/g, ' ').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/https?:\/\/\S+/g, ' enlace ').replace(/[*_`#>~|]/g, '').replace(/\p{Extended_Pictographic}/gu, '').replace(/\s+/g, ' ').trim();
}

export function stopSpeaking() { if (voiceSupported()) speechSynthesis.cancel(); }

/** Habla `text` (cancela lo anterior). `voiceURI` vacío = mejor voz española disponible. */
export function speak(text: string, opts: { voiceURI?: string; rate?: number; onEnd?: () => void } = {}) {
  const clean = speakable(text); if (!voiceSupported() || !clean) { opts.onEnd?.(); return false; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(clean.slice(0, 1500)); const vs = listVoices();
  const v = vs.find((x) => x.voiceURI === opts.voiceURI) ?? vs.find((x) => x.lang.toLowerCase().startsWith('es')); if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'es-ES';
  u.rate = opts.rate ?? 1; u.pitch = 0.95; u.onend = u.onerror = () => opts.onEnd?.();
  speechSynthesis.speak(u); return true;
}
