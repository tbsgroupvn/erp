import { format as dateFnsFormat, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';

import { Currency } from '@/lib/types/enums';

// ============================================
// CURRENCY FORMATTING
// ============================================

const CURRENCY_FORMATTERS: Record<Currency, Intl.NumberFormat> = {
  [Currency.VND]: new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }),
  [Currency.CNY]: new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
  [Currency.USD]: new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
};

/**
 * Format a numeric amount as a localised currency string.
 *
 * @param amount   The raw number (e.g. 1500000)
 * @param currency The target currency (default VND)
 * @returns Formatted string, e.g. "1.500.000 d"
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  currency: Currency = Currency.VND,
): string {
  const value = typeof amount === 'string' ? parseFloat(amount) : (amount ?? 0);
  if (isNaN(value)) return '0';
  const formatter = CURRENCY_FORMATTERS[currency] ?? CURRENCY_FORMATTERS[Currency.VND];
  return formatter.format(value);
}

// ============================================
// DATE FORMATTING
// ============================================

/**
 * Format a date string or Date object using date-fns with Vietnamese locale.
 *
 * @param date       ISO string or Date object
 * @param formatStr  date-fns format pattern (default: "dd/MM/yyyy HH:mm")
 * @returns Formatted date string, or empty string if input is falsy
 */
export function formatDate(
  date: string | Date | null | undefined,
  formatStr: string = 'dd/MM/yyyy HH:mm',
): string {
  if (!date) return '';
  const parsed = typeof date === 'string' ? parseISO(date) : date;
  return dateFnsFormat(parsed, formatStr, { locale: vi });
}

/**
 * Alias for formatDate — formats a date-time string with the default pattern.
 */
export const formatDateTime = formatDate;

// ============================================
// WEIGHT FORMATTING
// ============================================

/**
 * Format a weight value in kilograms.
 *
 * @param kg  Weight in kilograms
 * @returns Formatted string, e.g. "12.50 kg"
 */
export function formatWeight(
  kg: number | string | null | undefined,
): string {
  const value = typeof kg === 'string' ? parseFloat(kg) : (kg ?? 0);
  if (isNaN(value)) return '0 kg';
  return `${value.toFixed(2)} kg`;
}

// ============================================
// PERCENT FORMATTING
// ============================================

/**
 * Format a decimal or integer value as a percentage string.
 *
 * @param value  The percentage value (e.g. 0.15 or 15)
 * @returns Formatted string, e.g. "15.00%"
 */
export function formatPercent(
  value: number | string | null | undefined,
): string {
  const num = typeof value === 'string' ? parseFloat(value) : (value ?? 0);
  if (isNaN(num)) return '0%';
  return `${num.toFixed(2)}%`;
}
