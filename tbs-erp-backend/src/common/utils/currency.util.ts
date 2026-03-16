import { BadRequestException } from '@nestjs/common';
import { Currency } from '@prisma/client';

/**
 * Locale and formatting configuration for each supported currency.
 */
const CURRENCY_CONFIG: Record<Currency, { locale: string; symbol: string; decimals: number }> = {
  [Currency.VND]: { locale: 'vi-VN', symbol: '₫', decimals: 0 },
  [Currency.CNY]: { locale: 'zh-CN', symbol: '¥', decimals: 2 },
  [Currency.USD]: { locale: 'en-US', symbol: '$', decimals: 2 },
};

/**
 * Formats an amount in the specified currency using the appropriate locale.
 *
 * @param amount - The numeric amount to format
 * @param currency - The currency to format in
 * @returns Formatted currency string
 *
 * @example
 * formatCurrency(1500000, Currency.VND)  // "1.500.000 ₫"
 * formatCurrency(1234.56, Currency.CNY)  // "¥1,234.56"
 * formatCurrency(1234.56, Currency.USD)  // "$1,234.56"
 */
export function formatCurrency(amount: number, currency: Currency): string {
  const config = CURRENCY_CONFIG[currency];
  try {
    return new Intl.NumberFormat(config.locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: config.decimals,
      maximumFractionDigits: config.decimals,
    }).format(amount);
  } catch {
    // Fallback if the locale is not available on the server environment
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: config.decimals,
        maximumFractionDigits: config.decimals,
      }).format(amount);
    } catch {
      // Last resort: manual formatting
      const fixed = amount.toFixed(config.decimals);
      return `${config.symbol}${fixed}`;
    }
  }
}

/**
 * Formats an amount with a simple number format (no currency symbol).
 *
 * @param amount - The numeric amount
 * @param decimals - Number of decimal places (default: 0)
 * @returns Formatted number string
 *
 * @example
 * formatAmount(1500000)       // "1,500,000"
 * formatAmount(1234.567, 2)   // "1,234.57"
 */
export function formatAmount(amount: number, decimals = 0): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

/**
 * Converts an amount from one currency to another using a provided exchange rate.
 *
 * The rate represents: 1 unit of `from` currency = `rate` units of `to` currency.
 *
 * @param amount - The amount in the source currency
 * @param from - Source currency
 * @param to - Target currency
 * @param rate - Exchange rate (from -> to)
 * @returns Converted amount, rounded to the appropriate number of decimal places
 *
 * @example
 * // Convert 100 CNY to VND at rate 3,500
 * convertCurrency(100, Currency.CNY, Currency.VND, 3500) // 350000
 *
 * // Convert 1,000,000 VND to USD at rate 0.00004
 * convertCurrency(1000000, Currency.VND, Currency.USD, 0.00004) // 40
 */
export function convertCurrency(
  amount: number,
  from: Currency,
  to: Currency,
  rate: number,
): number {
  if (rate <= 0) {
    throw new BadRequestException('Exchange rate must be a positive number.');
  }

  if (from === to) {
    return amount;
  }

  const converted = amount * rate;
  const config = CURRENCY_CONFIG[to];
  const factor = Math.pow(10, config.decimals);

  return Math.round(converted * factor) / factor;
}

/**
 * Rounds an amount to the correct number of decimal places for the given currency.
 *
 * @param amount - The amount to round
 * @param currency - The currency determining precision
 * @returns Rounded amount
 */
export function roundToCurrencyPrecision(amount: number, currency: Currency): number {
  const config = CURRENCY_CONFIG[currency];
  const factor = Math.pow(10, config.decimals);
  return Math.round(amount * factor) / factor;
}
