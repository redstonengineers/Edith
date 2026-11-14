import * as THREE from 'three';

export interface NodeScreen { x: number; y: number; scale: number; depth: number }
export interface SceneOpts { quality: 'alta' | 'media' | 'baja'; motion: boolean; hex: string; hex2: string; nodes: number; compact?: boolean; onNodes?: (n: NodeScreen[]) => void }
export interface HudScene { setColors: (a: string, b: string) => void; setQuality: (q: SceneOpts['quality']) => void; setMotion: (m: boolean) => void; pulse: () => void; setThinking: (b: boolean) => void; setHover: (on: boolean) => void; dispose: () => void }

const Q = { alta: { stars: 2200, dpr: 2, net: 110 }, media: { stars: 1100, dpr: 1.5, net: 70 }, baja: { stars: 450, dpr: 1, net: 40 } };

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d')!; const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.2, 'rgba(255,255,255,.55)'); r.addColorStop(.55, 'rgba(255,255,255,.12)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export function createScene(canvas: HTMLCanvasElement, opts: SceneOpts): HudScene {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x02060f, 0.045);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 80); camera.position.set(0, 0.2, 8);
  const colA = new THREE.Color(opts.hex); const colB = new THREE.Color(opts.hex2);
  const mats: { m: THREE.Material & { color: THREE.Color }; role: 'a' | 'b'; base: number }[] = [];
  const reg = <T extends THREE.Material & { color: THREE.Color }>(m: T, role: 'a' | 'b' = 'a') => { m.color.copy(role === 'a' ? colA : colB); mats.push({ m, role, base: m.opacity }); return m; };
  const add = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false } as const;
  const glow = glowTexture();

  /* Núcleo */
  const core = new THREE.Group(); const cy = opts.compact ? 2.75 : 0.3; const cs = opts.compact ? .72 : 1.2; core.position.y = cy; core.scale.setScalar(cs); scene.add(core);
  const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(1.15, 2), reg(new THREE.MeshBasicMaterial({ wireframe: true, opacity: .55, ...add })));
  const inner = new THREE.Mesh(new THREE.IcosahedronGeometry(.72, 1), reg(new THREE.MeshBasicMaterial({ wireframe: true, opacity: .8, ...add }), 'b'));
  const heart = new THREE.Mesh(new THREE.SphereGeometry(.32, 32, 32), reg(new THREE.MeshBasicMaterial({ opacity: .9, ...add })));
  const halo = new THREE.Sprite(reg(new THREE.SpriteMaterial({ map: glow, opacity: .9, ...add }) as unknown as THREE.Material & { color: THREE.Color }) as unknown as THREE.SpriteMaterial); halo.scale.setScalar(5.2);
  core.add(shell, inner, heart, halo);

  /* Anillos */
  const rings: { mesh: THREE.Object3D; speed: number; axis: 'x' | 'y' | 'z' }[] = [];
  const ringGroup = new THREE.Group(); core.add(ringGroup);
  [[1.9, .006, .5, 'a'], [2.35, .004, .35, 'b'], [3.2, .005, .3, 'a']].forEach(([r, t, o, role], i) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r as number, t as number, 6, 160), reg(new THREE.MeshBasicMaterial({ opacity: o as number, ...add }), role as 'a' | 'b'));
    m.rotation.set(1.2 + i * .35, i * .6, i * 1.1); ringGroup.add(m); rings.push({ mesh: m, speed: (i % 2 ? -1 : 1) * (.1 + i * .05), axis: 'z' });
  });
  [[2.15, .035, 1.5, 'a'], [2.7, .02, 2.4, 'b'], [1.6, .028, 1.1, 'a']].forEach(([r, t, arc, role], i) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r as number, t as number, 8, 90, arc as number), reg(new THREE.MeshBasicMaterial({ opacity: .85, ...add }), role as 'a' | 'b'));
    m.rotation.set(1.5 - i * .5, i * .4, 0); ringGroup.add(m); rings.push({ mesh: m, speed: (i % 2 ? -1 : 1) * (.6 + i * .25), axis: 'z' });
  });
  const tickPts: number[] = []; for (let i = 0; i < 120; i++) { const a = (i / 120) * Math.PI * 2; const r = 3.55; tickPts.push(Math.cos(a) * r, Math.sin(a) * r, 0); }
  const ticks = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(tickPts, 3)), reg(new THREE.PointsMaterial({ size: .045, opacity: .8, ...add }) as unknown as THREE.Material & { color: THREE.Color }) as unknown as THREE.PointsMaterial);
  ticks.rotation.x = 1.15; ringGroup.add(ticks);

  /* Onda de choque */
  const waves = Array.from({ length: 3 }, () => { const m = new THREE.Mesh(new THREE.RingGeometry(.96, 1, 96), reg(new THREE.MeshBasicMaterial({ opacity: 0, side: THREE.DoubleSide, ...add }))); m.visible = false; core.add(m); return { m, t: 1 }; });
  let waveI = 0;

  /* Red neuronal */
  const net = new THREE.Group(); scene.add(net); let netLines: THREE.LineSegments | null = null; let netPts: THREE.Points | null = null;
  const buildNet = (count: number) => {
    if (netLines) { net.remove(netLines, netPts!); netLines.geometry.dispose(); netPts!.geometry.dispose(); }
    const p: THREE.Vector3[] = []; let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < count; i++) { const u = rnd() * 2 - 1; const a = rnd() * Math.PI * 2; const r = 4.4 + rnd() * 2.6; const s = Math.sqrt(1 - u * u); p.push(new THREE.Vector3(Math.cos(a) * s * r * 1.25, u * r * .8, Math.sin(a) * s * r - 2)); }
    const lines: number[] = []; for (let i = 0; i < count; i++) for (let j = i + 1; j < count; j++) if (p[i].distanceTo(p[j]) < 2.6) lines.push(p[i].x, p[i].y, p[i].z, p[j].x, p[j].y, p[j].z);
    netLines = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(lines, 3)), reg(new THREE.LineBasicMaterial({ opacity: .16, ...add }), 'b'));
    netPts = new THREE.Points(new THREE.BufferGeometry().setFromPoints(p), reg(new THREE.PointsMaterial({ size: .16, map: glow, opacity: .9, ...add }) as unknown as THREE.Material & { color: THREE.Color }) as unknown as THREE.PointsMaterial);
    net.add(netLines, netPts);
  };

  /* Estrellas con profundidad */
  let stars: THREE.Points | null = null;
  const buildStars = (n: number) => {
    if (stars) { scene.remove(stars); stars.geometry.dispose(); }
    const a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = (Math.random() - .5) * 34; a[i * 3 + 1] = (Math.random() - .5) * 20; a[i * 3 + 2] = -16 + Math.random() * 22; }
    stars = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(a, 3)), reg(new THREE.PointsMaterial({ size: .07, map: glow, opacity: .75, sizeAttenuation: true, ...add }) as unknown as THREE.Material & { color: THREE.Color }) as unknown as THREE.PointsMaterial);
    scene.add(stars);
  };

  /* Suelo en perspectiva */
  const grid = new THREE.GridHelper(60, 60, 0xffffff, 0xffffff); grid.position.y = -3.6; const gm = grid.material as THREE.LineBasicMaterial; gm.transparent = true; gm.opacity = .16; gm.depthWrite = false; gm.blending = THREE.AdditiveBlending; reg(gm as unknown as THREE.Material & { color: THREE.Color }, 'a'); mats[mats.length - 1].base = .16; scene.add(grid);

  /* Satélites (módulos) */
  const orbit = new THREE.Group(); orbit.position.y = cy; orbit.rotation.x = -1.12; scene.add(orbit);
  const sats: THREE.Object3D[] = Array.from({ length: opts.nodes }, () => { const s = new THREE.Sprite(reg(new THREE.SpriteMaterial({ map: glow, opacity: .85, ...add }) as unknown as THREE.Material & { color: THREE.Color }) as unknown as THREE.SpriteMaterial); s.scale.setScalar(.55); orbit.add(s); return s; });
  const v = new THREE.Vector3();

  /* Estado */
  let quality = opts.quality; let motion = opts.motion; let thinking = false; let hover = false; let speed = 1; let energy = 0; let orbitAngle = 0;
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  const apply = () => { renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, Q[quality].dpr)); buildStars(Q[quality].stars); buildNet(Q[quality].net); size(); };
  const size = () => { const p = canvas.parentElement ?? canvas; const w = Math.max(1, p.clientWidth); const h = Math.max(1, p.clientHeight); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  const onMove = (e: PointerEvent) => { mouse.tx = (e.clientX / window.innerWidth) * 2 - 1; mouse.ty = -((e.clientY / window.innerHeight) * 2 - 1); };
  window.addEventListener('pointermove', onMove, { passive: true });
  const ro = new ResizeObserver(size); ro.observe(canvas.parentElement ?? canvas);
  apply();

  const clock = new THREE.Clock(); let raf = 0; let alive = true;
  const frame = () => {
    if (!alive) return; raf = requestAnimationFrame(frame);
    if (document.hidden) return;
    const dt = Math.min(clock.getDelta(), .05); const t = clock.elapsedTime; const ts = motion ? 1 : .08;
    speed += ((thinking ? 4 : hover ? .15 : 1) - speed) * Math.min(1, dt * 3); energy *= Math.pow(.02, dt);
    const k = dt * ts * speed;
    mouse.x += (mouse.tx - mouse.x) * Math.min(1, dt * 3); mouse.y += (mouse.ty - mouse.y) * Math.min(1, dt * 3);
    const par = motion ? 1 : 0; camera.position.z = opts.compact ? 8 : 8 * Math.max(1, 1.5 / camera.aspect); camera.position.x = mouse.x * 1.1 * par; camera.position.y = .2 + mouse.y * .6 * par; camera.lookAt(0, .2, 0);
    shell.rotation.y += k * .35; shell.rotation.x += k * .12; inner.rotation.y -= k * .6; inner.rotation.z += k * .3;
    const pulse = cs * (1 + Math.sin(t * 1.6) * .04 + energy * .35); core.scale.setScalar(pulse); halo.scale.setScalar(5.2 + energy * 3 + (thinking ? Math.sin(t * 9) * .4 : 0));
    rings.forEach((r, i) => { r.mesh.rotation.z += k * r.speed; r.mesh.rotation.x += k * .02 * (i + 1); });
    ticks.rotation.z -= k * .05; net.rotation.y += k * .02; net.rotation.x = Math.sin(t * .1) * .05;
    if (stars) { stars.rotation.y += k * .01; }
    grid.position.z = (t * .4 * ts) % 1;
    waves.forEach((w) => { if (w.t >= 1) return; w.t += dt / 1.3; const e = 1 - Math.pow(1 - Math.min(w.t, 1), 3); w.m.scale.setScalar(1 + e * 5.5); (w.m.material as THREE.MeshBasicMaterial).opacity = (1 - w.t) * .8; w.m.rotation.x = 1.12; if (w.t >= 1) w.m.visible = false; });
    orbitAngle += k * .12;
    const out: NodeScreen[] = [];
    sats.forEach((s, i) => { const a = orbitAngle + (i / sats.length) * Math.PI * 2; s.position.set(Math.cos(a) * 2.45, Math.sin(a) * 2.45, 0); s.getWorldPosition(v); const d = v.z; v.project(camera); out.push({ x: (v.x * .5 + .5) * canvas.clientWidth, y: (-v.y * .5 + .5) * canvas.clientHeight, scale: THREE.MathUtils.clamp(.72 + (d + 3) * .09, .6, 1.25), depth: d }); });
    opts.onNodes?.(out);
    renderer.render(scene, camera);
  };
  frame();

  return {
    setColors(a, b) { colA.set(a); colB.set(b); mats.forEach((m) => m.m.color.copy(m.role === 'a' ? colA : colB)); },
    setQuality(q) { quality = q; apply(); }, setMotion(m) { motion = m; }, setThinking(b) { thinking = b; }, setHover(on) { hover = on; },
    pulse() { energy = 1; const w = waves[waveI++ % waves.length]; w.t = 0; w.m.visible = true; },
    dispose() { alive = false; cancelAnimationFrame(raf); window.removeEventListener('pointermove', onMove); ro.disconnect(); scene.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose?.(); }); mats.forEach((x) => x.m.dispose()); glow.dispose(); renderer.dispose(); },
  };
}
