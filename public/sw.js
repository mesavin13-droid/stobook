// STOBOOK Service Worker with Web Push & Offline Support

const CACHE_NAME = 'stobook-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch handler - network first with cache fallback
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = event.request.url;

  // Never intercept backend API or Vite development internal requests
  if (
    url.includes('/api/') ||
    url.includes('/@') ||
    url.includes('/src/') ||
    url.includes('node_modules') ||
    url.includes('hot-update')
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          }).catch(() => {});
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html') || fetch(event.request);
          }
          return fetch(event.request);
        });
      })
  );
});

// Push notification received
self.addEventListener('push', (event) => {
  let data = {
    title: 'STOBOOK',
    body: 'У вас новое уведомление по записи в автосервис',
    icon: '/icon.svg',
    badge: '/icon.svg',
    data: { url: '/bookings' },
    actions: [
      { action: 'confirm', title: 'Подтвердить' },
      { action: 'cancel', title: 'Не смогу приехать' }
    ]
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icon.svg',
    badge: data.badge || '/icon.svg',
    vibrate: [100, 50, 100],
    data: data.data || { url: '/bookings' },
    actions: data.actions || []
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const appointmentUrl = (event.notification.data && event.notification.data.url) || '/bookings';

  if (event.action === 'confirm') {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.postMessage({ type: 'CONFIRM_APPOINTMENT', appointmentId: event.notification.data?.appointmentId });
            return client.focus();
          }
        }
        return clients.openWindow(appointmentUrl + '?action=confirm&appointmentId=' + (event.notification.data?.appointmentId || ''));
      })
    );
  } else if (event.action === 'cancel') {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.postMessage({ type: 'CANCEL_APPOINTMENT', appointmentId: event.notification.data?.appointmentId });
            return client.focus();
          }
        }
        return clients.openWindow(appointmentUrl + '?action=cancel&appointmentId=' + (event.notification.data?.appointmentId || ''));
      })
    );
  } else {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        return clients.openWindow(appointmentUrl);
      })
    );
  }
});
