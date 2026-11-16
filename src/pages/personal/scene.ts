import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export interface SceneOpts { quality: 'alta' | 'media' | 'baja'; motion: boolean; hex: string; hex2: string; compact?: boolean; /** Vista de selección de perfil: núcleo más pequeño y bajado. */ view?: 'choose' }
/** Posición y tamaño del núcleo según el dispositivo y la vista (se anima al cambiar de vista, sin recrear la escena). */
const layoutOf = (compact?: boolean, view?: 'choose') => ({ cs: compact ? .62 : view === 'choose' ? .74 : .8, cy: compact ? 2.75 : view === 'choose' ? -.05 : .3 });
export interface HudScene { setColors: (a: string, b: string) => void; setQuality: (q: SceneOpts['quality']) => void; setMotion: (m: boolean) => void; pulse: () => void; setThinking: (b: boolean) => void; setSpeaking: (b: boolean) => void; setHover: (on: boolean) => void; setView: (v?: 'choose') => void; dispose: () => void }

const Q = { alta: { stars: 2400, swirl: 1700, dpr: 2, net: 100, tex: 1024, bloom: true }, media: { stars: 1200, swirl: 900, dpr: 1.5, net: 64, tex: 1024, bloom: true }, baja: { stars: 450, swirl: 420, dpr: 1, net: 36, tex: 512, bloom: false } };

/* ───────────── Texturas generadas ───────────── */
function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d')!; const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.2, 'rgba(255,255,255,.55)'); r.addColorStop(.55, 'rgba(255,255,255,.12)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
/** Destello anamórfico horizontal (el «lens flare» de cine). */
function streakTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 64; const g = c.getContext('2d')!; g.translate(256, 32); g.scale(1, .1);
  const r = g.createRadialGradient(0, 0, 0, 0, 0, 256); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.12, 'rgba(255,255,255,.5)'); r.addColorStop(.4, 'rgba(255,255,255,.1)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(-256, -320, 512, 640); return new THREE.CanvasTexture(c);
}

/** Diales HUD dibujados en blanco sobre transparente (el color lo pone el material). */
function dialTexture(kind: 0 | 1 | 2, px: number) {
  const c = document.createElement('canvas'); c.width = c.height = px; const g = c.getContext('2d')!; const C = px / 2; const R = px / 2 - 6; g.translate(C, C);
  g.strokeStyle = g.fillStyle = '#fff'; g.lineCap = 'butt';
  const circle = (r: number, lw: number, a = 1) => { g.globalAlpha = a; g.lineWidth = lw; g.beginPath(); g.arc(0, 0, r * R, 0, Math.PI * 2); g.stroke(); };
  const arc = (r: number, from: number, to: number, lw: number, a = 1) => { g.globalAlpha = a; g.lineWidth = lw; g.beginPath(); g.arc(0, 0, r * R, (from - 90) * Math.PI / 180, (to - 90) * Math.PI / 180); g.stroke(); };
  const ticks = (n: number, r: number, len: number, lw: number, a: number, every = 0, longLen = 0) => { for (let i = 0; i < n; i++) { const t = (i / n) * Math.PI * 2; const L = every && i % every === 0 ? longLen : len; g.globalAlpha = a; g.lineWidth = lw; g.beginPath(); g.moveTo(Math.cos(t) * r * R, Math.sin(t) * r * R); g.lineTo(Math.cos(t) * (r - L) * R, Math.sin(t) * (r - L) * R); g.stroke(); } };
  const text = (s: string, r: number, deg: number, size: number, a: number) => { g.save(); g.rotate((deg - 90) * Math.PI / 180); g.translate(r * R, 0); g.rotate(Math.PI / 2); g.globalAlpha = a; g.font = `600 ${size}px ui-monospace, "JetBrains Mono", Menlo, monospace`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s, 0, 0); g.restore(); };
  const u = px / 1024;
  if (kind === 0) {
    circle(.99, 3 * u, .95); circle(.7, 1.5 * u, .35); ticks(180, .97, .022, 1.5 * u, .8, 6, .055);
    for (let d = 0; d < 360; d += 30) text(String(d).padStart(3, '0'), .875, d, 21 * u, .85);
    [[8, 64], [96, 128], [190, 252], [282, 346]].forEach(([a, b]) => arc(.78, a, b, 11 * u, .9)); [[70, 92], [136, 180], [260, 276]].forEach(([a, b]) => arc(.78, a, b, 3 * u, .6));
  } else if (kind === 1) {
    for (let i = 0; i < 72; i++) arc(.97, i * 5, i * 5 + 2.4, 7 * u, .9);
    circle(.8, 1.5 * u, .45); for (let i = 0; i < 36; i++) { const t = (i / 36) * Math.PI * 2; g.globalAlpha = i % 3 === 0 ? 1 : .55; g.beginPath(); g.arc(Math.cos(t) * .8 * R, Math.sin(t) * .8 * R, (i % 3 === 0 ? 5 : 3) * u, 0, Math.PI * 2); g.fill(); }
    ['SYS', 'NET', 'MEM', 'CPU', 'I/O', 'IA', 'SYNC', 'SEC'].forEach((s, i) => { text(s, .885, i * 45 + 22.5, 22 * u, .95); text('▸', .885, i * 45, 20 * u, .6); });
    circle(.62, 1.5 * u, .25); ticks(60, .62, .03, 1.5 * u, .5, 5, .06);
  } else {
    circle(.97, 1.5 * u, .35); circle(.9, 1.5 * u, .2); circle(.83, 1.5 * u, .2);
    arc(.95, 0, 300, 6 * u, .95); arc(.88, 40, 250, 10 * u, .75); arc(.88, 270, 330, 3 * u, .5); arc(.81, 100, 200, 5 * u, .7); arc(.95, 312, 350, 3 * u, .5);
    for (const d of [0, 90, 180, 270]) { g.save(); g.rotate((d - 90) * Math.PI / 180); g.translate(R * .995, 0); g.globalAlpha = 1; g.beginPath(); g.moveTo(0, 0); g.lineTo(-22 * u, -9 * u); g.lineTo(-22 * u, 9 * u); g.closePath(); g.fill(); g.restore(); }
    ticks(90, .74, .02, 1.2 * u, .45, 5, .045);
  }
  const t = new THREE.CanvasTexture(c); t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; return t;
}

/* ───────────── Shaders ───────────── */
const NOISE = /* glsl */`
float hash(vec3 p){ p=fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float noise(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.-2.*f);
  return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z); }
float fbm(vec3 p){ float a=.5,s=0.; for(int i=0;i<4;i++){ s+=a*noise(p); p*=2.03; a*=.5; } return s; }`;
const SPHERE_VS = /* glsl */`varying vec3 vP; varying vec3 vN; varying vec3 vV;
void main(){ vP=position; vec4 mv=modelViewMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`;
const PLASMA_FS = /* glsl */`uniform float uT; uniform float uE; uniform vec3 uA; uniform vec3 uB; varying vec3 vP; varying vec3 vN; varying vec3 vV;
${NOISE}
void main(){
  vec3 p=normalize(vP);
  float n=fbm(p*2.3+vec3(0.,uT*.07,uT*.045)); float n2=fbm(p*4.4-vec3(uT*.1,0.,uT*.06));
  float plasma=smoothstep(.22,.82,n*.72+n2*.5);
  float vein=pow(1.-abs(n2*2.-1.),6.);
  float fres=pow(1.-max(dot(vN,vV),0.),2.2);
  vec3 col=mix(uB,uA,plasma)*(.12+plasma*.62)+uA*vein*.18;
  col+=uA*fres*.95;
  float hot=pow(max(dot(vN,vV),0.),3.)*(.35+uE*.9);
  col=mix(col,vec3(1.),clamp(hot*.3,0.,1.));
  gl_FragColor=vec4(col*(1.+uE*.35),1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const ATMO_FS = /* glsl */`uniform float uE; uniform vec3 uA; varying vec3 vP; varying vec3 vN; varying vec3 vV;
void main(){ float f=pow(1.-max(dot(vN,vV),0.),3.2); gl_FragColor=vec4(uA*f*(.8+uE*1.2),f);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const SWIRL_VS = /* glsl */`attribute vec4 aP; attribute vec2 aI; uniform float uT; uniform float uScale; uniform float uE; varying float vA;
void main(){
  float a=aP.y+uT*aP.z; vec3 p=vec3(cos(a),0.,sin(a))*aP.x*(1.+uE*.18);
  float ci=cos(aI.x), si=sin(aI.x); p=vec3(p.x,p.y*ci-p.z*si,p.y*si+p.z*ci);
  float cn=cos(aI.y), sn=sin(aI.y); p=vec3(p.x*cn-p.y*sn,p.x*sn+p.y*cn,p.z);
  vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv; gl_PointSize=aP.w*uScale/-mv.z; vA=.3+.7*fract(aP.y*7.13);
}`;
const SWIRL_FS = /* glsl */`uniform vec3 uA; uniform vec3 uB; varying float vA;
void main(){ float d=length(gl_PointCoord-.5); float a=smoothstep(.5,.0,d); a*=a; gl_FragColor=vec4(mix(uB,uA,vA)*1.6,a*vA);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function createScene(canvas: HTMLCanvasElement, opts: SceneOpts): HudScene {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setClearColor(0x02060f, 1);
  const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x02060f, 0.04);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 80); camera.position.set(0, 0.2, 8);
  const colA = new THREE.Color(opts.hex); const colB = new THREE.Color(opts.hex2);
  /* Fondo pintado en la propia escena (degradado con el color del tema): estático, sin mezclas del navegador. */
  const bgCanvas = document.createElement('canvas'); bgCanvas.width = 512; bgCanvas.height = 512; const bgTex = new THREE.CanvasTexture(bgCanvas); bgTex.colorSpace = THREE.SRGBColorSpace; scene.background = bgTex;
  const paintBg = () => { const g = bgCanvas.getContext('2d')!; const rgb = (c: THREE.Color, a: number) => `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`; const sr = (c: THREE.Color) => new THREE.Color().copy(c).convertLinearToSRGB(); g.fillStyle = '#02060f'; g.fillRect(0, 0, 512, 512); let r = g.createRadialGradient(256, 210, 0, 256, 210, 330); r.addColorStop(0, rgb(sr(colB), .2)); r.addColorStop(1, rgb(sr(colB), 0)); g.fillStyle = r; g.fillRect(0, 0, 512, 512); r = g.createRadialGradient(512, 512, 0, 512, 512, 300); r.addColorStop(0, rgb(sr(colA), .1)); r.addColorStop(1, rgb(sr(colA), 0)); g.fillStyle = r; g.fillRect(0, 0, 512, 512); bgTex.needsUpdate = true; };
  paintBg();
  type Tint = THREE.Material & { color: THREE.Color };
  const mats: { m: Tint; role: 'a' | 'b' }[] = []; const extra: { dispose: () => void }[] = [];
  const reg = <T extends THREE.Material>(m: T, role: 'a' | 'b' = 'a'): T => { (m as unknown as Tint).color.copy(role === 'a' ? colA : colB); mats.push({ m: m as unknown as Tint, role }); return m; };
  const add = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false } as const;
  const glow = glowTexture(); const streakTex = streakTexture(); extra.push(glow, streakTex);
  const uni = { uT: { value: 0 }, uE: { value: 0 }, uA: { value: colA }, uB: { value: colB } };

  /* ── Núcleo ── */
  let { cs, cy } = layoutOf(opts.compact, opts.view); let tcs = cs; let tcy = cy;
  const coreRoot = new THREE.Group(); coreRoot.position.y = cy; scene.add(coreRoot);
  const core = new THREE.Group(); core.scale.setScalar(cs); coreRoot.add(core);

  const plasma = new THREE.Mesh(new THREE.SphereGeometry(.74, 64, 48), new THREE.ShaderMaterial({ uniforms: uni, vertexShader: SPHERE_VS, fragmentShader: PLASMA_FS, ...add }));
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(.92, 48, 32), new THREE.ShaderMaterial({ uniforms: uni, vertexShader: SPHERE_VS, fragmentShader: ATMO_FS, ...add }));
  const heart = new THREE.Sprite(reg(new THREE.SpriteMaterial({ map: glow, opacity: .3, ...add }))); heart.scale.setScalar(.7);
  const halo = new THREE.Sprite(reg(new THREE.SpriteMaterial({ map: glow, opacity: .22, ...add }))); halo.scale.setScalar(4.6);
  const geo1 = new THREE.IcosahedronGeometry(1.08, 1); const geo2 = new THREE.IcosahedronGeometry(.9, 0);
  const lat = new THREE.LineSegments(new THREE.EdgesGeometry(geo1), reg(new THREE.LineBasicMaterial({ opacity: .4, ...add })));
  const latPts = new THREE.Points(geo1, reg(new THREE.PointsMaterial({ size: .09, map: glow, opacity: .95, sizeAttenuation: true, ...add })));
  const lat2 = new THREE.LineSegments(new THREE.EdgesGeometry(geo2), reg(new THREE.LineBasicMaterial({ opacity: .55, ...add }), 'b'));
  const streak = new THREE.Sprite(reg(new THREE.SpriteMaterial({ map: streakTex, opacity: .5, ...add }))); streak.scale.set(9, 1.1, 1);
  core.add(halo, plasma, atmo, lat, latPts, lat2, heart, streak);

  /* ── Diales HUD con graduaciones ── */
  const dials: { spin: THREE.Object3D; speed: number; tilt: THREE.Group }[] = [];
  const dialDefs: { kind: 0 | 1 | 2; half: number; rx: number; ry: number; speed: number; op: number; role: 'a' | 'b' }[] = [
    { kind: 0, half: 2.2, rx: -1.12, ry: 0, speed: .05, op: 1, role: 'a' }, { kind: 1, half: 1.78, rx: -.4, ry: .28, speed: -.09, op: 1, role: 'b' }, { kind: 2, half: 1.45, rx: 1.0, ry: -.35, speed: .16, op: 1, role: 'a' },
  ];
  let dialTex: THREE.Texture[] = [];
  const buildDials = () => {
    dials.forEach((d) => { core.remove(d.tilt); (d.spin as THREE.Mesh).geometry.dispose(); }); dials.length = 0; dialTex.forEach((t) => t.dispose()); dialTex = [];
    dialDefs.forEach((d) => {
      const tex = dialTexture(d.kind, Q[quality].tex); dialTex.push(tex);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(d.half * 2, d.half * 2), reg(new THREE.MeshBasicMaterial({ map: tex, opacity: d.op, side: THREE.DoubleSide, ...add }), d.role));
      const tilt = new THREE.Group(); tilt.rotation.set(d.rx, d.ry, 0); tilt.add(m); core.add(tilt); dials.push({ spin: m, speed: d.speed, tilt });
    });
  };

  /* ── Remolino de partículas ── */
  const swirlMat = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 }, uE: uni.uE, uScale: { value: 800 }, uA: { value: colA }, uB: { value: colB } }, vertexShader: SWIRL_VS, fragmentShader: SWIRL_FS, ...add });
  let swirl: THREE.Points | null = null;
  const buildSwirl = (n: number) => {
    if (swirl) { core.remove(swirl); swirl.geometry.dispose(); }
    let seed = 13; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const P = new Float32Array(n * 4); const I = new Float32Array(n * 2); const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const r = 1.15 + Math.pow(rnd(), 1.6) * 1.15; P[i * 4] = r; P[i * 4 + 1] = rnd() * 6.2832; P[i * 4 + 2] = (.25 + rnd() * .7) * (rnd() < .5 ? -1 : 1) / Math.sqrt(r); P[i * 4 + 3] = rnd() < .06 ? .06 + rnd() * .05 : .016 + rnd() * .03; I[i * 2] = (rnd() - .5) * 2.4; I[i * 2 + 1] = rnd() * 6.2832; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aP', new THREE.BufferAttribute(P, 4)); g.setAttribute('aI', new THREE.BufferAttribute(I, 2));
    swirl = new THREE.Points(g, swirlMat); swirl.frustumCulled = false; core.add(swirl);
  };

  /* ── Ondas de choque ── */
  const waves = Array.from({ length: 3 }, () => { const m = new THREE.Mesh(new THREE.RingGeometry(.97, 1, 128), reg(new THREE.MeshBasicMaterial({ opacity: 0, side: THREE.DoubleSide, ...add }))); m.visible = false; m.rotation.x = -1.12; core.add(m); return { m, t: 1 }; });
  let waveI = 0;

  /* ── Red neuronal de fondo ── */
  const net = new THREE.Group(); scene.add(net); let netLines: THREE.LineSegments | null = null; let netPts: THREE.Points | null = null;
  const buildNet = (count: number) => {
    if (netLines) { net.remove(netLines, netPts!); netLines.geometry.dispose(); netPts!.geometry.dispose(); }
    const p: THREE.Vector3[] = []; let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < count; i++) { const u = rnd() * 2 - 1; const a = rnd() * Math.PI * 2; const r = 4.6 + rnd() * 2.8; const s = Math.sqrt(1 - u * u); p.push(new THREE.Vector3(Math.cos(a) * s * r * 1.25, u * r * .8, Math.sin(a) * s * r - 2)); }
    const lines: number[] = []; for (let i = 0; i < count; i++) for (let j = i + 1; j < count; j++) if (p[i].distanceTo(p[j]) < 2.6) lines.push(p[i].x, p[i].y, p[i].z, p[j].x, p[j].y, p[j].z);
    netLines = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(lines, 3)), reg(new THREE.LineBasicMaterial({ opacity: .1, ...add }), 'b'));
    netPts = new THREE.Points(new THREE.BufferGeometry().setFromPoints(p), reg(new THREE.PointsMaterial({ size: .14, map: glow, opacity: .8, ...add })));
    net.add(netLines, netPts);
  };

  /* ── Estrellas con profundidad ── */
  let stars: THREE.Points | null = null;
  const buildStars = (n: number) => {
    if (stars) { scene.remove(stars); stars.geometry.dispose(); }
    const a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = (Math.random() - .5) * 34; a[i * 3 + 1] = (Math.random() - .5) * 20; a[i * 3 + 2] = -16 + Math.random() * 22; }
    stars = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(a, 3)), reg(new THREE.PointsMaterial({ size: .06, map: glow, opacity: .7, sizeAttenuation: true, ...add })));
    scene.add(stars);
  };

  /* ── Suelo en perspectiva ── */
  const grid = new THREE.GridHelper(60, 60, 0xffffff, 0xffffff); grid.position.y = -3.7; const gm = grid.material as THREE.LineBasicMaterial; gm.transparent = true; gm.opacity = .13; gm.depthWrite = false; gm.blending = THREE.AdditiveBlending; reg(gm); scene.add(grid);

  /* ── Estado, tamaño y postproceso ── */
  let quality = opts.quality; let motion = opts.motion; let thinking = false; let speaking = false; let hover = false; let speed = 1; let energy = 0; let voice = 0; let swirlT = 0; let bloomBroken = false; let seen = 0; let sumDt = 0; let degrade = 0;
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  let composer: EffectComposer | null = null; let bloom: UnrealBloomPass | null = null;
  const buildComposer = () => {
    composer?.dispose(); composer = null; bloom = null; if (!Q[quality].bloom || bloomBroken) return;
    try {
      const w = Math.max(1, renderer.domElement.width); const h = Math.max(1, renderer.domElement.height);
      composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: quality === 'alta' ? 4 : 0 }));
      composer.addPass(new RenderPass(scene, camera)); bloom = new UnrealBloomPass(new THREE.Vector2(w / 2, h / 2), .42, .5, .62); composer.addPass(bloom); composer.addPass(new OutputPass());
    } catch { composer = null; bloom = null; bloomBroken = true; }
  };
  let lw = 0; let lh = 0;
  const size = (force = false) => {
    const p = canvas.parentElement ?? canvas; const w = Math.max(1, p.clientWidth); const h = Math.max(1, p.clientHeight); if (!force && w === lw && h === lh) return; lw = w; lh = h; const pr = Math.min(window.devicePixelRatio || 1, Q[quality].dpr, degrade >= 2 ? 1 : 9);
    renderer.setPixelRatio(pr); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    swirlMat.uniforms.uScale.value = (h * pr) / (2 * Math.tan((camera.fov * Math.PI) / 360));
    if (composer) { composer.setPixelRatio(pr); composer.setSize(w, h); bloom?.resolution.set(w * pr / 2, h * pr / 2); }
  };
  const apply = () => { buildStars(Q[quality].stars); buildNet(Q[quality].net); buildSwirl(Q[quality].swirl); buildDials(); buildComposer(); size(true); };
  const onMove = (e: PointerEvent) => { mouse.tx = (e.clientX / window.innerWidth) * 2 - 1; mouse.ty = -((e.clientY / window.innerHeight) * 2 - 1); };
  window.addEventListener('pointermove', onMove, { passive: true });
  const ro = new ResizeObserver(() => size()); ro.observe(canvas.parentElement ?? canvas);
  apply();

  const clock = new THREE.Clock(); let raf = 0; let alive = true;
  const frame = () => {
    if (!alive) return; raf = requestAnimationFrame(frame);
    if (document.hidden) { clock.getDelta(); return; }
    const raw = clock.getDelta(); const dt = Math.min(raw, .05); const t = clock.elapsedTime; const ts = motion ? 1 : .08;
    /* Si el equipo va justo, se degrada solo: primero sin brillo (bloom), luego con menos resolución. */
    /* Durante los primeros segundos (compilar shaders, subir texturas) los tirones son normales: no cuentan, para no apagar el brillo al arrancar. */
    const warm = t > 2.5; seen++; if (warm && seen > 8 && degrade < 2 && (raw > .5 || (seen >= 45 && sumDt / 30 > .06))) { degrade++; if (degrade === 1) { bloomBroken = true; buildComposer(); } size(true); seen = 0; sumDt = 0; } else if (seen > 15) { sumDt += raw; if (seen >= 45) { seen = 0; sumDt = 0; } }
    cs += (tcs - cs) * Math.min(1, dt * 3); cy += (tcy - cy) * Math.min(1, dt * 3); coreRoot.position.y = cy;
    speed += ((thinking ? 2 : hover ? .2 : 1) - speed) * Math.min(1, dt * 3); energy *= Math.pow(.12, dt);
    voice += ((speaking ? .5 + .18 * Math.sin(t * 3.2) : 0) - voice) * Math.min(1, dt * 3);
    const lvl = Math.max(0, energy * .7 + voice * .5 + (thinking ? .2 : 0)); const k = dt * ts * speed;
    mouse.x += (mouse.tx - mouse.x) * Math.min(1, dt * 3); mouse.y += (mouse.ty - mouse.y) * Math.min(1, dt * 3);
    const par = motion ? 1 : 0; camera.position.z = opts.compact ? 8 : 8 * Math.max(1, 1.5 / camera.aspect); camera.position.x = mouse.x * 1.1 * par; camera.position.y = .2 + mouse.y * .6 * par; camera.lookAt(0, .2, 0);
    coreRoot.rotation.y += ((mouse.x * .35 * par) - coreRoot.rotation.y) * Math.min(1, dt * 2.5); coreRoot.rotation.x += ((-mouse.y * .2 * par) - coreRoot.rotation.x) * Math.min(1, dt * 2.5);
    uni.uT.value += k; uni.uE.value = lvl; swirlT += k; swirlMat.uniforms.uT.value = swirlT;
    lat.rotation.y += k * .12; lat.rotation.x += k * .05; latPts.rotation.copy(lat.rotation); lat2.rotation.y -= k * .22; lat2.rotation.z += k * .1; plasma.rotation.y += k * .05;
    core.scale.setScalar(cs * (1 + Math.sin(t * .8) * .015 + lvl * .05)); halo.scale.setScalar(4.6 + lvl * 1.2); heart.scale.setScalar(.7 + lvl * .3); streak.scale.set(9 + lvl * 1.5, 1.1, 1);
    (streak.material as THREE.SpriteMaterial).opacity = .25 + lvl * .2; (halo.material as THREE.SpriteMaterial).opacity = .2 + lvl * .12;
    dials.forEach((d, i) => { d.spin.rotation.z += k * d.speed * (1 + (thinking ? .8 : 0)); d.tilt.rotation.x += Math.sin(t * .3 + i) * .0006 * ts; });
    net.rotation.y += k * .02; net.rotation.x = Math.sin(t * .1) * .05; if (stars) stars.rotation.y += k * .01;
    grid.position.z = (t * .4 * ts) % 1;
    waves.forEach((w) => { if (w.t >= 1) return; w.t += dt / 1.4; const e = 1 - Math.pow(1 - Math.min(w.t, 1), 3); w.m.scale.setScalar(1.2 + e * 5.2); (w.m.material as THREE.MeshBasicMaterial).opacity = (1 - w.t) * .35; if (w.t >= 1) w.m.visible = false; });
    if (bloom) bloom.strength = .45 + lvl * .25;
    if (composer) composer.render(dt); else renderer.render(scene, camera);
  };
  frame();

  return {
    setColors(a, b) { colA.set(a); colB.set(b); mats.forEach((m) => m.m.color.copy(m.role === 'a' ? colA : colB)); paintBg(); },
    setView(v) { const l = layoutOf(opts.compact, v); tcs = l.cs; tcy = l.cy; },
    setQuality(q) { quality = q; apply(); }, setMotion(m) { motion = m; }, setThinking(b) { thinking = b; }, setSpeaking(b) { speaking = b; }, setHover(on) { hover = on; },
    pulse() { energy = 1; const w = waves[waveI++ % waves.length]; w.t = 0; w.m.visible = true; },
    dispose() {
      alive = false; cancelAnimationFrame(raf); window.removeEventListener('pointermove', onMove); ro.disconnect(); composer?.dispose();
      scene.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose?.(); }); mats.forEach((x) => x.m.dispose()); [plasma, atmo].forEach((m) => (m.material as THREE.Material).dispose()); swirlMat.dispose(); dialTex.forEach((t) => t.dispose()); extra.forEach((e) => e.dispose()); renderer.dispose();
    },
  };
}
