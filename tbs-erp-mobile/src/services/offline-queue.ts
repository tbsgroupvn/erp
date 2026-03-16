/**
 * Offline Queue Service
 *
 * Cho phep ung dung hoat dong khi mat mang (offline-first).
 * Cac action quan trong (confirm giao hang, nhan hang) duoc luu
 * vao AsyncStorage va xu ly lai khi ket noi duoc phuc hoi.
 *
 * Su dung AsyncStorage thay vi SQLite de giu dependency nhe.
 * Neu can xu ly phuc tap hon, chuyen sang WatermelonDB.
 */
import {getObject, setObject, STORAGE_KEYS} from '../utils/storage';
import {apiPost, apiPatch} from './api';

// ============================================================
// Types
// ============================================================

export type QueueItemMethod = 'POST' | 'PATCH' | 'PUT';

export interface QueueItem {
  id: string;          // UUID de dedup
  method: QueueItemMethod;
  url: string;         // Path relative (vi du: /warehouse-cn/receive)
  body?: unknown;
  createdAt: number;   // Unix ms
  retryCount: number;
  lastError?: string;
}

// ============================================================
// Constants
// ============================================================

const MAX_RETRY = 3;

/**
 * Gioi han toi da so luong item trong queue.
 * Tranh truong hop queue tang vo han khi mat mang dai.
 * Neu vuot gioi han, item cu nhat se bi loai bo (FIFO eviction).
 */
const MAX_QUEUE_SIZE = 100;

// ============================================================
// Lay queue hien tai tu storage
// ============================================================

async function readQueue(): Promise<QueueItem[]> {
  const items = await getObject<QueueItem[]>(STORAGE_KEYS.OFFLINE_QUEUE);
  return items ?? [];
}

async function writeQueue(items: QueueItem[]): Promise<void> {
  await setObject(STORAGE_KEYS.OFFLINE_QUEUE, items);
}

// ============================================================
// Public API
// ============================================================

/**
 * Them mot request vao cuoi queue.
 * Goi khi network request that bai do mat mang.
 *
 * FIX: Them gioi han MAX_QUEUE_SIZE de tranh queue tang vo han.
 * Neu vuot gioi han, item cu nhat bi loai bo truoc khi them item moi.
 *
 * Tra ve id cua item vua them, hoac null neu queue da day va khong the them.
 */
export async function enqueue(
  method: QueueItemMethod,
  url: string,
  body?: unknown,
): Promise<string> {
  const queue = await readQueue();

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const item: QueueItem = {
    id,
    method,
    url,
    body,
    createdAt: Date.now(),
    retryCount: 0,
  };

  // FIX: Gioi han kich thuoc queue — loai item cu nhat neu can
  const updatedQueue = [...queue, item];
  if (updatedQueue.length > MAX_QUEUE_SIZE) {
    // Loai bo item cu nhat (dau queue)
    updatedQueue.splice(0, updatedQueue.length - MAX_QUEUE_SIZE);
  }

  await writeQueue(updatedQueue);
  return id;
}

/**
 * Xoa mot item khoi queue theo id
 */
export async function dequeue(id: string): Promise<void> {
  const queue = await readQueue();
  const filtered = queue.filter(item => item.id !== id);
  await writeQueue(filtered);
}

/**
 * Dem so luong request dang cho trong queue
 */
export async function getQueueSize(): Promise<number> {
  const queue = await readQueue();
  return queue.length;
}

/**
 * Lay danh sach tat ca items trong queue (cho UI hien thi)
 */
export async function getQueue(): Promise<QueueItem[]> {
  return readQueue();
}

/**
 * Xu ly toan bo queue — gui tung request theo thu tu FIFO
 *
 * - Neu thanh cong: xoa khoi queue
 * - Neu that bai: tang retryCount, ghi lastError
 * - Items co retryCount >= MAX_RETRY se bi loai bo
 *
 * FIX: Doc queue mot lan duy nhat truoc khi xu ly, sau do cap nhat atomic.
 * Tranh viec doc/ghi queue nhieu lan trong vong lap gay race condition.
 *
 * Goi function nay khi:
 * - App len foreground
 * - Network reconnected (dang ky listener trong AppNavigator)
 */
export async function processQueue(): Promise<{
  processed: number;
  failed: number;
  skipped: number;
}> {
  // FIX: Lay snapshot cua queue mot lan duy nhat
  const snapshot = await readQueue();

  if (snapshot.length === 0) {
    return {processed: 0, failed: 0, skipped: 0};
  }

  let processed = 0;
  let failed = 0;
  let skipped = 0;

  // Tap hop id cac item can xoa (thanh cong hoac het retry)
  const toRemove = new Set<string>();
  // Map id -> so lan retry moi va loi
  const toUpdate = new Map<string, {retryCount: number; lastError: string}>();

  // Xu ly tung item — giu thu tu FIFO
  for (const item of snapshot) {
    // Loai bo item qua so lan retry
    if (item.retryCount >= MAX_RETRY) {
      toRemove.add(item.id);
      skipped++;
      continue;
    }

    try {
      if (item.method === 'POST') {
        await apiPost(item.url, item.body);
      } else if (item.method === 'PATCH') {
        await apiPatch(item.url, item.body);
      }
      // PUT khong duoc ho tro nhung van ghi nhan thanh cong de xoa
      toRemove.add(item.id);
      processed++;
    } catch (error) {
      const lastError =
        error instanceof Error ? error.message : 'Unknown error';
      toUpdate.set(item.id, {
        retryCount: item.retryCount + 1,
        lastError,
      });
      failed++;

      // Thoat som neu loi mang (khong can thu tiep cac item sau)
      if (isNetworkError(error)) {
        break;
      }
    }
  }

  // FIX: Cap nhat queue mot lan duy nhat sau khi xu ly xong
  if (toRemove.size > 0 || toUpdate.size > 0) {
    const currentQueue = await readQueue();
    const finalQueue = currentQueue
      .filter(q => !toRemove.has(q.id))
      .map(q => {
        const update = toUpdate.get(q.id);
        if (update) {
          return {...q, ...update};
        }
        return q;
      });
    await writeQueue(finalQueue);
  }

  return {processed, failed, skipped};
}

/**
 * Xoa toan bo queue (dung khi logout)
 */
export async function clearQueue(): Promise<void> {
  await writeQueue([]);
}

// ============================================================
// Helper
// ============================================================

function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes('network') ||
      msg.includes('timeout') ||
      msg.includes('econnrefused') ||
      msg.includes('econnreset')
    );
  }
  return false;
}

/**
 * Exponential backoff delay (ms) voi jitter
 * retryCount 0 → ~1s, 1 → ~2s, 2 → ~4s
 *
 * Goi ham nay truoc khi retry de tranh thundering herd.
 */
export function backoffDelay(retryCount: number): number {
  const base = 1000;
  const jitter = Math.random() * 200;
  return base * Math.pow(2, retryCount) + jitter;
}
