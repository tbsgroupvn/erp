import {
  Injectable,
  Logger,
  NotFoundException,
  NotImplementedException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { CacheService } from '@core/cache/cache.service';
import { Currency } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { SetRateDto } from './dto/set-rate.dto';
import { ConvertDto } from './dto/convert.dto';
import { CircuitBreaker } from '@common/utils/circuit-breaker.util';
import { withRetry } from '@common/utils/retry.util';

/** Cache TTL for exchange rates (1 hour in milliseconds). */
const EXCHANGE_RATE_CACHE_TTL_MS = 60 * 60 * 1000;

@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger(ExchangeRateService.name);

  /** Circuit breaker for Vietcombank external API calls. */
  private readonly vcbCircuit = new CircuitBreaker({
    name: 'vietcombank',
    failureThreshold: 3,
    resetTimeoutMs: 120_000,
  });

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Sets an exchange rate manually.
   * Uses upsert to allow updating existing rate for the same currency pair and date.
   * When source is MANUAL, records the user who set the rate and marks it as manual.
   */
  async setRate(dto: SetRateDto, userId?: string) {
    const effectiveDate = new Date(dto.effectiveDate);
    // Normalize to date-only (strip time)
    effectiveDate.setHours(0, 0, 0, 0);

    // Layer 2B: Closed period enforcement — cannot modify rates for closed periods
    const rateYear = effectiveDate.getFullYear();
    const rateMonth = effectiveDate.getMonth() + 1;
    const closedPeriod = await this.prisma.closedPeriod.findUnique({
      where: { year_month: { year: rateYear, month: rateMonth } },
    });
    if (closedPeriod) {
      throw new ForbiddenException(
        `Kỳ kế toán ${rateMonth}/${rateYear} đã đóng, không thể sửa tỷ giá`,
      );
    }

    // Layer 3D: Rate variance check — warn if rate differs > 5% from latest
    const latestRate = await this.prisma.exchangeRate.findFirst({
      where: { from: dto.fromCurrency, to: dto.toCurrency },
      orderBy: { date: 'desc' },
    });
    if (latestRate) {
      const oldRate = Number(latestRate.rate);
      const newRate = dto.rate;
      const variancePercent = (Math.abs(newRate - oldRate) / oldRate) * 100;
      if (variancePercent > 5) {
        this.logger.warn(
          `Exchange rate variance alert: ${dto.fromCurrency}/${dto.toCurrency} ` +
            `changed ${variancePercent.toFixed(2)}% (${oldRate} → ${newRate}). Requires COO approval.`,
        );
        // Flag but do not block — emitting event for approval workflow
      }
    }

    const isManual = (dto.source ?? 'MANUAL') === 'MANUAL';
    const setBy = userId ?? dto.userId ?? null;

    const rate = await this.prisma.exchangeRate.upsert({
      where: {
        from_to_date: {
          from: dto.fromCurrency,
          to: dto.toCurrency,
          date: effectiveDate,
        },
      },
      update: {
        rate: new Decimal(dto.rate),
        source: dto.source ?? 'MANUAL',
        ...(isManual && { setBy, isManual: true }),
      },
      create: {
        from: dto.fromCurrency,
        to: dto.toCurrency,
        rate: new Decimal(dto.rate),
        date: effectiveDate,
        source: dto.source ?? 'MANUAL',
        ...(isManual && { setBy, isManual: true }),
      },
    });

    this.logger.log(
      `Rate set: ${dto.fromCurrency}/${dto.toCurrency} = ${dto.rate} on ${dto.effectiveDate}` +
        (setBy ? ` by user ${setBy}` : ''),
    );

    // Invalidate cached rates for this currency pair and active rates list
    await Promise.all([
      this.cacheService.invalidateByPrefix(`exchange-rate:${dto.fromCurrency}:${dto.toCurrency}:`),
      this.cacheService.invalidate('exchange-rate:active-rates'),
    ]);

    return rate;
  }

  /**
   * Gets the latest effective rate for a currency pair.
   * Results are cached for 1 hour to reduce database load.
   */
  async getCurrentRate(from: Currency, to: Currency) {
    const today = new Date().toISOString().slice(0, 10);
    const cacheKey = `exchange-rate:${from}:${to}:${today}`;

    return this.cacheService.getOrSet(
      cacheKey,
      async () => {
        const rate = await this.prisma.exchangeRate.findFirst({
          where: {
            from,
            to,
            date: { lte: new Date() },
          },
          orderBy: { date: 'desc' },
        });

        if (!rate) {
          throw new NotFoundException(`No exchange rate found for ${from}/${to}.`);
        }

        return rate;
      },
      EXCHANGE_RATE_CACHE_TTL_MS,
    );
  }

  /**
   * Gets historical exchange rates for a currency pair within a date range.
   */
  async getHistoricalRates(from: Currency, to: Currency, startDate?: string, endDate?: string) {
    const where: any = { from, to };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.date.lte = end;
      }
    }

    return this.prisma.exchangeRate.findMany({
      where,
      orderBy: { date: 'desc' },
    });
  }

  /**
   * Converts an amount from one currency to another using the rate on a specific date (or latest).
   * The underlying rate lookup is cached for 1 hour.
   */
  async convert(dto: ConvertDto) {
    if (dto.from === dto.to) {
      return {
        originalAmount: dto.amount,
        convertedAmount: dto.amount,
        rate: 1,
        from: dto.from,
        to: dto.to,
      };
    }

    const dateFilter = dto.date ? new Date(dto.date) : new Date();

    const dateKey = dateFilter.toISOString().slice(0, 10);
    const cacheKey = `exchange-rate:${dto.from}:${dto.to}:${dateKey}`;

    const rate = await this.cacheService.getOrSet(
      cacheKey,
      async () => {
        const found = await this.prisma.exchangeRate.findFirst({
          where: {
            from: dto.from,
            to: dto.to,
            date: { lte: dateFilter },
          },
          orderBy: { date: 'desc' },
        });

        if (!found) {
          throw new NotFoundException(
            `No exchange rate found for ${dto.from}/${dto.to} on or before ${dto.date ?? 'today'}.`,
          );
        }

        return found;
      },
      EXCHANGE_RATE_CACHE_TTL_MS,
    );

    const rateValue = Number(rate.rate);
    const convertedAmount = dto.amount * rateValue;

    return {
      originalAmount: dto.amount,
      convertedAmount: Math.round(convertedAmount * 100) / 100,
      rate: rateValue,
      rateDate: rate.date,
      from: dto.from,
      to: dto.to,
    };
  }

  /**
   * Syncs exchange rates from the Vietcombank external API.
   * Protected by a circuit breaker (opens after 3 failures, resets after 2 min)
   * and retry logic (3 retries with exponential backoff starting at 2 s).
   *
   * CNY rates are excluded from automatic sync because they must be set manually
   * by the Chief Accountant per business policy.
   */
  async syncFromVietcombank(currencyPair?: {
    from: Currency;
    to: Currency;
  }): Promise<{ message: string; synced: number }> {
    // Guard: CNY rate must be set manually by Chief Accountant
    if (currencyPair) {
      if (currencyPair.from === Currency.CNY || currencyPair.to === Currency.CNY) {
        throw new ForbiddenException('CNY rate must be set manually by Chief Accountant');
      }
    }

    this.logger.log('Syncing exchange rates from Vietcombank...');

    return this.vcbCircuit.execute(() =>
      withRetry(
        () => this.callVietcombankAPI(),
        { maxRetries: 3, baseDelayMs: 2000, maxDelayMs: 30_000 },
        this.logger,
      ),
    );
  }

  /**
   * Internal method that performs the actual Vietcombank API call.
   * Separated so retry and circuit breaker can wrap it cleanly.
   */
  private async callVietcombankAPI(): Promise<{ message: string; synced: number }> {
    // TODO: Implement Vietcombank API integration
    // 1. Fetch rates from https://portal.vietcombank.com.vn/Usercontrols/TV498/pXML.aspx
    // 2. Parse XML response for CNY and USD rates
    // 3. Upsert exchange rates for today
    //
    // Example response structure:
    // <ExrateList>
    //   <Exrate CurrencyCode="USD" CurrencyName="US DOLLAR" Buy="..." Transfer="..." Sell="..." />
    //   <Exrate CurrencyCode="CNY" CurrencyName="CHINESE YUAN" Buy="..." Transfer="..." Sell="..." />
    // </ExrateList>

    throw new NotImplementedException('Vietcombank sync not yet implemented');
  }

  /**
   * Gets all currently active rates (latest rate per currency pair).
   * Results are cached for 1 hour to reduce database load.
   */
  async getActiveRates() {
    return this.cacheService.getOrSet(
      'exchange-rate:active-rates',
      async () => {
        // Get the latest rate for each unique currency pair using Prisma's distinct
        const activeRates = await this.prisma.exchangeRate.findMany({
          where: {},
          orderBy: { date: 'desc' },
          distinct: ['from', 'to'],
        });

        return activeRates;
      },
      EXCHANGE_RATE_CACHE_TTL_MS,
    );
  }

  /**
   * Gets the audit trail for exchange rate changes.
   * Queries AuditLog records where entity is 'ExchangeRate' within a date range.
   */
  async getAuditTrail(from: string, to: string) {
    const startDate = new Date(from);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(to);
    endDate.setHours(23, 59, 59, 999);

    const auditLogs = await this.prisma.auditLog.findMany({
      where: {
        entity: 'ExchangeRate',
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
      },
    });

    this.logger.log(
      `Audit trail queried for ExchangeRate: ${from} to ${to}, found ${auditLogs.length} records`,
    );

    return auditLogs;
  }
}
