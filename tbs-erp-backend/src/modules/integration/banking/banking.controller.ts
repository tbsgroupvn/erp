import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { BaseResponse } from '@common/dto/base-response.dto';
import { BankingService } from './banking.service';
import { BankReconciliationService } from './bank-reconciliation.service';
import { BankTransactionQueryDto } from './dto/bank-transaction-query.dto';
import { BankTransferDto } from './dto/bank-transfer.dto';
import { BankReconcileDto } from './dto/bank-reconcile.dto';
import { ManualMatchDto } from './dto/manual-match.dto';

// Roles co quyen doi chieu
const RECONCILE_ROLES = [
  UserRole.CEO,
  UserRole.CFO,
  UserRole.CHIEF_ACCOUNTANT,
  UserRole.ACCOUNTANT,
  UserRole.ACCOUNTANT_AR,
] as const;

@ApiTags('Integration - Banking')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('integrations/banking')
export class BankingController {
  constructor(
    private readonly bankingService: BankingService,
    private readonly bankReconciliationService: BankReconciliationService,
  ) {}

  @Get('balance/:accountId')
  @Roles(UserRole.CEO, UserRole.CFO, UserRole.ACCOUNTANT, UserRole.CHIEF_ACCOUNTANT, UserRole.ACCOUNTANT_AR)
  @ApiOperation({
    summary: 'Get bank account balance',
    description: 'Retrieves the current available and ledger balance for a bank account.',
  })
  @ApiParam({ name: 'accountId', description: 'Bank account ID or number' })
  async getBalance(@Param('accountId') accountId: string) {
    const result = await this.bankingService.getBalance(accountId);
    return BaseResponse.ok(result);
  }

  @Get('transactions')
  @Roles(UserRole.CEO, UserRole.CFO, UserRole.ACCOUNTANT, UserRole.CHIEF_ACCOUNTANT, UserRole.ACCOUNTANT_AR)
  @ApiOperation({
    summary: 'Get bank transaction history',
    description: 'Retrieves paginated transaction history for a bank account within a date range.',
  })
  async getTransactions(@Query() query: BankTransactionQueryDto) {
    const result = await this.bankingService.getTransactions(query);
    return BaseResponse.ok(result);
  }

  @Post('reconcile')
  @Roles(UserRole.CEO, UserRole.CFO, UserRole.ACCOUNTANT, UserRole.CHIEF_ACCOUNTANT, UserRole.ACCOUNTANT_AR)
  @ApiOperation({
    summary: 'Reconcile bank payments automatically',
    description:
      'Matches bank transactions to ERP payment records (vouchers, invoices, orders) ' +
      'using reference numbers, amounts, and dates.',
  })
  async reconcilePayments(@Body() dto: BankReconcileDto, @CurrentUser('id') _userId: string) {
    const result = await this.bankingService.reconcilePayments(dto);
    return BaseResponse.ok(result, 'Payment reconciliation completed');
  }

  @Post('transfer')
  @Roles(UserRole.CEO, UserRole.CFO, UserRole.CHIEF_ACCOUNTANT)
  @ApiOperation({
    summary: 'Initiate a bank transfer',
    description:
      'Initiates a bank transfer (internal, domestic via Napas, or international via SWIFT).',
  })
  async initiateTransfer(@Body() dto: BankTransferDto, @CurrentUser('id') _userId: string) {
    const result = await this.bankingService.initiateTransfer(dto);
    return BaseResponse.ok(result, 'Bank transfer initiated');
  }

  @Get('supported-banks')
  @Roles(UserRole.CEO, UserRole.CFO, UserRole.ACCOUNTANT, UserRole.CHIEF_ACCOUNTANT, UserRole.COO)
  @ApiOperation({
    summary: 'Get list of supported banks',
    description: 'Returns the list of banks with available API integrations and their features.',
  })
  async getSupportedBanks() {
    const result = await this.bankingService.getSupportedBanks();
    return BaseResponse.ok(result);
  }

  // ----------------------------------------------------------------
  // BANK RECONCILIATION DASHBOARD
  // ----------------------------------------------------------------

  @Get('reconciliation/summary')
  @Roles(...RECONCILE_ROLES)
  @ApiOperation({
    summary: 'Dashboard doi chieu ngan hang',
    description:
      'Tra ve tong quan doi chieu: so giao dich theo trang thai (pending/auto_credited/manual_matched/failed), ' +
      'tong tien chua xu ly, tong tien da xu ly, va danh sach 20 giao dich moi nhat chua match ' +
      '(PENDING + FAILED) de ke toan xu ly thu cong.',
  })
  @ApiResponse({ status: 200, description: 'Reconciliation dashboard data tra ve thanh cong' })
  async getReconciliationSummary() {
    const result = await this.bankReconciliationService.getSummary();
    return BaseResponse.ok(result, 'Doi chieu ngan hang');
  }

  @Post('reconciliation/manual-match')
  @Roles(...RECONCILE_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Doi chieu thu cong giao dich ngan hang',
    description:
      'Ke toan doi chieu thu cong giao dich chua parse duoc tu dong. ' +
      'Flow: Xac nhan KH -> Lien ket cong no (tuy chon) -> Cap nhat trang thai MANUAL_MATCHED -> ' +
      'Nap vi KH (neu khong lien ket cong no). ' +
      'Chi ap dung cho giao dich PENDING hoac FAILED.',
  })
  @ApiResponse({ status: 200, description: 'Doi chieu thu cong thanh cong' })
  @ApiResponse({ status: 400, description: 'Tham so sai hoac so tien khong hop le' })
  @ApiResponse({ status: 404, description: 'Giao dich hoac khach hang khong tim thay' })
  @ApiResponse({ status: 409, description: 'Giao dich da duoc xu ly truoc do' })
  async manualMatch(
    @Body() dto: ManualMatchDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.bankReconciliationService.manualMatch(dto, user.id);
    return BaseResponse.ok(result, 'Doi chieu thu cong thanh cong');
  }
}
