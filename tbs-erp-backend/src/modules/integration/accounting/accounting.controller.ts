import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { BaseResponse } from '@common/dto/base-response.dto';
import { DateRangeDto } from '@common/dto/date-range.dto';
import { AccountingService } from './accounting.service';
import { FinancialStatementDto } from './dto/financial-statement.dto';
import { SyncChartOfAccountsDto } from './dto/sync-coa.dto';

@ApiTags('Integration - Accounting (MISA/Fast)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('integrations/accounting')
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  @Post('export/misa')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 exports per minute
  @Roles('CEO', 'CFO', 'ACCOUNTANT' as any)
  @ApiOperation({
    summary: 'Export journal entries to MISA format',
    description:
      'Exports general ledger journal entries for a date range in MISA-compatible format.',
  })
  async exportToMisa(
    @Body() dateRange: DateRangeDto,
    @CurrentUser('id') userId: string,
  ) {
    const result = await this.accountingService.exportToMisa(dateRange);
    return BaseResponse.ok(result, 'Exported to MISA format successfully');
  }

  @Post('export/fast')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 exports per minute
  @Roles('CEO', 'CFO', 'ACCOUNTANT' as any)
  @ApiOperation({
    summary: 'Export journal entries to Fast Accounting format',
    description:
      'Exports general ledger journal entries for a date range in Fast Accounting-compatible format.',
  })
  async exportToFast(
    @Body() dateRange: DateRangeDto,
    @CurrentUser('id') userId: string,
  ) {
    const result = await this.accountingService.exportToFastAccounting(dateRange);
    return BaseResponse.ok(result, 'Exported to Fast Accounting format successfully');
  }

  @Post('sync-coa')
  @Roles('CEO', 'CFO', 'ACCOUNTANT' as any)
  @ApiOperation({
    summary: 'Synchronize chart of accounts with accounting provider',
    description:
      'Pulls the chart of accounts from MISA or Fast Accounting and updates internal mappings.',
  })
  async syncChartOfAccounts(
    @Body() dto: SyncChartOfAccountsDto,
    @CurrentUser('id') userId: string,
  ) {
    const result = await this.accountingService.syncChartOfAccounts(dto.provider);
    return BaseResponse.ok(result, `Chart of accounts synced with ${dto.provider}`);
  }

  @Post('financial-statements')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 exports per minute
  @Roles('CEO', 'CFO', 'ACCOUNTANT' as any)
  @ApiOperation({
    summary: 'Export financial statements',
    description:
      'Generates financial statements (Balance Sheet, Income Statement, etc.) ' +
      'following Vietnamese Accounting Standards (VAS).',
  })
  async exportFinancialStatements(
    @Body() dto: FinancialStatementDto,
    @CurrentUser('id') userId: string,
  ) {
    const buffer = await this.accountingService.exportFinancialStatements(dto);
    return BaseResponse.ok(
      { message: 'Financial statement generated', size: buffer.length },
      'Financial statement exported successfully',
    );
  }

  @Post('import-bank-statements')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 imports per minute
  @Roles('CEO', 'CFO', 'ACCOUNTANT' as any)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Import bank statements from file',
    description:
      'Imports bank transaction data from a CSV, Excel, or MT940 file for reconciliation.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'Bank statement file' },
        bankCode: { type: 'string', description: 'Bank code (e.g., VCB, TCB, BIDV)', example: 'VCB' },
      },
      required: ['file', 'bankCode'],
    },
  })
  async importBankStatements(
    @UploadedFile() file: Express.Multer.File,
    @Body('bankCode') bankCode: string,
    @CurrentUser('id') userId: string,
  ) {
    const result = await this.accountingService.importBankStatements(file, bankCode);
    return BaseResponse.ok(result, 'Bank statements imported successfully');
  }
}
