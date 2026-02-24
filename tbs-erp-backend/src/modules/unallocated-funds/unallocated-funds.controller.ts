import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
import { UserRole } from '@prisma/client';
import { UnallocatedFundsService } from './unallocated-funds.service';
import { CreateClaimDto } from './dto/create-claim.dto';

@ApiTags('Finance - Unallocated Funds')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('unallocated-funds')
export class UnallocatedFundsController {
  constructor(
    private readonly unallocatedFundsService: UnallocatedFundsService,
  ) {}

  @Get('transactions')
  @ApiOperation({
    summary: 'List unallocated transactions',
    description: 'Returns wallet transactions that have not been allocated to any order or contract.',
  })
  @Roles(
    UserRole.CFO,
    UserRole.CHIEF_ACCOUNTANT,
    UserRole.ACCOUNTANT_AR,
    UserRole.ACCOUNTANT,
    UserRole.COO,
    UserRole.CEO,
  )
  async listUnallocatedTransactions() {
    const transactions = await this.unallocatedFundsService.listUnallocatedTransactions();
    return BaseResponse.ok(transactions);
  }

  @Post('claim')
  @ApiOperation({
    summary: 'Create a claim on unallocated funds',
    description: 'A sale representative claims that an unallocated wallet transaction belongs to a specific customer.',
  })
  async createClaim(
    @Body() dto: CreateClaimDto,
    @CurrentUser('id') userId: string,
  ) {
    const claim = await this.unallocatedFundsService.createClaim(dto, userId);
    return BaseResponse.ok(claim, 'Claim created successfully');
  }

  @Get('claims')
  @ApiOperation({
    summary: 'List claims',
    description: 'Returns all unallocated fund claims, optionally filtered by status.',
  })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status (PENDING, APPROVED, REJECTED)' })
  @Roles(
    UserRole.CFO,
    UserRole.CHIEF_ACCOUNTANT,
    UserRole.ACCOUNTANT_AR,
    UserRole.ACCOUNTANT,
    UserRole.COO,
    UserRole.CEO,
    UserRole.SALES_DIRECTOR,
    UserRole.SALES_LEADER,
    UserRole.SALE,
  )
  async listClaims(@Query('status') status?: string) {
    const claims = await this.unallocatedFundsService.listClaims(status);
    return BaseResponse.ok(claims);
  }

  @Patch('claims/:id/approve')
  @ApiOperation({
    summary: 'Approve a claim',
    description: 'Approves a pending claim and moves funds from the intermediate account to the target order/contract.',
  })
  @ApiParam({ name: 'id', description: 'Claim ID' })
  @Roles(
    UserRole.CFO,
    UserRole.CHIEF_ACCOUNTANT,
    UserRole.ACCOUNTANT_AR,
    UserRole.COO,
    UserRole.CEO,
  )
  async approveClaim(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    const claim = await this.unallocatedFundsService.approveClaim(id, userId);
    return BaseResponse.ok(claim, 'Claim approved successfully');
  }
}
