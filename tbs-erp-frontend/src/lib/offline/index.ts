/**
 * Offline module barrel export.
 */

export { OfflineProvider, useOffline } from './offline-provider';
export type { OfflineContextValue } from './offline-provider';

export { offlineFetch, offlineGet } from './offline-fetch';
export type { OfflineMethod, OfflineFetchResult } from './offline-fetch';

export {
  addMutation,
  getPendingMutations,
  updateMutationStatus,
  removeMutation,
  getPendingCount,
  clearCompleted,
} from './mutation-queue';
export type { QueuedMutation, MutationStatus } from './mutation-queue';

export {
  startSync,
  isOnline,
  addSyncListener,
  getIsSyncing,
  setupSyncListeners,
} from './sync-manager';
export type { SyncEvent, SyncEventType } from './sync-manager';
