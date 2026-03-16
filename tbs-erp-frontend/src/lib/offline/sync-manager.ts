/**
 * sync-manager.ts
 * Background sync manager — processes the offline mutation queue
 * when the device comes back online.
 */

import {
  getPendingMutations,
  updateMutationStatus,
  removeMutation,
  type QueuedMutation,
} from './mutation-queue';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type SyncEventType = 'start' | 'progress' | 'completed' | 'failed' | 'idle';

export interface SyncEvent {
  type: SyncEventType;
  /** Id of the mutation this event relates to (for 'progress' / 'failed'). */
  mutationId?: string;
  /** How many mutations are still pending after this event. */
  pendingCount?: number;
  /** Error message when type === 'failed'. */
  error?: string;
}

type SyncListener = (event: SyncEvent) => void;

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------
const MAX_RETRY_COUNT = 3;
let isSyncing = false;
const listeners: Set<SyncListener> = new Set();

// ---------------------------------------------------------------------------
// Event emitter helpers
// ---------------------------------------------------------------------------
function emit(event: SyncEvent): void {
  listeners.forEach((fn) => {
    try {
      fn(event);
    } catch {
      // Individual listener errors must not break the sync loop.
    }
  });
}

export function addSyncListener(fn: SyncListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ---------------------------------------------------------------------------
// Online check
// ---------------------------------------------------------------------------
export function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

// ---------------------------------------------------------------------------
// Core sync logic
// ---------------------------------------------------------------------------

/**
 * Attempt to replay a single queued mutation against the real API.
 * Returns true when the request succeeded (2xx), false otherwise.
 */
async function replayMutation(mutation: QueuedMutation): Promise<boolean> {
  const { id, method, url, body, headers, retryCount } = mutation;

  // Skip mutations that have already exhausted retries.
  if (retryCount >= MAX_RETRY_COUNT) {
    await updateMutationStatus(
      id,
      'failed',
      `Vượt quá số lần thử lại tối đa (${MAX_RETRY_COUNT})`,
    );
    emit({ type: 'failed', mutationId: id, error: 'Vượt quá số lần thử lại tối đa' });
    return false;
  }

  await updateMutationStatus(id, 'syncing');

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body != null ? JSON.stringify(body) : undefined,
      credentials: 'include',
    });

    if (response.ok || (response.status >= 200 && response.status < 300)) {
      // Success — remove the mutation from the queue.
      await removeMutation(id);
      emit({ type: 'progress', mutationId: id });
      return true;
    }

    // 4xx errors (client errors) — do not retry, mark as permanently failed.
    if (response.status >= 400 && response.status < 500) {
      const errorText = await response.text().catch(() => `HTTP ${response.status}`);
      await updateMutationStatus(id, 'failed', `Lỗi máy chủ: ${response.status} — ${errorText}`);
      emit({
        type: 'failed',
        mutationId: id,
        error: `HTTP ${response.status}`,
      });
      return false;
    }

    // 5xx — mark as failed (will retry next time).
    await updateMutationStatus(
      id,
      'failed',
      `Lỗi máy chủ tạm thời: ${response.status}`,
    );
    return false;
  } catch (networkError) {
    // Network-level error — device is likely offline again.
    // Restore status to 'pending' so it retries without counting as a failed attempt.
    await updateMutationStatus(id, 'pending');
    return false;
  }
}

/**
 * Process all pending mutations sequentially.
 * Skips remaining mutations if the device goes offline mid-sync.
 */
export async function startSync(): Promise<void> {
  if (isSyncing) return;
  if (!isOnline()) return;

  isSyncing = true;
  emit({ type: 'start' });

  try {
    const mutations = await getPendingMutations();

    for (const mutation of mutations) {
      // Abort mid-sync if we lost connectivity.
      if (!isOnline()) break;
      await replayMutation(mutation);
    }

    const remaining = await getPendingMutations();
    emit({ type: 'completed', pendingCount: remaining.length });
  } catch {
    emit({ type: 'failed', error: 'Lỗi khi đồng bộ hàng đợi' });
  } finally {
    isSyncing = false;
    emit({ type: 'idle' });
  }
}

export function getIsSyncing(): boolean {
  return isSyncing;
}

// ---------------------------------------------------------------------------
// Browser event listeners
// ---------------------------------------------------------------------------

/**
 * Set up 'online' / 'offline' browser event listeners.
 * Call once during app initialisation.
 * Returns a cleanup function that removes the listeners.
 */
export function setupSyncListeners(): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const handleOnline = () => {
    startSync();
  };

  window.addEventListener('online', handleOnline);

  return () => {
    window.removeEventListener('online', handleOnline);
  };
}
