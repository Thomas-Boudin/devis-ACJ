self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; }
  catch { payload = { body: event.data ? event.data.text() : '' }; }

  const title = String(payload.title || 'ACJ Services');
  const options = {
    body: String(payload.body || 'Nouvelle alerte terrain.'),
    tag: String(payload.tag || 'acj-terrain-alert'),
    renotify: true,
    requireInteraction: Boolean(payload.requireInteraction ?? true),
    vibrate: [250, 120, 250, 120, 450],
    data: { url: String(payload.url || './') }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification?.data?.url || './', self.location.href).href;
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if ('focus' in client) {
        await client.focus();
        if ('navigate' in client) await client.navigate(target);
        return;
      }
    }
    if (clients.openWindow) await clients.openWindow(target);
  })());
});
