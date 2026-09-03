const CACHE = 'devis-acj-v19';
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
  './ai-v17.js',
  './ai-policy-v18.js',
  './ogust-write-v19.js'
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
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    await Promise.all(clients.map(async (client) => {
      try { await client.navigate(client.url); } catch (e) {}
    }));
  })());
});

async function withV19(response) {
  if (!response) return response;
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) return response;
  const text = await response.text();
  let html = text;
  if (!html.includes('sap-v7.js')) html = html.replace('</body>', '<script src="./sap-v7.js"></script></body>');
  if (!html.includes('print-v9.js')) html = html.replace('</body>', '<script src="./print-v9.js"></script></body>');
  if (!html.includes('details-v10.js')) html = html.replace('</body>', '<script src="./details-v10.js"></script></body>');
  if (!html.includes('print-v11.js')) html = html.replace('</body>', '<script src="./print-v11.js"></script></body>');
  if (!html.includes('ai-v17.js')) html = html.replace('</body>', '<script src="./ai-v17.js"></script></body>');
  if (!html.includes('ai-policy-v18.js')) html = html.replace('</body>', '<script src="./ai-policy-v18.js"></script></body>');
  if (!html.includes('ogust-write-v19.js')) html = html.replace('</body>', '<script src="./ogust-write-v19.js"></script></body>');
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(event.request);
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return await withV19(response);
      } catch (e) {
        const cached = await caches.match(event.request) || await caches.match('./index.html');
        return withV19(cached);
      }
    })());
    return;
  }
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
    if (response && response.ok) caches.open(CACHE).then((cache) => cache.put(event.request, response.clone()));
    return response;
  })));
});
