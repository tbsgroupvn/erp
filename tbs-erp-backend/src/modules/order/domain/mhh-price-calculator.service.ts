import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { CustomerTier, ServiceType } from '@prisma/client';

/**
 * Input parameters for MHH price calculation.
 */
export interface MHHPriceInput {
  /** Product price per unit in CNY */
  productPriceCNY: number;
  /** Number of items */
  quantity: number;
  /** Domestic shipping cost within China per unit (CNY) */
  domesticShippingCNY?: number;
  /** Estimated weight per unit in kilograms */
  estimatedWeightKg?: number;
  /** Shipping route from China to Vietnam */
  shippingRoute?: 'SEA' | 'ROAD' | 'AIR';
  /** Customer tier for fee calculation */
  customerTier?: CustomerTier;
}

/**
 * Result of MHH price calculation.
 *
 * Calculation flow:
 *   Gia SP (100 CNY) + Phi DV 8% (8 CNY) + Ship noi TQ (10 CNY) = 118 CNY
 *   118 CNY x 3,500 VND/CNY = 413,000 VND
 *   + Phi van chuyen VN (uoc tinh theo can) = ~50,000 VND
 *   -> Tong uoc tinh: 463,000 VND
 */
export interface MHHPriceResult {
  // --- Per item ---
  /** Unit product price in CNY */
  productPriceCNY: number;
  /** Service fee percentage applied */
  serviceFeePercent: number;
  /** Service fee amount per unit in CNY */
  serviceFeeCNY: number;
  /** Domestic shipping cost per unit in CNY */
  domesticShippingCNY: number;
  /** Total cost per unit in CNY (product + fee + domestic shipping) */
  totalPerItemCNY: number;

  // --- Total ---
  /** Number of items */
  quantity: number;
  /** Subtotal in CNY (totalPerItemCNY * quantity) */
  subtotalCNY: number;

  // --- Exchange rate ---
  /** CNY to VND exchange rate */
  exchangeRate: number;
  /** Date of the exchange rate */
  exchangeRateDate: Date;
  /** Subtotal converted to VND */
  subtotalVND: number;

  // --- Shipping VN estimate ---
  /** Total estimated weight in kg (estimatedWeightKg * quantity) */
  estimatedWeightKg: number;
  /** Shipping rate per kg in VND */
  shippingRatePerKg: number;
  /** Estimated Vietnam shipping cost in VND */
  estimatedShippingVND: number;

  // --- Grand total ---
  /** Grand total in VND (subtotalVND + estimatedShippingVND) */
  grandTotalVND: number;
}

/**
 * MHH Price Calculator Service.
 *
 * Computes the estimated total cost for MHH (Mua Hang Ho) orders so
 * sales staff can provide customers with a quick price quote.
 *
 * The calculation is composed of:
 *  1. Product cost + service fee + domestic China shipping -> subtotal in CNY
 *  2. Convert to VND using the latest exchange rate
 *  3. Add estimated Vietnam domestic shipping based on weight and route
 */
@Injectable()
export class MHHPriceCalculatorService {
  private readonly logger = new Logger(MHHPriceCalculatorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculates the full MHH price breakdown for a given product input.
   *
   * @param input - Product pricing details and shipping parameters
   * @returns Detailed price breakdown from per-item CNY to grand total VND
   */
  async calculatePrice(input: MHHPriceInput): Promise<MHHPriceResult> {
    this.logger.log(
      `Calculating MHH price: productCNY=${input.productPriceCNY}, qty=${input.quantity}, tier=${input.customerTier ?? 'default'}`,
    );

    // 1. Resolve service fee percentage based on customer tier and order value
    const orderValueCNY = input.productPriceCNY * input.quantity;
    const feePercent = await this.getServiceFeePercent(input.customerTier, orderValueCNY);

    // 2. Fetch the latest CNY -> VND exchange rate
    const exchangeRate = await this.getLatestExchangeRate();

    // 3. Per-item calculation
    const rawServiceFeeCNY = (input.productPriceCNY * feePercent) / 100;
    const serviceFeeCNY = Math.ceil(rawServiceFeeCNY);
    const domesticShippingCNY = input.domesticShippingCNY ?? 0;
    const totalPerItemCNY = input.productPriceCNY + serviceFeeCNY + domesticShippingCNY;

    // 4. Totals in CNY and convert to VND
    const subtotalCNY = totalPerItemCNY * input.quantity;
    const subtotalVND = Math.ceil(subtotalCNY * exchangeRate.rate);

    // 5. Estimate Vietnam domestic shipping cost
    const perUnitWeightKg = input.estimatedWeightKg ?? 0;
    const estimatedWeightKg = perUnitWeightKg * input.quantity;
    const shippingRatePerKg = this.getShippingRate(input.shippingRoute ?? 'SEA');
    const estimatedShippingVND = Math.ceil(estimatedWeightKg * shippingRatePerKg);

    // 6. Grand total
    const grandTotalVND = subtotalVND + estimatedShippingVND;

    this.logger.log(
      `Price result: subtotalCNY=${subtotalCNY}, rate=${exchangeRate.rate}, ` +
        `subtotalVND=${subtotalVND}, shippingVND=${estimatedShippingVND}, grandTotalVND=${grandTotalVND}`,
    );

    return {
      productPriceCNY: input.productPriceCNY,
      serviceFeePercent: feePercent,
      serviceFeeCNY,
      domesticShippingCNY,
      totalPerItemCNY,
      quantity: input.quantity,
      subtotalCNY,
      exchangeRate: exchangeRate.rate,
      exchangeRateDate: exchangeRate.date,
      subtotalVND,
      estimatedWeightKg,
      shippingRatePerKg,
      estimatedShippingVND,
      grandTotalVND,
    };
  }

  /**
   * Resolves the service fee percentage from ServiceFeeConfig.
   *
   * Matches based on:
   *  - serviceType = MHH
   *  - isActive = true
   *  - customerTier (exact match or null = applies to all tiers)
   *  - order value within [minOrderValue, maxOrderValue] range
   *
   * Configs are evaluated by priority descending. The first match wins.
   * Falls back to 5% if no matching configuration is found.
   *
   * @param customerTier - The customer's tier (optional)
   * @param orderValue - The total order value in CNY for range checking
   * @returns The resolved fee percentage
   */
  private async getServiceFeePercent(
    customerTier?: CustomerTier,
    orderValue?: number,
  ): Promise<number> {
    const configs = await this.prisma.serviceFeeConfig.findMany({
      where: {
        serviceType: ServiceType.MHH,
        isActive: true,
        ...(customerTier ? { OR: [{ customerTier }, { customerTier: null }] } : {}),
      },
      orderBy: { priority: 'desc' },
    });

    for (const config of configs) {
      // Skip if the config targets a specific tier that doesn't match
      if (config.customerTier && config.customerTier !== customerTier) {
        continue;
      }

      // Check minimum order value threshold
      if (
        config.minOrderValue &&
        orderValue !== undefined &&
        orderValue < Number(config.minOrderValue)
      ) {
        continue;
      }

      // Check maximum order value threshold
      if (
        config.maxOrderValue &&
        orderValue !== undefined &&
        orderValue > Number(config.maxOrderValue)
      ) {
        continue;
      }

      const feePercent = Number(config.feePercent);

      this.logger.debug(`Matched fee config "${config.name}" (id=${config.id}): ${feePercent}%`);

      return feePercent;
    }

    this.logger.warn(
      `No ServiceFeeConfig matched for tier=${customerTier}, orderValue=${orderValue}. Using default 5%.`,
    );

    return 5;
  }

  /**
   * Fetches the most recent CNY -> VND exchange rate from the database.
   *
   * Falls back to a default rate of 3,500 VND/CNY if no rate is found
   * (e.g. during initial setup or if the rate sync job hasn't run yet).
   *
   * @returns The exchange rate and its effective date
   */
  private async getLatestExchangeRate(): Promise<{
    rate: number;
    date: Date;
  }> {
    const rate = await this.prisma.exchangeRate.findFirst({
      where: { from: 'CNY', to: 'VND' },
      orderBy: { date: 'desc' },
    });

    if (rate) {
      return { rate: Number(rate.rate), date: rate.date };
    }

    this.logger.warn('No CNY->VND exchange rate found in database. Using fallback rate of 3500.');

    return { rate: 3500, date: new Date() };
  }

  /**
   * Returns the estimated VN domestic shipping rate per kilogram in VND
   * based on the selected shipping route.
   *
   * @param route - Shipping route: SEA, ROAD, or AIR
   * @returns Rate in VND per kg
   */
  private getShippingRate(route: string): number {
    const rates: Record<string, number> = {
      SEA: 25000,
      ROAD: 35000,
      AIR: 120000,
    };

    return rates[route] ?? rates['SEA'];
  }
}
