const CACHE_NAME = 'life-os-v5';
const ASSETS_TO_CACHE = [
  '/accountability-tracker/',
  '/accountability-tracker/index.html',
  '/accountability-tracker/vendor/chart.umd.js'
];

// Install - cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // For Convex API calls, always go network
  if (event.request.url.includes('convex.cloud') || event.request.url.includes('convex.dev')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone and cache successful responses
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(event.request);
      })
  );
});

// Push - reminders from the Convex cron. iOS revokes the subscription if a push
// doesn't show a notification, so always show one.
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { body: event.data ? event.data.text() : '' };
  }

  const shown = self.registration.showNotification(payload.title || 'Life OS', {
    body: payload.body || "Open Life OS to check today's list.",
    tag: payload.tag || 'life-os',
    data: { url: payload.url || './?section=habits' }
  });

  // Home Screen badge = items left today
  const count = Number(payload.count);
  let badge = Promise.resolve();
  if (Number.isFinite(count) && 'setAppBadge' in self.navigator) {
    badge = (count > 0 ? self.navigator.setAppBadge(count) : self.navigator.clearAppBadge()).catch(() => {});
  }

  event.waitUntil(Promise.all([shown, badge]));
});

// Notification tap - open (or focus) the app on the Today tab
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || './?section=habits', self.registration.scope).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => w.url.startsWith(self.registration.scope));
      if (open) {
        open.postMessage({ type: 'navigate', section: 'habits' });
        return open.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
