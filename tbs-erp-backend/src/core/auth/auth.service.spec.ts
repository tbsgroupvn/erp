import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuthService } from './auth.service';
import { PrismaService } from '@core/database/prisma.service';
import { UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  // Mock user data
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    passwordHash: '',
    fullName: 'Test User',
    role: 'SALE',
    branch: null,
    isActive: true,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    phone: null,
    saleCode: null,
    is2FAEnabled: false,
    resetToken: null,
    resetTokenExpiry: null,
    leaderId: null,
  };

  beforeAll(async () => {
    // Hash a password for testing
    mockUser.passwordHash = await bcrypt.hash('Test123!@#', 10);
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              update: jest.fn(),
              findFirst: jest.fn(),
              findMany: jest.fn(),
            },
            session: {
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              deleteMany: jest.fn(),
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                'jwt.secret': 'test-secret',
                'jwt.refreshSecret': 'test-refresh-secret',
                'jwt.expiresIn': '15m',
                'jwt.refreshExpiresIn': '7d',
              };
              return config[key];
            }),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn((payload) => `mock-token-${payload.sub}`),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      // Arrange
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(mockUser as any);
      jest.spyOn(prismaService.session, 'create').mockResolvedValue({
        id: 'session-123',
        userId: mockUser.id,
        refreshToken: 'hashed-refresh-token',
        userAgent: 'test-agent',
        ipAddress: '127.0.0.1',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
      } as any);

      // Act
      const result = await service.login(
        'test@example.com',
        'Test123!@#',
        'test-agent',
        '127.0.0.1',
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe('test@example.com');
      expect(result.tokens).toBeDefined();
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('should throw UnauthorizedException for invalid email', async () => {
      // Arrange
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.login('wrong@example.com', 'Test123!@#', 'test-agent', '127.0.0.1'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      // Arrange
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(mockUser as any);

      // Act & Assert
      await expect(
        service.login('test@example.com', 'WrongPassword', 'test-agent', '127.0.0.1'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw ForbiddenException for inactive user', async () => {
      // Arrange
      const inactiveUser = { ...mockUser, isActive: false };
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(inactiveUser as any);

      // Act & Assert
      await expect(
        service.login('test@example.com', 'Test123!@#', 'test-agent', '127.0.0.1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should update lastLoginAt timestamp', async () => {
      // Arrange
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(mockUser as any);
      jest.spyOn(prismaService.user, 'update').mockResolvedValue(mockUser as any);
      jest.spyOn(prismaService.session, 'create').mockResolvedValue({
        id: 'session-123',
        userId: mockUser.id,
        refreshToken: 'hashed-refresh-token',
        userAgent: 'test-agent',
        ipAddress: '127.0.0.1',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
      } as any);

      // Act
      await service.login('test@example.com', 'Test123!@#', 'test-agent', '127.0.0.1');

      // Assert
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { lastLoginAt: expect.any(Date) },
      });
    });
  });

  describe('resetPassword', () => {
    it('should successfully reset password with valid token', async () => {
      // Arrange
      const crypto = require('crypto');
      const testToken = 'test-reset-token';
      const tokenHash = crypto.createHash('sha256').update(testToken).digest('hex');

      const userWithResetToken = {
        ...mockUser,
        resetToken: tokenHash,
        resetTokenExpiry: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
      };

      jest.spyOn(prismaService.user, 'findFirst').mockResolvedValue(userWithResetToken as any);
      jest.spyOn(prismaService.user, 'update').mockResolvedValue(mockUser as any);
      jest.spyOn(prismaService.session, 'deleteMany').mockResolvedValue({ count: 2 } as any);

      // Act
      const result = await service.resetPassword(testToken, 'NewPassword123!@#');

      // Assert
      expect(result).toBeDefined();
      expect(result.message).toContain('success');
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          passwordHash: expect.any(String),
          resetToken: null,
          resetTokenExpiry: null,
        },
      });
      expect(prismaService.session.deleteMany).toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid token', async () => {
      // Arrange
      jest.spyOn(prismaService.user, 'findFirst').mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.resetPassword('invalid-token', 'NewPassword123!@#'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for expired token', async () => {
      // Arrange
      const crypto = require('crypto');
      const testToken = 'test-reset-token';
      const tokenHash = crypto.createHash('sha256').update(testToken).digest('hex');

      const userWithExpiredToken = {
        ...mockUser,
        resetToken: tokenHash,
        resetTokenExpiry: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago (expired)
      };

      // findFirst with gt: new Date() won't return expired tokens
      jest.spyOn(prismaService.user, 'findFirst').mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.resetPassword(testToken, 'NewPassword123!@#'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('logout', () => {
    it('should successfully revoke session', async () => {
      // Arrange
      const sessionId = 'session-123';
      jest.spyOn(prismaService.session, 'deleteMany').mockResolvedValue({ count: 1 } as any);

      // Act
      await service.logout(sessionId);

      // Assert
      expect(prismaService.session.deleteMany).toHaveBeenCalledWith({
        where: { id: sessionId },
      });
    });
  });
});
