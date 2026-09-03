const CACHE = 'devis-acj-v12';
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
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function withV12(response) {
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
        return await withV12(response);
      } catch (e) {
        const cached = await caches.match(event.request) || await caches.match('./index.html');
        return withV12(cached);
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
