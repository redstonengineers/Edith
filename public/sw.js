// Service worker de EDITH: la app abre sin conexión.
//  - Cascarón (HTML + JS/CSS compilados, listados en /precache.json al compilar) en caché.
//  - Navegaciones: red primero (para recibir despliegues nuevos) y, si falla o tarda, el cascarón guardado.
//  - /assets/* (nombres con hash): caché primero.
//  - /api/* NUNCA pasa por aquí: los datos sin conexión los gestiona la app (IndexedDB, src/services/offline.ts).
const VERSION = 'v1';
const CACHE = `edith-shell-${VERSION}`;
const BASE = ['/', '/manifest.webmanifest', '/favicon.svg', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    let files = [];
    try { const r = await fetch('/precache.json', { cache: 'no-store' }); if (r.ok) files = await r.json(); } catch { /* sin lista: se irá guardando al usar */ }
    await cache.addAll([...BASE, ...files]);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('edith-shell-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

const put = async (req, res) => { if (res.ok && res.type === 'basic') { const c = await caches.open(CACHE); await c.put(req, res.clone()); } return res; };

self.addEventListener('fetch', (e) => {
  const req = e.request; const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/') || url.pathname === '/sw.js') return;

  if (req.mode === 'navigate') {
    // Cualquier ruta de la SPA se resuelve con la página «/» guardada.
    e.respondWith((async () => {
      const cached = await caches.match('/');
      const net = fetch(req).then((res) => (res.ok && (res.headers.get('content-type') || '').includes('text/html') ? put('/', res) : res));
      try {
        if (!cached) return await net;
        return await Promise.race([net, new Promise((_, no) => setTimeout(no, 3500))]);
      } catch { return cached ?? new Response('Sin conexión', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }); }
    })());
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    e.respondWith((async () => (await caches.match(req)) ?? put(req, await fetch(req)))());
    return;
  }
  // Resto (iconos, manifiesto…): lo guardado al instante y se actualiza en segundo plano.
  e.respondWith((async () => {
    const cached = await caches.match(req);
    const net = fetch(req).then((res) => put(req, res)).catch(() => null);
    if (cached) { e.waitUntil(net); return cached; }
    return (await net) ?? new Response('Sin conexión', { status: 503 });
  })());
});
