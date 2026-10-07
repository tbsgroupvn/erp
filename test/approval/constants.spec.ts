import { AStatus, statusLabel } from '../../src/approval/approval.constants';

test('status values + labels', () => {
  expect(AStatus).toEqual({ DRAFT: 0, PENDING: 1, APPROVED: 2, REJECTED: -1, REVOKED: -2 });
  expect(statusLabel(0)).toBe('Nháp');
  expect(statusLabel(1)).toBe('Đang chờ duyệt');
  expect(statusLabel(2)).toBe('Đã duyệt');
  expect(statusLabel(-1)).toBe('Từ chối');
  expect(statusLabel(-2)).toBe('Đã thu hồi');
  expect(statusLabel(99)).toBe('?');
});
