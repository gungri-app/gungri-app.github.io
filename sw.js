// Keeps 궁리's own files (code, styles, fonts, icons) on the device, so the app opens without
// waiting for the network. GitHub API requests are never touched: only this site's own GET
// requests are handled. The build fills in the version below, so every deploy gets a fresh cache.
const CACHE = 'gungri-1183ef3592ca';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') event.respondWith(page(request));
  else if (url.pathname.includes('/assets/')) event.respondWith(cacheFirst(request));
  else event.respondWith(staleWhileRevalidate(request));
});

/** File names under assets/ change whenever their content does, so a saved copy is always right. */
async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const saved = await cache.match(request);
  if (saved) return saved;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

/** The page: the newest version when the network answers quickly, the saved one otherwise. */
async function page(request) {
  const cache = await caches.open(CACHE);
  const key = self.registration.scope; // one saved page, whatever ?repo= the link carries
  const network = fetch(request).then(async (response) => {
    if (response.ok) await cache.put(key, response.clone());
    return response;
  });
  const slow = new Promise((resolve) => setTimeout(resolve, 2500, null));
  const first = await Promise.race([network.catch(() => null), slow]);
  if (first) return first;
  return (await cache.match(key)) ?? network;
}

/** Icons and the manifest: the saved copy at once, refreshed in the background. */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const saved = await cache.match(request);
  const network = fetch(request)
    .then(async (response) => {
      if (response.ok) await cache.put(request, response.clone());
      return response;
    })
    .catch(() => saved);
  return saved ?? network;
}
