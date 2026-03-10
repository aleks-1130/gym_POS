// Service Worker for FitOS PWA
const CACHE_NAME = 'fitos-v1.2';
const urlsToCache = [
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/vite.svg'
];

// Install event - cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching fundamental assets');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
      .catch(err => console.error('[Service Worker] Install cache failed:', err))
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Clearing legacy cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // 1. Navigation strategy (HTML): Network First
  // This prevents the "Black Screen" by ensuring we always try to get the latest index.html
  if (event.request.mode === 'navigate' || (url.origin === self.origin && url.pathname === '/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // If network works, update the cache and return
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          return response;
        })
        .catch(() => {
          // If network fails, try cache
          return caches.match(event.request)
            .then(cachedResponse => cachedResponse || new Response('Offline - content unavailable', {
              status: 503,
              headers: { 'Content-Type': 'text/plain' }
            }));
        })
    );
    return;
  }

  // 2. API strategy: Network First
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(err => {
          console.warn(`[Service Worker] API Fetch failed for ${event.request.url}:`, err);
          return caches.match(event.request)
            .then(res => res || new Response(JSON.stringify({ error: 'Offline' }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            }));
        })
    );
    return;
  }

  // 3. Asset strategy: Cache First, then Network
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request)
          .catch(err => {
            console.warn(`[Service Worker] Asset Fetch failed for ${event.request.url}:`, err);
            // Return a valid blank/fallback Response to prevent promise rejection
            return new Response('Asset not found', { status: 404 });
          });
      })
  );
});

// Background sync for offline actions
self.addEventListener('sync', event => {
  if (event.tag === 'sync-bookings') {
    event.waitUntil(syncBookings());
  }
  if (event.tag === 'sync-cart') {
    event.waitUntil(syncCart());
  }
});

async function syncBookings() {
  // Sync any pending booking operations
  console.log('Syncing bookings...');
}

async function syncCart() {
  // Sync any pending cart operations
  console.log('Syncing cart...');
}

// Push notifications
self.addEventListener('push', event => {
  const options = {
    body: event.data?.text() || 'New notification',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [100, 50, 100],
    tag: 'fitos-notification',
    requireInteraction: false
  };

  event.waitUntil(
    self.registration.showNotification('FitOS', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      // Check if there's already a window open with the target URL
      for (let client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, open a new window
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
