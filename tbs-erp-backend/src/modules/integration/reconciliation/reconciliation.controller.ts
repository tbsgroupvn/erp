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
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { BaseResponse } from '@common/dto/base-response.dto';
import { ReconciliationService } from './reconciliation.service';
import { ImportBankStatementDto } from './dto/import-bank-statement.dto';
import { ResolveItemDto } from './dto/resolve-item.dto';
import { ReconType } from '@prisma/client';

@ApiTags('Reconciliation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reconciliation')
export class ReconciliationController {
  constructor(private readonly reconciliationService: ReconciliationService) {}

  @Post('financial')
  @Roles('CEO', 'CFO', 'CHIEF_ACCOUNTANT', 'ACCOUNTANT' as any)
  @ApiOperation({
    summary: 'Run financial reconciliation',
    description:
      'Compares ERP payment vouchers against imported bank statements for a given period. ' +
      'Scope format: YYYY-MM (e.g., 2026-02).',
  })
  @ApiQuery({ name: 'scope', description: 'Period scope (YYYY-MM)', example: '2026-02' })
  async runFinancialRecon(
    @Query('scope') scope: string,
    @CurrentUser('id') userId: string,
  ) {
    const result = await this.reconciliationService.runFinancialRecon(scope, userId);
    return BaseResponse.ok(result, 'Financial reconciliation completed');
  }

  @Post('inventory')
  @Roles('CEO', 'COO', 'WAREHOUSE_MANAGER', 'WAREHOUSE_VN_MANAGER' as any)
  @ApiOperation({
    summary: 'Run inventory reconciliation',
    description:
      'Compares ERP package records against physical warehouse counts.',
  })
  @ApiQuery({ name: 'warehouseId', description: 'Warehouse ID to reconcile' })
  async runInventoryRecon(
    @Query('warehouseId') warehouseId: string,
    @CurrentUser('id') userId: string,
  ) {
    const result = await this.reconciliationService.runInventoryRecon(warehouseId, userId);
    return BaseResponse.ok(result, 'Inventory reconciliation completed');
  }

  @Post('bank-import')
  @Roles('CEO', 'CFO', 'CHIEF_ACCOUNTANT', 'ACCOUNTANT' as any)
  @ApiOperation({
    summary: 'Import bank statement transactions',
    description:
      'Imports bank transaction data for reconciliation. ' +
      'Duplicate transactions (same reference + date) are skipped automatically.',
  })
  async importBankStatements(
    @Body() dto: ImportBankStatementDto,
    @CurrentUser('id') userId: string,
  ) {
    const result = await this.reconciliationService.importBankStatements(
      dto.transactions,
      userId,
    );
    return BaseResponse.ok(result, `Imported ${result.imported} bank transactions`);
  }

  @Get('runs')
  @Roles('CEO', 'CFO', 'COO', 'CHIEF_ACCOUNTANT', 'ACCOUNTANT' as any)
  @ApiOperation({
    summary: 'List reconciliation runs',
    description: 'Returns paginated list of reconciliation runs.',
  })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  @ApiQuery({ name: 'type', required: false, enum: ['FINANCIAL', 'INVENTORY', 'ORDER', 'PAYMENT'] })
  async listRuns(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('type') type?: ReconType,
  ) {
    const result = await this.reconciliationService.listRuns(
      skip ? parseInt(skip, 10) : 0,
      take ? parseInt(take, 10) : 20,
      type,
    );
    return BaseResponse.ok(result);
  }

  @Get('runs/:id')
  @Roles('CEO', 'CFO', 'COO', 'CHIEF_ACCOUNTANT', 'ACCOUNTANT' as any)
  @ApiOperation({
    summary: 'Get reconciliation run details',
    description: 'Returns a reconciliation run with its matched/discrepancy items.',
  })
  @ApiParam({ name: 'id', description: 'Reconciliation run ID' })
  async getRunDetails(@Param('id') id: string) {
    const result = await this.reconciliationService.getRunDetails(id);
    return BaseResponse.ok(result);
  }

  @Patch('items/:id/resolve')
  @Roles('CEO', 'CFO', 'CHIEF_ACCOUNTANT', 'ACCOUNTANT' as any)
  @ApiOperation({
    summary: 'Resolve a reconciliation discrepancy',
    description: 'Manually resolve a reconciliation item with a resolution type and optional note.',
  })
  @ApiParam({ name: 'id', description: 'Reconciliation item ID' })
  async resolveItem(
    @Param('id') id: string,
    @Body() dto: ResolveItemDto,
    @CurrentUser('id') userId: string,
  ) {
    const result = await this.reconciliationService.resolveItem(
      id,
      dto.resolution,
      userId,
      dto.note,
    );
    return BaseResponse.ok(result, 'Reconciliation item resolved');
  }
}
