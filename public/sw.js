// Service Worker — handles push notifications even when the app tab is closed.
// This file MUST live at the root of the site (not inside src/) so its scope
// covers the whole app.

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Reminder', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Hi Ridhhi, how far are you with your work?';
  const options = {
    body: data.body || 'You have a task due.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'todo-reminder',
    data: { url: data.url || '/' },
    requireInteraction: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// When the user clicks the notification, focus or open the app.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(event.notification.data.url || '/');
    })
  );
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(clients.claim()));
