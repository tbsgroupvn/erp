import { Currency } from '@/lib/types';
import { cn } from '@/lib/utils/cn';

interface CurrencyDisplayProps {
  amount: number;
  currency?: Currency;
  className?: string;
}

function formatAmount(amount: number, currency: Currency): string {
  switch (currency) {
    case Currency.VND:
      return (
        new Intl.NumberFormat('vi-VN', {
          maximumFractionDigits: 0,
        }).format(amount) + ' \u20AB'
      );
    case Currency.CNY:
      return (
        '\u00A5' +
        new Intl.NumberFormat('zh-CN', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(amount)
      );
    case Currency.USD:
      return (
        '$' +
        new Intl.NumberFormat('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(amount)
      );
    default:
      return new Intl.NumberFormat('vi-VN').format(amount);
  }
}

export function CurrencyDisplay({
  amount,
  currency = Currency.VND,
  className,
}: CurrencyDisplayProps) {
  return (
    <span className={cn('tabular-nums', className)}>
      {formatAmount(amount, currency)}
    </span>
  );
}
