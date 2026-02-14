import { describe, it, expect } from 'vitest';
import { codKeys } from '../use-cod';

describe('codKeys', () => {
  it('generates base key', () => {
    expect(codKeys.all).toEqual(['cod']);
  });

  it('generates lists key', () => {
    expect(codKeys.lists()).toEqual(['cod', 'list']);
  });

  it('generates list key with params', () => {
    const params = { driverId: 'drv-1', status: 'COLLECTED' };
    expect(codKeys.list(params)).toEqual(['cod', 'list', params]);
  });

  it('generates driverDay key', () => {
    expect(codKeys.driverDay('drv-1', '2024-01-15')).toEqual([
      'cod',
      'driver',
      'drv-1',
      '2024-01-15',
    ]);
  });
});
