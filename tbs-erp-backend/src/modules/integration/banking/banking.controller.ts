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
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { BaseResponse } from '@common/dto/base-response.dto';
import { BankingService } from './banking.service';
import { BankTransactionQueryDto } from './dto/bank-transaction-query.dto';
import { BankTransferDto } from './dto/bank-transfer.dto';
import { BankReconcileDto } from './dto/bank-reconcile.dto';

@ApiTags('Integration - Banking')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('integrations/banking')
export class BankingController {
  constructor(private readonly bankingService: BankingService) {}

  @Get('balance/:accountId')
  @Roles('CEO', 'CFO', 'ACCOUNTANT' as any)
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
  @Roles('CEO', 'CFO', 'ACCOUNTANT' as any)
  @ApiOperation({
    summary: 'Get bank transaction history',
    description: 'Retrieves paginated transaction history for a bank account within a date range.',
  })
  async getTransactions(@Query() query: BankTransactionQueryDto) {
    const result = await this.bankingService.getTransactions(query);
    return BaseResponse.ok(result);
  }

  @Post('reconcile')
  @Roles('CEO', 'CFO', 'ACCOUNTANT' as any)
  @ApiOperation({
    summary: 'Reconcile bank payments automatically',
    description:
      'Matches bank transactions to ERP payment records (vouchers, invoices, orders) ' +
      'using reference numbers, amounts, and dates.',
  })
  async reconcilePayments(
    @Body() dto: BankReconcileDto,
    @CurrentUser('id') userId: string,
  ) {
    const result = await this.bankingService.reconcilePayments(dto);
    return BaseResponse.ok(result, 'Payment reconciliation completed');
  }

  @Post('transfer')
  @Roles('CEO', 'CFO' as any)
  @ApiOperation({
    summary: 'Initiate a bank transfer',
    description:
      'Initiates a bank transfer (internal, domestic via Napas, or international via SWIFT).',
  })
  async initiateTransfer(
    @Body() dto: BankTransferDto,
    @CurrentUser('id') userId: string,
  ) {
    const result = await this.bankingService.initiateTransfer(dto);
    return BaseResponse.ok(result, 'Bank transfer initiated');
  }

  @Get('supported-banks')
  @Roles('CEO', 'CFO', 'ACCOUNTANT', 'COO' as any)
  @ApiOperation({
    summary: 'Get list of supported banks',
    description: 'Returns the list of banks with available API integrations and their features.',
  })
  async getSupportedBanks() {
    const result = await this.bankingService.getSupportedBanks();
    return BaseResponse.ok(result);
  }
}
