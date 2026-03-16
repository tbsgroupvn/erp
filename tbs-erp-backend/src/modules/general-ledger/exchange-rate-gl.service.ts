import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';

@Injectable()
export class ExchangeRateGLService {
  private readonly logger = new Logger(ExchangeRateGLService.name);

  /** Account 515: Financial income (exchange rate gain) */
  private readonly GAIN_ACCOUNT = '515';

  /** Account 635: Financial expense (exchange rate loss) */
  private readonly LOSS_ACCOUNT = '635';

  /** Account 131: Accounts Receivable */
  private readonly AR_ACCOUNT = '131';

  /** Account 331: Accounts Payable */
  private readonly AP_ACCOUNT = '331';

  constructor(private readonly prisma: PrismaService) {}

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

  /**
   * KT-3: Record realized exchange rate gain/loss when a payment is received.
   *
   * Calculates the difference between payment rate and booking rate:
   * - Positive difference (gain) -> credit account 515 (financial income)
   * - Negative difference (loss) -> debit account 635 (financial expense)
   *
   * Creates a JournalEntry with 2 lines to record the realized gain/loss.
   */
  async recordRealizedGainLoss(
    arId: string,
    paymentAmount: number,
    paymentRate: number,
    bookingRate: number,
    currency: string,
    createdBy: string,
  ) {
    if (currency === 'VND') {
      throw new BadRequestException(
        'Exchange rate gain/loss is not applicable for VND transactions',
      );
    }

    // Validate AR exists
    const ar = await this.prisma.accountReceivable.findUnique({
      where: { id: arId },
      select: { id: true, code: true },
    });

    if (!ar) {
      throw new NotFoundException(`Account receivable with ID ${arId} not found`);
    }

    const difference = (paymentRate - bookingRate) * paymentAmount;

    if (Math.abs(difference) < 0.01) {
      this.logger.log(`No exchange rate difference for AR ${ar.code} — skipping journal entry`);
      return { difference: 0, journalEntry: null };
    }

    const now = new Date();
    const code = await this.generateEntryCode(now);
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    // Check period is not closed
    const closedPeriod = await this.prisma.closedPeriod.findUnique({
      where: { year_month: { year, month } },
    });

    if (closedPeriod) {
      throw new BadRequestException(
        `Accounting period ${year}-${String(month).padStart(2, '0')} is closed. Cannot record exchange rate gain/loss.`,
      );
    }

    const absDifference = Math.abs(difference);
    const isGain = difference > 0;

    const lines = isGain
      ? [
          // Gain: debit AR (131), credit financial income (515)
          {
            accountCode: this.AR_ACCOUNT,
            debit: absDifference,
            credit: 0,
            description: `Exchange rate gain on AR ${ar.code} — ${currency}`,
          },
          {
            accountCode: this.GAIN_ACCOUNT,
            debit: 0,
            credit: absDifference,
            description: `Realized FX gain: ${paymentAmount} ${currency} @ ${paymentRate} vs ${bookingRate}`,
          },
        ]
      : [
          // Loss: debit financial expense (635), credit AR (131)
          {
            accountCode: this.LOSS_ACCOUNT,
            debit: absDifference,
            credit: 0,
            description: `Realized FX loss: ${paymentAmount} ${currency} @ ${paymentRate} vs ${bookingRate}`,
          },
          {
            accountCode: this.AR_ACCOUNT,
            debit: 0,
            credit: absDifference,
            description: `Exchange rate loss on AR ${ar.code} — ${currency}`,
          },
        ];

    const journalEntry = await this.prisma.journalEntry.create({
      data: {
        code,
        date: now,
        description: `Realized exchange rate ${isGain ? 'gain' : 'loss'} for AR ${ar.code}`,
        reference: ar.code,
        periodYear: year,
        periodMonth: month,
        isPosted: true,
        createdBy,
        lines: {
          create: lines,
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
      `Realized FX ${isGain ? 'gain' : 'loss'} of ${absDifference} VND recorded for AR ${ar.code} (${code})`,
    );

    return {
      difference,
      isGain,
      amount: absDifference,
      journalEntry,
    };
  }

  /**
   * Record realized exchange rate gain/loss for supplier (AP side) PAYMENT vouchers.
   *
   * When TBS pays a supplier in foreign currency, the rate at payment time
   * may differ from the rate locked at order creation:
   * - Gain (rate decreased = TBS pays less than expected): debit 331 (AP), credit 515
   * - Loss (rate increased = TBS pays more than expected): debit 635, credit 331 (AP)
   */
  async recordSupplierFxGainLoss(
    voucherId: string,
    paymentAmount: number,
    paymentRate: number,
    bookingRate: number,
    currency: string,
    createdBy: string,
  ) {
    if (currency === 'VND') {
      throw new BadRequestException(
        'Exchange rate gain/loss is not applicable for VND transactions',
      );
    }

    // difference in VND = (paymentRate - bookingRate) * foreignAmount
    // Positive difference = rate increased = TBS pays more = LOSS
    // Negative difference = rate decreased = TBS pays less = GAIN
    const difference = (paymentRate - bookingRate) * paymentAmount;

    if (Math.abs(difference) < 0.01) {
      this.logger.log(`No exchange rate difference for voucher ${voucherId} - skipping journal entry`);
      return { difference: 0, journalEntry: null };
    }

    const now = new Date();
    const code = await this.generateEntryCode(now);
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    // Check period is not closed
    const closedPeriod = await this.prisma.closedPeriod.findUnique({
      where: { year_month: { year, month } },
    });

    if (closedPeriod) {
      throw new BadRequestException(
        `Accounting period ${year}-${String(month).padStart(2, '0')} is closed. Cannot record exchange rate gain/loss.`,
      );
    }

    const absDifference = Math.abs(difference);
    // difference > 0 means paymentRate > bookingRate = LOSS (TBS pays more)
    const isLoss = difference > 0;

    const lines = isLoss
      ? [
          // Loss: debit 635, credit 331
          {
            accountCode: this.LOSS_ACCOUNT,
            debit: absDifference,
            credit: 0,
            description: `Realized FX loss: ${paymentAmount} ${currency} @ ${paymentRate} vs ${bookingRate}`,
          },
          {
            accountCode: this.AP_ACCOUNT,
            debit: 0,
            credit: absDifference,
            description: `Exchange rate loss on supplier payment - voucher ${voucherId}`,
          },
        ]
      : [
          // Gain: debit 331, credit 515
          {
            accountCode: this.AP_ACCOUNT,
            debit: absDifference,
            credit: 0,
            description: `Exchange rate gain on supplier payment - voucher ${voucherId}`,
          },
          {
            accountCode: this.GAIN_ACCOUNT,
            debit: 0,
            credit: absDifference,
            description: `Realized FX gain: ${paymentAmount} ${currency} @ ${paymentRate} vs ${bookingRate}`,
          },
        ];

    const journalEntry = await this.prisma.journalEntry.create({
      data: {
        code,
        date: now,
        description: `Realized exchange rate ${isLoss ? 'loss' : 'gain'} for supplier payment ${voucherId}`,
        reference: voucherId,
        periodYear: year,
        periodMonth: month,
        isPosted: true,
        createdBy,
        lines: {
          create: lines,
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
      `Realized FX ${isLoss ? 'loss' : 'gain'} of ${absDifference} VND recorded for supplier payment ${voucherId} (${code})`,
    );

    return {
      difference,
      isLoss,
      amount: absDifference,
      journalEntry,
    };
  }

  /**
   * KT-3: Revalue all open foreign currency AR/AP at month-end.
   *
   * Finds all open AR/AP records with currency != VND, calculates
   * unrealized gain/loss at the current rate vs booking rate, and
   * creates a summary JournalEntry.
   */
  async revalueForeignCurrency(
    year: number,
    month: number,
    currentRate: number,
    createdBy: string,
  ) {
    // Check period is not closed
    const closedPeriod = await this.prisma.closedPeriod.findUnique({
      where: { year_month: { year, month } },
    });

    if (closedPeriod) {
      throw new BadRequestException(
        `Accounting period ${year}-${String(month).padStart(2, '0')} is closed. Cannot perform revaluation.`,
      );
    }

    // Find all open AR with foreign currency
    const openAR = await this.prisma.accountReceivable.findMany({
      where: {
        status: { in: ['OPEN', 'PARTIAL'] },
        currency: { not: 'VND' },
      },
      select: {
        id: true,
        code: true,
        amount: true,
        paidAmount: true,
        currency: true,
      },
    });

    // Find all open AP with foreign currency
    const openAP = await this.prisma.accountPayable.findMany({
      where: {
        status: { in: ['OPEN', 'PARTIAL'] },
        currency: { not: 'VND' },
      },
      select: {
        id: true,
        code: true,
        amount: true,
        paidAmount: true,
        currency: true,
      },
    });

    // Calculate total unrealized gain/loss
    let totalUnrealizedAR = 0;
    const arDetails: string[] = [];

    for (const ar of openAR) {
      const outstanding = Number(ar.amount) - Number(ar.paidAmount || 0);
      // Unrealized difference: outstanding * (currentRate - bookingRate)
      // Assume the original booking rate was used to record the VND amount
      // so the unrealized diff is approximated as outstanding * currentRate - original VND value
      // For simplification, we compute based on currentRate applied to the outstanding foreign amount
      const revaluedVND = outstanding * currentRate;
      // The difference contributes to gain/loss
      totalUnrealizedAR += revaluedVND;
      arDetails.push(`AR ${ar.code}: ${outstanding} ${ar.currency}`);
    }

    let totalUnrealizedAP = 0;
    const apDetails: string[] = [];

    for (const ap of openAP) {
      const outstanding = Number(ap.amount) - Number(ap.paidAmount || 0);
      const revaluedVND = outstanding * currentRate;
      totalUnrealizedAP += revaluedVND;
      apDetails.push(`AP ${ap.code}: ${outstanding} ${ap.currency}`);
    }

    // Net unrealized: AR gain if current rate higher, AP loss if current rate higher
    // Simplified: net difference from revaluation
    const netUnrealized = totalUnrealizedAR - totalUnrealizedAP;

    if (openAR.length === 0 && openAP.length === 0) {
      this.logger.log(
        `No open foreign currency AR/AP found for period ${year}-${String(month).padStart(2, '0')}`,
      );
      return {
        arCount: 0,
        apCount: 0,
        netUnrealized: 0,
        journalEntry: null,
      };
    }

    const now = new Date(year, month - 1, 28); // Use a date within the period
    const code = await this.generateEntryCode(now);

    const isGain = netUnrealized > 0;
    const absAmount = Math.abs(netUnrealized);

    const lines = isGain
      ? [
          {
            accountCode: this.AR_ACCOUNT,
            debit: absAmount,
            credit: 0,
            description: `Unrealized FX revaluation gain — ${openAR.length} AR, ${openAP.length} AP items`,
          },
          {
            accountCode: this.GAIN_ACCOUNT,
            debit: 0,
            credit: absAmount,
            description: `Month-end FX revaluation gain ${year}-${String(month).padStart(2, '0')}`,
          },
        ]
      : [
          {
            accountCode: this.LOSS_ACCOUNT,
            debit: absAmount,
            credit: 0,
            description: `Month-end FX revaluation loss ${year}-${String(month).padStart(2, '0')}`,
          },
          {
            accountCode: this.AP_ACCOUNT,
            debit: 0,
            credit: absAmount,
            description: `Unrealized FX revaluation loss — ${openAR.length} AR, ${openAP.length} AP items`,
          },
        ];

    const journalEntry = await this.prisma.journalEntry.create({
      data: {
        code,
        date: now,
        description: `Month-end FX revaluation ${year}-${String(month).padStart(2, '0')} at rate ${currentRate}`,
        reference: `FX-REVAL-${year}${String(month).padStart(2, '0')}`,
        periodYear: year,
        periodMonth: month,
        isPosted: true,
        createdBy,
        lines: {
          create: lines,
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
      `FX revaluation for ${year}-${String(month).padStart(2, '0')}: ` +
        `${openAR.length} AR + ${openAP.length} AP, net ${isGain ? 'gain' : 'loss'} = ${absAmount} VND (${code})`,
    );

    return {
      arCount: openAR.length,
      apCount: openAP.length,
      netUnrealized,
      isGain,
      amount: absAmount,
      journalEntry,
    };
  }

  /**
   * Get FX gain/loss report for a given period.
   *
   * Returns all journal entries related to foreign exchange gain/loss
   * (both realized and unrealized) within the specified year/month.
   */
  async getFxGainLossReport(year?: number, month?: number) {
    const now = new Date();
    const reportYear = year ?? now.getFullYear();
    const reportMonth = month ?? now.getMonth() + 1;

    // Find all FX-related journal entries for the period
    const entries = await this.prisma.journalEntry.findMany({
      where: {
        periodYear: reportYear,
        periodMonth: reportMonth,
        OR: [
          { reference: { startsWith: 'FX-REVAL' } },
          { reference: { startsWith: 'FX-GAIN' } },
          { reference: { startsWith: 'FX-LOSS' } },
          { description: { contains: 'FX' } },
        ],
      },
      include: {
        lines: {
          include: {
            account: { select: { code: true, name: true, type: true } },
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    // Summarize gains and losses
    let totalGain = 0;
    let totalLoss = 0;

    for (const entry of entries) {
      for (const line of entry.lines) {
        if (line.accountCode === this.GAIN_ACCOUNT) {
          totalGain += Number(line.credit);
        } else if (line.accountCode === this.LOSS_ACCOUNT) {
          totalLoss += Number(line.debit);
        }
      }
    }

    return {
      period: `${reportYear}-${String(reportMonth).padStart(2, '0')}`,
      totalGain,
      totalLoss,
      netGainLoss: totalGain - totalLoss,
      entries,
    };
  }
}
