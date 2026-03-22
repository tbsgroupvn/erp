import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { BaseResponse, PaginatedResponse } from '@common/dto/base-response.dto';
import { DebtNettingService } from './debt-netting.service';
import { CreateNettingRequestDto } from './dto/create-netting-request.dto';
import { NettingQueryDto } from './dto/netting-query.dto';

@ApiTags('Debt Netting')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('debt-netting')
export class DebtNettingController {
  constructor(private readonly debtNettingService: DebtNettingService) {}

  @Get('opportunities')
  @Roles(UserRole.CHIEF_ACCOUNTANT, UserRole.ACCOUNTANT, UserRole.ACCOUNTANT_AR, UserRole.CFO)
  @ApiOperation({
    summary: 'Find netting opportunities',
    description: 'Finds counterparties with both AR and AP balances that can be netted.',
  })
  @ApiResponse({ status: 200, description: 'Opportunities retrieved' })
  async findNettingOpportunities() {
    const result = await this.debtNettingService.findNettingOpportunities();
    return BaseResponse.ok(result);
  }

  @Post()
  @Roles(UserRole.CHIEF_ACCOUNTANT, UserRole.ACCOUNTANT, UserRole.CFO)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create netting request',
    description: 'Creates a netting voucher for offsetting AR and AP.',
  })
  @ApiResponse({ status: 201, description: 'Netting request created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async createNettingRequest(
    @Body() dto: CreateNettingRequestDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.debtNettingService.createNettingRequest(dto, user.id);
    return BaseResponse.ok(result, 'Netting request created');
  }

  @Patch(':id/approve')
  @Roles(UserRole.CHIEF_ACCOUNTANT, UserRole.CFO)
  @ApiOperation({
    summary: 'Approve netting request',
    description: 'CFO/Chief Accountant approves the netting request.',
  })
  @ApiParam({ name: 'id', description: 'Netting request ID' })
  @ApiResponse({ status: 200, description: 'Netting approved' })
  async approveNetting(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    const result = await this.debtNettingService.approveNetting(id, user.id);
    return BaseResponse.ok(result, 'Netting request approved');
  }

  @Post(':id/execute')
  @Roles(UserRole.CHIEF_ACCOUNTANT, UserRole.CFO)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Execute netting',
    description: 'Executes an approved netting, updating AR/AP records.',
  })
  @ApiParam({ name: 'id', description: 'Netting request ID' })
  @ApiResponse({ status: 200, description: 'Netting executed' })
  @ApiResponse({ status: 400, description: 'Netting not in APPROVED status' })
  async executeNetting(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    const result = await this.debtNettingService.executeNetting(id, user.id);
    return BaseResponse.ok(result);
  }

  @Get()
  @Roles(UserRole.CHIEF_ACCOUNTANT, UserRole.ACCOUNTANT, UserRole.ACCOUNTANT_AR, UserRole.CFO)
  @ApiOperation({
    summary: 'List netting requests',
    description: 'Returns paginated netting requests with filters.',
  })
  @ApiResponse({ status: 200, description: 'Netting requests retrieved' })
  async findAll(@Query() query: NettingQueryDto) {
    const result = await this.debtNettingService.findAll(query);
    return PaginatedResponse.paginate(result.data, result.total, result.page, result.limit);
  }

  @Get('history/:counterpartyId')
  @Roles(UserRole.CHIEF_ACCOUNTANT, UserRole.ACCOUNTANT_AR, UserRole.CFO)
  @ApiOperation({
    summary: 'Get netting history for counterparty',
    description: 'Returns all netting requests for a specific counterparty.',
  })
  @ApiParam({ name: 'counterpartyId', description: 'Counterparty ID' })
  @ApiResponse({ status: 200, description: 'Netting history retrieved' })
  async getNettingHistory(@Param('counterpartyId') counterpartyId: string) {
    const result = await this.debtNettingService.getNettingHistory(counterpartyId);
    return BaseResponse.ok(result);
  }
}
