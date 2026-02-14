'use client';

import { useEffect } from 'react';
import { registerServiceWorker } from '@/lib/utils/register-sw';

/**
 * Service Worker Registration Component
 * Registers the service worker when the component mounts
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    registerServiceWorker();
  }, []);

  // This component doesn't render anything
  return null;
}
