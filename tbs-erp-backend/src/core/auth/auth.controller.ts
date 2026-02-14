import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
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
import { TokenResponseDto } from './dto/token-response.dto';
import { AuthenticatedUser } from './strategies/jwt.strategy';
import { RefreshTokenUser } from './strategies/refresh-token.strategy';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 900000 } }) // 5 attempts per 15 minutes
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({
    description: 'Returns user profile and access token. Refresh token set in HttpOnly cookie.',
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

    // Set refresh token in HttpOnly cookie (secure, not accessible via JavaScript)
    res.cookie('refreshToken', result.tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.APP_ENV === 'production', // HTTPS only in production
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/api/auth/refresh', // Only send to refresh endpoint
    });

    // Return response without refresh token (it's in cookie now)
    return {
      user: result.user,
      tokens: {
        accessToken: result.tokens.accessToken,
        expiresIn: result.tokens.expiresIn,
      },
    };
  }

  @Post('refresh')
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

    // Return response without refresh token (it's in cookie now)
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
}
