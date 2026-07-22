/**
 * sw.js - Service Worker v3.0
 * Cache-first para app shell, Network-first para datos,
 * Cola offline para mutaciones (POST/PATCH) cuando no hay red.
 */

const CACHE_NAME        = 'canastas-v3.0.0';
const CACHE_STATIC_NAME = 'canastas-static-v3.0.0';
const QUEUE_STORE       = 'canastas-offline-queue';

const APP_SHELL = [
  './', './index.html', './css/style.css',
  './js/db.js', './js/db-viajes.js', './js/auth.js', './js/firma.js',
  './js/export-excel.js', './js/ui.js', './js/ui-viajes.js', './js/app.js',
  './manifest.json',
];

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_STATIC_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Pre-cache failed:', err))
  );
});

// ─── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_STATIC_NAME && k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo GET desde el mismo origen → app shell
  if (request.method === 'GET' && url.origin === location.origin) {
    if (isAppShell(url)) { event.respondWith(cacheFirst(request)); return; }
    event.respondWith(networkFirst(request));
    return;
  }

  // POST / PATCH a Supabase → intentar red; si falla, encolar
  if ((request.method === 'POST' || request.method === 'PATCH') &&
       url.hostname.includes('supabase.co')) {
    event.respondWith(networkOrQueue(request));
    return;
  }
});

// ─── Strategies ───────────────────────────────────────────────────────────────
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) (await caches.open(CACHE_STATIC_NAME)).put(request, response.clone());
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) (await caches.open(CACHE_NAME)).put(request, response.clone());
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response('Offline', { status: 503 });
  }
}

async function networkOrQueue(request) {
  try {
    return await fetch(request);
  } catch {
    // Sin red: guardar en cola y devolver respuesta optimista
    await _enqueue(request.clone());
    return new Response(JSON.stringify({ offline: true, queued: true }), {
      status: 202,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ─── Cola offline (IndexedDB via Cache API como fallback) ─────────────────────
async function _enqueue(request) {
  try {
    const body = await request.text();
    const entry = {
      url:     request.url,
      method:  request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body,
      ts:      Date.now(),
    };
    const cache = await caches.open(QUEUE_STORE);
    await cache.put(new Request(`queue-${Date.now()}-${Math.random()}`),
      new Response(JSON.stringify(entry)));
    console.log('[SW] Operación encolada offline:', request.url);
  } catch (e) { console.warn('[SW] No se pudo encolar:', e); }
}

// Sincronizar cola cuando vuelve la red
self.addEventListener('sync', event => {
  if (event.tag === 'sync-queue') {
    event.waitUntil(_flushQueue());
  }
});

async function _flushQueue() {
  const cache   = await caches.open(QUEUE_STORE);
  const requests = await cache.keys();
  for (const req of requests) {
    try {
      const res   = await cache.match(req);
      const entry = JSON.parse(await res.text());
      await fetch(entry.url, {
        method:  entry.method,
        headers: entry.headers,
        body:    entry.body,
      });
      await cache.delete(req);
      console.log('[SW] Operación sincronizada:', entry.url);
    } catch (e) {
      console.warn('[SW] No se pudo sincronizar:', e);
      break; // Parar si aún no hay red
    }
  }
  // Notificar a los clientes
  const clients = await self.clients.matchAll();
  clients.forEach(c => c.postMessage({ type: 'QUEUE_FLUSHED' }));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isAppShell(url) {
  const paths = ['/index.html', '/css/style.css', '/js/db.js', '/js/db-viajes.js',
    '/js/auth.js', '/js/firma.js', '/js/export-excel.js', '/js/ui.js',
    '/js/ui-viajes.js', '/js/app.js', '/manifest.json'];
  return url.pathname === '/' || url.pathname.endsWith('/') ||
    paths.some(p => url.pathname.endsWith(p));
}

// ─── Messages ─────────────────────────────────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'CLEAR_CACHE')  caches.keys().then(k => Promise.all(k.map(c => caches.delete(c))));
  if (event.data?.type === 'SYNC_NOW')     _flushQueue();
});
