import { describe, it, expect } from 'vitest';
import { financeKeys } from '../use-finance';

describe('financeKeys', () => {
  describe('AR keys', () => {
    it('generates base key', () => {
      expect(financeKeys.ar.all).toEqual(['receivables']);
    });

    it('generates lists key', () => {
      expect(financeKeys.ar.lists()).toEqual(['receivables', 'list']);
    });

    it('generates list key with params', () => {
      const params = { page: 1, limit: 10 };
      expect(financeKeys.ar.list(params)).toEqual(['receivables', 'list', params]);
    });

    it('generates detail key', () => {
      expect(financeKeys.ar.detail('ar-1')).toEqual(['receivables', 'detail', 'ar-1']);
    });

    it('generates overdue key', () => {
      expect(financeKeys.ar.overdue()).toEqual(['receivables', 'overdue']);
    });

    it('generates aging key', () => {
      expect(financeKeys.ar.aging()).toEqual(['receivables', 'aging']);
    });

    it('generates customerDebt key', () => {
      expect(financeKeys.ar.customerDebt('cust-1')).toEqual([
        'receivables',
        'customer-debt',
        'cust-1',
      ]);
    });
  });

  describe('AP keys', () => {
    it('generates base key', () => {
      expect(financeKeys.ap.all).toEqual(['payables']);
    });

    it('generates detail key', () => {
      expect(financeKeys.ap.detail('ap-1')).toEqual(['payables', 'detail', 'ap-1']);
    });
  });

  describe('Voucher keys', () => {
    it('generates base key', () => {
      expect(financeKeys.vouchers.all).toEqual(['vouchers']);
    });

    it('generates cashFlow key', () => {
      expect(financeKeys.vouchers.cashFlow()).toEqual(['vouchers', 'cash-flow']);
    });
  });

  describe('Invoice keys', () => {
    it('generates base key', () => {
      expect(financeKeys.invoices.all).toEqual(['invoices']);
    });

    it('generates lists key', () => {
      expect(financeKeys.invoices.lists()).toEqual(['invoices', 'list']);
    });
  });
});
