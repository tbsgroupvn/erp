import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { BaseResponse } from '@common/dto/base-response.dto';
import { LarkSuiteService } from './larksuite.service';
import { LarkNotificationDto } from './dto/lark-notification.dto';
import { LarkApprovalDto } from './dto/lark-approval.dto';

@ApiTags('Integration - LarkSuite')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('integrations/larksuite')
export class LarkSuiteController {
  constructor(private readonly larkSuiteService: LarkSuiteService) {}

  @Post('sync-employees')
  @Roles('CEO', 'COO', 'HR_MANAGER' as any)
  @ApiOperation({
    summary: 'Sync employees from LarkSuite',
    description:
      'Pulls employee data from the LarkSuite directory and updates ERP employee records.',
  })
  async syncEmployees(@CurrentUser('id') userId: string) {
    const result = await this.larkSuiteService.syncEmployees();
    return BaseResponse.ok(result, 'Employee sync completed');
  }

  @Post('notifications')
  @Roles('CEO', 'COO', 'HR_MANAGER', 'LOGISTICS_MANAGER', 'ACCOUNTANT', 'SALE' as any)
  @ApiOperation({
    summary: 'Send notification to LarkSuite',
    description:
      'Sends a text, rich text, or card message to a LarkSuite user, group, or department.',
  })
  async sendNotification(
    @Body() dto: LarkNotificationDto,
    @CurrentUser('id') userId: string,
  ) {
    await this.larkSuiteService.sendNotification(dto);
    return BaseResponse.ok(null, 'Notification sent successfully');
  }

  @Get('calendar/:userId')
  @Roles('CEO', 'COO', 'HR_MANAGER' as any)
  @ApiOperation({
    summary: 'Sync calendar events from LarkSuite',
    description: 'Fetches upcoming calendar events for a specific user from LarkSuite.',
  })
  @ApiParam({ name: 'userId', description: 'ERP user ID to sync calendar for' })
  async syncCalendar(@Param('userId') userId: string) {
    const result = await this.larkSuiteService.syncCalendar(userId);
    return BaseResponse.ok(result);
  }

  @Post('approvals')
  @Roles('CEO', 'COO', 'CFO', 'HR_MANAGER', 'LOGISTICS_MANAGER', 'ACCOUNTANT' as any)
  @ApiOperation({
    summary: 'Create an approval in LarkSuite',
    description:
      'Creates an approval workflow instance in LarkSuite, ' +
      'linked to an ERP record for bidirectional status tracking.',
  })
  async createApproval(
    @Body() dto: LarkApprovalDto,
    @CurrentUser('id') userId: string,
  ) {
    const result = await this.larkSuiteService.createApproval(dto);
    return BaseResponse.ok(result, 'Approval created in LarkSuite');
  }

  @Get('users/mapping')
  @Roles('CEO', 'COO', 'HR_MANAGER' as any)
  @ApiOperation({
    summary: 'Get LarkSuite user mapping by email',
    description: 'Resolves an email address to the corresponding LarkSuite user profile.',
  })
  @ApiQuery({ name: 'email', description: 'Email address to look up', required: true })
  async getUserMapping(@Query('email') email: string) {
    const result = await this.larkSuiteService.getUserMapping(email);
    return BaseResponse.ok(result);
  }
}
