import { randomUUID } from 'crypto';

export interface WsErrorResponse {
  errorCode: string;
  message: string;
  requestId: string;
  timestamp: string;
}

/**
 * Create a structured WebSocket error object.
 *
 * Replaces raw `{ message: string }` error emissions with machine-readable
 * objects containing errorCode, requestId, and timestamp for correlation
 * with HTTP error responses and BullMQ processor logs.
 *
 * @param errorCode - ErrorCode constant (e.g. ErrorCode.WS_AUTH_REQUIRED)
 * @param message - Human-readable error description
 * @param requestId - Optional request ID for correlation; auto-generated if omitted
 */
export function wsError(
  errorCode: string,
  message: string,
  requestId?: string,
): WsErrorResponse {
  return {
    errorCode,
    message,
    requestId: requestId || 'ws-' + randomUUID().slice(0, 8),
    timestamp: new Date().toISOString(),
  };
}
