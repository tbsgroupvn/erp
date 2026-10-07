import { SetMetadata } from '@nestjs/common';

export const SCOPED_BY = 'scoped_by';

/**
 * Đóng lỗ ENUMERATION mà PermGuard bỏ trống: PermGuard chỉ xác nhận "được
 * phép GỌI route này" (qua @RequirePerm), KHÔNG xác nhận "bản ghi ứng với
 * tham số route (vd `:cusId`) có nằm trong phạm vi của người gọi". Một sale
 * phạm vi `own` giữ token hợp lệ + `wallet.view` vẫn dò được mọi mã khách
 * tuần tự và đọc số dư của người khác — @ScopedBy + ScopeGuard (scope.guard.ts)
 * nối phần còn thiếu bằng MỘT truy vấn `findFirst` gộp cả điều kiện tồn tại
 * lẫn điều kiện phạm vi (xem chú thích đầu scope.guard.ts để biết vì sao phải
 * là MỘT truy vấn, MỘT lỗi).
 *
 * Entity hỗ trợ:
 *  - `'customer'` — khoá nối `Customer.code` === `Wallet.cusId` (chuỗi, KHÔNG
 *    có FK) là khoá liên-module của cả dự án, xem CLAUDE.md/MEMORY.md.
 *  - `'supplierPayment'` (09a, `tbl_payment`) — `field: 'id'`, tham số route
 *    phải là số nguyên dương (khác ⇒ 404 như không tồn tại); chủ sở hữu là cột
 *    `saler`, KHÔNG có người phụ trách phụ.
 *  - `'fundAccount'` (09b, `tbl_accounts`) — `field: 'code'`; không có chủ sở hữu ⇒ chỉ phạm vi
 *    `all` thấy, phạm vi hẹp hơn ≡ không tồn tại (404).
 *  - `'purchaseOrder'` (#06, `tbl_purchase_orders`) — `field: 'id'`, số nguyên dương; chủ sở hữu
 *    `createdBy` (cùng luật `PoService.listForUser`), không người phụ trách phụ, không cột kho.
 * Mở rộng sang entity khác thì thêm nhánh trong bảng tra của ScopeGuard,
 * không đổi shape của decorator này.
 */
export interface ScopedByEntity {
  /** Bảng đối chiếu phạm vi — phải có dòng trong bảng tra của ScopeGuard (entity lạ ⇒ 404). */
  entity: 'customer' | 'supplierPayment' | 'fundAccount' | 'purchaseOrder';
  /** Tên tham số trên route, vd 'cusId' trong `:cusId`. */
  param: string;
  /** Cột trên `entity` khớp với giá trị tham số, vd Customer.code. */
  field: string;
}

/**
 * Lối thoát CÓ CHỦ ĐÍCH cho route mang tham số route trông như định danh bản
 * ghi (`:id`, `:code`…) nhưng KHÔNG cần ScopeGuard — vd tham số đó là enum
 * cố định, không phải khoá tra một bảng có chủ sở hữu. Task 2 của kế hoạch
 * (.superpowers/sdd/2026-09-24-perm-scope-plan/task-2-brief.md) đòi lối thoát
 * này phải là một HÀNH ĐỘNG THẤY ĐƯỢC, không phải một khoảng trống im lặng:
 *  - `reason` bắt buộc khác rỗng — `route-inventory.spec.ts` đọc field này,
 *    thiếu/rỗng vẫn bị lưới bắt đỏ y như không khai @ScopedBy.
 *  - route-inventory.spec.ts còn so KHỚP ĐÚNG danh sách route nào đang
 *    `none:true` (giống cách nó khoá cứng danh sách @Public) — thêm một
 *    opt-out MỚI bắt buộc phải sửa chính test đó, không lặng lẽ lọt qua.
 */
export interface ScopedByNone {
  none: true;
  /** Vì sao route này KHÔNG cần ScopeGuard dù có tham số định danh trên path. */
  reason: string;
}

export type ScopedByOptions = ScopedByEntity | ScopedByNone;

export const ScopedBy = (opts: ScopedByOptions) => SetMetadata(SCOPED_BY, opts);
