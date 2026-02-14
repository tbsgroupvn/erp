import { describe, it, expect } from 'vitest';
import { attendanceKeys, leaveKeys } from '../use-attendance';
import { LeaveStatus } from '@/lib/types/enums';

describe('attendanceKeys', () => {
  it('generates base key', () => {
    expect(attendanceKeys.all).toEqual(['attendance']);
  });

  it('generates lists key', () => {
    expect(attendanceKeys.lists()).toEqual(['attendance', 'list']);
  });

  it('generates list key with params', () => {
    const params = { employeeId: 'emp-1', status: 'PRESENT' };
    expect(attendanceKeys.list(params)).toEqual(['attendance', 'list', params]);
  });

  it('generates list key without params', () => {
    expect(attendanceKeys.list()).toEqual(['attendance', 'list', undefined]);
  });

  it('generates my key with params', () => {
    const params = { dateFrom: '2024-01-01', dateTo: '2024-01-31' };
    expect(attendanceKeys.my(params)).toEqual(['attendance', 'my', params]);
  });

  it('generates summary key with date', () => {
    expect(attendanceKeys.summary('2024-01-15')).toEqual([
      'attendance',
      'summary',
      '2024-01-15',
    ]);
  });

  it('generates summary key without date', () => {
    expect(attendanceKeys.summary()).toEqual(['attendance', 'summary', undefined]);
  });
});

describe('leaveKeys', () => {
  it('generates base key', () => {
    expect(leaveKeys.all).toEqual(['leave']);
  });

  it('generates lists key', () => {
    expect(leaveKeys.lists()).toEqual(['leave', 'list']);
  });

  it('generates list key with params', () => {
    const params = { status: LeaveStatus.APPROVED };
    expect(leaveKeys.list(params)).toEqual(['leave', 'list', params]);
  });

  it('generates my key with params', () => {
    const params = { employeeId: 'emp-1' };
    expect(leaveKeys.my(params)).toEqual(['leave', 'my', params]);
  });

  it('generates balance key', () => {
    expect(leaveKeys.balance()).toEqual(['leave', 'balance']);
  });
});
