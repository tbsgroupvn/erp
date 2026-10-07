import { PrismaService } from '../prisma/prisma.service';
import { phpRound } from '../common/money';
import type { IPendingHoldProvider } from './hold.service';

/**
 * Q7 (docs/rewrite-spec/migration/03-vi-gl.md mục 5.11) — GIỮ TIỀN cho phiếu duyệt TRỪ VÍ
 * đang chờ. Chép từ prod `libs/cls.wallet.php` holdCalc() (đọc 24/09/2026):
 *
 *   SELECT r.form_data, t.code FROM tbl_approval_requests r JOIN tbl_approval_templates t …
 *    WHERE t.code IN ('phan_bo_vi_kh','rut_tien_vi_kh') AND r.status=1
 *      AND (r.is_deleted IS NULL OR r.is_deleted=0) [AND r.id<>$ex]
 *   rồi với từng dòng: bỏ qua nếu form_data không phải JSON, bỏ qua nếu trim(form.cus) !== $cusid,
 *   rut_tien_vi_kh ⇒ giữ += max(0, (int)round(tbs_num(form.so_tien))).
 *
 * Tiền của phiếu chờ VẪN nằm trong sổ (chưa trừ) nhưng không được tiêu vào việc khác; khi phiếu
 * được duyệt thì status rời 1 ⇒ tự nhả giữ, đúng lúc handler trừ ví. Thiếu provider này thì
 * khách tiêu được tiền đang chờ rút (ca thật TBS1931, phiếu #91795, 15.965.000đ).
 *
 * Khoá theo `objectType` (prod: rut_tien_vi_kh ↔ wallet_withdraw, phan_bo_vi_kh ↔ wallet_alloc,
 * 1:1 trên prod) vì BusinessSyncService chọn handler trừ ví theo `objectType` — giữ và trừ phải
 * nhìn cùng một khoá, nếu không sẽ có phiếu bị trừ mà chưa từng được giữ.
 *
 * ⚠ SỐ TIỀN GIỮ = SỐ TIỀN HANDLER SẼ TRỪ, đọc qua CÙNG MỘT hàm `walletDebitOfForm()` —
 * handler rút (wallet-withdraw.handler.ts) và handler phân bổ (wallet-alloc.handler.ts) gọi
 * đúng hàm này. Đừng tự parse `so_tien` ở chỗ khác: hai bản parse lệch nhau là giữ một số,
 * trừ một số khác.
 *   - wallet_withdraw: `so_tien` — khớp prod.
 *   - wallet_alloc: `so_tien` — theo WalletAllocHandler của hệ mới (trừ so_tien). Prod phan_bo_vi_kh
 *     giữ `doi_te_vnd` (phần vào PO nằm ở tbl_po_receipts) vì handler prod trừ PO+đổi tệ; hệ mới
 *     chưa chép luồng đó. Prod có 0 phiếu phan_bo_vi_kh từ trước tới nay (đo 24/09/2026).
 */
export const HOLD_OBJECT_TYPES = ['wallet_withdraw', 'wallet_alloc'] as const;

/** Trạng thái "đang chờ duyệt" — AStatus.PENDING (src/approval/approval.constants.ts), = status 1 prod. */
const PENDING = 1;

/**
 * Bản chép `tbs_num()` của prod (global/libs/gffunc.php): parser số BAO DUNG.
 * VN "1.234.567,89" → 1234567.89 · Mỹ "1,234,567.89" → 1234567.89 · "5,5" → 5.5 · "1.500" → 1500.
 * Có CẢ chấm và phẩy thì dấu đứng SAU CÙNG là thập phân.
 */
export function tbsNum(input: unknown): number {
  let v: string;
  if (input === null || input === undefined) v = '';
  else if (typeof input === 'boolean') v = input ? '1' : '';           // PHP (string)true = "1"
  else if (typeof input === 'object') return 0;                          // PHP "Array" → 0
  else v = String(input);
  v = v.trim();
  if (v === '') return 0;
  v = v.replace(/[^0-9.,\-]/g, '');
  if (v === '' || v === '-') return 0;
  const neg = v[0] === '-';
  v = v.replace(/^-+/, '');
  if (v === '') return 0;
  const hasC = v.includes(','), hasD = v.includes('.');
  if (hasC && hasD) {
    if (v.lastIndexOf(',') > v.lastIndexOf('.')) v = v.replace(/\./g, '').replace(/,/g, '.');
    else v = v.replace(/,/g, '');
  } else if (hasC) {
    if (/^\d{1,3}(,\d{3}){2,}$/.test(v)) v = v.replace(/,/g, '');
    else v = v.replace(/,/g, '.');
  } else if (hasD) {
    if (/^[1-9]\d{0,2}(\.\d{3})+$/.test(v)) v = v.replace(/\./g, '');
  }
  // PHP (float)"…" đọc phần số ĐẦU chuỗi, không số thì 0 — parseFloat cũng đọc tiền tố, NaN → 0.
  const n = parseFloat(v);
  const f = Number.isFinite(n) ? n : 0;
  return neg ? -f : f;
}

/** prod holdNum(): (int)round(floatval(tbs_num($v))), rồi max(0, …). */
function vndNonNeg(v: unknown): bigint {
  const n = phpRound(tbsNum(v), 0);
  return n > 0 ? BigInt(n) : 0n;
}

/**
 * Khách + số tiền mà phiếu (objectType, form) sẽ TRỪ khỏi ví khi được duyệt.
 * `null` = form không phải JSON object (prod: `continue`). Nguồn DUY NHẤT cho cả giữ lẫn trừ.
 */
export function walletDebitOfForm(formData: string | null | undefined): { cus: string; amount: bigint } | null {
  let fd: unknown;
  try { fd = JSON.parse(formData || '{}'); } catch { return null; }
  if (!fd || typeof fd !== 'object' || Array.isArray(fd)) return null;
  const f = fd as Record<string, unknown>;
  const cus = typeof f.cus === 'string' || typeof f.cus === 'number' ? String(f.cus).trim() : '';
  return { cus, amount: vndNonNeg(f.so_tien) };
}

export class ApprovalPendingHoldProvider implements IPendingHoldProvider {
  constructor(private prisma: PrismaService) {}

  async pendingHold(cusId: string, excludeRequestId?: number): Promise<bigint> {
    const c = (cusId ?? '').trim();
    if (!c) return 0n;
    const rows = await this.prisma.approvalRequest.findMany({
      where: {
        objectType: { in: [...HOLD_OBJECT_TYPES] },
        status: PENDING,
        isDeleted: false,
        // ⚠ dựng có điều kiện: Prisma BỎ key `undefined` khỏi where — không để lọt `{ not: undefined }`.
        ...(excludeRequestId && excludeRequestId > 0 ? { id: { not: excludeRequestId } } : {}),
      },
      select: { formData: true, templateId: true, objectType: true },
    });
    // I-2: chỉ giữ cho phiếu mà MẪU mang đúng loại trừ ví (prod lọc theo t.code IN (…) qua JOIN mẫu).
    // `objectType` trên phiếu có thể do người gửi tự khai/dữ liệu cũ — tin nó thì phiếu của mẫu bất kỳ
    // đóng băng được ví của khách bất kỳ.
    const tplIds = [...new Set(rows.map((r) => r.templateId))];
    const tpls = tplIds.length
      ? await this.prisma.approvalTemplate.findMany({ where: { id: { in: tplIds } }, select: { id: true, objectType: true } })
      : [];
    const tplType = new Map(tpls.map((t) => [t.id, t.objectType]));
    let hold = 0n;
    for (const r of rows) {
      if (tplType.get(r.templateId) !== r.objectType) continue;
      const d = walletDebitOfForm(r.formData);
      if (d && d.cus === c) hold += d.amount; // prod so ===: phân biệt hoa/thường, sau trim
    }
    return hold;
  }
}
