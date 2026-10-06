const CACHE = 'devis-acj-v40';
const CACHE_PREFIX = 'devis-acj-';
const ISOLATED_SUBAPPS = ['intervenantes/', 'terrain/'];

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './sap-v7.js?v=40',
  './print-v9.js?v=40',
  './details-v10.js?v=40',
  './print-v11.js?v=40',
  './ai-v17.js?v=40',
  './ai-policy-v18.js?v=40',
  './ogust-write-v19.js?v=40',
  './client-step-v21.js?v=40',
  './navigation-v22.js?v=40',
  './compliance-v23.js?v=40',
  './multi-ogust-v28.js?v=40',
  './auth-v29-2.js?v=40',
  './prestation-sync-v24.js?v=40',
  './costs-v28-1.js?v=40',
  './ogust-units-v25.js?v=40',
  './history-v29.js?v=40',
  './history-delete-v29-1.js?v=40',
  './ux-v26.js?v=40',
  './ux-v27.js?v=40',
  './ux-v30.js?v=40',
  './availability-v31.js?v=40',
  './availability-v32.js?v=40',
  './history-reopen-v33.js?v=40',
  './quotation-update-v34.js?v=40',
  './ogust-rates-v40.js?v=40',
  './notes-import-v39.js?v=40',
  './pwa-update-v38.js?v=40'
];

function relativePath(urlValue) {
  const url = new URL(urlValue);
  const scopePath = new URL(self.registration.scope).pathname;
  if (!url.pathname.startsWith(scopePath)) return '';
  return url.pathname.slice(scopePath.length);
}

function isIsolatedSubapp(urlValue) {
  const url = new URL(urlValue);
  if (url.origin !== self.location.origin) return false;
  const relative = relativePath(urlValue);
  return ISOLATED_SUBAPPS.some((prefix) => relative === prefix.slice(0, -1) || relative.startsWith(prefix));
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS.map(url=>new Request(url,{cache:'reload'})))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE)
        .map((key) => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

async function withV292(response) {
  if (!response) return response;
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) return response;
  const text = await response.text();
  let html = text;
  if (!html.includes('sap-v7.js')) html = html.replace('</body>', '<script src="./sap-v7.js?v=40"></script></body>');
  if (!html.includes('print-v9.js')) html = html.replace('</body>', '<script src="./print-v9.js?v=40"></script></body>');
  if (!html.includes('details-v10.js')) html = html.replace('</body>', '<script src="./details-v10.js?v=40"></script></body>');
  if (!html.includes('print-v11.js')) html = html.replace('</body>', '<script src="./print-v11.js?v=40"></script></body>');
  if (!html.includes('ai-v17.js')) html = html.replace('</body>', '<script src="./ai-v17.js?v=40"></script></body>');
  if (!html.includes('ai-policy-v18.js')) html = html.replace('</body>', '<script src="./ai-policy-v18.js?v=40"></script></body>');
  if (!html.includes('ogust-write-v19.js')) html = html.replace('</body>', '<script src="./ogust-write-v19.js?v=40"></script></body>');
  if (!html.includes('client-step-v21.js')) html = html.replace('</body>', '<script src="./client-step-v21.js?v=40"></script></body>');
  if (!html.includes('navigation-v22.js')) html = html.replace('</body>', '<script src="./navigation-v22.js?v=40"></script></body>');
  if (!html.includes('compliance-v23.js')) html = html.replace('</body>', '<script src="./compliance-v23.js?v=40"></script></body>');
  if (!html.includes('multi-ogust-v28.js')) html = html.replace('</body>', '<script src="./multi-ogust-v28.js?v=40"></script></body>');
  if (!html.includes('auth-v29-2.js')) html = html.replace('</body>', '<script src="./auth-v29-2.js?v=40"></script></body>');
  if (!html.includes('prestation-sync-v24.js')) html = html.replace('</body>', '<script src="./prestation-sync-v24.js?v=40"></script></body>');
  if (!html.includes('costs-v28-1.js')) html = html.replace('</body>', '<script src="./costs-v28-1.js?v=40"></script></body>');
  if (!html.includes('ogust-units-v25.js')) html = html.replace('</body>', '<script src="./ogust-units-v25.js?v=40"></script></body>');
  if (!html.includes('history-v29.js')) html = html.replace('</body>', '<script src="./history-v29.js?v=40"></script></body>');
  if (!html.includes('history-delete-v29-1.js')) html = html.replace('</body>', '<script src="./history-delete-v29-1.js?v=40"></script></body>');
  if (!html.includes('ux-v26.js')) html = html.replace('</body>', '<script src="./ux-v26.js?v=40"></script></body>');
  if (!html.includes('ux-v27.js')) html = html.replace('</body>', '<script src="./ux-v27.js?v=40"></script></body>');
  if (!html.includes('ux-v30.js')) html = html.replace('</body>', '<script src="./ux-v30.js?v=40"></script></body>');
  if (!html.includes('availability-v31.js')) html = html.replace('</body>', '<script src="./availability-v31.js?v=40"></script></body>');
  if (!html.includes('availability-v32.js')) html = html.replace('</body>', '<script src="./availability-v32.js?v=40"></script></body>');
  if (!html.includes('history-reopen-v33.js')) html = html.replace('</body>', '<script src="./history-reopen-v33.js?v=40"></script></body>');
  if (!html.includes('quotation-update-v34.js')) html = html.replace('</body>', '<script src="./quotation-update-v34.js?v=40"></script></body>');
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  // ACJ Intervenantes et ACJ Terrain ont leur propre logique. Le Service Worker
  // de Devis ACJ ne doit ni les mettre en cache, ni modifier leur HTML.
  if (isIsolatedSubapp(event.request.url)) return;

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
