import { describe, it, expect } from 'vitest';
import { complaintKeys } from '../use-complaints';
import { ComplaintStatus } from '@/lib/types/enums';

describe('complaintKeys', () => {
  it('generates base key', () => {
    expect(complaintKeys.all).toEqual(['complaints']);
  });

  it('generates lists key', () => {
    expect(complaintKeys.lists()).toEqual(['complaints', 'list']);
  });

  it('generates list key with params', () => {
    const params = { status: ComplaintStatus.OPEN, page: 1 };
    expect(complaintKeys.list(params)).toEqual(['complaints', 'list', params]);
  });

  it('generates details key', () => {
    expect(complaintKeys.details()).toEqual(['complaints', 'detail']);
  });

  it('generates detail key with id', () => {
    expect(complaintKeys.detail('comp-123')).toEqual([
      'complaints',
      'detail',
      'comp-123',
    ]);
  });

  it('generates statistics key', () => {
    expect(complaintKeys.statistics()).toEqual(['complaints', 'statistics']);
  });
});
