/** Eventos y sonido del HUD: el núcleo 3D reacciona a lo que haces. */
type Ev = 'pulse' | 'success' | 'think-on' | 'think-off' | 'speak-on' | 'speak-off';
const subs = new Set<(e: Ev) => void>();
export const hudBus = { on(fn: (e: Ev) => void) { subs.add(fn); return () => { subs.delete(fn); }; }, emit(e: Ev) { subs.forEach((f) => f(e)); } };

let ctx: AudioContext | null = null;
export function blip(kind: 'tick' | 'ok' | 'open' | 'hover', enabled: boolean) {
  if (!enabled || typeof AudioContext === 'undefined') return;
  try {
    ctx ??= new AudioContext(); if (ctx.state === 'suspended') void ctx.resume();
    const t = ctx.currentTime; const o = ctx.createOscillator(); const g = ctx.createGain();
    const f = { tick: [880, 620], ok: [520, 1040], open: [300, 700], hover: [1400, 1400] }[kind]; const dur = { tick: .06, ok: .2, open: .16, hover: .025 }[kind]; const vol = kind === 'hover' ? .012 : .04;
    o.type = kind === 'ok' ? 'sine' : 'triangle'; o.frequency.setValueAtTime(f[0], t); o.frequency.exponentialRampToValueAtTime(f[1], t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur + .02);
  } catch { /* sin audio */ }
}
