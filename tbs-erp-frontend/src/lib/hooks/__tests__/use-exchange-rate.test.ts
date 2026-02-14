import { describe, it, expect } from 'vitest';
import { exchangeRateKeys } from '../use-exchange-rate';

describe('exchangeRateKeys', () => {
  it('generates base key', () => {
    expect(exchangeRateKeys.all).toEqual(['exchange-rate']);
  });

  it('generates current key with currencies', () => {
    expect(exchangeRateKeys.current('CNY' as never, 'VND' as never)).toEqual([
      'exchange-rate',
      'current',
      'CNY',
      'VND',
    ]);
  });

  it('generates history key with params', () => {
    const params = { from: 'CNY', to: 'VND' };
    expect(exchangeRateKeys.history(params as never)).toEqual([
      'exchange-rate',
      'history',
      params,
    ]);
  });

  it('generates active key', () => {
    expect(exchangeRateKeys.active()).toEqual(['exchange-rate', 'active']);
  });
});
