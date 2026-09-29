// Dark Corner's service worker. It only shows push notifications and opens the
// game when one is tapped; it caches nothing, so every deploy shows up as before.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Dark Corner', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      tag: data.tag || undefined,
      // A newer notification with the same tag replaces the old one, and still buzzes.
      renotify: Boolean(data.tag),
      data: { url: data.url || '/city' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/city', self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (!open) return self.clients.openWindow(url);
      await open.focus();
      if (open.url !== url && 'navigate' in open) await open.navigate(url).catch(() => undefined);
    })(),
  );
});
