/**
 * Service Worker for TBS ERP Frontend
 * Provides offline caching for static assets and API responses
 */

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `tbs-erp-static-${CACHE_VERSION}`;
const API_CACHE = `tbs-erp-api-${CACHE_VERSION}`;
const IMAGE_CACHE = `tbs-erp-images-${CACHE_VERSION}`;

// Static assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/offline',
  '/manifest.json',
];

// Cache duration in milliseconds
const CACHE_DURATION = {
  static: 30 * 24 * 60 * 60 * 1000, // 30 days
  api: 5 * 60 * 1000, // 5 minutes
  images: 7 * 24 * 60 * 60 * 1000, // 7 days
};

/**
 * Install event - cache static assets
 */
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');

  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[Service Worker] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );

  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (
            cacheName !== STATIC_CACHE &&
            cacheName !== API_CACHE &&
            cacheName !== IMAGE_CACHE
          ) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );

  // Take control of all pages immediately
  self.clients.claim();
});

/**
 * Fetch event - implement caching strategies
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome extension requests
  if (url.protocol === 'chrome-extension:') {
    return;
  }

  // API requests - Network First with cache fallback
  if (url.pathname.startsWith('/api/') || url.hostname.includes('api.')) {
    event.respondWith(networkFirstStrategy(request, API_CACHE));
    return;
  }

  // Images - Cache First with network fallback
  if (request.destination === 'image') {
    event.respondWith(cacheFirstStrategy(request, IMAGE_CACHE));
    return;
  }

  // Static assets (JS, CSS, fonts) - Cache First
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'font'
  ) {
    event.respondWith(cacheFirstStrategy(request, STATIC_CACHE));
    return;
  }

  // Documents - Network First with cache fallback
  if (request.destination === 'document') {
    event.respondWith(networkFirstStrategy(request, STATIC_CACHE));
    return;
  }

  // Default strategy
  event.respondWith(fetch(request));
});

/**
 * Cache First Strategy
 * Try cache first, fall back to network
 */
async function cacheFirstStrategy(request, cacheName) {
  try {
    // Check cache first
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      // Check if cache is still valid
      const cacheDate = cachedResponse.headers.get('sw-cache-date');
      if (cacheDate) {
        const age = Date.now() - parseInt(cacheDate);
        const maxAge = cacheName === IMAGE_CACHE
          ? CACHE_DURATION.images
          : CACHE_DURATION.static;

        if (age < maxAge) {
          return cachedResponse;
        }
      } else {
        // If no cache date, return cached response anyway
        return cachedResponse;
      }
    }

    // Fetch from network
    const networkResponse = await fetch(request);

    // Cache the response
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(cacheName);
      const responseToCache = networkResponse.clone();

      // Add cache date header
      const headers = new Headers(responseToCache.headers);
      headers.set('sw-cache-date', Date.now().toString());

      const modifiedResponse = new Response(responseToCache.body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers: headers,
      });

      cache.put(request, modifiedResponse);
    }

    return networkResponse;
  } catch (error) {
    console.error('[Service Worker] Cache First error:', error);

    // Try to return cached response as fallback
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Return offline page for documents
    if (request.destination === 'document') {
      return caches.match('/offline');
    }

    throw error;
  }
}

/**
 * Network First Strategy
 * Try network first, fall back to cache
 */
async function networkFirstStrategy(request, cacheName) {
  try {
    // Try network first
    const networkResponse = await fetch(request);

    // Cache successful responses
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(cacheName);
      const responseToCache = networkResponse.clone();

      // Add cache date header
      const headers = new Headers(responseToCache.headers);
      headers.set('sw-cache-date', Date.now().toString());

      const modifiedResponse = new Response(responseToCache.body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers: headers,
      });

      cache.put(request, modifiedResponse);
    }

    return networkResponse;
  } catch (error) {
    console.log('[Service Worker] Network failed, trying cache:', error.message);

    // Fall back to cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Return offline page for documents
    if (request.destination === 'document') {
      return caches.match('/offline');
    }

    throw error;
  }
}

/**
 * Background sync for offline requests
 */
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background sync:', event.tag);

  if (event.tag === 'sync-data') {
    event.waitUntil(syncData());
  }
});

/**
 * Sync data when back online
 */
async function syncData() {
  try {
    // Implement your sync logic here
    console.log('[Service Worker] Syncing data...');
    // Example: Send queued requests, refresh data, etc.
  } catch (error) {
    console.error('[Service Worker] Sync error:', error);
  }
}

/**
 * Push notification handler
 */
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();

  const options = {
    body: data.body || 'New notification',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/',
    },
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'TBS ERP', options)
  );
});

/**
 * Notification click handler
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
});
