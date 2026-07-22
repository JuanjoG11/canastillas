/**
 * sw.js - Service Worker for Control de Canastas PWA
 * Provides offline capability via Cache-first strategy for app shell,
 * Network-first strategy for dynamic data.
 */

const CACHE_NAME = 'canastas-v2.0.0';
const CACHE_STATIC_NAME = 'canastas-static-v2.0.0';

// App shell files to pre-cache
const APP_SHELL = [
  './',
  './index.html',
  './css/style.css',
  './js/db.js',
  './js/db-viajes.js',
  './js/auth.js',
  './js/firma.js',
  './js/ui.js',
  './js/ui-viajes.js',
  './js/app.js',
  './manifest.json',
];

// ─── Install ──────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC_NAME)
      .then(cache => {
        console.log('[SW] Pre-caching app shell');
        return cache.addAll(APP_SHELL);
      })
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Pre-cache failed:', err))
  );
});

// ─── Activate ─────────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_STATIC_NAME && key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Removing old cache:', key);
            return caches.delete(key);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ─── Fetch ────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests from same origin
  if (request.method !== 'GET' || url.origin !== location.origin) {
    return;
  }

  // Cache-first for app shell assets (HTML, CSS, JS)
  if (isAppShell(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Network-first for everything else
  event.respondWith(networkFirst(request));
});

// ─── Strategies ───────────────────────────────────────────────────────────────

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_STATIC_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    console.warn('[SW] Cache-first fetch failed:', err);
    return new Response('Offline — recurso no disponible', { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response('Offline — recurso no disponible', { status: 503 });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isAppShell(url) {
  const appPaths = ['/index.html', '/css/style.css', '/js/db.js', '/js/db-viajes.js',
                    '/js/auth.js', '/js/firma.js', '/js/ui.js', '/js/ui-viajes.js',
                    '/js/app.js', '/manifest.json'];
  return url.pathname === '/' ||
         url.pathname.endsWith('/') ||
         appPaths.some(p => url.pathname.endsWith(p));
}

// ─── Message handler (for cache busting on demand) ────────────────────────────

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
  }
});
