import { SCOPE_RANK, rong, widest } from '../../src/iam/scope.constants';
test('ladder order own<team<dept<dept_tree<warehouse<all', () => {
  expect(SCOPE_RANK).toEqual({ own: 1, team: 2, dept: 3, dept_tree: 4, warehouse: 5, all: 6 });
});
test('rong returns 0 for unknown', () => { expect(rong('nope')).toBe(0); expect(rong('dept_tree')).toBe(4); });
test('widest picks the broader', () => {
  expect(widest('own', 'dept')).toBe('dept');
  expect(widest('warehouse', 'dept_tree')).toBe('warehouse');
});

// D5 Task 1 — bảng A của docs/rewrite-spec/D5-pham-vi-sale-de-xuat.md §3, đã chỉnh theo
// QUYẾT ĐỊNH chủ DN 25/09/2026: Q-D5-3 (payment.* = TEAM), Q-D5-12 (report_wallet/debts = TEAM),
// Q-D5-7 (bank.view = khách trong phạm vi + giao dịch CHƯA gán), Q-D5-5 (po qua khách).
import { SALE_SENSITIVE, saleSensitiveRule } from '../../src/iam/scope.constants';
describe('SALE_SENSITIVE (D5)', () => {
  test('không ô nào là all — sale chỉ được own/team trên quyền nhạy cảm', () => {
    for (const [code, r] of Object.entries(SALE_SENSITIVE)) {
      expect([code, ['own', 'team'].includes(r.scope)]).toEqual([code, true]);
    }
  });
  test('TEAM: customer/wallet/order/quote/po/payment (Q3)/report (Q12)/crm', () => {
    for (const c of ['customer.view', 'customer.edit', 'wallet.view', 'wallet.detail', 'wallet.exportfile',
      'wallet_detail.view', 'wallet_detail.exportfile', 'order.view', 'order.detail', 'quote.view', 'quote.edit',
      'quote.delete', 'quote.edit_rate', 'po.view', 'po.edit', 'po.exportfile', 'payment.view', 'payment.edit',
      'payment.checkcoc', 'report.report_wallet', 'report.report_debts']) {
      expect([c, SALE_SENSITIVE[c]?.scope]).toEqual([c, 'team']);
    }
    expect(saleSensitiveRule('crm.bat_ky')?.scope).toBe('team');
  });
  test('kiểu sở hữu: ví/đơn/PO qua khách; bank = qua khách + chưa gán (Q-D5-7); chiphi own', () => {
    expect(SALE_SENSITIVE['wallet.view'].kind).toBe('via_customer');
    expect(SALE_SENSITIVE['order.view'].kind).toBe('via_customer');
    expect(SALE_SENSITIVE['po.view'].kind).toBe('via_customer');
    expect(SALE_SENSITIVE['customer.view'].kind).toBe('owner');
    expect(SALE_SENSITIVE['payment.view'].kind).toBe('owner');
    expect(SALE_SENSITIVE['bank.view']).toEqual({ scope: 'team', kind: 'via_customer_or_unassigned' });
    expect(SALE_SENSITIVE['chiphi.view'].scope).toBe('own');
  });
  test('container.* KHÔNG nhạy cảm (Q-D5-8 giữ prod); tra mã không phân biệt hoa-thường/khoảng trắng', () => {
    expect(saleSensitiveRule('container.view')).toBeUndefined();
    expect(saleSensitiveRule(' Wallet.View ')).toEqual(SALE_SENSITIVE['wallet.view']);
    expect(saleSensitiveRule('')).toBeUndefined();
    expect(saleSensitiveRule(undefined as any)).toBeUndefined();
    expect(saleSensitiveRule('crm')).toBeUndefined();
    expect(saleSensitiveRule('crm.')).toBeUndefined();
  });
  test('bảng đông cứng', () => {
    expect(Object.isFrozen(SALE_SENSITIVE)).toBe(true);
    expect(Object.isFrozen(SALE_SENSITIVE['wallet.view'])).toBe(true);
  });
});
