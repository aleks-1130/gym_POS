// Service Worker for FitOS PWA - Safe Version
// IMPORTANT: No skipWaiting() and no clients.claim() to prevent reload loops.
const CACHE_VERSION = 'fitos-v2.0';
const CACHE_NAME = CACHE_VERSION;
const urlsToCache = [
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/vite.svg'
];

// Install: cache static assets, but do NOT call skipWaiting
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching fundamental assets');
        return cache.addAll(urlsToCache);
      })
      .catch(err => console.error('[Service Worker] Install cache failed:', err))
    // NO self.skipWaiting() here — that was causing the reload loop
  );
});

// Activate: clean up old caches, but do NOT call clients.claim
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
    })
    // NO self.clients.claim() here — that was also contributing to the reload loop
  );
});

// Fetch event
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // 1. Skip API calls entirely - let the browser handle them with full credentials
  if (event.request.url.includes('/api/')) {
    return;
  }

  // 2. Navigation (HTML pages): Network First, no SW interception
  // Vercel handles SPA routing at the CDN level, so we just pass through
  if (event.request.mode === 'navigate') {
    return; // Let the browser/Vercel handle navigation
  }

  // 3. Static assets (JS, CSS, images): Cache First, then Network
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request)
          .catch(err => {
            console.warn(`[Service Worker] Asset Fetch failed for ${event.request.url}:`, err);
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
  console.log('Syncing bookings...');
}

async function syncCart() {
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
      for (let client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
