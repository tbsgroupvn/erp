import {
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
// @ts-ignore
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { PrismaService } from '@core/database/prisma.service';
import { SmsService } from '@core/sms/sms.service';
import { TokenResponseDto } from './dto/token-response.dto';
import { TwoFactorMethodDto } from './dto/two-factor.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { RefreshTokenPayload } from './strategies/refresh-token.strategy';
import { User, UserRole, Branch, TwoFactorMethod } from '@prisma/client';

/** Roles allowed to impersonate customers */
const IMPERSONATION_ROLES: UserRole[] = [
  UserRole.CEO,
  UserRole.COO,
  UserRole.SALES_DIRECTOR,
  UserRole.CSKH,
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LoginResult {
  user: Omit<User, 'passwordHash' | 'resetToken' | 'resetTokenExpiry'>;
  tokens: TokenResponseDto;
}

export interface Login2FARequiredResult {
  requires2FA: true;
  userId: string;
  methods: TwoFactorMethod[];
  tempToken: string;
}

type LoginResponse = LoginResult | Login2FARequiredResult;

export interface TwoFASetupResult {
  secret: string;
  qrCodeDataUrl: string;
  otpauthUrl: string;
}

export interface TwoFAStatusResult {
  is2FAEnabled: boolean;
  preferredMethod: TwoFactorMethod;
  hasPhoneNumber: boolean;
  hasBackupCodes: boolean;
}

// ---------------------------------------------------------------------------
// SMS OTP entry structure (stored in Redis cache)
// ---------------------------------------------------------------------------
interface SmsOtpEntry {
  code: string;
  attempts: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  /** AES-256 encryption key for TOTP secrets (32 bytes). */
  private readonly encryptionKey: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly smsService: SmsService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {
    // Derive a 32-byte key from the configured secret using PBKDF2
    const rawKey = this.configService.get<string>('TWO_FA_ENCRYPTION_KEY');
    if (!rawKey) {
      const env = this.configService.get<string>('app.env', 'development');
      if (env === 'production') {
        throw new Error(
          'TWO_FA_ENCRYPTION_KEY must be set in production. Cannot start without a 2FA encryption key.',
        );
      }
      this.logger.warn(
        'TWO_FA_ENCRYPTION_KEY is not set. Using a fallback key for development only.',
      );
    }
    const keyMaterial = rawKey || 'dev-only-2fa-encryption-key';
    this.encryptionKey = crypto.pbkdf2Sync(keyMaterial, 'tbs-erp-2fa-encryption-salt', 100000, 32, 'sha256');
  }

  // =========================================================================
  // Authentication
  // =========================================================================

  /**
   * Validate user credentials (email + password).
   * Returns the user record if valid, or null.
   */
  async validateUser(
    email: string,
    password: string,
  ): Promise<Omit<User, 'passwordHash'> | null> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      return null;
    }

    if (!user.isActive) {
      throw new ForbiddenException('Account has been deactivated');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      return null;
    }

    const { passwordHash: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Authenticate user and create a session with JWT + refresh token.
   *
   * If the user has 2FA enabled, returns a temporary token and the available
   * methods instead of full session tokens. The frontend must then call
   * POST /auth/2fa/verify to complete login.
   */
  async login(
    email: string,
    password: string,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<LoginResponse> {
    const user = await this.validateUser(email, password);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // ── 2FA check ──────────────────────────────────────────────────────────
    if (user.is2FAEnabled) {
      // Generate a short-lived temporary token (5 minutes) for the 2FA step
      const tempToken = this.jwtService.sign(
        { sub: user.id, type: '2fa-pending' },
        {
          secret: this.configService.get<string>('jwt.secret'),
          expiresIn: '5m',
        },
      );

      // Determine available methods
      const methods: TwoFactorMethod[] = [user.preferredTwoFactorMethod];
      if (
        user.preferredTwoFactorMethod === TwoFactorMethod.TOTP &&
        user.phoneNumber
      ) {
        methods.push(TwoFactorMethod.SMS);
      } else if (
        user.preferredTwoFactorMethod === TwoFactorMethod.SMS &&
        user.twoFactorSecret
      ) {
        methods.push(TwoFactorMethod.TOTP);
      }

      this.logger.log(
        `2FA required for user ${user.id} — methods: ${methods.join(', ')}`,
      );

      return {
        requires2FA: true,
        userId: user.id,
        methods,
        tempToken,
      };
    }

    // ── Standard login (no 2FA) ────────────────────────────────────────────
    return this.completeLogin(user, userAgent, ipAddress);
  }

  /**
   * Verify a 2FA code during login and issue full session tokens.
   */
  async verifyLoginOtp(
    tempToken: string,
    userId: string,
    code: string,
    method?: TwoFactorMethodDto,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<LoginResult> {
    // Validate the temporary token
    try {
      const payload = this.jwtService.verify(tempToken, {
        secret: this.configService.get<string>('jwt.secret'),
      });

      if (payload.type !== '2fa-pending' || payload.sub !== userId) {
        throw new UnauthorizedException('Invalid or expired 2FA session');
      }
    } catch {
      throw new UnauthorizedException('Invalid or expired 2FA session');
    }

    // Fetch the user
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    if (!user.is2FAEnabled) {
      throw new BadRequestException('2FA is not enabled for this user');
    }

    // Determine verification method (cast to string to compare Prisma enum with DTO enum)
    const resolvedMethod: string = method ?? user.preferredTwoFactorMethod;

    // Try verifying as the specified method, falling back to backup code
    let verified = false;

    if (resolvedMethod === TwoFactorMethodDto.TOTP) {
      verified = this.verifyTotpCode(user.twoFactorSecret, code);
    } else if (resolvedMethod === TwoFactorMethodDto.SMS) {
      verified = await this.verifySmsOtpCode(userId, code);
    }

    // If not verified via primary method, try backup code
    if (!verified) {
      verified = await this.verifyAndConsumeBackupCode(userId, code);
    }

    if (!verified) {
      throw new UnauthorizedException('Invalid verification code');
    }

    // Complete login
    const { passwordHash: _, ...userWithoutPassword } = user;
    return this.completeLogin(userWithoutPassword, userAgent, ipAddress);
  }

  // =========================================================================
  // Two-Factor Authentication — Setup & Management
  // =========================================================================

  /**
   * Generate a TOTP secret and return a QR code for the user to scan.
   * Does NOT enable 2FA yet — the user must verify a code first.
   */
  async generate2FASecret(userId: string): Promise<TwoFASetupResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, is2FAEnabled: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Generate a new TOTP secret
    const secret = authenticator.generateSecret();

    // Create the otpauth URL
    const appTitle = this.configService.get<string>('branding.appTitle') || 'ERP System';
    const otpauthUrl = authenticator.keyuri(user.email, appTitle, secret);

    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    // Encrypt and store the secret (but don't enable 2FA yet)
    const encryptedSecret = this.encryptSecret(secret);

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: encryptedSecret },
    });

    this.logger.log(`2FA secret generated for user ${userId}`);

    return {
      secret,
      qrCodeDataUrl,
      otpauthUrl,
    };
  }

  /**
   * Verify a TOTP code and enable 2FA for the user.
   * Also generates backup codes.
   */
  async enable2FA(
    userId: string,
    code: string,
  ): Promise<{ message: string; backupCodes: string[] }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        twoFactorSecret: true,
        is2FAEnabled: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.is2FAEnabled) {
      throw new BadRequestException('2FA is already enabled');
    }

    if (!user.twoFactorSecret) {
      throw new BadRequestException(
        'No 2FA secret found. Please call /auth/2fa/setup first.',
      );
    }

    // Verify the code against the stored (encrypted) secret
    const isValid = this.verifyTotpCode(user.twoFactorSecret, code);

    if (!isValid) {
      throw new BadRequestException('Invalid TOTP code. Please try again.');
    }

    // Generate backup codes
    const backupCodes = this.generateRawBackupCodes(10);
    const hashedCodes = await this.hashBackupCodes(backupCodes);

    // Enable 2FA
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        is2FAEnabled: true,
        twoFactorBackupCodes: hashedCodes,
        preferredTwoFactorMethod: 'TOTP',
      },
    });

    this.logger.log(`2FA enabled for user ${userId}`);

    this.eventEmitter.emit('auth.2fa.enabled', { userId });

    return {
      message: '2FA has been enabled successfully. Save your backup codes in a safe place.',
      backupCodes,
    };
  }

  /**
   * Disable 2FA for a user. Requires a valid code and password confirmation.
   */
  async disable2FA(
    userId: string,
    code: string,
    password: string,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.is2FAEnabled) {
      throw new BadRequestException('2FA is not enabled');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new BadRequestException('Invalid password');
    }

    // Verify the 2FA code (TOTP or backup)
    let verified = this.verifyTotpCode(user.twoFactorSecret, code);
    if (!verified) {
      verified = await this.verifyAndConsumeBackupCode(userId, code);
    }

    if (!verified) {
      throw new BadRequestException('Invalid verification code');
    }

    // Disable 2FA and clear secrets
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        is2FAEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: [],
        phoneNumber: null,
        preferredTwoFactorMethod: 'TOTP',
      },
    });

    this.logger.log(`2FA disabled for user ${userId}`);

    this.eventEmitter.emit('auth.2fa.disabled', { userId });

    return { message: '2FA has been disabled successfully' };
  }

  /**
   * Verify a 2FA code without completing login (for authenticated endpoints).
   */
  async verify2FA(
    userId: string,
    code: string,
    method?: TwoFactorMethodDto,
  ): Promise<{ valid: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        twoFactorSecret: true,
        is2FAEnabled: true,
        preferredTwoFactorMethod: true,
      },
    });

    if (!user || !user.is2FAEnabled) {
      throw new BadRequestException('2FA is not enabled for this user');
    }

    const resolvedMethod: string = method ?? user.preferredTwoFactorMethod;

    let verified = false;

    if (resolvedMethod === TwoFactorMethodDto.TOTP) {
      verified = this.verifyTotpCode(user.twoFactorSecret, code);
    } else if (resolvedMethod === TwoFactorMethodDto.SMS) {
      verified = await this.verifySmsOtpCode(userId, code);
    }

    if (!verified) {
      verified = await this.verifyAndConsumeBackupCode(userId, code);
    }

    return { valid: verified };
  }

  /**
   * Get the current 2FA status for a user.
   */
  async get2FAStatus(userId: string): Promise<TwoFAStatusResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        is2FAEnabled: true,
        preferredTwoFactorMethod: true,
        phoneNumber: true,
        twoFactorBackupCodes: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      is2FAEnabled: user.is2FAEnabled,
      preferredMethod: user.preferredTwoFactorMethod,
      hasPhoneNumber: !!user.phoneNumber,
      hasBackupCodes: user.twoFactorBackupCodes.length > 0,
    };
  }

  // =========================================================================
  // SMS OTP
  // =========================================================================

  /**
   * Set up SMS-based 2FA by registering a phone number.
   */
  async setupSms2FA(
    userId: string,
    phoneNumber: string,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, is2FAEnabled: true, phoneNumber: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Store the phone number in Redis pending verification instead of directly in user record
    await this.cacheManager.set(`pending-phone:${userId}`, phoneNumber, 10 * 60 * 1000); // 10 min TTL

    // Generate a 6-digit code and send it to the pending phone number
    const code = crypto.randomInt(100000, 999999).toString();
    await this.cacheManager.set(`sms-otp:${userId}`, {
      code,
      attempts: 0,
    } as SmsOtpEntry, 5 * 60 * 1000);

    const brandName = this.configService.get<string>('branding.companyName') || 'ERP';
    const message = `[${brandName}] Your verification code is: ${code}. Valid for 5 minutes.`;
    const sent = await this.smsService.sendSms(phoneNumber, message);

    if (!sent) {
      this.logger.error(`Failed to send SMS OTP to user ${userId}`);
      throw new BadRequestException(
        'Failed to send SMS. Please try again or use TOTP instead.',
      );
    }

    this.logger.log(`SMS 2FA verification code sent for user ${userId}`);

    return {
      message: 'A verification code has been sent. Please verify to complete phone number registration.',
    };
  }

  /**
   * Generate a 6-digit SMS OTP, store it with a 5-minute expiry, and send it.
   */
  async sendSmsOtp(userId: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, phoneNumber: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.phoneNumber) {
      throw new BadRequestException(
        'No phone number configured. Please set up SMS 2FA first.',
      );
    }

    // Generate a 6-digit code
    const code = crypto.randomInt(100000, 999999).toString();

    // Store in Redis cache with 5-minute TTL
    await this.cacheManager.set(`sms-otp:${userId}`, {
      code,
      attempts: 0,
    } as SmsOtpEntry, 5 * 60 * 1000);

    // Send via SMS gateway
    const brandName = this.configService.get<string>('branding.companyName') || 'ERP';
    const message = `[${brandName}] Your verification code is: ${code}. Valid for 5 minutes.`;
    const sent = await this.smsService.sendSms(user.phoneNumber, message);

    if (!sent) {
      this.logger.error(`Failed to send SMS OTP to user ${userId}`);
      throw new BadRequestException(
        'Failed to send SMS. Please try again or use TOTP instead.',
      );
    }

    this.logger.log(`SMS OTP sent to user ${userId}`);

    return { message: 'Verification code sent via SMS' };
  }

  // =========================================================================
  // Backup Codes
  // =========================================================================

  /**
   * Regenerate backup codes for a user. Requires 2FA to be enabled.
   * Returns the new plaintext codes (only shown once).
   */
  async regenerateBackupCodes(
    userId: string,
  ): Promise<{ backupCodes: string[] }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, is2FAEnabled: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.is2FAEnabled) {
      throw new BadRequestException('2FA must be enabled to generate backup codes');
    }

    const backupCodes = this.generateRawBackupCodes(10);
    const hashedCodes = await this.hashBackupCodes(backupCodes);

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorBackupCodes: hashedCodes },
    });

    this.logger.log(`Backup codes regenerated for user ${userId}`);

    return { backupCodes };
  }

  // =========================================================================
  // Session management (unchanged)
  // =========================================================================

  /**
   * Refresh the access token using a valid refresh token.
   */
  async refreshToken(
    userId: string,
    sessionId: string,
    refreshToken: string,
  ): Promise<TokenResponseDto> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });

    if (!session || session.userId !== userId) {
      throw new UnauthorizedException('Invalid session');
    }

    if (session.expiresAt < new Date()) {
      await this.prisma.session.delete({ where: { id: sessionId } });
      throw new UnauthorizedException('Refresh token has expired');
    }

    // Verify the stored refresh token matches (compare hashed tokens)
    const isTokenValid = await bcrypt.compare(
      refreshToken,
      session.refreshToken,
    );

    if (!isTokenValid) {
      // Potential token theft: revoke the entire session
      this.logger.warn(
        `Refresh token mismatch for session ${sessionId} — possible token theft`,
      );
      await this.prisma.session.delete({ where: { id: sessionId } });
      throw new UnauthorizedException(
        'Refresh token is invalid. Session has been revoked for security.',
      );
    }

    const { user } = session;

    if (!user.isActive) {
      await this.prisma.session.delete({ where: { id: sessionId } });
      throw new ForbiddenException('Account has been deactivated');
    }

    // Rotate the refresh token for security
    const tokens = this.generateTokens(
      user.id,
      user.email,
      user.role,
      user.branch,
      sessionId,
    );

    const hashedRefreshToken = await bcrypt.hash(tokens.rawRefreshToken, 10);

    const refreshExpiresIn = this.configService.get<string>(
      'jwt.refreshExpiresIn',
      '7d',
    );

    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        refreshToken: hashedRefreshToken,
        expiresAt: this.calculateExpiry(refreshExpiresIn),
      },
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.rawRefreshToken,
      expiresIn: tokens.expiresIn,
    };
  }

  /**
   * Revoke a session (logout).
   */
  async logout(sessionId: string): Promise<void> {
    await this.prisma.session.deleteMany({
      where: { id: sessionId },
    });

    this.logger.log(`Session ${sessionId} has been revoked`);
  }

  /**
   * Revoke all sessions for a user (force logout everywhere).
   */
  async logoutAll(userId: string): Promise<void> {
    const { count } = await this.prisma.session.deleteMany({
      where: { userId },
    });

    this.logger.log(`Revoked ${count} sessions for user ${userId}`);
  }

  /**
   * Get user profile by ID.
   */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        fullName: true,
        role: true,
        branch: true,
        isActive: true,
        is2FAEnabled: true,
        preferredTwoFactorMethod: true,
        lastLoginAt: true,
        createdAt: true,
        leaderId: true,
        leader: {
          select: {
            id: true,
            fullName: true,
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  /**
   * Initiate password reset flow. Generates a reset token, stores its hash
   * with a 1-hour expiry in the user record, and emits an event for email sending.
   * Always returns a success message to prevent email enumeration.
   */
  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user || !user.isActive) {
      // Return success even if user not found to prevent email enumeration
      this.logger.log(`Password reset requested for email: ${email.substring(0, 3)}***@*** (user not found or inactive)`);
      return { message: 'If an account with that email exists, a password reset link has been sent.' };
    }

    // Generate a secure random token (256 bits of entropy)
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Use SHA-256 instead of bcrypt for reset tokens
    // SHA-256 is secure enough here because:
    // 1. Token has 256 bits of entropy (random)
    // 2. Single-use and short-lived (1 hour)
    // 3. Makes querying O(1) instead of O(n) - prevents timing attacks
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store the hashed token and expiry in the user record
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: resetTokenHash,
        resetTokenExpiry: resetTokenExpiry,
      },
    });

    // Emit event for email sending
    this.eventEmitter.emit('auth.password.reset.requested', {
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      resetToken,
    });

    this.logger.log(`Password reset token generated for user ${user.id}`);

    return { message: 'If an account with that email exists, a password reset link has been sent.' };
  }

  /**
   * Reset password using a valid reset token.
   * Validates the token and expiry, hashes the new password,
   * updates the user record, and invalidates all existing sessions.
   *
   * SECURITY: Uses SHA-256 for token lookup (O(1) query) to prevent timing attacks.
   */
  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    // Hash the incoming token with SHA-256 (same as storage)
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Direct query by hashed token - O(1) lookup, prevents timing attacks
    // This is secure because the token has 256 bits of entropy and is single-use
    const matchedUser = await this.prisma.user.findFirst({
      where: {
        resetToken: tokenHash,
        resetTokenExpiry: { gt: new Date() },
      },
    });

    if (!matchedUser) {
      // Same error message regardless of whether token exists or is expired
      // Prevents token enumeration attacks
      throw new BadRequestException('Invalid or expired password reset token');
    }

    // Hash the new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update user: set new password, clear reset token
    await this.prisma.user.update({
      where: { id: matchedUser.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    // Invalidate all sessions for the user
    const { count } = await this.prisma.session.deleteMany({
      where: { userId: matchedUser.id },
    });

    this.logger.log(
      `Password reset completed for user ${matchedUser.id}, ${count} session(s) invalidated`,
    );

    this.eventEmitter.emit('auth.password.reset.completed', {
      userId: matchedUser.id,
      email: matchedUser.email,
    });

    return { message: 'Password has been reset successfully. Please log in with your new password.' };
  }

  /**
   * Change password for an authenticated user.
   * Validates the current password before updating.
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    currentSessionId?: string,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const isCurrentValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Invalidate all other sessions (keep the current one so user stays logged in)
    const deleteWhere: any = { userId };
    if (currentSessionId) {
      deleteWhere.id = { not: currentSessionId };
    }
    const { count } = await this.prisma.session.deleteMany({
      where: deleteWhere,
    });

    this.logger.log(`Password changed for user ${userId}, ${count} other session(s) invalidated`);

    return { message: 'Password changed successfully' };
  }

  // =========================================================================
  // Impersonation
  // =========================================================================

  /**
   * Allow an admin user to impersonate a target customer.
   * Validates the admin has the right role, creates an ImpersonationLog record,
   * and generates a JWT with impersonation metadata.
   */
  async impersonate(
    adminUserId: string,
    targetCustomerId: string,
    ipAddress?: string,
  ): Promise<{ token: string; logId: string }> {
    // Validate admin user and role
    const adminUser = await this.prisma.user.findUnique({
      where: { id: adminUserId },
      select: { id: true, email: true, role: true, branch: true, isActive: true },
    });

    if (!adminUser || !adminUser.isActive) {
      throw new UnauthorizedException('Admin user not found or inactive');
    }

    if (!IMPERSONATION_ROLES.includes(adminUser.role)) {
      throw new ForbiddenException(
        `Role ${adminUser.role} is not allowed to impersonate. Required: ${IMPERSONATION_ROLES.join(', ')}`,
      );
    }

    // Validate target customer exists
    const targetCustomer = await this.prisma.customer.findUnique({
      where: { id: targetCustomerId },
      select: { id: true, code: true, fullName: true },
    });

    if (!targetCustomer) {
      throw new BadRequestException(`Customer ${targetCustomerId} not found`);
    }

    // Create ImpersonationLog record
    const log = await this.prisma.impersonationLog.create({
      data: {
        adminUserId,
        targetCustomerId,
        ipAddress: ipAddress || null,
      },
    });

    // Generate JWT with impersonation metadata
    const token = this.jwtService.sign(
      {
        sub: targetCustomerId,
        email: adminUser.email,
        role: adminUser.role,
        branch: adminUser.branch,
        impersonatedBy: adminUserId,
        isImpersonation: true,
        impersonationLogId: log.id,
      },
      {
        secret: this.configService.get<string>('jwt.secret'),
        expiresIn: '1h', // Impersonation sessions are limited to 1 hour
      },
    );

    this.logger.log(
      `Impersonation started: admin ${adminUserId} (${adminUser.role}) → customer ${targetCustomer.code} (${targetCustomer.fullName})`,
    );

    this.eventEmitter.emit('auth.impersonation.started', {
      adminUserId,
      targetCustomerId,
      logId: log.id,
    });

    return { token, logId: log.id };
  }

  /**
   * End an impersonation session by updating the ImpersonationLog record.
   */
  async endImpersonation(logId: string): Promise<{ message: string }> {
    const log = await this.prisma.impersonationLog.findUnique({
      where: { id: logId },
    });

    if (!log) {
      throw new BadRequestException(`Impersonation log ${logId} not found`);
    }

    if (log.endedAt) {
      throw new BadRequestException('Impersonation session already ended');
    }

    await this.prisma.impersonationLog.update({
      where: { id: logId },
      data: { endedAt: new Date() },
    });

    this.logger.log(`Impersonation ended: logId=${logId}`);

    this.eventEmitter.emit('auth.impersonation.ended', {
      logId,
      adminUserId: log.adminUserId,
      targetCustomerId: log.targetCustomerId,
    });

    return { message: 'Impersonation session ended' };
  }

  // =========================================================================
  // Private helpers — Session & Token
  // =========================================================================

  /**
   * Complete the login flow: update lastLoginAt, create session, return tokens + user.
   */
  private async completeLogin(
    user: Omit<User, 'passwordHash'>,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<LoginResult> {
    // Update last login timestamp
    const now = new Date();
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: now },
    });

    const tokens = await this.createSession(user.id, user.email, user.role, user.branch, {
      userAgent,
      ipAddress,
    });

    // Strip sensitive fields from user response using explicit safe field selection
    const safeUser = this.sanitizeUser(user);

    return {
      user: { ...(safeUser as any), lastLoginAt: now },
      tokens,
    };
  }

  /**
   * Returns a user object with sensitive fields removed.
   * Avoids fragile `...user as any` destructuring patterns.
   */
  private sanitizeUser(user: Omit<User, 'passwordHash'>): Record<string, any> {
    const sensitiveFields = new Set([
      'resetToken', 'resetTokenExpiry', 'twoFactorSecret',
      'twoFactorBackupCodes', 'passwordHash',
    ]);
    const safe: Record<string, any> = {};
    for (const [key, value] of Object.entries(user)) {
      if (!sensitiveFields.has(key)) {
        safe[key] = value;
      }
    }
    return safe;
  }

  private async createSession(
    userId: string,
    email: string,
    role: UserRole,
    branch: Branch | null,
    meta: { userAgent?: string; ipAddress?: string },
  ): Promise<TokenResponseDto> {
    const refreshExpiresIn = this.configService.get<string>(
      'jwt.refreshExpiresIn',
      '7d',
    );

    // Create session record first to get the session ID
    const session = await this.prisma.session.create({
      data: {
        userId,
        refreshToken: 'pending', // Placeholder, updated below
        userAgent: meta.userAgent ?? null,
        ipAddress: meta.ipAddress ?? null,
        expiresAt: this.calculateExpiry(refreshExpiresIn),
      },
    });

    const tokens = this.generateTokens(
      userId,
      email,
      role,
      branch,
      session.id,
    );

    // Hash the refresh token before storing
    const hashedRefreshToken = await bcrypt.hash(tokens.rawRefreshToken, 10);

    await this.prisma.session.update({
      where: { id: session.id },
      data: { refreshToken: hashedRefreshToken },
    });

    this.logger.log(`Session ${session.id} created for user ${userId}`);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.rawRefreshToken,
      expiresIn: tokens.expiresIn,
    };
  }

  private generateTokens(
    userId: string,
    email: string,
    role: UserRole,
    branch: Branch | null,
    sessionId: string,
  ): { accessToken: string; rawRefreshToken: string; expiresIn: number } {
    const expiresIn = this.configService.get<string>('jwt.expiresIn', '15m');

    const accessTokenPayload: JwtPayload = {
      sub: userId,
      email,
      role,
      branch,
      sessionId,
    };

    const refreshTokenPayload: RefreshTokenPayload = {
      sub: userId,
      sessionId,
      type: 'refresh',
    };

    const accessToken = this.jwtService.sign(accessTokenPayload, {
      secret: this.configService.get<string>('jwt.secret'),
      expiresIn,
    });

    const rawRefreshToken = this.jwtService.sign(refreshTokenPayload, {
      secret: this.configService.get<string>('jwt.refreshSecret'),
      expiresIn: this.configService.get<string>('jwt.refreshExpiresIn', '7d'),
    });

    return {
      accessToken,
      rawRefreshToken,
      expiresIn: this.parseExpiryToSeconds(expiresIn),
    };
  }

  /**
   * Parse a duration string like '15m', '1h', '7d' into seconds.
   */
  private parseExpiryToSeconds(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) {
      this.logger.warn(`Invalid expiry format "${expiry}", defaulting to 900 seconds (15 minutes)`);
      return 900; // Default 15 minutes
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 3600;
      case 'd':
        return value * 86400;
      default:
        return 900;
    }
  }

  /**
   * Calculate an absolute expiry date from a duration string.
   */
  private calculateExpiry(duration: string): Date {
    const seconds = this.parseExpiryToSeconds(duration);
    return new Date(Date.now() + seconds * 1000);
  }

  // =========================================================================
  // Private helpers — 2FA Cryptography
  // =========================================================================

  /**
   * Encrypt a TOTP secret using AES-256-GCM before storing in the database.
   * Format: iv:authTag:ciphertext (all base64-encoded)
   */
  private encryptSecret(plainSecret: string): string {
    const iv = crypto.randomBytes(12); // 96-bit IV for GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    let encrypted = cipher.update(plainSecret, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const authTag = cipher.getAuthTag();
    // Store as iv:authTag:ciphertext (all base64-encoded)
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
  }

  /**
   * Decrypt a stored TOTP secret.
   * Supports both legacy CBC format (iv:ciphertext in hex) and new GCM format (iv:authTag:ciphertext in base64).
   */
  private decryptSecret(encryptedSecret: string): string {
    const parts = encryptedSecret.split(':');

    if (parts.length === 3) {
      // New GCM format: iv:authTag:ciphertext (base64)
      const [ivB64, authTagB64, ciphertextB64] = parts;
      const iv = Buffer.from(ivB64, 'base64');
      const authTag = Buffer.from(authTagB64, 'base64');
      const ciphertext = Buffer.from(ciphertextB64, 'base64');
      const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(ciphertext);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      return decrypted.toString('utf8');
    }

    // Legacy CBC format (iv:ciphertext in hex) for backward compatibility
    const [ivHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Verify a TOTP code against an encrypted secret.
   */
  private verifyTotpCode(
    encryptedSecret: string | null,
    code: string,
  ): boolean {
    if (!encryptedSecret) return false;

    try {
      const secret = this.decryptSecret(encryptedSecret);
      return authenticator.verify({ token: code, secret });
    } catch (error) {
      this.logger.error('TOTP verification failed', { errorType: error?.name || 'Unknown' });
      return false;
    }
  }

  /**
   * Verify an SMS OTP code from the Redis cache.
   */
  private async verifySmsOtpCode(userId: string, code: string): Promise<boolean> {
    // Validate input is exactly 6 digits before comparison
    if (!/^\d{6}$/.test(code)) return false;

    const entry = await this.cacheManager.get<SmsOtpEntry>(`sms-otp:${userId}`);

    if (!entry) return false;

    // Rate limit: max 5 attempts
    if (entry.attempts >= 5) {
      await this.cacheManager.del(`sms-otp:${userId}`);
      return false;
    }

    entry.attempts++;
    // Update attempts count in cache (preserve remaining TTL by re-setting with same TTL)
    await this.cacheManager.set(`sms-otp:${userId}`, entry, 5 * 60 * 1000);

    // Constant-time comparison using fixed-length buffers to prevent timing attacks
    const inputBuf = Buffer.alloc(6);
    Buffer.from(code).copy(inputBuf);
    const storedBuf = Buffer.alloc(6);
    Buffer.from(entry.code).copy(storedBuf);
    const isValid = crypto.timingSafeEqual(inputBuf, storedBuf);

    if (isValid) {
      // Remove used code
      await this.cacheManager.del(`sms-otp:${userId}`);

      // If there's a pending phone number, commit it to the user record now that verification succeeded
      const pendingPhone = await this.cacheManager.get<string>(`pending-phone:${userId}`);
      if (pendingPhone) {
        await this.prisma.user.update({
          where: { id: userId },
          data: {
            phoneNumber: pendingPhone,
            preferredTwoFactorMethod: 'SMS',
          },
        });
        await this.cacheManager.del(`pending-phone:${userId}`);
        this.logger.log(`Phone number verified and saved for user ${userId}`);
      }
    }

    return isValid;
  }

  /**
   * Generate N random backup codes in the format XXXX-XXXX.
   */
  private generateRawBackupCodes(count: number): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      const part1 = crypto.randomBytes(2).toString('hex').toUpperCase();
      const part2 = crypto.randomBytes(2).toString('hex').toUpperCase();
      codes.push(`${part1}-${part2}`);
    }
    return codes;
  }

  /**
   * Hash an array of backup codes with bcrypt.
   */
  private async hashBackupCodes(codes: string[]): Promise<string[]> {
    return Promise.all(codes.map((code) => bcrypt.hash(code, 10)));
  }

  /**
   * Verify a backup code and consume it (one-time use).
   * Returns true if the code matched (and was removed from the user's stored codes).
   */
  private async verifyAndConsumeBackupCode(
    userId: string,
    code: string,
  ): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorBackupCodes: true },
    });

    if (!user || user.twoFactorBackupCodes.length === 0) {
      return false;
    }

    // Try to match against each stored hashed code
    for (let i = 0; i < user.twoFactorBackupCodes.length; i++) {
      const isMatch = await bcrypt.compare(code, user.twoFactorBackupCodes[i]);
      if (isMatch) {
        // Remove the consumed code
        const updatedCodes = [
          ...user.twoFactorBackupCodes.slice(0, i),
          ...user.twoFactorBackupCodes.slice(i + 1),
        ];

        await this.prisma.user.update({
          where: { id: userId },
          data: { twoFactorBackupCodes: updatedCodes },
        });

        this.logger.log(
          `Backup code consumed for user ${userId} (${updatedCodes.length} remaining)`,
        );

        return true;
      }
    }

    return false;
  }
}
