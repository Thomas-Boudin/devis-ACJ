const CACHE = 'devis-acj-v2';
self.addEventListener('install', evt=>{
  evt.waitUntil(caches.open(CACHE).then(c=>c.addAll([
    './','devis-mobile-v2.html','manifest.json','icon-192.png','icon-512.png'
  ])));
});
self.addEventListener('fetch', evt=>{
  evt.respondWith(
    caches.match(evt.request).then(r=>r||fetch(evt.request))
  );
});
