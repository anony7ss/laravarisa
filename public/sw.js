/* Service Worker - Lara Varisa Agendar PWA */
const CACHE_NAME = 'lv-pwa-v1';

const STATIC_PRECACHE = [
  '/agendar',
  '/manifest.webmanifest',
  '/favicon.ico',
  '/logo-emblem.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/maskable-icon-512x512.png',
  '/lara-lashes-optimized.webp',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_PRECACHE))
      .catch((err) => {
        // Ignora erros em pré-cache caso algum arquivo não esteja imediatamente disponível
        console.warn('[SW] Falha parcial no pré-cache:', err);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key.startsWith('lv-pwa-') && key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Aceita somente requisições GET
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Ignora chamadas de API, endpoints administrativos e extensões de navegador
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/admin') ||
    url.protocol.startsWith('chrome-extension')
  ) {
    return;
  }

  // Requisições de navegação de páginas (ex: /agendar) -> Network First com fallback para cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const fallbackAgendar = await caches.match('/agendar');
          if (fallbackAgendar) return fallbackAgendar;
          return new Response(
            'Você está offline. Conecte-se à internet para carregar o agendamento.',
            {
              status: 503,
              headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            }
          );
        })
    );
    return;
  }

  // Arquivos estáticos (fontes, scripts do Next.js, imagens, css) -> Cache First / Stale While Revalidate
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|webp|ico|woff2|woff|ttf)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
  }
});
