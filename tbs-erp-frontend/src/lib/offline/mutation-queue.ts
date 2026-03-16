/**
 * mutation-queue.ts
 * IndexedDB-based offline mutation queue using raw IndexedDB API.
 *
 * Database: tbs-offline-queue
 * Object store: mutations
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type MutationStatus = 'pending' | 'syncing' | 'failed' | 'completed';

export interface QueuedMutation {
  id: string;
  timestamp: number;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  body: unknown;
  headers: Record<string, string>;
  status: MutationStatus;
  retryCount: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const DB_NAME = 'tbs-offline-queue';
const STORE_NAME = 'mutations';
const DB_VERSION = 1;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Add a new mutation to the queue.
 * Returns the generated mutation id.
 */
export async function addMutation(
  method: QueuedMutation['method'],
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<string> {
  const db = await openDB();
  const mutation: QueuedMutation = {
    id: generateId(),
    timestamp: Date.now(),
    method,
    url,
    body,
    headers,
    status: 'pending',
    retryCount: 0,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.add(mutation);
    req.onsuccess = () => resolve(mutation.id);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

/**
 * Retrieve all mutations with status 'pending' or 'failed' (retry candidates),
 * ordered by timestamp ascending so older mutations sync first.
 */
export async function getPendingMutations(): Promise<QueuedMutation[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      const all: QueuedMutation[] = req.result ?? [];
      const eligible = all
        .filter((m) => m.status === 'pending' || m.status === 'failed')
        .sort((a, b) => a.timestamp - b.timestamp);
      resolve(eligible);
    };
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

/**
 * Update the status (and optionally the error message) of a mutation by id.
 */
export async function updateMutationStatus(
  id: string,
  status: MutationStatus,
  error?: string,
): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const mutation: QueuedMutation | undefined = getReq.result;
      if (!mutation) {
        resolve();
        return;
      }
      const updated: QueuedMutation = {
        ...mutation,
        status,
        error: error ?? mutation.error,
        // Increment retryCount when transitioning to 'failed'
        retryCount: status === 'failed' ? mutation.retryCount + 1 : mutation.retryCount,
      };
      const putReq = store.put(updated);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };

    getReq.onerror = () => reject(getReq.error);
    tx.oncomplete = () => db.close();
  });
}

/**
 * Remove a mutation from the queue entirely.
 */
export async function removeMutation(id: string): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

/**
 * Return the count of mutations that are pending or failed (not yet synced).
 */
export async function getPendingCount(): Promise<number> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      const all: QueuedMutation[] = req.result ?? [];
      resolve(all.filter((m) => m.status === 'pending' || m.status === 'failed').length);
    };
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

/**
 * Remove all mutations that have status 'completed'.
 */
export async function clearCompleted(): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();

    req.onsuccess = () => {
      const all: QueuedMutation[] = req.result ?? [];
      const completed = all.filter((m) => m.status === 'completed');
      let remaining = completed.length;

      if (remaining === 0) {
        resolve();
        return;
      }

      completed.forEach((m) => {
        const delReq = store.delete(m.id);
        delReq.onsuccess = () => {
          remaining--;
          if (remaining === 0) resolve();
        };
        delReq.onerror = () => reject(delReq.error);
      });
    };

    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}
