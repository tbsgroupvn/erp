import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { RolesGuard } from './roles.guard';
import { DomainException } from '@common/exceptions/domain.exception';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let mockReflector: { getAllAndOverride: jest.Mock };

  function createMockContext(user?: any): ExecutionContext {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as any;
  }

  beforeEach(() => {
    mockReflector = { getAllAndOverride: jest.fn() };
    guard = new RolesGuard(mockReflector as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return true when no @Roles decorator is present (null)', () => {
    // Arrange
    mockReflector.getAllAndOverride.mockReturnValue(null);
    const context = createMockContext({ id: 'user-1', role: 'SALE' });

    // Act
    const result = guard.canActivate(context);

    // Assert
    expect(result).toBe(true);
  });

  it('should return true when @Roles has empty array', () => {
    // Arrange
    mockReflector.getAllAndOverride.mockReturnValue([]);
    const context = createMockContext({ id: 'user-1', role: 'SALE' });

    // Act
    const result = guard.canActivate(context);

    // Assert
    expect(result).toBe(true);
  });

  it('should return true when user has required role', () => {
    // Arrange
    mockReflector.getAllAndOverride.mockReturnValue(['SALE', 'CEO']);
    const context = createMockContext({
      id: 'user-1',
      email: 'test@example.com',
      role: 'SALE',
      branch: null,
    });

    // Act
    const result = guard.canActivate(context);

    // Assert
    expect(result).toBe(true);
  });

  it('should throw DomainException with FORBIDDEN when no user in request', () => {
    // Arrange
    mockReflector.getAllAndOverride.mockReturnValue(['CEO', 'COO']);
    const context = createMockContext(undefined);

    // Act & Assert
    try {
      guard.canActivate(context);
      fail('Expected DomainException to be thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(DomainException);
      expect((error as DomainException).errorCode).toBe('FORBIDDEN');
      expect((error as DomainException).getStatus()).toBe(HttpStatus.FORBIDDEN);
    }
  });

  it('should throw DomainException with FORBIDDEN when user lacks required role', () => {
    // Arrange
    mockReflector.getAllAndOverride.mockReturnValue(['CEO', 'COO']);
    const context = createMockContext({
      id: 'user-1',
      email: 'sale@example.com',
      role: 'SALE',
      branch: null,
    });

    // Act & Assert
    try {
      guard.canActivate(context);
      fail('Expected DomainException to be thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(DomainException);
      expect((error as DomainException).errorCode).toBe('FORBIDDEN');
      expect((error as DomainException).getStatus()).toBe(HttpStatus.FORBIDDEN);
      // Verify error message contains role labels
      const message = (error as DomainException).message;
      expect(message).toContain('Vai tro hien tai');
    }
  });
});
