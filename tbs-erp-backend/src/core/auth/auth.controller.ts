import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '@nestjs/passport';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { TokenResponseDto } from './dto/token-response.dto';
import {
  Verify2FADto,
  Disable2FADto,
  VerifyLoginOtpDto,
  SmsTwoFactorDto,
} from './dto/two-factor.dto';
import { AuthenticatedUser } from './strategies/jwt.strategy';
import { RefreshTokenUser } from './strategies/refresh-token.strategy';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  // =========================================================================
  // Standard Auth Endpoints
  // =========================================================================

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 900000 } }) // 5 attempts per 15 minutes
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login with email and password',
    description:
      'Authenticates the user. If 2FA is enabled, returns a temporary token and available methods ' +
      'instead of full session tokens. The client must then call POST /auth/2fa/verify to complete login.',
  })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({
    description:
      'Returns user profile + access token (no 2FA), or { requires2FA, userId, methods, tempToken } (2FA enabled).',
  })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password' })
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userAgent = req.headers['user-agent'];
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip;

    const result = await this.authService.login(
      loginDto.email,
      loginDto.password,
      userAgent,
      ipAddress,
    );

    // If 2FA is required, return the challenge directly (no cookies needed yet)
    if ('requires2FA' in result) {
      return result;
    }

    // Standard login: set refresh token in HttpOnly cookie
    res.cookie('refreshToken', result.tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.APP_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/api/auth/refresh',
    });

    return {
      user: result.user,
      tokens: {
        accessToken: result.tokens.accessToken,
        expiresIn: result.tokens.expiresIn,
      },
    };
  }

  @Post('refresh')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt-refresh'))
  @ApiOperation({ summary: 'Refresh access token using refresh token from HttpOnly cookie' })
  @ApiOkResponse({
    description: 'Returns new access token. New refresh token set in HttpOnly cookie.',
  })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired refresh token' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Omit<TokenResponseDto, 'refreshToken'>> {
    const user = req.user as RefreshTokenUser;
    const result = await this.authService.refreshToken(
      user.userId,
      user.sessionId,
      user.refreshToken,
    );

    // Set new refresh token in HttpOnly cookie
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.APP_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/api/auth/refresh',
    });

    return {
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and revoke current session' })
  @ApiOkResponse({ description: 'Session has been revoked and cookies cleared' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    const user = req.user as AuthenticatedUser;
    await this.authService.logout(user.sessionId);

    // Clear the refresh token cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.APP_ENV === 'production',
      sameSite: 'strict',
      path: '/api/auth/refresh',
    });

    return { message: 'Logged out successfully' };
  }

  @Post('forgot-password')
  @Throttle({ default: { limit: 3, ttl: 3600000 } }) // 3 attempts per hour
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a password reset link' })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiOkResponse({ description: 'Password reset instructions sent (if account exists)' })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 900000 } }) // 5 attempts per 15 minutes
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using a reset token' })
  @ApiBody({ type: ResetPasswordDto })
  @ApiOkResponse({ description: 'Password has been reset successfully' })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  @Get('profile')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiOkResponse({ description: 'Returns current user profile' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  async getProfile(@Req() req: Request) {
    const user = req.user as AuthenticatedUser;
    return this.authService.getProfile(user.id);
  }

  @Patch('change-password')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 attempts per minute
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password for the authenticated user' })
  @ApiOkResponse({ description: 'Password changed successfully' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated or current password incorrect' })
  async changePassword(
    @Req() req: Request,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const user = req.user as AuthenticatedUser;
    return this.authService.changePassword(user.id, dto.currentPassword, dto.newPassword, user.sessionId);
  }

  // =========================================================================
  // Two-Factor Authentication Endpoints
  // =========================================================================

  @Post('2fa/setup')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 attempts per minute
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Generate TOTP secret and QR code for 2FA setup',
    description:
      'Generates a new TOTP secret, encrypts and stores it, then returns the secret ' +
      'and a QR code data URL. The user must scan the QR code with an authenticator app ' +
      '(e.g. Google Authenticator) and then call POST /auth/2fa/enable with a valid code.',
  })
  @ApiOkResponse({
    description: 'Returns { secret, qrCodeDataUrl, otpauthUrl }',
  })
  async setup2FA(@Req() req: Request) {
    const user = req.user as AuthenticatedUser;
    return this.authService.generate2FASecret(user.id);
  }

  @Post('2fa/enable')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 attempts per minute
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Verify TOTP code and enable 2FA',
    description:
      'Verifies a TOTP code from the authenticator app to confirm setup, ' +
      'then enables 2FA and generates 10 backup codes.',
  })
  @ApiBody({ type: Verify2FADto })
  @ApiOkResponse({
    description: 'Returns { message, backupCodes[] }. Backup codes are shown only once.',
  })
  async enable2FA(
    @Req() req: Request,
    @Body() dto: Verify2FADto,
  ) {
    const user = req.user as AuthenticatedUser;
    return this.authService.enable2FA(user.id, dto.code);
  }

  @Post('2fa/disable')
  @Throttle({ default: { limit: 3, ttl: 300000 } }) // 3 attempts per 5 minutes
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Disable 2FA for the authenticated user',
    description:
      'Requires a valid TOTP or backup code AND the account password. ' +
      'Clears all 2FA secrets, backup codes, and phone number.',
  })
  @ApiBody({ type: Disable2FADto })
  @ApiOkResponse({ description: '2FA disabled successfully' })
  async disable2FA(
    @Req() req: Request,
    @Body() dto: Disable2FADto,
  ): Promise<{ message: string }> {
    const user = req.user as AuthenticatedUser;
    return this.authService.disable2FA(user.id, dto.code, dto.password);
  }

  @Post('2fa/verify')
  @Throttle({ default: { limit: 5, ttl: 900000 } }) // 5 attempts per 15 minutes
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify 2FA code during login',
    description:
      'Second step of the login flow when 2FA is enabled. Requires the temporary token ' +
      'returned from POST /auth/login, a valid verification code, and the userId. ' +
      'On success, returns the full user profile and session tokens.',
  })
  @ApiBody({ type: VerifyLoginOtpDto })
  @ApiOkResponse({
    description: 'Returns user profile and access token. Refresh token set in HttpOnly cookie.',
  })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired 2FA code/session' })
  async verifyLogin2FA(
    @Body() dto: VerifyLoginOtpDto,
    @Headers('x-2fa-token') tempToken: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!tempToken) {
      tempToken = (req.headers['authorization']?.replace('Bearer ', '') ?? '');
    }

    const userAgent = req.headers['user-agent'];
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip;

    const result = await this.authService.verifyLoginOtp(
      tempToken,
      dto.userId,
      dto.code,
      dto.method,
      userAgent,
      ipAddress,
    );

    // Set refresh token in HttpOnly cookie
    res.cookie('refreshToken', result.tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.APP_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/api/auth/refresh',
    });

    return {
      user: result.user,
      tokens: {
        accessToken: result.tokens.accessToken,
        expiresIn: result.tokens.expiresIn,
      },
    };
  }

  @Post('2fa/sms/setup')
  @Throttle({ default: { limit: 3, ttl: 300000 } }) // 3 attempts per 5 minutes
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Set up SMS-based 2FA with a phone number',
    description:
      'Registers a phone number for receiving SMS OTP codes. ' +
      'Immediately sends a verification code to confirm the number.',
  })
  @ApiBody({ type: SmsTwoFactorDto })
  @ApiOkResponse({ description: 'Phone number registered and verification code sent' })
  async setupSms2FA(
    @Req() req: Request,
    @Body() dto: SmsTwoFactorDto,
  ): Promise<{ message: string }> {
    const user = req.user as AuthenticatedUser;
    return this.authService.setupSms2FA(user.id, dto.phoneNumber);
  }

  @Post('2fa/sms/send')
  @Throttle({ default: { limit: 3, ttl: 300000 } }) // 3 attempts per 5 minutes
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send SMS OTP code',
    description:
      'Generates and sends a 6-digit OTP code via SMS to the registered phone number. ' +
      'Requires either a valid JWT token or a valid temporary 2FA token (x-2fa-token header). ' +
      'The code is valid for 5 minutes.',
  })
  @ApiOkResponse({ description: 'Verification code sent via SMS' })
  async sendSmsOtp(
    @Body() body: { userId: string },
    @Req() req: Request,
    @Headers('x-2fa-token') tempToken?: string,
  ): Promise<{ message: string }> {
    // Require either a valid JWT or a valid temporary 2FA token
    let authenticatedUserId: string | null = null;
    const jwtSecret = this.configService.get<string>('jwt.secret');

    // Try temporary 2FA token from x-2fa-token header
    if (tempToken) {
      try {
        const payload = this.jwtService.verify(tempToken, { secret: jwtSecret });
        if (payload.type === '2fa-pending' && payload.sub) {
          authenticatedUserId = payload.sub;
        }
      } catch {
        // Invalid temp token
      }
    }

    // Try standard authorization header (JWT or 2FA temp token)
    const authHeader = req.headers['authorization'];
    if (!authenticatedUserId && authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const payload = this.jwtService.verify(token, { secret: jwtSecret });
        if (payload.sub) {
          authenticatedUserId = payload.sub;
        }
      } catch {
        // Invalid token
      }
    }

    if (!authenticatedUserId) {
      throw new UnauthorizedException(
        'A valid JWT token or temporary 2FA token is required to send SMS OTP',
      );
    }

    // Validate that the userId in the body matches the authenticated user
    if (body.userId !== authenticatedUserId) {
      throw new UnauthorizedException(
        'Cannot send SMS OTP for a different user',
      );
    }

    return this.authService.sendSmsOtp(body.userId);
  }

  @Post('2fa/backup-codes')
  @Throttle({ default: { limit: 3, ttl: 300000 } }) // 3 attempts per 5 minutes
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Regenerate backup codes',
    description:
      'Generates 10 new backup codes and replaces the existing ones. ' +
      'The new codes are shown only once and must be saved by the user.',
  })
  @ApiOkResponse({
    description: 'Returns { backupCodes[] }. These codes are shown only once.',
  })
  async regenerateBackupCodes(
    @Req() req: Request,
  ): Promise<{ backupCodes: string[] }> {
    const user = req.user as AuthenticatedUser;
    return this.authService.regenerateBackupCodes(user.id);
  }

  @Get('2fa/status')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get current 2FA status',
    description:
      'Returns whether 2FA is enabled, the preferred method, and whether a phone number ' +
      'and backup codes are configured.',
  })
  @ApiOkResponse({
    description: 'Returns { is2FAEnabled, preferredMethod, hasPhoneNumber, hasBackupCodes }',
  })
  async get2FAStatus(@Req() req: Request) {
    const user = req.user as AuthenticatedUser;
    return this.authService.get2FAStatus(user.id);
  }

  // =========================================================================
  // Impersonation Endpoints
  // =========================================================================

  @Post('impersonate/:customerId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Impersonate a customer',
    description:
      'Allows authorized admin users (CEO, COO, SALES_DIRECTOR, CSKH) to impersonate a customer. ' +
      'Returns a special JWT token with impersonation metadata. Limited to 1 hour.',
  })
  @ApiOkResponse({
    description: 'Returns { token, logId } for the impersonation session',
  })
  async impersonate(
    @Param('customerId') customerId: string,
    @Req() req: Request,
  ) {
    const user = req.user as AuthenticatedUser;
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip;

    return this.authService.impersonate(user.id, customerId, ipAddress);
  }

  @Post('end-impersonation')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'End an impersonation session',
    description:
      'Ends an active impersonation session by updating the ImpersonationLog record.',
  })
  @ApiOkResponse({ description: 'Impersonation session ended' })
  async endImpersonation(
    @Body() body: { logId: string },
  ): Promise<{ message: string }> {
    return this.authService.endImpersonation(body.logId);
  }

}
