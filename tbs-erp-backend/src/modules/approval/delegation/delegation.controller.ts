import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { ALL_ROLES } from '@core/rbac/roles.enum';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { BaseResponse } from '@common/dto/base-response.dto';
import { DelegationService } from './delegation.service';
import { CreateDelegationDto } from './dto/create-delegation.dto';

@Roles(...ALL_ROLES)
@ApiTags('System - Approval Delegations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('approval-delegations')
export class DelegationController {
  constructor(private readonly delegationService: DelegationService) {}

  @Get()
  @ApiOperation({ summary: 'Get my delegations' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 50)' })
  async findAll(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit ?? '50', 10) || 50));
    const data = await this.delegationService.findByUser(userId, pageNum, limitNum);
    return BaseResponse.ok(data);
  }

  @Post()
  @ApiOperation({ summary: 'Create a delegation' })
  async create(@Body() dto: CreateDelegationDto, @CurrentUser() user: ICurrentUser) {
    const data = await this.delegationService.create(dto, user.id);
    return BaseResponse.ok(data, 'Delegation created');
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate a delegation' })
  @ApiParam({ name: 'id' })
  async deactivate(@Param('id') id: string, @CurrentUser('id') userId: string) {
    const data = await this.delegationService.deactivate(id, userId);
    return BaseResponse.ok(data, 'Delegation deactivated');
  }
}
