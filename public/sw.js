// Service worker de VaLoMi: conserva solo la interfaz y el mapa base para uso sin conexión.
// Los reportes, adjuntos, sesiones y datos de moderación siempre requieren la red: no se guardan aquí.
const VERSION = 'valomi-v2-dia-48h';
const BASE = ['/', '/mapa', '/reportar', '/mas', '/privacidad', '/como-se-revisan', '/manifest.webmanifest', '/icono.svg', '/mapa/limite.geojson', '/mapa/calles.geojson', '/mapa/esquinas.json'];
const PAGINAS = new Set(['/', '/mapa', '/reportar', '/mas', '/privacidad', '/como-se-revisan']);

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(BASE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  // La versión anterior podía guardar /api/reportes; se elimina al activar esta versión.
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('valomi-') && k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // Nunca devolver un HTML sin conexión como respuesta de una API ni rescatar reportes/fotos de una caché vieja.
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(req, { cache: 'no-store' }).catch(() => new Response(JSON.stringify({ mensaje: 'Sin conexión. No se pueden cargar reportes ni archivos.' }), { status: 503, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })));
    return;
  }
  if (url.pathname.startsWith('/moderacion') || url.pathname.startsWith('/entrar') || url.searchParams.has('original')) return;

  if (req.mode === 'navigate' && PAGINAS.has(url.pathname)) {
    e.respondWith((async () => {
      try {
        const r = await fetch(req);
        if (r.ok) { const c = await caches.open(VERSION); await c.put(req, r.clone()).catch(() => {}); }
        return r;
      } catch {
        return (await caches.match(req)) || (await caches.match(url.pathname)) || (await caches.match('/')) || new Response('Sin conexión', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
    })());
    return;
  }

  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/mapa/') || url.pathname.startsWith('/icono')) {
    e.respondWith((async () => {
      const guardado = await caches.match(req);
      if (guardado) return guardado;
      const r = await fetch(req);
      if (r.ok) { const c = await caches.open(VERSION); await c.put(req, r.clone()).catch(() => {}); }
      return r;
    })());
  }
});
