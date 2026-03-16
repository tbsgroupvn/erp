/**
 * offline-fetch.ts
 * Drop-in wrapper around fetch that queues mutations when the device is offline.
 *
 * - GET requests: always pass through (reads are not queued).
 * - POST / PUT / PATCH / DELETE:
 *   - Online  → execute immediately.
 *   - Offline → enqueue the mutation and return a synthetic "202 Queued" response.
 */

import { addMutation, type QueuedMutation } from './mutation-queue';
import { isOnline } from './sync-manager';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type OfflineMethod = QueuedMutation['method'];

export interface OfflineFetchResult {
  /** The raw fetch Response (real or synthetic). */
  response: Response;
  /**
   * True when the request was enqueued instead of sent.
   * Callers can show the user "Thao tác sẽ đồng bộ khi có mạng".
   */
  queued: boolean;
  /** The mutation queue id when queued === true. */
  mutationId?: string;
}

// ---------------------------------------------------------------------------
// Synthetic response factory
// ---------------------------------------------------------------------------
function buildQueuedResponse(mutationId: string): Response {
  const body = JSON.stringify({
    success: true,
    queued: true,
    mutationId,
    message: 'Thao tác đã được lưu và sẽ đồng bộ khi có kết nối mạng.',
  });
  return new Response(body, {
    status: 202,
    statusText: 'Accepted (Queued)',
    headers: { 'Content-Type': 'application/json', 'X-Offline-Queued': 'true' },
  });
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Execute a mutating HTTP request. If the device is offline the request is
 * added to the IndexedDB queue and a synthetic 202 response is returned so
 * the UI can proceed optimistically.
 *
 * @param method   HTTP method (POST | PUT | PATCH | DELETE)
 * @param url      Full URL (e.g. from apiClient.defaults.baseURL + path)
 * @param body     Request payload (will be JSON-serialised)
 * @param headers  Additional request headers (e.g. Authorization)
 */
export async function offlineFetch(
  method: OfflineMethod,
  url: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<OfflineFetchResult> {
  if (isOnline()) {
    // -----------------------------------------------------------------------
    // Online path — execute the real request.
    // -----------------------------------------------------------------------
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body != null ? JSON.stringify(body) : undefined,
      credentials: 'include',
    });

    return { response, queued: false };
  }

  // -------------------------------------------------------------------------
  // Offline path — add to queue, return synthetic response.
  // -------------------------------------------------------------------------
  const mutationId = await addMutation(method, url, body, headers);
  return {
    response: buildQueuedResponse(mutationId),
    queued: true,
    mutationId,
  };
}

/**
 * Convenience: passthrough for GET/HEAD requests.
 * Always attempts the real network call; returns the raw Response.
 */
export async function offlineGet(
  url: string,
  headers: Record<string, string> = {},
): Promise<Response> {
  return fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', ...headers },
    credentials: 'include',
  });
}
