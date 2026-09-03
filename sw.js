const CACHE = 'devis-acj-v13';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './sap-v7.js',
  './print-v9.js',
  './details-v10.js',
  './print-v11.js',
  './ai-v12.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();

    // Une ancienne version de la PWA peut rester affichée même après l'activation
    // du nouveau service worker. On recharge alors les fenêtres ouvertes une fois,
    // afin que les nouveaux modules injectés (notamment l'assistant IA) soient pris
    // en compte immédiatement.
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    await Promise.all(clients.map(async (client) => {
      try {
        await client.navigate(client.url);
      } catch (e) {
        // Le prochain lancement utilisera de toute façon ce service worker.
      }
    }));
  })());
});

async function withV13(response) {
  if (!response) return response;
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) return response;
  const text = await response.text();
  let html = text;
  if (!html.includes('sap-v7.js')) html = html.replace('</body>', '<script src="./sap-v7.js"></script></body>');
  if (!html.includes('print-v9.js')) html = html.replace('</body>', '<script src="./print-v9.js"></script></body>');
  if (!html.includes('details-v10.js')) html = html.replace('</body>', '<script src="./details-v10.js"></script></body>');
  if (!html.includes('print-v11.js')) html = html.replace('</body>', '<script src="./print-v11.js"></script></body>');
  if (!html.includes('ai-v12.js')) html = html.replace('</body>', '<script src="./ai-v12.js"></script></body>');
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(event.request);
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return await withV13(response);
      } catch (e) {
        const cached = await caches.match(event.request) || await caches.match('./index.html');
        return withV13(cached);
      }
    })());
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      });
    })
  );
});
