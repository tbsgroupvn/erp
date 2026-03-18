import { Injectable, Logger, BadRequestException, HttpStatus } from '@nestjs/common';
import { DomainException } from '@common/exceptions';
import { ErrorCode } from '@common/exceptions';
import { ConfigService } from '@nestjs/config';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '@core/database/prisma.service';
import { CircuitBreaker } from '@common/utils/circuit-breaker.util';
import {
  getIntegrationTimeout,
  IntegrationTimeoutConfig,
} from '@config/integration-timeout.config';
import { DateRangeDto } from '@common/dto/date-range.dto';
import { FinancialStatementDto, StatementType } from './dto/financial-statement.dto';
import {
  MisaExportResult,
  FastExportResult,
  SyncResult,
  ImportResult,
} from './interfaces/accounting.interfaces';

/** Supported accounting software backends. */
type AccountingProvider = 'MISA' | 'FAST' | 'GENERIC';

/** Configuration for one accounting provider. */
interface ProviderConfig {
  apiUrl: string;
  apiKey: string;
}

/**
 * Service for integrating with Vietnamese accounting software (MISA and Fast Accounting).
 *
 * Implements a configurable adapter pattern supporting multiple accounting backends.
 * Each external call is protected by a circuit breaker and configurable timeout.
 * All operations are logged to the sync_logs table for auditability.
 */
@Injectable()
export class AccountingService {
  private readonly logger = new Logger(AccountingService.name);
  private readonly enabled: boolean;
  private readonly timeoutConfig: IntegrationTimeoutConfig;
  private readonly circuitBreaker: CircuitBreaker;

  /** Provider configs keyed by provider name. */
  private readonly providers: Record<string, ProviderConfig>;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.enabled = this.configService.get<boolean>('integrations.accounting.enabled', false);
    this.timeoutConfig = getIntegrationTimeout('ACCOUNTING');

    this.providers = {
      MISA: {
        apiUrl: this.configService.get<string>('integrations.accounting.misaApiUrl', ''),
        apiKey: this.configService.get<string>('integrations.accounting.misaApiKey', ''),
      },
      FAST: {
        apiUrl: this.configService.get<string>('integrations.accounting.fastApiUrl', ''),
        apiKey: this.configService.get<string>('integrations.accounting.fastApiKey', ''),
      },
      GENERIC: {
        apiUrl: this.configService.get<string>('ACCOUNTING_API_URL', ''),
        apiKey: this.configService.get<string>('ACCOUNTING_API_KEY', ''),
      },
    };

    this.circuitBreaker = new CircuitBreaker({
      name: 'accounting',
      failureThreshold: this.timeoutConfig.circuitBreakerThreshold,
      resetTimeoutMs: this.timeoutConfig.circuitBreakerResetMs,
    });
  }

  // ─────────────────────────────────────────────
  // PUBLIC METHODS
  // ─────────────────────────────────────────────

  /**
   * Export journal entries to MISA accounting format.
   * Fetches posted journal entries for the date range, transforms them
   * into MISA-compatible JSON, pushes each entry via the external API,
   * and logs every operation to sync_logs.
   */
  async exportToMisa(dateRange: DateRangeDto): Promise<MisaExportResult> {
    this.logger.log(
      `Exporting to MISA: startDate=${dateRange.startDate}, endDate=${dateRange.endDate}`,
    );
    this.ensureEnabled('MISA');

    const { startDate, endDate } = this.parseDateRange(dateRange);

    const entries = await this.prisma.journalEntry.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
        isPosted: true,
      },
      include: { lines: { include: { account: true } } },
      orderBy: { date: 'asc' },
    });

    let totalDebit = new Decimal(0);
    let totalCredit = new Decimal(0);
    const unmappedEntries: MisaExportResult['unmappedEntries'] = [];
    let exportedCount = 0;

    for (const entry of entries) {
      try {
        // Validate: every line must have a valid account
        const unmappedLines = entry.lines.filter((l) => !l.account);
        if (unmappedLines.length > 0) {
          unmappedEntries.push({
            entryId: entry.id,
            reason: `${unmappedLines.length} line(s) have unmapped account codes`,
          });
          continue;
        }

        const payload = this.transformForMisa(entry);
        await this.pushToProvider('MISA', 'journal_entry', payload, entry.id);
        exportedCount++;

        for (const line of entry.lines) {
          totalDebit = totalDebit.add(line.debit);
          totalCredit = totalCredit.add(line.credit);
        }
      } catch (error) {
        unmappedEntries.push({
          entryId: entry.id,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      totalEntries: exportedCount,
      totalDebit: totalDebit.toNumber(),
      totalCredit: totalCredit.toNumber(),
      dateRange: {
        from: dateRange.startDate || '',
        to: dateRange.endDate || '',
      },
      exportFormat: 'JSON',
      unmappedEntries,
      exportedAt: new Date(),
    };
  }

  /**
   * Export journal entries to Fast Accounting format.
   * Similar flow to MISA but transforms data into Fast-compatible CSV structure.
   */
  async exportToFastAccounting(dateRange: DateRangeDto): Promise<FastExportResult> {
    this.logger.log(
      `Exporting to Fast Accounting: startDate=${dateRange.startDate}, endDate=${dateRange.endDate}`,
    );
    this.ensureEnabled('FAST');

    const { startDate, endDate } = this.parseDateRange(dateRange);

    const entries = await this.prisma.journalEntry.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
        isPosted: true,
      },
      include: { lines: { include: { account: true } } },
      orderBy: { date: 'asc' },
    });

    let totalDebit = new Decimal(0);
    let totalCredit = new Decimal(0);
    const unmappedEntries: FastExportResult['unmappedEntries'] = [];
    let exportedCount = 0;

    for (const entry of entries) {
      try {
        const unmappedLines = entry.lines.filter((l) => !l.account);
        if (unmappedLines.length > 0) {
          unmappedEntries.push({
            entryId: entry.id,
            reason: `${unmappedLines.length} line(s) have unmapped account codes`,
          });
          continue;
        }

        const payload = this.transformForFast(entry);
        await this.pushToProvider('FAST', 'journal_entry', payload, entry.id);
        exportedCount++;

        for (const line of entry.lines) {
          totalDebit = totalDebit.add(line.debit);
          totalCredit = totalCredit.add(line.credit);
        }
      } catch (error) {
        unmappedEntries.push({
          entryId: entry.id,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      totalEntries: exportedCount,
      totalDebit: totalDebit.toNumber(),
      totalCredit: totalCredit.toNumber(),
      dateRange: {
        from: dateRange.startDate || '',
        to: dateRange.endDate || '',
      },
      exportFormat: 'CSV',
      unmappedEntries,
      exportedAt: new Date(),
    };
  }

  /**
   * Synchronize chart of accounts between the ERP and an external accounting provider.
   * Pulls the remote chart of accounts, diffs it against the local ChartOfAccount table,
   * creates new accounts, and updates changed ones.
   */
  async syncChartOfAccounts(provider: 'MISA' | 'FAST'): Promise<SyncResult> {
    this.logger.log(`Syncing chart of accounts with provider: ${provider}`);
    this.ensureEnabled(provider);

    const providerKey = provider as AccountingProvider;
    let newAccounts = 0;
    let updatedAccounts = 0;
    let failedAccounts = 0;
    const failures: SyncResult['failures'] = [];

    // Fetch remote chart of accounts
    let remoteAccounts: Array<{
      code: string;
      name: string;
      type: string;
      parentCode?: string;
      level?: number;
    }> = [];

    try {
      remoteAccounts = await this.fetchFromProvider(providerKey, 'chart_of_accounts', {});
    } catch (error) {
      this.logger.error(`Failed to fetch chart of accounts from ${provider}: ${error}`);
      return {
        provider,
        totalSynced: 0,
        newAccounts: 0,
        updatedAccounts: 0,
        failedAccounts: 1,
        failures: [
          {
            accountCode: '*',
            reason: `Failed to fetch from ${provider}: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        syncedAt: new Date(),
      };
    }

    for (const remote of remoteAccounts) {
      try {
        const existing = await this.prisma.chartOfAccount.findUnique({
          where: { code: remote.code },
        });

        const accountType = this.mapAccountType(remote.type);

        if (!existing) {
          await this.prisma.chartOfAccount.create({
            data: {
              code: remote.code,
              name: remote.name,
              type: accountType,
              parentCode: remote.parentCode || null,
              level: remote.level ?? 1,
              isActive: true,
            },
          });
          newAccounts++;
        } else if (existing.name !== remote.name || existing.type !== accountType) {
          await this.prisma.chartOfAccount.update({
            where: { code: remote.code },
            data: {
              name: remote.name,
              type: accountType,
            },
          });
          updatedAccounts++;
        }
      } catch (error) {
        failedAccounts++;
        failures.push({
          accountCode: remote.code,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Log the sync operation
    await this.logSyncOperation(
      `coa_sync:${provider}:${Date.now()}`,
      provider,
      'chart_of_accounts',
      'sync',
      'sync',
      newAccounts + updatedAccounts > 0 ? 'SUCCESS' : 'FAILED',
      { newAccounts, updatedAccounts, failedAccounts },
      failedAccounts > 0 ? `${failedAccounts} account(s) failed to sync` : undefined,
    );

    return {
      provider,
      totalSynced: newAccounts + updatedAccounts,
      newAccounts,
      updatedAccounts,
      failedAccounts,
      failures,
      syncedAt: new Date(),
    };
  }

  /**
   * Export financial statements (Balance Sheet, Income Statement, Cash Flow, etc.)
   * in a format compatible with Vietnamese accounting standards (VAS).
   *
   * Generates a CSV buffer by aggregating journal entry lines for the period.
   */
  async exportFinancialStatements(dto: FinancialStatementDto): Promise<Buffer> {
    this.logger.log(
      `Exporting financial statement: type=${dto.statementType}, ` +
        `period=${dto.startDate} to ${dto.endDate}, format=${dto.format}`,
    );
    this.ensureEnabled('GENERIC');

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    endDate.setHours(23, 59, 59, 999);

    // Fetch all posted journal entry lines for the period with account info
    const lines = await this.prisma.journalEntryLine.findMany({
      where: {
        entry: {
          date: { gte: startDate, lte: endDate },
          isPosted: true,
        },
      },
      include: {
        account: true,
        entry: true,
      },
      orderBy: { entry: { date: 'asc' } },
    });

    let csvContent: string;

    switch (dto.statementType) {
      case StatementType.TRIAL_BALANCE:
        csvContent = this.generateTrialBalanceCsv(lines, dto);
        break;
      case StatementType.GENERAL_LEDGER:
        csvContent = this.generateGeneralLedgerCsv(lines, dto);
        break;
      case StatementType.BALANCE_SHEET:
        csvContent = this.generateBalanceSheetCsv(lines, dto);
        break;
      case StatementType.INCOME_STATEMENT:
        csvContent = this.generateIncomeStatementCsv(lines, dto);
        break;
      case StatementType.CASH_FLOW:
        csvContent = this.generateCashFlowCsv(lines, dto);
        break;
      default:
        csvContent = this.generateTrialBalanceCsv(lines, dto);
    }

    // Log the export
    await this.logSyncOperation(
      `financial_statement:${dto.statementType}:${Date.now()}`,
      'ACCOUNTING',
      'financial_statement',
      dto.statementType,
      'export',
      'SUCCESS',
      {
        statementType: dto.statementType,
        startDate: dto.startDate,
        endDate: dto.endDate,
        lineCount: lines.length,
      },
    );

    return Buffer.from(csvContent, 'utf-8');
  }

  /**
   * Import bank statements from a file (CSV format supported).
   * Parses the file content and creates CashTransaction records,
   * checking for duplicates via idempotency keys in sync_logs.
   */
  async importBankStatements(file: Express.Multer.File, bankCode: string): Promise<ImportResult> {
    this.logger.log(
      `Importing bank statements: bankCode=${bankCode}, ` +
        `fileName=${file.originalname}, size=${file.size} bytes`,
    );
    this.ensureEnabled('GENERIC');

    const content = file.buffer.toString('utf-8');
    const rows = this.parseBankStatementCsv(content);

    let newTransactions = 0;
    let duplicateTransactions = 0;
    let failedTransactions = 0;
    let totalCredit = new Decimal(0);
    let totalDebit = new Decimal(0);
    const failures: ImportResult['failures'] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const lineNum = i + 2; // +2 because header is line 1 and i is 0-based

      try {
        const idempotencyKey = `bank_import:${bankCode}:${row.reference || row.date + ':' + row.amount}`;

        // Check for duplicate
        const existing = await this.prisma.syncLog.findUnique({
          where: { idempotencyKey },
        });

        if (existing) {
          duplicateTransactions++;
          continue;
        }

        // Create cash transaction
        const amount = new Decimal(row.amount);
        const isCredit = amount.greaterThan(0);

        await this.prisma.cashTransaction.create({
          data: {
            type: isCredit ? 'IN' : 'OUT',
            amount: amount.abs(),
            currency: 'VND',
            paymentMethod: 'BANK_TRANSFER',
            reference: `${bankCode}:${row.reference || ''}`,
            note: `Bank import - ${row.description || ''} [${file.originalname}]`,
            createdBy: 'SYSTEM_IMPORT',
          },
        });

        if (isCredit) {
          totalCredit = totalCredit.add(amount);
        } else {
          totalDebit = totalDebit.add(amount.abs());
        }

        // Log successful import
        await this.logSyncOperation(
          idempotencyKey,
          bankCode,
          'bank_transaction',
          row.reference || `line_${lineNum}`,
          'import',
          'SUCCESS',
          row,
        );

        newTransactions++;
      } catch (error) {
        failedTransactions++;
        failures.push({
          line: lineNum,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      bankCode,
      totalTransactions: rows.length,
      newTransactions,
      duplicateTransactions,
      failedTransactions,
      failures,
      totalCredit: totalCredit.toNumber(),
      totalDebit: totalDebit.toNumber(),
      importedAt: new Date(),
    };
  }

  // ─────────────────────────────────────────────
  // PRIVATE — External API Communication
  // ─────────────────────────────────────────────

  /**
   * Push data to an accounting provider via HTTP.
   * Protected by circuit breaker and timeout.
   */
  private async pushToProvider(
    provider: AccountingProvider,
    entityType: string,
    data: any,
    entityId: string,
  ): Promise<any> {
    const config = this.providers[provider];
    if (!config?.apiUrl) {
      this.logger.warn(
        `${provider} API URL not configured. Logging export locally without external push.`,
      );
      // Log locally even when no external API is configured
      await this.logSyncOperation(
        `accounting:${provider}:${entityType}:${entityId}:${Date.now()}`,
        provider,
        entityType,
        entityId,
        'export',
        'SUCCESS',
        data,
        undefined,
      );
      return null;
    }

    return this.circuitBreaker.execute(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.timeoutConfig.totalTimeoutMs,
      );

      try {
        const response = await fetch(`${config.apiUrl}/api/v1/${entityType}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`,
            'X-ERP-Source': 'TBS-ERP',
            'X-Provider': provider,
          },
          body: JSON.stringify(data),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorBody = await response.text().catch(() => 'Unknown error');
          throw new DomainException(
            ErrorCode.INTEGRATION_SYNC_ERROR,
            `${provider} API returned ${response.status}: ${errorBody.substring(0, 200)}`,
            HttpStatus.BAD_GATEWAY,
          );
        }

        // Log success
        await this.logSyncOperation(
          `accounting:${provider}:${entityType}:${entityId}:${Date.now()}`,
          provider,
          entityType,
          entityId,
          'export',
          'SUCCESS',
          data,
        );

        return response.json().catch(() => null);
      } catch (error) {
        clearTimeout(timeoutId);

        // Log failure
        await this.logSyncOperation(
          `accounting:${provider}:${entityType}:${entityId}:${Date.now()}`,
          provider,
          entityType,
          entityId,
          'export',
          'FAILED',
          data,
          error instanceof Error ? error.message : String(error),
        );

        throw error;
      }
    });
  }

  /**
   * Fetch data from an accounting provider via HTTP GET.
   * Protected by circuit breaker and timeout.
   */
  private async fetchFromProvider(
    provider: AccountingProvider,
    endpoint: string,
    params: Record<string, string>,
  ): Promise<any[]> {
    const config = this.providers[provider];
    if (!config?.apiUrl) {
      this.logger.warn(
        `${provider} API URL not configured. Returning empty dataset.`,
      );
      return [];
    }

    return this.circuitBreaker.execute(async () => {
      const url = new URL(`${config.apiUrl}/api/v1/${endpoint}`);
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.timeoutConfig.totalTimeoutMs,
      );

      try {
        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`,
            'X-ERP-Source': 'TBS-ERP',
            'X-Provider': provider,
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorBody = await response.text().catch(() => 'Unknown error');
          throw new DomainException(
            ErrorCode.INTEGRATION_SYNC_ERROR,
            `${provider} API returned ${response.status}: ${errorBody.substring(0, 200)}`,
            HttpStatus.BAD_GATEWAY,
          );
        }

        const result = await response.json();
        return Array.isArray(result) ? result : result?.data ?? [];
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    });
  }

  // ─────────────────────────────────────────────
  // PRIVATE — Data Transformation
  // ─────────────────────────────────────────────

  /**
   * Transform a journal entry into MISA-compatible format.
   * MISA expects entries with Vietnamese field naming conventions.
   */
  private transformForMisa(entry: any): any {
    return {
      ma_chung_tu: entry.code,
      ngay_chung_tu: entry.date.toISOString().split('T')[0],
      dien_giai: entry.description,
      so_tham_chieu: entry.reference || '',
      nam_ky: entry.periodYear,
      thang_ky: entry.periodMonth,
      chi_tiet: entry.lines.map((line: any) => ({
        ma_tai_khoan: line.accountCode,
        ten_tai_khoan: line.account?.name || '',
        loai_tai_khoan: line.account?.type || '',
        no: Number(line.debit),
        co: Number(line.credit),
        dien_giai_dong: line.description || '',
      })),
    };
  }

  /**
   * Transform a journal entry into Fast Accounting-compatible format.
   * Fast uses a flatter CSV-oriented structure.
   */
  private transformForFast(entry: any): any {
    return {
      voucher_code: entry.code,
      voucher_date: entry.date.toISOString().split('T')[0],
      description: entry.description,
      reference: entry.reference || '',
      period_year: entry.periodYear,
      period_month: entry.periodMonth,
      lines: entry.lines.map((line: any) => ({
        account_code: line.accountCode,
        account_name: line.account?.name || '',
        account_type: line.account?.type || '',
        debit: Number(line.debit),
        credit: Number(line.credit),
        line_description: line.description || '',
      })),
    };
  }

  // ─────────────────────────────────────────────
  // PRIVATE — Financial Statement Generators
  // ─────────────────────────────────────────────

  /**
   * Generate Trial Balance CSV.
   * Aggregates debit/credit by account code.
   */
  private generateTrialBalanceCsv(lines: any[], dto: FinancialStatementDto): string {
    const accountTotals = new Map<
      string,
      { name: string; type: string; debit: Decimal; credit: Decimal }
    >();

    for (const line of lines) {
      const key = line.accountCode;
      const existing = accountTotals.get(key) || {
        name: line.account?.name || '',
        type: line.account?.type || '',
        debit: new Decimal(0),
        credit: new Decimal(0),
      };
      existing.debit = existing.debit.add(line.debit);
      existing.credit = existing.credit.add(line.credit);
      accountTotals.set(key, existing);
    }

    const header = `"BANG CAN DOI SO PHAT SINH - TRIAL BALANCE"\n"Ky: ${dto.startDate} - ${dto.endDate}"\n"Don vi tien: ${dto.currency || 'VND'}"\n\n"Ma TK","Ten tai khoan","Loai","No","Co","So du"\n`;

    let body = '';
    let grandDebit = new Decimal(0);
    let grandCredit = new Decimal(0);

    const sorted = [...accountTotals.entries()].sort((a, b) => a[0].localeCompare(b[0]));

    for (const [code, totals] of sorted) {
      const balance = totals.debit.minus(totals.credit);
      body += `"${code}","${totals.name}","${totals.type}","${totals.debit.toFixed(2)}","${totals.credit.toFixed(2)}","${balance.toFixed(2)}"\n`;
      grandDebit = grandDebit.add(totals.debit);
      grandCredit = grandCredit.add(totals.credit);
    }

    body += `\n"TONG CONG","","","${grandDebit.toFixed(2)}","${grandCredit.toFixed(2)}","${grandDebit.minus(grandCredit).toFixed(2)}"\n`;

    return header + body;
  }

  /**
   * Generate General Ledger CSV.
   * Lists all journal entry lines in chronological order.
   */
  private generateGeneralLedgerCsv(lines: any[], dto: FinancialStatementDto): string {
    const header = `"SO CAI - GENERAL LEDGER"\n"Ky: ${dto.startDate} - ${dto.endDate}"\n"Don vi tien: ${dto.currency || 'VND'}"\n\n"Ngay","Ma CT","Dien giai","Ma TK","Ten TK","No","Co"\n`;

    let body = '';
    for (const line of lines) {
      const date = line.entry?.date
        ? new Date(line.entry.date).toISOString().split('T')[0]
        : '';
      body += `"${date}","${line.entry?.code || ''}","${line.entry?.description || ''}","${line.accountCode}","${line.account?.name || ''}","${Number(line.debit).toFixed(2)}","${Number(line.credit).toFixed(2)}"\n`;
    }

    return header + body;
  }

  /**
   * Generate Balance Sheet CSV.
   * Groups accounts by type (ASSET, LIABILITY, EQUITY) and shows net balances.
   */
  private generateBalanceSheetCsv(lines: any[], dto: FinancialStatementDto): string {
    const accountTotals = new Map<
      string,
      { name: string; type: string; debit: Decimal; credit: Decimal }
    >();

    for (const line of lines) {
      const key = line.accountCode;
      const existing = accountTotals.get(key) || {
        name: line.account?.name || '',
        type: line.account?.type || '',
        debit: new Decimal(0),
        credit: new Decimal(0),
      };
      existing.debit = existing.debit.add(line.debit);
      existing.credit = existing.credit.add(line.credit);
      accountTotals.set(key, existing);
    }

    const header = `"BANG CAN DOI KE TOAN - BALANCE SHEET"\n"Ngay: ${dto.endDate}"\n"Don vi tien: ${dto.currency || 'VND'}"\n\n`;

    let body = '';
    const groups = ['ASSET', 'LIABILITY', 'EQUITY'];

    for (const group of groups) {
      body += `\n"${group}"\n"Ma TK","Ten tai khoan","So du"\n`;
      let groupTotal = new Decimal(0);

      const accounts = [...accountTotals.entries()]
        .filter(([, v]) => v.type === group)
        .sort((a, b) => a[0].localeCompare(b[0]));

      for (const [code, totals] of accounts) {
        // ASSET: debit balance; LIABILITY/EQUITY: credit balance
        const balance =
          group === 'ASSET'
            ? totals.debit.minus(totals.credit)
            : totals.credit.minus(totals.debit);
        body += `"${code}","${totals.name}","${balance.toFixed(2)}"\n`;
        groupTotal = groupTotal.add(balance);
      }
      body += `"TONG ${group}","","${groupTotal.toFixed(2)}"\n`;
    }

    return header + body;
  }

  /**
   * Generate Income Statement CSV.
   * Shows REVENUE minus EXPENSE accounts for the period.
   */
  private generateIncomeStatementCsv(lines: any[], dto: FinancialStatementDto): string {
    const accountTotals = new Map<
      string,
      { name: string; type: string; debit: Decimal; credit: Decimal }
    >();

    for (const line of lines) {
      const key = line.accountCode;
      const existing = accountTotals.get(key) || {
        name: line.account?.name || '',
        type: line.account?.type || '',
        debit: new Decimal(0),
        credit: new Decimal(0),
      };
      existing.debit = existing.debit.add(line.debit);
      existing.credit = existing.credit.add(line.credit);
      accountTotals.set(key, existing);
    }

    const header = `"BAO CAO KET QUA KINH DOANH - INCOME STATEMENT"\n"Ky: ${dto.startDate} - ${dto.endDate}"\n"Don vi tien: ${dto.currency || 'VND'}"\n\n`;

    let body = '';
    let totalRevenue = new Decimal(0);
    let totalExpense = new Decimal(0);

    // Revenue section
    body += `"DOANH THU - REVENUE"\n"Ma TK","Ten tai khoan","So tien"\n`;
    const revenueAccounts = [...accountTotals.entries()]
      .filter(([, v]) => v.type === 'REVENUE')
      .sort((a, b) => a[0].localeCompare(b[0]));

    for (const [code, totals] of revenueAccounts) {
      const amount = totals.credit.minus(totals.debit);
      body += `"${code}","${totals.name}","${amount.toFixed(2)}"\n`;
      totalRevenue = totalRevenue.add(amount);
    }
    body += `"TONG DOANH THU","","${totalRevenue.toFixed(2)}"\n\n`;

    // Expense section
    body += `"CHI PHI - EXPENSE"\n"Ma TK","Ten tai khoan","So tien"\n`;
    const expenseAccounts = [...accountTotals.entries()]
      .filter(([, v]) => v.type === 'EXPENSE')
      .sort((a, b) => a[0].localeCompare(b[0]));

    for (const [code, totals] of expenseAccounts) {
      const amount = totals.debit.minus(totals.credit);
      body += `"${code}","${totals.name}","${amount.toFixed(2)}"\n`;
      totalExpense = totalExpense.add(amount);
    }
    body += `"TONG CHI PHI","","${totalExpense.toFixed(2)}"\n\n`;

    // Net income
    const netIncome = totalRevenue.minus(totalExpense);
    body += `"LOI NHUAN RONG - NET INCOME","","${netIncome.toFixed(2)}"\n`;

    return header + body;
  }

  /**
   * Generate Cash Flow Statement CSV (simplified direct method).
   * Uses CashTransaction data alongside journal entries.
   */
  private generateCashFlowCsv(lines: any[], dto: FinancialStatementDto): string {
    // Simplified cash flow: group cash-related account lines
    const accountTotals = new Map<
      string,
      { name: string; type: string; debit: Decimal; credit: Decimal }
    >();

    for (const line of lines) {
      // Cash accounts typically start with '111' (tien mat) or '112' (tien gui ngan hang) in VAS
      const code = line.accountCode as string;
      if (code.startsWith('111') || code.startsWith('112')) {
        const key = code;
        const existing = accountTotals.get(key) || {
          name: line.account?.name || '',
          type: line.account?.type || '',
          debit: new Decimal(0),
          credit: new Decimal(0),
        };
        existing.debit = existing.debit.add(line.debit);
        existing.credit = existing.credit.add(line.credit);
        accountTotals.set(key, existing);
      }
    }

    const header = `"BAO CAO LUU CHUYEN TIEN TE - CASH FLOW STATEMENT"\n"Ky: ${dto.startDate} - ${dto.endDate}"\n"Don vi tien: ${dto.currency || 'VND'}"\n\n"Ma TK","Ten tai khoan","Thu vao","Chi ra","Rong"\n`;

    let body = '';
    let totalIn = new Decimal(0);
    let totalOut = new Decimal(0);

    const sorted = [...accountTotals.entries()].sort((a, b) => a[0].localeCompare(b[0]));

    for (const [code, totals] of sorted) {
      const net = totals.debit.minus(totals.credit);
      body += `"${code}","${totals.name}","${totals.debit.toFixed(2)}","${totals.credit.toFixed(2)}","${net.toFixed(2)}"\n`;
      totalIn = totalIn.add(totals.debit);
      totalOut = totalOut.add(totals.credit);
    }

    body += `\n"TONG CONG","","${totalIn.toFixed(2)}","${totalOut.toFixed(2)}","${totalIn.minus(totalOut).toFixed(2)}"\n`;

    return header + body;
  }

  // ─────────────────────────────────────────────
  // PRIVATE — Helpers
  // ─────────────────────────────────────────────

  /**
   * Ensure the integration is enabled. Throws BadRequestException if not.
   */
  private ensureEnabled(provider: string): void {
    if (!this.enabled) {
      throw new BadRequestException(
        `Accounting integration is not enabled. ` +
          `Set ACCOUNTING_INTEGRATION_ENABLED=true and configure ${provider} credentials.`,
      );
    }
  }

  /**
   * Parse a DateRangeDto into actual Date objects.
   * Defaults to current month if no dates are provided.
   */
  private parseDateRange(dateRange: DateRangeDto): { startDate: Date; endDate: Date } {
    dateRange.validate();

    const now = new Date();
    const startDate = dateRange.startDate
      ? new Date(dateRange.startDate)
      : new Date(now.getFullYear(), now.getMonth(), 1);

    const endDate = dateRange.endDate ? new Date(dateRange.endDate) : new Date();
    endDate.setHours(23, 59, 59, 999);

    return { startDate, endDate };
  }

  /**
   * Map a string account type from external systems to the Prisma AccountType enum.
   */
  private mapAccountType(
    type: string,
  ): 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE' {
    const normalized = type.toUpperCase().trim();
    const mapping: Record<string, 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'> = {
      ASSET: 'ASSET',
      TAI_SAN: 'ASSET',
      LIABILITY: 'LIABILITY',
      NO_PHAI_TRA: 'LIABILITY',
      EQUITY: 'EQUITY',
      VON_CHU_SO_HUU: 'EQUITY',
      REVENUE: 'REVENUE',
      DOANH_THU: 'REVENUE',
      EXPENSE: 'EXPENSE',
      CHI_PHI: 'EXPENSE',
    };
    return mapping[normalized] || 'ASSET';
  }

  /**
   * Parse a bank statement CSV file content into structured rows.
   * Expected CSV columns: date, reference, description, amount
   */
  private parseBankStatementCsv(
    content: string,
  ): Array<{ date: string; reference: string; description: string; amount: string }> {
    const rawLines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (rawLines.length < 2) {
      return []; // No data rows (only header or empty)
    }

    // Skip header row
    const dataLines = rawLines.slice(1);
    const rows: Array<{ date: string; reference: string; description: string; amount: string }> =
      [];

    for (const line of dataLines) {
      // Simple CSV parsing (handles quoted fields)
      const fields = this.parseCsvLine(line);
      if (fields.length >= 4) {
        rows.push({
          date: fields[0].trim(),
          reference: fields[1].trim(),
          description: fields[2].trim(),
          amount: fields[3].trim().replace(/[,\s]/g, ''),
        });
      }
    }

    return rows;
  }

  /**
   * Parse a single CSV line handling quoted fields.
   */
  private parseCsvLine(line: string): string[] {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        fields.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    fields.push(current);
    return fields;
  }

  /**
   * Log a sync operation to the sync_logs table.
   * Silently catches errors to avoid failing the main operation.
   */
  private async logSyncOperation(
    idempotencyKey: string,
    source: string,
    entity: string,
    externalId: string,
    action: string,
    status: string,
    payload?: any,
    errorMessage?: string,
  ): Promise<void> {
    try {
      await this.prisma.syncLog.create({
        data: {
          idempotencyKey,
          source,
          entity,
          externalId,
          action,
          status,
          payload: payload ?? undefined,
          errorMessage: errorMessage?.substring(0, 2000),
        },
      });
    } catch (err) {
      this.logger.error(
        `Failed to log sync operation [${idempotencyKey}]: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
