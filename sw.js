const CACHE = 'devis-acj-v33';
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
  './ogust-write-v19.js',
  './client-step-v21.js',
  './navigation-v22.js',
  './compliance-v23.js',
  './multi-ogust-v28.js',
  './auth-v29-2.js',
  './prestation-sync-v24.js',
  './costs-v28-1.js',
  './ogust-units-v25.js',
  './history-v29.js',
  './history-delete-v29-1.js',
  './ux-v26.js',
  './ux-v27.js',
  './ux-v30.js',
  './availability-v31.js',
  './availability-v32.js',
  './history-reopen-v33.js'
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

async function withV292(response) {
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
  if (!html.includes('client-step-v21.js')) html = html.replace('</body>', '<script src="./client-step-v21.js"></script></body>');
  if (!html.includes('navigation-v22.js')) html = html.replace('</body>', '<script src="./navigation-v22.js"></script></body>');
  if (!html.includes('compliance-v23.js')) html = html.replace('</body>', '<script src="./compliance-v23.js"></script></body>');
  if (!html.includes('multi-ogust-v28.js')) html = html.replace('</body>', '<script src="./multi-ogust-v28.js"></script></body>');
  if (!html.includes('auth-v29-2.js')) html = html.replace('</body>', '<script src="./auth-v29-2.js"></script></body>');
  if (!html.includes('prestation-sync-v24.js')) html = html.replace('</body>', '<script src="./prestation-sync-v24.js"></script></body>');
  if (!html.includes('costs-v28-1.js')) html = html.replace('</body>', '<script src="./costs-v28-1.js"></script></body>');
  if (!html.includes('ogust-units-v25.js')) html = html.replace('</body>', '<script src="./ogust-units-v25.js"></script></body>');
  if (!html.includes('history-v29.js')) html = html.replace('</body>', '<script src="./history-v29.js"></script></body>');
  if (!html.includes('history-delete-v29-1.js')) html = html.replace('</body>', '<script src="./history-delete-v29-1.js"></script></body>');
  if (!html.includes('ux-v26.js')) html = html.replace('</body>', '<script src="./ux-v26.js"></script></body>');
  if (!html.includes('ux-v27.js')) html = html.replace('</body>', '<script src="./ux-v27.js"></script></body>');
  if (!html.includes('ux-v30.js')) html = html.replace('</body>', '<script src="./ux-v30.js"></script></body>');
  if (!html.includes('availability-v31.js')) html = html.replace('</body>', '<script src="./availability-v31.js"></script></body>');
  if (!html.includes('availability-v32.js')) html = html.replace('</body>', '<script src="./availability-v32.js"></script></body>');
  if (!html.includes('history-reopen-v33.js')) html = html.replace('</body>', '<script src="./history-reopen-v33.js"></script></body>');
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
        return await withV292(response);
      } catch (e) {
        const cached = await caches.match(event.request) || await caches.match('./index.html');
        return withV292(cached);
      }
    })());
    return;
  }
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
    if (response && response.ok) caches.open(CACHE).then((cache) => cache.put(event.request, response.clone()));
    return response;
  })));
});