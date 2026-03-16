import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiParam } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { BaseResponse } from '@common/dto/base-response.dto';
import { PrismaService } from '@core/database/prisma.service';

@ApiTags('Notification Rules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CEO, UserRole.COO, UserRole.DIRECTOR_OPERATIONS)
@Controller('notification-rules')
export class NotificationRulesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'List all notification rules' })
  @ApiResponse({ status: 200, description: 'Rules retrieved' })
  async findAll() {
    const rules = await this.prisma.notificationRule.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return BaseResponse.ok(rules);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get notification rule by ID' })
  @ApiParam({ name: 'id', description: 'Rule ID' })
  @ApiResponse({ status: 200, description: 'Rule retrieved' })
  async findById(@Param('id') id: string) {
    const rule = await this.prisma.notificationRule.findUnique({
      where: { id },
    });
    return BaseResponse.ok(rule);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a notification rule' })
  @ApiResponse({ status: 201, description: 'Rule created' })
  async create(
    @Body()
    body: {
      name: string;
      eventType: string;
      conditions?: any;
      channels: string[];
      recipientType: string;
      recipientRole?: string;
      recipientUserId?: string;
      templateTitle: string;
      templateBody: string;
    },
  ) {
    const rule = await this.prisma.notificationRule.create({
      data: {
        name: body.name,
        eventType: body.eventType,
        conditions: body.conditions ?? {},
        channels: body.channels,
        recipientType: body.recipientType,
        recipientRole: body.recipientRole,
        recipientUserId: body.recipientUserId,
        templateTitle: body.templateTitle,
        templateBody: body.templateBody,
      },
    });
    return BaseResponse.ok(rule, 'Notification rule created');
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a notification rule' })
  @ApiParam({ name: 'id', description: 'Rule ID' })
  @ApiResponse({ status: 200, description: 'Rule updated' })
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      eventType?: string;
      conditions?: any;
      channels?: string[];
      recipientType?: string;
      recipientRole?: string;
      recipientUserId?: string;
      templateTitle?: string;
      templateBody?: string;
      isActive?: boolean;
    },
  ) {
    const rule = await this.prisma.notificationRule.update({
      where: { id },
      data: body,
    });
    return BaseResponse.ok(rule, 'Notification rule updated');
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a notification rule' })
  @ApiParam({ name: 'id', description: 'Rule ID' })
  @ApiResponse({ status: 200, description: 'Rule deleted' })
  async remove(@Param('id') id: string) {
    await this.prisma.notificationRule.delete({ where: { id } });
    return BaseResponse.ok(null, 'Notification rule deleted');
  }
}
