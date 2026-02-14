import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';
import { GeneralLedgerQueryDto } from './dto/general-ledger-query.dto';

@Injectable()
export class GeneralLedgerService {
  private readonly logger = new Logger(GeneralLedgerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a journal entry with double-entry bookkeeping validation.
   * Total debits must equal total credits.
   */
  async createJournalEntry(dto: CreateJournalEntryDto, userId: string) {
    // Validate double-entry: total debits = total credits
    const totalDebit = dto.entries.reduce((sum, e) => sum + e.debit, 0);
    const totalCredit = dto.entries.reduce((sum, e) => sum + e.credit, 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new BadRequestException(
        `Journal entry is unbalanced. Total debits (${totalDebit}) must equal total credits (${totalCredit}).`,
      );
    }

    if (dto.entries.length < 2) {
      throw new BadRequestException(
        'A journal entry must have at least 2 lines.',
      );
    }

    // Validate each line has either debit or credit (not both zero)
    for (const entry of dto.entries) {
      if (entry.debit === 0 && entry.credit === 0) {
        throw new BadRequestException(
          `Line for account ${entry.accountCode} has both debit and credit as zero.`,
        );
      }
    }

    // Validate all account codes exist
    const accountCodes = [...new Set(dto.entries.map((e) => e.accountCode))];
    const accounts = await this.prisma.chartOfAccount.findMany({
      where: { code: { in: accountCodes } },
      select: { code: true, isActive: true },
    });

    const foundCodes = new Set(accounts.map((a) => a.code));
    for (const code of accountCodes) {
      if (!foundCodes.has(code)) {
        throw new NotFoundException(`Account code ${code} not found in chart of accounts.`);
      }
    }

    const inactiveAccount = accounts.find((a) => !a.isActive);
    if (inactiveAccount) {
      throw new BadRequestException(
        `Account ${inactiveAccount.code} is inactive and cannot be used.`,
      );
    }

    // Check period is not closed
    const entryDate = new Date(dto.date);
    const year = entryDate.getFullYear();
    const month = entryDate.getMonth() + 1;

    const closedPeriod = await this.prisma.closedPeriod.findUnique({
      where: { year_month: { year, month } },
    });

    if (closedPeriod) {
      throw new BadRequestException(
        `Accounting period ${year}-${String(month).padStart(2, '0')} is closed. No entries allowed.`,
      );
    }

    // Generate entry code JE-YYYYMM-XXXX
    const code = await this.generateEntryCode(entryDate);

    // Create journal entry with lines
    const journalEntry = await this.prisma.journalEntry.create({
      data: {
        code,
        date: entryDate,
        description: dto.description,
        reference: dto.reference,
        periodYear: year,
        periodMonth: month,
        isPosted: true,
        createdBy: userId,
        lines: {
          create: dto.entries.map((line) => ({
            accountCode: line.accountCode,
            debit: line.debit,
            credit: line.credit,
            description: line.description,
          })),
        },
      },
      include: {
        lines: {
          include: {
            account: { select: { code: true, name: true, type: true } },
          },
        },
      },
    });

    this.logger.log(
      `Journal entry ${code} created by ${userId}: ${dto.description}`,
    );

    return journalEntry;
  }

  /**
   * Lists journal entries with pagination and filters.
   */
  async findAll(query: GeneralLedgerQueryDto) {
    const where: any = {};

    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.startDate || query.endDate) {
      where.date = {};
      if (query.startDate) {
        where.date.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const endOfDay = new Date(query.endDate);
        endOfDay.setHours(23, 59, 59, 999);
        where.date.lte = endOfDay;
      }
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.journalEntry.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: query.orderBy,
        include: {
          lines: {
            include: {
              account: { select: { code: true, name: true, type: true } },
            },
          },
        },
      }),
      this.prisma.journalEntry.count({ where }),
    ]);

    return { data, total, page: query.page, limit: query.limit };
  }

  /**
   * Computes trial balance as of a specific date.
   * Sums debits and credits per account.
   */
  async getTrialBalance(asOfDate: string) {
    const endDate = new Date(asOfDate);
    endDate.setHours(23, 59, 59, 999);

    const result = await this.prisma.journalEntryLine.groupBy({
      by: ['accountCode'],
      _sum: {
        debit: true,
        credit: true,
      },
      where: {
        entry: {
          date: { lte: endDate },
          isPosted: true,
        },
      },
    });

    // Enrich with account info
    const accountCodes = result.map((r) => r.accountCode);
    const accounts = await this.prisma.chartOfAccount.findMany({
      where: { code: { in: accountCodes } },
    });

    const accountMap = new Map(accounts.map((a) => [a.code, a]));

    const trialBalance = result.map((r) => {
      const account = accountMap.get(r.accountCode);
      return {
        accountCode: r.accountCode,
        accountName: account?.name ?? 'Unknown',
        accountType: account?.type ?? 'Unknown',
        totalDebit: r._sum.debit ?? 0,
        totalCredit: r._sum.credit ?? 0,
        balance: (r._sum.debit ?? 0) - (r._sum.credit ?? 0),
      };
    });

    const totals = trialBalance.reduce(
      (acc, row) => ({
        totalDebit: acc.totalDebit + row.totalDebit,
        totalCredit: acc.totalCredit + row.totalCredit,
      }),
      { totalDebit: 0, totalCredit: 0 },
    );

    return {
      asOfDate,
      accounts: trialBalance,
      totals,
      isBalanced: Math.abs(totals.totalDebit - totals.totalCredit) < 0.01,
    };
  }

  /**
   * Gets running balance for a specific account within a date range.
   */
  async getAccountBalance(
    accountCode: string,
    startDate?: string,
    endDate?: string,
  ) {
    const account = await this.prisma.chartOfAccount.findUnique({
      where: { code: accountCode },
    });

    if (!account) {
      throw new NotFoundException(`Account ${accountCode} not found.`);
    }

    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }

    const lines = await this.prisma.journalEntryLine.findMany({
      where: {
        accountCode,
        entry: {
          isPosted: true,
          ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
        },
      },
      include: {
        entry: { select: { code: true, date: true, description: true } },
      },
      orderBy: { entry: { date: 'asc' } },
    });

    let runningBalance = 0;
    const movements = lines.map((line) => {
      runningBalance += line.debit - line.credit;
      return {
        entryCode: line.entry.code,
        date: line.entry.date,
        description: line.description ?? line.entry.description,
        debit: line.debit,
        credit: line.credit,
        balance: runningBalance,
      };
    });

    return {
      account: {
        code: account.code,
        name: account.name,
        type: account.type,
      },
      movements,
      closingBalance: runningBalance,
    };
  }

  /**
   * Closes an accounting period, preventing further journal entries.
   */
  async closePeriod(year: number, month: number, userId: string) {
    const existing = await this.prisma.closedPeriod.findUnique({
      where: { year_month: { year, month } },
    });

    if (existing) {
      throw new BadRequestException(
        `Period ${year}-${String(month).padStart(2, '0')} is already closed.`,
      );
    }

    const closedPeriod = await this.prisma.closedPeriod.create({
      data: {
        year,
        month,
        closedBy: userId,
      },
    });

    this.logger.log(
      `Period ${year}-${String(month).padStart(2, '0')} closed by ${userId}`,
    );

    return closedPeriod;
  }

  /**
   * Lists all accounts in the chart of accounts with hierarchy.
   */
  async getChartOfAccounts() {
    const accounts = await this.prisma.chartOfAccount.findMany({
      orderBy: { code: 'asc' },
    });

    return accounts;
  }

  /**
   * Generates the next journal entry code in the format JE-YYYYMM-XXXX.
   */
  private async generateEntryCode(date: Date): Promise<string> {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const prefix = `JE-${year}${month}`;

    const latest = await this.prisma.journalEntry.findFirst({
      where: { code: { startsWith: prefix } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });

    let sequence = 1;
    if (latest) {
      const lastSeq = parseInt(latest.code.split('-').pop() || '0', 10);
      sequence = lastSeq + 1;
    }

    return `${prefix}-${String(sequence).padStart(4, '0')}`;
  }
}
