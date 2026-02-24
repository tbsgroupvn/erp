import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { BaseResponse } from '@common/dto/base-response.dto';
import { DataClass, DataClassification } from '@common/decorators/data-classification.decorator';
import { ConsentService } from './consent.service';
import { GrantConsentDto, RevokeConsentDto } from './dto/consent.dto';

@ApiTags('Consent Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('consent')
export class ConsentController {
  constructor(private readonly consentService: ConsentService) {}

  // =========================================================================
  // User Self-Service Consent Endpoints
  // =========================================================================

  @Post('grant')
  @HttpCode(HttpStatus.OK)
  @DataClass(DataClassification.RESTRICTED)
  @ApiOperation({
    summary: 'Grant or update consent',
    description:
      'Allows authenticated users to grant consent for specific data processing purposes. ' +
      'Records IP address and user agent for NĐ 13/2023 compliance evidence.',
  })
  @ApiResponse({ status: 200, description: 'Consent granted/updated' })
  async grantConsent(
    @CurrentUser() user: ICurrentUser,
    @Body() dto: GrantConsentDto,
    @Req() req: Request,
  ) {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip;
    const userAgent = req.headers['user-agent'];

    const consent = await this.consentService.grantConsent(
      user.id,
      dto,
      ipAddress,
      userAgent,
    );
    return BaseResponse.ok(consent, 'Consent updated successfully');
  }

  @Post('revoke')
  @HttpCode(HttpStatus.OK)
  @DataClass(DataClassification.RESTRICTED)
  @ApiOperation({
    summary: 'Revoke consent',
    description:
      'NĐ 13/2023 Article 13 — Right to withdraw consent. ' +
      'Allows users to revoke previously granted consent at any time.',
  })
  @ApiResponse({ status: 200, description: 'Consent revoked' })
  async revokeConsent(
    @CurrentUser() user: ICurrentUser,
    @Body() dto: RevokeConsentDto,
    @Req() req: Request,
  ) {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip;
    const userAgent = req.headers['user-agent'];

    await this.consentService.revokeConsent(
      user.id,
      dto.consentType,
      ipAddress,
      userAgent,
    );
    return BaseResponse.ok(null, 'Consent revoked successfully');
  }

  @Get('my-consents')
  @DataClass(DataClassification.RESTRICTED)
  @ApiOperation({
    summary: 'Get current user consents',
    description: 'Returns all consent records for the authenticated user.',
  })
  @ApiResponse({ status: 200, description: 'List of user consents' })
  async getMyConsents(@CurrentUser() user: ICurrentUser) {
    const consents = await this.consentService.getUserConsents(user.id);
    return BaseResponse.ok(consents);
  }

  @Get('my-summary')
  @DataClass(DataClassification.RESTRICTED)
  @ApiOperation({
    summary: 'Get consent summary for current user',
    description:
      'Returns a summary of all consent types and their current status.',
  })
  @ApiResponse({ status: 200, description: 'Consent summary' })
  async getConsentSummary(@CurrentUser() user: ICurrentUser) {
    const summary = await this.consentService.getConsentSummary(user.id);
    return BaseResponse.ok(summary);
  }

  // =========================================================================
  // Admin Consent Endpoints (CEO/COO)
  // =========================================================================

  @Get('user/:userId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CEO, UserRole.COO)
  @DataClass(DataClassification.RESTRICTED)
  @ApiOperation({
    summary: 'Get consents for a specific user (admin)',
    description: 'CEO/COO can view consent records for any user.',
  })
  @ApiParam({ name: 'userId', description: 'User ID to query consents for' })
  @ApiResponse({ status: 200, description: 'User consent records' })
  async getUserConsents(@Param('userId') userId: string) {
    const consents = await this.consentService.getUserConsents(userId);
    return BaseResponse.ok(consents);
  }

  @Get('user/:userId/audit-trail')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CEO, UserRole.COO)
  @DataClass(DataClassification.RESTRICTED)
  @ApiOperation({
    summary: 'Get consent audit trail for a user',
    description:
      'Returns the full consent history including IP addresses, user agents, ' +
      'and timestamps. Used for NĐ 13/2023 compliance evidence.',
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Consent audit trail' })
  async getConsentAuditTrail(@Param('userId') userId: string) {
    const trail = await this.consentService.getConsentAuditTrail(userId);
    return BaseResponse.ok(trail);
  }

  @Get('user/:userId/check/:consentType')
  @DataClass(DataClassification.RESTRICTED)
  @ApiOperation({
    summary: 'Check if a user has specific consent',
    description: 'Quick check used by other services before processing data.',
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiParam({ name: 'consentType', description: 'Consent type to check' })
  @ApiResponse({ status: 200, description: 'Consent status boolean' })
  async hasConsent(
    @Param('userId') userId: string,
    @Param('consentType') consentType: string,
  ) {
    const hasConsent = await this.consentService.hasConsent(userId, consentType);
    return BaseResponse.ok({ hasConsent });
  }
}
