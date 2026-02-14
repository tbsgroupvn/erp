import {
  Injectable,
  Logger,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '@core/database/prisma.service';
import { TokenResponseDto } from './dto/token-response.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { RefreshTokenPayload } from './strategies/refresh-token.strategy';
import { User, UserRole, Branch } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

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
   * Returns both user profile and tokens for the frontend.
   */
  async login(
    email: string,
    password: string,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<{ user: Omit<User, 'passwordHash' | 'resetToken' | 'resetTokenExpiry'>; tokens: TokenResponseDto }> {
    const user = await this.validateUser(email, password);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

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

    // Strip sensitive fields from user response
    const { resetToken: _rt, resetTokenExpiry: _rte, ...safeUser } = user as any;

    return {
      user: { ...safeUser, lastLoginAt: now },
      tokens,
    };
  }

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

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

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
    if (!match) return 900; // Default 15 minutes

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
}
