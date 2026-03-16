/**
 * Service Worker Registration Utility
 * Registers the service worker in production environments
 */

export function registerServiceWorker() {
  // Only register in production and if service workers are supported
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    process.env.NODE_ENV !== 'production'
  ) {
    return;
  }

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      console.log('[SW] Service Worker registered successfully:', registration.scope);

      // Check for updates periodically
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New service worker available, prompt user to refresh
            console.log('[SW] New service worker available');

            // You can show a toast notification here
            if (typeof window !== 'undefined' && window.showUpdateNotification) {
              window.showUpdateNotification();
            }
          }
        });
      });

      // Auto-update check every hour
      setInterval(() => {
        registration.update();
      }, 60 * 60 * 1000);
    } catch (error) {
      console.error('[SW] Service Worker registration failed:', error);
    }
  });

  // Listen for messages from service worker
  navigator.serviceWorker.addEventListener('message', (event) => {
    console.log('[SW] Message from service worker:', event.data);

    // Handle different message types
    if (event.data.type === 'CACHE_UPDATED') {
      console.log('[SW] Cache updated for:', event.data.url);
    }
  });

  // Handle controller change (new SW activated)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('[SW] New service worker activated');

    // Optionally reload the page
    if (confirm('New version available! Reload to update?')) {
      window.location.reload();
    }
  });
}

/**
 * Unregister service worker (useful for development)
 */
export async function unregisterServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      await registration.unregister();
      console.log('[SW] Service Worker unregistered');
    }
  } catch (error) {
    console.error('[SW] Service Worker unregistration failed:', error);
  }
}

/**
 * Check if service worker is registered
 */
export function isServiceWorkerRegistered(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    navigator.serviceWorker.controller !== null
  );
}

/**
 * Send message to service worker
 */
export async function sendMessageToSW(message: unknown): Promise<void> {
  if (!isServiceWorkerRegistered() || !navigator.serviceWorker.controller) {
    console.warn('[SW] Service worker not available');
    return;
  }

  navigator.serviceWorker.controller.postMessage(message);
}

/**
 * Request background sync
 */
export async function requestBackgroundSync(tag: string): Promise<void> {
  if (!isServiceWorkerRegistered()) {
    console.warn('[SW] Service worker not available for background sync');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    if ('sync' in registration) {
      await (registration as ServiceWorkerRegistration & { sync: { register(tag: string): Promise<void> } }).sync.register(tag);
      console.log('[SW] Background sync registered:', tag);
    }
  } catch (error) {
    console.error('[SW] Background sync registration failed:', error);
  }
}

/**
 * Clear all caches
 */
export async function clearAllCaches(): Promise<void> {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return;
  }

  try {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
    console.log('[SW] All caches cleared');
  } catch (error) {
    console.error('[SW] Failed to clear caches:', error);
  }
}
