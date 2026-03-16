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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { BaseResponse, PaginatedResponse } from '@common/dto/base-response.dto';
import { UserRole } from '@prisma/client';
import { AutomationService } from './automation.service';
import { CreateAutomationRuleDto, UpdateAutomationRuleDto } from './dto';

@ApiTags('Automation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('automation')
export class AutomationController {
  constructor(private readonly automationService: AutomationService) {}

  // ---------------------------------------------------------------------------
  // GET /automation
  // ---------------------------------------------------------------------------
  @Get()
  @Roles(
    UserRole.CEO,
    UserRole.COO,
    UserRole.DIRECTOR_OPERATIONS,
    UserRole.SALES_DIRECTOR,
    UserRole.SALE,
    UserRole.SALES_LEADER,
    UserRole.CSKH,
    UserRole.CHIEF_ACCOUNTANT,
    UserRole.ACCOUNTANT,
    UserRole.HR_MANAGER,
    UserRole.LOGISTICS_MANAGER,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.XNK_MANAGER,
  )
  @ApiOperation({ summary: 'List all automation rules' })
  @ApiResponse({ status: 200, description: 'Rules retrieved successfully' })
  async getRules() {
    const rules = await this.automationService.getRules();
    return BaseResponse.ok(rules);
  }

  // ---------------------------------------------------------------------------
  // GET /automation/stats
  // ---------------------------------------------------------------------------
  @Get('stats')
  @Roles(
    UserRole.CEO,
    UserRole.COO,
    UserRole.DIRECTOR_OPERATIONS,
    UserRole.SALES_DIRECTOR,
    UserRole.HR_MANAGER,
  )
  @ApiOperation({ summary: 'Get automation statistics' })
  @ApiResponse({ status: 200, description: 'Stats retrieved' })
  async getStats() {
    const stats = await this.automationService.getStats();
    return BaseResponse.ok(stats);
  }

  // ---------------------------------------------------------------------------
  // POST /automation
  // ---------------------------------------------------------------------------
  @Post()
  @Roles(
    UserRole.CEO,
    UserRole.COO,
    UserRole.DIRECTOR_OPERATIONS,
    UserRole.SALES_DIRECTOR,
    UserRole.SALES_LEADER,
    UserRole.HR_MANAGER,
    UserRole.LOGISTICS_MANAGER,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.XNK_MANAGER,
  )
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create automation rule' })
  @ApiResponse({ status: 201, description: 'Rule created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async createRule(
    @Body() dto: CreateAutomationRuleDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const rule = await this.automationService.createRule(user.id, dto);
    return BaseResponse.ok(rule, 'Automation rule created successfully');
  }

  // ---------------------------------------------------------------------------
  // GET /automation/:id
  // ---------------------------------------------------------------------------
  @Get(':id')
  @Roles(
    UserRole.CEO,
    UserRole.COO,
    UserRole.DIRECTOR_OPERATIONS,
    UserRole.SALES_DIRECTOR,
    UserRole.SALE,
    UserRole.SALES_LEADER,
    UserRole.CSKH,
    UserRole.CHIEF_ACCOUNTANT,
    UserRole.ACCOUNTANT,
    UserRole.HR_MANAGER,
    UserRole.LOGISTICS_MANAGER,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.XNK_MANAGER,
  )
  @ApiOperation({ summary: 'Get automation rule detail with recent executions' })
  @ApiParam({ name: 'id', description: 'Rule ID' })
  @ApiResponse({ status: 200, description: 'Rule retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Rule not found' })
  async getRule(@Param('id') id: string) {
    const rule = await this.automationService.getRule(id);
    return BaseResponse.ok(rule);
  }

  // ---------------------------------------------------------------------------
  // PATCH /automation/:id
  // ---------------------------------------------------------------------------
  @Patch(':id')
  @Roles(
    UserRole.CEO,
    UserRole.COO,
    UserRole.DIRECTOR_OPERATIONS,
    UserRole.SALES_DIRECTOR,
    UserRole.SALES_LEADER,
    UserRole.HR_MANAGER,
    UserRole.LOGISTICS_MANAGER,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.XNK_MANAGER,
  )
  @ApiOperation({ summary: 'Update automation rule (creator only)' })
  @ApiParam({ name: 'id', description: 'Rule ID' })
  @ApiResponse({ status: 200, description: 'Rule updated successfully' })
  @ApiResponse({ status: 403, description: 'Not the rule creator' })
  @ApiResponse({ status: 404, description: 'Rule not found' })
  async updateRule(
    @Param('id') id: string,
    @Body() dto: UpdateAutomationRuleDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const rule = await this.automationService.updateRule(user.id, id, dto);
    return BaseResponse.ok(rule, 'Automation rule updated successfully');
  }

  // ---------------------------------------------------------------------------
  // DELETE /automation/:id
  // ---------------------------------------------------------------------------
  @Delete(':id')
  @Roles(
    UserRole.CEO,
    UserRole.COO,
    UserRole.DIRECTOR_OPERATIONS,
    UserRole.SALES_DIRECTOR,
    UserRole.SALES_LEADER,
    UserRole.HR_MANAGER,
    UserRole.LOGISTICS_MANAGER,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.XNK_MANAGER,
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete automation rule (creator only)' })
  @ApiParam({ name: 'id', description: 'Rule ID' })
  @ApiResponse({ status: 200, description: 'Rule deleted' })
  @ApiResponse({ status: 403, description: 'Not the rule creator' })
  @ApiResponse({ status: 404, description: 'Rule not found' })
  async deleteRule(
    @Param('id') id: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.automationService.deleteRule(user.id, id);
    return BaseResponse.ok(result, 'Automation rule deleted');
  }

  // ---------------------------------------------------------------------------
  // POST /automation/:id/test
  // ---------------------------------------------------------------------------
  @Post(':id/test')
  @Roles(
    UserRole.CEO,
    UserRole.COO,
    UserRole.DIRECTOR_OPERATIONS,
    UserRole.SALES_DIRECTOR,
    UserRole.SALES_LEADER,
    UserRole.HR_MANAGER,
    UserRole.LOGISTICS_MANAGER,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.XNK_MANAGER,
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually trigger rule for testing' })
  @ApiParam({ name: 'id', description: 'Rule ID' })
  @ApiResponse({ status: 200, description: 'Test execution result' })
  @ApiResponse({ status: 404, description: 'Rule not found' })
  async manualTrigger(
    @Param('id') id: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.automationService.manualTrigger(user.id, id);
    return BaseResponse.ok(result, `Test execution: ${result.status}`);
  }

  // ---------------------------------------------------------------------------
  // GET /automation/:id/executions
  // ---------------------------------------------------------------------------
  @Get(':id/executions')
  @Roles(
    UserRole.CEO,
    UserRole.COO,
    UserRole.DIRECTOR_OPERATIONS,
    UserRole.SALES_DIRECTOR,
    UserRole.SALES_LEADER,
    UserRole.HR_MANAGER,
    UserRole.LOGISTICS_MANAGER,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.XNK_MANAGER,
  )
  @ApiOperation({ summary: 'Get execution history for a rule' })
  @ApiParam({ name: 'id', description: 'Rule ID' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max records (default 50)' })
  @ApiResponse({ status: 200, description: 'Execution history retrieved' })
  @ApiResponse({ status: 404, description: 'Rule not found' })
  async getExecutions(
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    const executions = await this.automationService.getExecutions(
      id,
      limit ? parseInt(limit, 10) : 50,
    );
    return BaseResponse.ok(executions);
  }
}
