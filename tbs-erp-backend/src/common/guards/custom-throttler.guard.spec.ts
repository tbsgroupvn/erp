import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { CustomThrottlerGuard } from './custom-throttler.guard';
import { DomainException } from '@common/exceptions/domain.exception';

describe('CustomThrottlerGuard', () => {
  // Create an instance without calling the constructor (ThrottlerGuard requires DI)
  let guard: CustomThrottlerGuard;

  beforeEach(() => {
    guard = Object.create(CustomThrottlerGuard.prototype);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('canActivate', () => {
    it('should return true for non-HTTP context (WebSocket)', async () => {
      // Arrange
      const context = {
        getType: () => 'ws',
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      // Act
      const result = await guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('getTracker', () => {
    it('should return userId when user is authenticated', async () => {
      // Arrange
      const req = { user: { id: 'user-1' }, ip: '192.168.1.1' };

      // Act
      const tracker = await guard.getTracker(req);

      // Assert
      expect(tracker).toBe('user-1');
    });

    it('should return IP when user is anonymous', async () => {
      // Arrange
      const req = { ip: '192.168.1.1' };

      // Act
      const tracker = await guard.getTracker(req);

      // Assert
      expect(tracker).toBe('192.168.1.1');
    });
  });

  describe('throwThrottlingException', () => {
    it('should throw DomainException with RATE_LIMIT_EXCEEDED error code and 429 status', async () => {
      // Arrange
      const mockHeader = jest.fn();
      const context = {
        switchToHttp: () => ({
          getResponse: () => ({ header: mockHeader }),
          getRequest: () => ({}),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      const throttlerLimitDetail = {
        ttl: 60000, // 60 seconds
        limit: 60,
        key: 'test-key',
        tracker: 'user-1',
        totalHits: 61,
        timeToExpire: 55000,
        isBlocked: true,
        timeToBlockExpire: 55000,
      };

      // Act & Assert
      try {
        await guard.throwThrottlingException(context, throttlerLimitDetail as any);
        fail('Expected DomainException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect((error as DomainException).errorCode).toBe('RATE_LIMIT_EXCEEDED');
        expect((error as DomainException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      }

      // Verify Retry-After header was set
      expect(mockHeader).toHaveBeenCalledWith('Retry-After', '60');
    });
  });
});
