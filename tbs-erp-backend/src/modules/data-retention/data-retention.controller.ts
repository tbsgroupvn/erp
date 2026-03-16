import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { BaseResponse } from '@common/dto/base-response.dto';
import { DataRetentionService } from './data-retention.service';
import { AnonymizeUserDto, ExecuteRetentionDto } from './dto/retention-policy.dto';

@ApiTags('Data Retention & Compliance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('data-retention')
export class DataRetentionController {
  constructor(private readonly dataRetentionService: DataRetentionService) {}

  // =========================================================================
  // Policy Management
  // =========================================================================

  @Get('policies')
  @Roles(UserRole.CEO, UserRole.COO)
  @ApiOperation({
    summary: 'List all data retention policies',
    description:
      'Returns the configured data retention policies aligned with Vietnamese data protection law ' +
      '(NĐ 13/2023/NĐ-CP) and ISO 27001 standards. CEO/COO access only.',
  })
  @ApiResponse({ status: 200, description: 'List of retention policies' })
  async getPolicies() {
    const policies = this.dataRetentionService.getRetentionPolicies();
    return BaseResponse.ok(policies, 'Retention policies retrieved');
  }

  // =========================================================================
  // Manual Execution
  // =========================================================================

  @Post('execute')
  @Roles(UserRole.CEO)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Manually execute data retention policies',
    description:
      'Triggers immediate execution of data retention policies. CEO access only. ' +
      'Can optionally specify which entity policies to execute.',
  })
  @ApiResponse({ status: 200, description: 'Retention report' })
  async executeRetention(@CurrentUser() user: ICurrentUser, @Body() dto?: ExecuteRetentionDto) {
    const report = await this.dataRetentionService.executeRetentionPolicies(user.id, dto?.entities);
    return BaseResponse.ok(report, 'Retention policies executed successfully');
  }

  // =========================================================================
  // Reports
  // =========================================================================

  @Get('reports')
  @Roles(UserRole.CEO, UserRole.COO)
  @ApiOperation({
    summary: 'Get data retention execution reports',
    description: 'Returns paginated history of retention policy executions.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Paginated retention reports' })
  async getReports(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    const result = await this.dataRetentionService.getReports(page, limit);
    return {
      success: true,
      data: result.data,
      meta: result.meta,
    };
  }

  // =========================================================================
  // User Data Rights (NĐ 13/2023 / GDPR)
  // =========================================================================

  @Post('user/:id/export')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 exports per minute
  @Roles(UserRole.CEO, UserRole.COO)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Export all data for a specific user (data portability)',
    description:
      'NĐ 13/2023/NĐ-CP Article 14 — Right to data portability. ' +
      'Exports all personal data related to a user in structured JSON format. ' +
      'CEO/COO access only. The export action is logged for compliance.',
  })
  @ApiParam({ name: 'id', description: 'User ID to export data for' })
  @ApiResponse({ status: 200, description: 'User data export' })
  async exportUserData(@Param('id') userId: string, @CurrentUser() user: ICurrentUser) {
    const exportData = await this.dataRetentionService.exportUserData(userId, user.id);
    return BaseResponse.ok(exportData, 'User data exported successfully');
  }

  @Post('user/:id/anonymize')
  @Roles(UserRole.CEO)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Anonymize a user's personal data (right to be forgotten)",
    description:
      'NĐ 13/2023/NĐ-CP Article 16 — Right to deletion. ' +
      'Anonymizes all personal data for the specified user. ' +
      'Financial and transaction records are retained per Vietnamese tax law ' +
      '(Luật Kế toán 2015, Art. 41) but with PII removed. CEO access only.',
  })
  @ApiParam({ name: 'id', description: 'User ID to anonymize' })
  @ApiResponse({ status: 200, description: 'User data anonymized' })
  async anonymizeUser(@Param('id') userId: string, @Body() dto: AnonymizeUserDto) {
    await this.dataRetentionService.anonymizeUserData(userId, dto.reason);
    return BaseResponse.ok(null, 'User data anonymized successfully');
  }
}
