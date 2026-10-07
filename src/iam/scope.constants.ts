export type ScopeName = 'own' | 'team' | 'dept' | 'dept_tree' | 'warehouse' | 'all';
export const SCOPE_RANK: Record<ScopeName, number> = { own: 1, team: 2, dept: 3, dept_tree: 4, warehouse: 5, all: 6 };
export function rong(scope: string): number { return (SCOPE_RANK as Record<string, number>)[scope] ?? 0; }
export function widest(a: string, b: string): ScopeName { return (rong(a) >= rong(b) ? a : b) as ScopeName; }

/**
 * D5 — quyền NHẠY CẢM với sale: người thuộc nhóm sale CHỈ được giữ `own`/`team` trên các mã này
 * (không bao giờ `all`). Nguồn: docs/rewrite-spec/D5-pham-vi-sale-de-xuat.md §3 bảng phương án A,
 * ĐÃ CHỈNH theo QUYẾT ĐỊNH chủ DN 25/09/2026:
 *  - Q-D5-3  `payment.*` = TEAM (bảng A ghi own) — leader thấy phiếu TT NCC của cả team.
 *  - Q-D5-12 `report.report_wallet`/`report_debts` = TEAM (bảng A ghi own).
 *  - Q-D5-5  PO sở hữu THEO KHÁCH (`buyerCode`, H3) như web.
 *  - Q-D5-7  `bank.view` SIẾT (bảng A ghi "giữ all"): giao dịch đã gán khách trong phạm vi + giao
 *            dịch CHƯA gán — kiểu `via_customer_or_unassigned`; nối dây ở Task 2.
 *  - Q-D5-8  `container.*` giữ prod (thấy hết) ⇒ KHÔNG có trong bảng.
 *
 * `kind` = cách xác định "chứng từ này của ai" (Task 2 đọc để nối dây):
 *  - `owner`       : cột người phụ trách trên chính chứng từ (`saler`/`salerOther`/`createdBy`).
 *  - `via_customer`: qua mã khách (`buildDocScope(..., {viaCustomer})` hoặc ScopeGuard `customer`).
 *  - `via_customer_or_unassigned`: như trên, CỘNG các dòng chưa gán khách.
 */
export type SaleScopeKind = 'owner' | 'via_customer' | 'via_customer_or_unassigned';
export type SaleSensitiveRule = Readonly<{ scope: 'own' | 'team'; kind: SaleScopeKind }>;

const luat = (scope: 'own' | 'team', kind: SaleScopeKind): SaleSensitiveRule => Object.freeze({ scope, kind });

export const SALE_SENSITIVE: Readonly<Record<string, SaleSensitiveRule>> = Object.freeze({
  'customer.view': luat('team', 'owner'),
  'customer.edit': luat('team', 'owner'),
  'wallet.view': luat('team', 'via_customer'),
  'wallet.detail': luat('team', 'via_customer'),
  'wallet.exportfile': luat('team', 'via_customer'),
  'wallet_detail.view': luat('team', 'via_customer'),
  'wallet_detail.exportfile': luat('team', 'via_customer'),
  'order.view': luat('team', 'via_customer'),
  'order.detail': luat('team', 'via_customer'),
  'quote.view': luat('team', 'owner'),
  'quote.edit': luat('team', 'owner'),
  'quote.delete': luat('team', 'owner'),
  'quote.edit_rate': luat('team', 'owner'),
  'po.view': luat('team', 'via_customer'),
  'po.edit': luat('team', 'via_customer'),
  'po.exportfile': luat('team', 'via_customer'),
  'payment.view': luat('team', 'owner'),
  'payment.edit': luat('team', 'owner'),
  'payment.checkcoc': luat('team', 'owner'),
  'report.report_wallet': luat('team', 'via_customer'),
  'report.report_debts': luat('team', 'via_customer'),
  'bank.view': luat('team', 'via_customer_or_unassigned'),
  'chiphi.view': luat('own', 'owner'),
});

/** Cả module nhạy cảm (mọi `crm.<action>`): TEAM theo `assignedTo`, khi dựng #11. */
export const SALE_SENSITIVE_MODULES: Readonly<Record<string, SaleSensitiveRule>> = Object.freeze({
  crm: luat('team', 'owner'),
});

/** Tra luật cho một mã quyền (chuẩn hoá trim + lowercase như PermService). Không nhạy cảm ⇒ undefined. */
export function saleSensitiveRule(code: string): SaleSensitiveRule | undefined {
  const k = typeof code === 'string' ? code.trim().toLowerCase() : '';
  if (!k) return undefined;
  if (Object.prototype.hasOwnProperty.call(SALE_SENSITIVE, k)) return SALE_SENSITIVE[k];
  const dot = k.indexOf('.');
  if (dot <= 0 || dot === k.length - 1) return undefined;
  const mod = k.slice(0, dot);
  return Object.prototype.hasOwnProperty.call(SALE_SENSITIVE_MODULES, mod) ? SALE_SENSITIVE_MODULES[mod] : undefined;
}
