import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { BaseResponse } from '@common/dto/base-response.dto';
import { NotificationService, SendNotificationDto } from './notification.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'List current user notifications (paginated)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async listNotifications(
    @CurrentUser() user: ICurrentUser,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    const result = await this.notificationService.getUserNotifications(user.id, page, limit);
    return {
      success: true,
      data: result.data,
      meta: result.meta,
    };
  }

  @Post('send')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.DIRECTOR_OPERATIONS)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send notification to a user' })
  @ApiResponse({ status: 200, description: 'Notification sent' })
  async sendToUser(@Body() dto: SendNotificationDto) {
    await this.notificationService.send(dto);
    return BaseResponse.ok(null, 'Notification sent');
  }

  @Post('send-role')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.DIRECTOR_OPERATIONS)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send notification to all users with a role' })
  async sendToRole(@Body('role') role: string, @Body() dto: Omit<SendNotificationDto, 'userId'>) {
    const result = await this.notificationService.sendToRole(role, dto);
    return BaseResponse.ok(result, 'Notifications sent');
  }

  @Post('send-bulk')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.DIRECTOR_OPERATIONS)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send notification to multiple users' })
  async sendBulk(
    @Body('userIds') userIds: string[],
    @Body() dto: Omit<SendNotificationDto, 'userId'>,
  ) {
    const result = await this.notificationService.sendBulk(userIds, dto);
    return BaseResponse.ok(result, 'Bulk notifications sent');
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  async markAsRead(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    const notification = await this.notificationService.markAsRead(id, user.id);
    return BaseResponse.ok(notification, 'Notification marked as read');
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllAsRead(@CurrentUser() user: ICurrentUser) {
    const result = await this.notificationService.markAllAsRead(user.id);
    return BaseResponse.ok(result, 'All marked as read');
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  async getUnreadCount(@CurrentUser() user: ICurrentUser) {
    const result = await this.notificationService.getUnreadCount(user.id);
    return BaseResponse.ok(result);
  }

  @Delete('cleanup')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.DIRECTOR_OPERATIONS)
  @ApiOperation({ summary: 'Delete old read notifications' })
  @ApiQuery({ name: 'daysOld', required: true, example: 90 })
  async deleteOld(@Query('daysOld', ParseIntPipe) daysOld: number) {
    const result = await this.notificationService.deleteOld(daysOld);
    return BaseResponse.ok(result, 'Old notifications deleted');
  }
}
