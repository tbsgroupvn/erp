import { PrismaService } from '../prisma/prisma.service';

/**
 * M-4 — khoá chống ghi trùng (`WalletEntry.refKey`) cho bút toán tiền của phiếu duyệt.
 *
 * Khoá cũ `approval:<id>` KHÔNG mang loại hiệu ứng: một hiệu ứng tiền thứ hai trên cùng phiếu sẽ đụng
 * đúng khoá của hiệu ứng thứ nhất ⇒ applyEntry trả `alreadyApplied` ⇒ hiệu ứng thứ hai bị BỎ QUA LẶNG
 * LẼ. Khoá mới: `approval:<id>:<objectType của hiệu ứng>`.
 *
 * ⚠ Bút toán ĐÃ ghi bằng khoá cũ không được trừ lần hai. Đổi khoá thuần tuý thì lượt chạy lại (quét
 * sau sự cố) sẽ không thấy khoá mới ⇒ ghi thêm. Nên `effectApplied()` coi hiệu ứng là ĐÃ ghi nếu có:
 *   (1) bút toán mang khoá MỚI, hoặc
 *   (2) bút toán mang khoá CŨ `approval:<id>` VÀ đúng `type` của hiệu ứng này — khoá cũ chỉ từng được
 *       ghi bởi handler rút (type −3) hoặc phân bổ (type 4), nên type phân biệt được hiệu ứng nào đã
 *       ghi nó; khoá cũ mang type KHÁC là của hiệu ứng khác ⇒ KHÔNG chặn hiệu ứng này, hoặc
 *   (3) dấu `legacyNoteMarker` trong `note` (vd prod viRutTienDuyetXong() ghi "[PHIEU-RUT#<id>]" và
 *       chính prod dùng nó để khỏi trừ hai lần) — bút toán nạp từ prod có `ref_key = NULL`.
 * Không viết lại khoá cũ trong CSDL (không UPDATE sổ ví); khoá cũ chỉ còn được ĐỌC.
 */
export function approvalRefKey(requestId: number, effect: string): string {
  return `approval:${requestId}:${effect}`;
}

/** Khoá trước M-4 — CHỈ ĐỌC. */
export function legacyApprovalRefKey(requestId: number): string {
  return `approval:${requestId}`;
}

export async function effectApplied(
  prisma: PrismaService, requestId: number, effect: string, entryType: number,
  legacy?: { noteMarker: string; cus: string; money: bigint },
): Promise<boolean> {
  if (await prisma.walletEntry.findUnique({ where: { refKey: approvalRefKey(requestId, effect) }, select: { id: true } }))
    return true;
  const old = await prisma.walletEntry.findUnique({ where: { refKey: legacyApprovalRefKey(requestId) }, select: { type: true } });
  if (old && old.type === entryType) return true;
  if (legacy) {
    // Khớp CẢ khách và số tiền, không chỉ dấu: nếu migration #04 không giữ nguyên id phiếu thì
    // "[PHIEU-RUT#10]" của prod có thể trùng số với một phiếu KHÁC của hệ mới — khi đó chỉ khớp dấu
    // sẽ bỏ qua lệnh trừ thật (phiếu duyệt mà ví không trừ). Thêm cus+money thì trùng nhầm phải
    // trùng cả khách lẫn số tiền.
    const m = await prisma.walletEntry.findFirst({
      where: { type: entryType, cusId: legacy.cus, money: legacy.money, note: { contains: legacy.noteMarker } },
      select: { id: true },
    });
    if (m) return true;
  }
  return false;
}
