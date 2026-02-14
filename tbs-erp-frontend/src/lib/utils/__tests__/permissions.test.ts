import { describe, it, expect } from 'vitest';
import {
  canAccessRoute,
  getDashboardType,
  BOD_ROLES,
  SALES_ROLES,
  FINANCE_ROLES,
  WAREHOUSE_ROLES,
} from '../permissions';
import { UserRole } from '@/lib/types/enums';

describe('canAccessRoute', () => {
  it('CEO has access to all routes', () => {
    expect(canAccessRoute(UserRole.CEO, '/don-hang')).toBe(true);
    expect(canAccessRoute(UserRole.CEO, '/tai-chinh/ty-gia')).toBe(true);
    expect(canAccessRoute(UserRole.CEO, '/nhan-su')).toBe(true);
  });

  it('CSKH can access don-hang and khieu-nai', () => {
    expect(canAccessRoute(UserRole.CSKH, '/don-hang')).toBe(true);
    expect(canAccessRoute(UserRole.CSKH, '/khieu-nai')).toBe(true);
    expect(canAccessRoute(UserRole.CSKH, '/khach-hang')).toBe(true);
  });

  it('CSKH cannot access finance routes', () => {
    expect(canAccessRoute(UserRole.CSKH, '/tai-chinh')).toBe(false);
    expect(canAccessRoute(UserRole.CSKH, '/luong')).toBe(false);
  });

  it('DRIVER has limited access', () => {
    expect(canAccessRoute(UserRole.DRIVER, '/giao-hang')).toBe(true);
    expect(canAccessRoute(UserRole.DRIVER, '/don-hang')).toBe(false);
    expect(canAccessRoute(UserRole.DRIVER, '/tai-chinh')).toBe(false);
  });

  it('handles nested route prefixes', () => {
    expect(canAccessRoute(UserRole.CHIEF_ACCOUNTANT, '/tai-chinh/cong-no-phai-thu')).toBe(true);
  });
});

describe('getDashboardType', () => {
  it('returns executive for CEO and COO', () => {
    expect(getDashboardType(UserRole.CEO)).toBe('executive');
    expect(getDashboardType(UserRole.COO)).toBe('executive');
  });

  it('returns sales for sales roles', () => {
    expect(getDashboardType(UserRole.SALE)).toBe('sales');
    expect(getDashboardType(UserRole.SALES_DIRECTOR)).toBe('sales');
  });

  it('returns cskh for CSKH role', () => {
    expect(getDashboardType(UserRole.CSKH)).toBe('cskh');
  });

  it('returns finance for accounting roles', () => {
    expect(getDashboardType(UserRole.CHIEF_ACCOUNTANT)).toBe('finance');
    expect(getDashboardType(UserRole.ACCOUNTANT_AR)).toBe('finance');
  });

  it('returns warehouse for warehouse roles', () => {
    expect(getDashboardType(UserRole.WAREHOUSE_VN_MANAGER)).toBe('warehouse');
    expect(getDashboardType(UserRole.WAREHOUSE_CN_AGENT)).toBe('warehouse');
  });

  it('returns logistics for driver', () => {
    expect(getDashboardType(UserRole.DRIVER)).toBe('logistics');
  });

  it('returns operations for XNK roles', () => {
    expect(getDashboardType(UserRole.XNK_MANAGER)).toBe('operations');
  });
});

describe('role groups', () => {
  it('BOD_ROLES contains CEO and COO', () => {
    expect(BOD_ROLES).toContain(UserRole.CEO);
    expect(BOD_ROLES).toContain(UserRole.COO);
    expect(BOD_ROLES).toHaveLength(2);
  });

  it('SALES_ROLES contains CSKH', () => {
    expect(SALES_ROLES).toContain(UserRole.CSKH);
    expect(SALES_ROLES).toContain(UserRole.SALE);
  });

  it('FINANCE_ROLES contains accountant roles', () => {
    expect(FINANCE_ROLES).toContain(UserRole.CHIEF_ACCOUNTANT);
    expect(FINANCE_ROLES).toHaveLength(3);
  });

  it('WAREHOUSE_ROLES contains all warehouse/xnk roles', () => {
    expect(WAREHOUSE_ROLES).toContain(UserRole.WAREHOUSE_VN_MANAGER);
    expect(WAREHOUSE_ROLES).toContain(UserRole.WAREHOUSE_CN_AGENT);
    expect(WAREHOUSE_ROLES).toHaveLength(5);
  });
});
