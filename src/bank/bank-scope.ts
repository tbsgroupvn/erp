import { Prisma } from '@prisma/client';
import { ScopeService } from '../iam/scope.service';
import { saleSensitiveRule } from '../iam/scope.constants';

/** Mã quyền đọc giao dịch ngân hàng (`/bank` prod). */
export const BANK_VIEW = 'bank.view';

const DENY = { id: -1 } as const;

/**
 * D5 Q-D5-7 (quyết định chủ DN 25/09/2026, HẸP HƠN prod): phạm vi đọc `tbl_bank_transaction`.
 *  - `bank.view = all` (kế toán…) ⇒ `{}` — không đổi hành vi.
 *  - phạm vi hẹp hơn ⇒ giao dịch đã gán khách TRONG phạm vi khách của người đó (`cus_id ∈ codes`,
 *    cùng luật own/team của `Customer`) + giao dịch CHƯA gán (`cus_id` NULL hoặc '').
 *  - không quyền / danh tính hỏng / phạm vi không áp được lên khách ⇒ DENY.
 *
 * "Chưa gán" không biểu diễn được trong ma trận (enum `Scope`) nên luật đọc từ `kind` của
 * `SALE_SENSITIVE['bank.view']`, không chỉ `scope`. Kind khác `via_customer_or_unassigned` ⇒ bỏ vế
 * chưa gán; kind `owner` (BankTransaction không có cột người phụ trách) ⇒ DENY.
 *
 * ⚠ CHƯA CÓ đường đọc giao dịch NH nào cho sale ở v2 (09c chỉ có `BankIngestService` ghi, và
 * `/bank/recon` gác `account.view` + Super Admin/kế toán). Hàm này là where-builder dựng sẵn + test;
 * route danh sách `/bank` khi dựng PHẢI gọi nó (lưới test/iam/sale-sensitive-inventory.spec.ts đòi
 * mọi route mang `bank.view` khai trong danh sách đường đã kiểm).
 *
 * Giới hạn đã biết: "đã gán" tính theo `BankTransaction.cusId` (cột cấp giao dịch). Phân bổ chi tiết
 * (`tbl_bank_transaction_detail.cus_id`) không được xét — giao dịch tách cho nhiều khách mà cột cấp
 * giao dịch trỏ khách khác sẽ KHÔNG hiện với sale (fail-closed).
 */
export async function bankTxScope(scope: ScopeService, uid: number): Promise<Prisma.BankTransactionWhereInput> {
  const rule = saleSensitiveRule(BANK_VIEW);
  if (!rule || rule.kind === 'owner') return { ...DENY } as unknown as Prisma.BankTransactionWhereInput;
  return scope.buildDocScope(BANK_VIEW, uid, {
    viaCustomer: 'cusId',
    unassigned: rule.kind === 'via_customer_or_unassigned',
  });
}
