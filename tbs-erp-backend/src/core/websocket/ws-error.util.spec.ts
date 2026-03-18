import { wsError, WsErrorResponse } from './ws-error.util';

describe('wsError', () => {
  it('returns object with errorCode, message, requestId, and timestamp', () => {
    const result: WsErrorResponse = wsError('WS_AUTH_REQUIRED', 'Authentication required');

    expect(result).toHaveProperty('errorCode', 'WS_AUTH_REQUIRED');
    expect(result).toHaveProperty('message', 'Authentication required');
    expect(result).toHaveProperty('requestId');
    expect(result).toHaveProperty('timestamp');
  });

  it('generates requestId prefixed with "ws-" when none provided', () => {
    const result = wsError('WS_AUTH_FAILED', 'Auth failed');

    expect(result.requestId).toMatch(/^ws-[0-9a-f]{8}$/);
  });

  it('uses explicit requestId as-is when provided', () => {
    const result = wsError('WS_AUTH_FAILED', 'Auth failed', 'req-abc-123');

    expect(result.requestId).toBe('req-abc-123');
  });

  it('returns timestamp in ISO 8601 format', () => {
    const result = wsError('WS_INVALID_CHANNEL', 'Invalid channel');

    // ISO 8601 format: 2026-03-18T08:00:00.000Z
    expect(result.timestamp).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
  });
});
