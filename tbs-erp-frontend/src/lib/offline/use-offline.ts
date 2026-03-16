/**
 * use-offline.ts
 * Re-export of the useOffline hook for convenience.
 *
 * Usage:
 *   import { useOffline } from '@/lib/offline/use-offline';
 *   const { isOnline, pendingCount, isSyncing, syncNow } = useOffline();
 */

export { useOffline } from './offline-provider';
export type { OfflineContextValue } from './offline-provider';
