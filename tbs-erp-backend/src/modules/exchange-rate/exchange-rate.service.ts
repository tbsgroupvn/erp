import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { Currency } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { SetRateDto } from './dto/set-rate.dto';
import { ConvertDto } from './dto/convert.dto';

@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger(ExchangeRateService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Sets an exchange rate manually.
   * Uses upsert to allow updating existing rate for the same currency pair and date.
   */
  async setRate(dto: SetRateDto) {
    const effectiveDate = new Date(dto.effectiveDate);
    // Normalize to date-only (strip time)
    effectiveDate.setHours(0, 0, 0, 0);

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
      },
      create: {
        from: dto.fromCurrency,
        to: dto.toCurrency,
        rate: new Decimal(dto.rate),
        date: effectiveDate,
        source: dto.source ?? 'MANUAL',
      },
    });

    this.logger.log(
      `Rate set: ${dto.fromCurrency}/${dto.toCurrency} = ${dto.rate} on ${dto.effectiveDate}`,
    );

    return rate;
  }

  /**
   * Gets the latest effective rate for a currency pair.
   */
  async getCurrentRate(from: Currency, to: Currency) {
    const rate = await this.prisma.exchangeRate.findFirst({
      where: {
        from,
        to,
        date: { lte: new Date() },
      },
      orderBy: { date: 'desc' },
    });

    if (!rate) {
      throw new NotFoundException(
        `No exchange rate found for ${from}/${to}.`,
      );
    }

    return rate;
  }

  /**
   * Gets historical exchange rates for a currency pair within a date range.
   */
  async getHistoricalRates(
    from: Currency,
    to: Currency,
    startDate?: string,
    endDate?: string,
  ) {
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

    const dateFilter = dto.date
      ? new Date(dto.date)
      : new Date();

    const rate = await this.prisma.exchangeRate.findFirst({
      where: {
        from: dto.from,
        to: dto.to,
        date: { lte: dateFilter },
      },
      orderBy: { date: 'desc' },
    });

    if (!rate) {
      throw new NotFoundException(
        `No exchange rate found for ${dto.from}/${dto.to} on or before ${dto.date ?? 'today'}.`,
      );
    }

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
   * Stub for Vietcombank API integration.
   * Interface: fetch CNY/VND, USD/VND rates daily.
   */
  async syncFromVietcombank(): Promise<{ message: string; synced: number }> {
    this.logger.log('Syncing exchange rates from Vietcombank...');

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

    this.logger.warn(
      'Vietcombank sync is not yet implemented. This is a stub endpoint.',
    );

    return {
      message: 'Vietcombank sync stub — not yet implemented',
      synced: 0,
    };
  }

  /**
   * Gets all currently active rates (latest rate per currency pair).
   */
  async getActiveRates() {
    // Get the latest rate for each unique currency pair
    const allRates = await this.prisma.exchangeRate.findMany({
      orderBy: { date: 'desc' },
    });

    // Deduplicate: keep only the latest rate per pair
    const rateMap = new Map<string, typeof allRates[0]>();
    for (const rate of allRates) {
      const key = `${rate.from}-${rate.to}`;
      if (!rateMap.has(key)) {
        rateMap.set(key, rate);
      }
    }

    return Array.from(rateMap.values());
  }
}
