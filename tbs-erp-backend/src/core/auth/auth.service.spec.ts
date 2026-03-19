import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuthService } from './auth.service';
import { PrismaService } from '@core/database/prisma.service';
import { CacheService } from '@core/cache/cache.service';
import { SmsService } from '@core/sms/sms.service';
import { UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

jest.mock('otplib', () => ({
  authenticator: {
    generateSecret: jest.fn().mockReturnValue('mock-secret'),
    keyuri: jest.fn().mockReturnValue('otpauth://totp/mock?issuer=TBS%20ERP'),
    verify: jest.fn().mockReturnValue(true),
  },
}));

jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,mock-qr-code'),
}));

describe('AuthService', () => {
  let module: TestingModule;
  let service: AuthService;
  let prismaService: PrismaService;
  let jwtService: JwtService;
  let smsService: SmsService;

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
    twoFactorSecret: null,
    twoFactorBackupCodes: [],
    phoneNumber: null,
    preferredTwoFactorMethod: 'TOTP',
    resetToken: null,
    resetTokenExpiry: null,
    leaderId: null,
  };

  beforeAll(async () => {
    // Hash a password for testing
    mockUser.passwordHash = await bcrypt.hash('Test123!@#', 10);
  });

  beforeEach(async () => {
    module = await Test.createTestingModule({
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
            get: jest.fn((key: string, defaultValue?: string) => {
              const config: Record<string, string> = {
                'jwt.secret': 'test-secret',
                'jwt.refreshSecret': 'test-refresh-secret',
                'jwt.expiresIn': '15m',
                'jwt.refreshExpiresIn': '7d',
                TWO_FA_ENCRYPTION_KEY: 'test-2fa-encryption-key-for-testing',
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn((payload) => `mock-token-${payload.sub}`),
            verify: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
        {
          provide: SmsService,
          useValue: {
            sendSms: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: CACHE_MANAGER,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn().mockResolvedValue(undefined),
            set: jest.fn().mockResolvedValue(true),
            del: jest.fn().mockResolvedValue(undefined),
            delByPrefix: jest.fn().mockResolvedValue(undefined),
            invalidate: jest.fn().mockResolvedValue(undefined),
            invalidateByPrefix: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
    smsService = module.get<SmsService>(SmsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should successfully login with valid credentials (no 2FA)', async () => {
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
      const result = await service.login(
        'test@example.com',
        'Test123!@#',
        'test-agent',
        '127.0.0.1',
      );

      // Assert
      expect(result).toBeDefined();
      expect('requires2FA' in result).toBe(false);
      if (!('requires2FA' in result)) {
        expect(result.user).toBeDefined();
        expect(result.user.email).toBe('test@example.com');
        expect(result.tokens).toBeDefined();
        expect(result.tokens.accessToken).toBeDefined();
      }
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('should return 2FA challenge when 2FA is enabled', async () => {
      // Arrange
      const user2FA = {
        ...mockUser,
        is2FAEnabled: true,
        twoFactorSecret: 'encrypted-secret',
        preferredTwoFactorMethod: 'TOTP',
      };
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(user2FA as any);

      // Act
      const result = await service.login(
        'test@example.com',
        'Test123!@#',
        'test-agent',
        '127.0.0.1',
      );

      // Assert
      expect(result).toBeDefined();
      expect('requires2FA' in result).toBe(true);
      if ('requires2FA' in result) {
        expect(result.requires2FA).toBe(true);
        expect(result.userId).toBe(mockUser.id);
        expect(result.methods).toContain('TOTP');
        expect(result.tempToken).toBeDefined();
      }
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
      await expect(service.resetPassword('invalid-token', 'NewPassword123!@#')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for expired token', async () => {
      // Arrange

      const testToken = 'test-reset-token';

      // findFirst with gt: new Date() won't return expired tokens
      jest.spyOn(prismaService.user, 'findFirst').mockResolvedValue(null);

      // Act & Assert
      await expect(service.resetPassword(testToken, 'NewPassword123!@#')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('logout', () => {
    it('should successfully revoke session and invalidate cache', async () => {
      // Arrange
      const userId = 'user-123';
      const sessionId = 'session-123';
      jest.spyOn(prismaService.session, 'deleteMany').mockResolvedValue({ count: 1 } as any);
      const cacheService = module.get<CacheService>(CacheService);

      // Act
      await service.logout(userId, sessionId);

      // Assert — DB session deleted
      expect(prismaService.session.deleteMany).toHaveBeenCalledWith({
        where: { id: sessionId },
      });

      // Assert — Redis cache entry invalidated for this specific session
      expect(cacheService.del).toHaveBeenCalledWith(`jwt-session:${userId}:${sessionId}`);
    });
  });

  describe('2FA', () => {
    it('should generate 2FA secret and QR code', async () => {
      // Arrange
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(mockUser as any);
      jest.spyOn(prismaService.user, 'update').mockResolvedValue(mockUser as any);

      // Act
      const result = await service.generate2FASecret(mockUser.id);

      // Assert
      expect(result).toBeDefined();
      expect(result.secret).toBeDefined();
      expect(result.qrCodeDataUrl).toContain('data:image/png;base64');
      expect(result.otpauthUrl).toContain('otpauth://totp/');
      expect(result.otpauthUrl).toContain('TBS%20ERP');
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { twoFactorSecret: expect.any(String) },
      });
    });

    it('should throw BadRequestException when enabling 2FA without secret', async () => {
      // Arrange
      const userNoSecret = { ...mockUser, twoFactorSecret: null };
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(userNoSecret as any);

      // Act & Assert
      await expect(service.enable2FA(mockUser.id, '123456')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when 2FA is already enabled', async () => {
      // Arrange
      const user2FA = { ...mockUser, is2FAEnabled: true, twoFactorSecret: 'encrypted' };
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(user2FA as any);

      // Act & Assert
      await expect(service.enable2FA(mockUser.id, '123456')).rejects.toThrow(BadRequestException);
    });

    it('should get 2FA status', async () => {
      // Arrange
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue({
        is2FAEnabled: false,
        preferredTwoFactorMethod: 'TOTP',
        phoneNumber: null,
        twoFactorBackupCodes: [],
      } as any);

      // Act
      const result = await service.get2FAStatus(mockUser.id);

      // Assert
      expect(result).toEqual({
        is2FAEnabled: false,
        preferredMethod: 'TOTP',
        hasPhoneNumber: false,
        hasBackupCodes: false,
      });
    });

    it('should regenerate backup codes when 2FA is enabled', async () => {
      // Arrange
      const user2FA = { ...mockUser, is2FAEnabled: true };
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(user2FA as any);
      jest.spyOn(prismaService.user, 'update').mockResolvedValue(user2FA as any);

      // Act
      const result = await service.regenerateBackupCodes(mockUser.id);

      // Assert
      expect(result.backupCodes).toBeDefined();
      expect(result.backupCodes).toHaveLength(10);
      // Each code should be in XXXX-XXXX format
      result.backupCodes.forEach((code) => {
        expect(code).toMatch(/^[A-F0-9]{4}-[A-F0-9]{4}$/);
      });
    });

    it('should throw BadRequestException when regenerating codes without 2FA enabled', async () => {
      // Arrange
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(mockUser as any);

      // Act & Assert
      await expect(service.regenerateBackupCodes(mockUser.id)).rejects.toThrow(BadRequestException);
    });
  });

  describe('verifyLoginOtp', () => {
    // Helper: create an encrypted TOTP secret matching the constructor's key derivation
    function createEncryptedSecret(): string {
      const key = crypto.pbkdf2Sync(
        'test-2fa-encryption-key-for-testing',
        'tbs-erp-2fa-encryption-salt',
        100000,
        32,
        'sha256',
      );
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      let encrypted = cipher.update('mock-totp-secret', 'utf8');
      encrypted = Buffer.concat([encrypted, cipher.final()]);
      const authTag = cipher.getAuthTag();
      return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
    }

    it('should verify OTP and return LoginResult for valid temp token and code', async () => {
      // Arrange
      const encryptedSecret = createEncryptedSecret();
      const user2FA = {
        ...mockUser,
        is2FAEnabled: true,
        twoFactorSecret: encryptedSecret,
        preferredTwoFactorMethod: 'TOTP',
      };

      (jwtService.verify as jest.Mock).mockReturnValue({
        type: '2fa-pending',
        sub: 'user-123',
      });
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(user2FA as any);
      jest.spyOn(prismaService.user, 'update').mockResolvedValue(user2FA as any);
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
      const result = await service.verifyLoginOtp(
        'mock-temp-token',
        '123456',
        undefined,
        'test-agent',
        '127.0.0.1',
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.tokens).toBeDefined();
      expect(result.tokens.accessToken).toBeDefined();
    });

    it('should throw UnauthorizedException for invalid/expired temp token', async () => {
      // Arrange - jwtService.verify throws error
      (jwtService.verify as jest.Mock).mockImplementation(() => {
        throw new Error('jwt expired');
      });

      // Act & Assert
      await expect(
        service.verifyLoginOtp('expired-token', '123456'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for temp token with wrong type', async () => {
      // Arrange - token type is not '2fa-pending'
      (jwtService.verify as jest.Mock).mockReturnValue({
        type: 'access',
        sub: 'user-123',
      });

      // Act & Assert
      await expect(
        service.verifyLoginOtp('wrong-type-token', '123456'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshToken', () => {
    const mockSession = {
      id: 'session-123',
      userId: 'user-123',
      refreshToken: 'hashed-refresh-token',
      userAgent: 'test-agent',
      ipAddress: '127.0.0.1',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      user: {
        ...mockUser,
        isActive: true,
      },
    };

    it('should return new tokens for valid session and refresh token', async () => {
      // Arrange
      jest.spyOn(prismaService.session, 'findUnique').mockResolvedValue(mockSession as any);
      jest.spyOn(bcrypt, 'compare' as any).mockResolvedValue(true);
      jest.spyOn(bcrypt, 'hash' as any).mockResolvedValue('new-hashed-refresh-token');
      jest.spyOn(prismaService.session, 'update').mockResolvedValue(mockSession as any);

      // Act
      const result = await service.refreshToken('user-123', 'session-123', 'valid-refresh-token');

      // Assert
      expect(result).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(prismaService.session.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'session-123' },
          data: expect.objectContaining({
            refreshToken: 'new-hashed-refresh-token',
          }),
        }),
      );
    });

    it('should throw UnauthorizedException when session not found', async () => {
      // Arrange
      jest.spyOn(prismaService.session, 'findUnique').mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.refreshToken('user-123', 'nonexistent-session', 'some-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when session expired', async () => {
      // Arrange
      const expiredSession = {
        ...mockSession,
        expiresAt: new Date(Date.now() - 1000), // expired 1 second ago
      };
      jest.spyOn(prismaService.session, 'findUnique').mockResolvedValue(expiredSession as any);
      jest.spyOn(prismaService.session, 'delete').mockResolvedValue(expiredSession as any);

      // Act & Assert
      await expect(
        service.refreshToken('user-123', 'session-123', 'some-token'),
      ).rejects.toThrow(UnauthorizedException);

      // Verify session was cleaned up
      expect(prismaService.session.delete).toHaveBeenCalledWith({
        where: { id: 'session-123' },
      });
    });

    it('should throw UnauthorizedException when token mismatch (potential theft)', async () => {
      // Arrange
      jest.spyOn(prismaService.session, 'findUnique').mockResolvedValue(mockSession as any);
      jest.spyOn(bcrypt, 'compare' as any).mockResolvedValue(false);
      jest.spyOn(prismaService.session, 'delete').mockResolvedValue(mockSession as any);

      // Act & Assert
      await expect(
        service.refreshToken('user-123', 'session-123', 'stolen-token'),
      ).rejects.toThrow(UnauthorizedException);

      // Verify session was revoked for security
      expect(prismaService.session.delete).toHaveBeenCalledWith({
        where: { id: 'session-123' },
      });
    });

    it('should throw ForbiddenException when user is deactivated', async () => {
      // Arrange
      const sessionWithInactiveUser = {
        ...mockSession,
        user: { ...mockUser, isActive: false },
      };
      jest.spyOn(prismaService.session, 'findUnique').mockResolvedValue(sessionWithInactiveUser as any);
      jest.spyOn(bcrypt, 'compare' as any).mockResolvedValue(true);
      jest.spyOn(prismaService.session, 'delete').mockResolvedValue(sessionWithInactiveUser as any);

      // Act & Assert
      await expect(
        service.refreshToken('user-123', 'session-123', 'valid-token'),
      ).rejects.toThrow(ForbiddenException);

      // Verify session was cleaned up
      expect(prismaService.session.delete).toHaveBeenCalledWith({
        where: { id: 'session-123' },
      });
    });
  });

  describe('SMS OTP', () => {
    it('should send SMS OTP when phone number is configured', async () => {
      // Arrange
      const userWithPhone = { ...mockUser, phoneNumber: '+84901234567' };
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(userWithPhone as any);

      // Act
      const result = await service.sendSmsOtp(mockUser.id);

      // Assert
      expect(result.message).toBe('Verification code sent via SMS');
      expect(smsService.sendSms).toHaveBeenCalledWith(
        '+84901234567',
        expect.stringContaining('verification code'),
      );
    });

    it('should throw BadRequestException when no phone number is configured', async () => {
      // Arrange
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(mockUser as any);

      // Act & Assert
      await expect(service.sendSmsOtp(mockUser.id)).rejects.toThrow(BadRequestException);
    });
  });
});
