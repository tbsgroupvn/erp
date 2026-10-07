import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AStatus } from './approval.constants';

/**
 * Hiệu ứng nghiệp vụ chạy khi phiếu duyệt xong (vd trừ ví).
 *
 * ⚠ `sync()` PHẢI AN TOÀN KHI CHẠY LẠI (idempotent): nó được gọi TRƯỚC khi phiếu đổi trạng thái,
 * và được gọi lại bởi lượt quét `ApprovalService.resumeUnfinished()` sau sự cố. Handler tiền neo
 * bút toán bằng `refKey` và tự nhận ra bút toán của chính phiếu đã nằm trong sổ (`isApplied`).
 * Lỗi ⇒ NÉM (fail-visible); phiếu khi đó KHÔNG được thành APPROVED.
 */
export interface IBusinessSyncHandler {
  objectType: string;
  sync(request: any): Promise<void>;
  /** Hiệu ứng của phiếu này ĐÃ nằm trong sổ chưa. Không khai = coi như chưa. */
  isApplied?(request: any): Promise<boolean>;
}

export type EffectResult = { ok: true } | { ok: false; msg: string };

/** Tiền tố nhận xét hệ thống khi trừ ví lúc duyệt xong không thành — nguyên văn prod
 *  `libs/cls.approval.php` viRutTienDuyetXong() để tra cứu vận hành không phải đổi thói quen. */
export const SYNC_FAIL_PREFIX = '[VI] TRU VI THAT BAI';

/** Giao dịch khoá dòng phiếu trong lúc chạy hiệu ứng — hiệu ứng (applyEntry + GL) chạy trên kết nối
 *  khác nên cần thời hạn rộng hơn mặc định 5 giây của Prisma. */
/*  #04b (review cuối): GHIM READ COMMITTED. G2 trong finalize() đọc ReturnState SAU khi lấy khoá dòng
 *  phiếu; returnToSubmitter() chỉ KHOÁ dòng phiếu chứ không SỬA nó. Dưới REPEATABLE READ, snapshot của
 *  finalize lấy trước lúc trả về ⇒ G2 đọc "chưa bị trả" và hiệu ứng tiền chạy. Postgres mặc định đã là
 *  READ COMMITTED — ghim để không ai đổi mặc định mà vô tình mở lại lỗ đó. */
export const FINALIZE_TX = { maxWait: 10_000, timeout: 60_000, isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted };

function nowSec() { return Math.floor(Date.now() / 1000); }

/**
 * I-2 — lớp phòng thủ thứ hai (sau RequestService.submit): handler tiền chỉ chạy khi MẪU của phiếu
 * mang đúng loại handler phục vụ. `objectType` trên phiếu có thể đến từ dữ liệu cũ/đường ghi khác
 * không qua submit; mẫu thì do quản trị cấu hình. Prod quyết theo mã mẫu (tpl_code === 'rut_tien_vi_kh').
 * Lệch ⇒ NÉM: phiếu không thành APPROVED, nhận xét thất bại nằm trên phiếu.
 */
export async function assertTemplateType(
  prisma: PrismaService, request: { id: number; templateId: number; objectType: string }, objectType: string,
): Promise<void> {
  const t = await prisma.approvalTemplate.findUnique({ where: { id: request.templateId }, select: { code: true, objectType: true } });
  if (!t || t.objectType !== objectType || request.objectType !== objectType)
    throw new Error(`Phiếu #${request.id}: mẫu ${t?.code ?? '?'} (loại "${t?.objectType ?? '?'}") không phải mẫu ${objectType} — không chạy`);
}

/**
 * Điều phối hiệu ứng nghiệp vụ theo `objectType`.
 *
 * I-1 (24/09/2026): trước đây `onApproved` được gọi SAU khi phiếu đã APPROVED và đặt `synced=true`
 * TRƯỚC khi handler chạy. Hai lỗ: (1) status rời PENDING ⇒ tiền giữ nhả ⇒ lệnh tiêu chen vào làm
 * bước trừ thất bại mà phiếu vẫn APPROVED; (2) sập sau khi đánh `synced` ⇒ "đã đồng bộ, chưa trừ"
 * vĩnh viễn. Nay hiệu ứng chạy qua `runEffect()` TRONG KHI phiếu còn PENDING và dòng phiếu đang bị
 * khoá (xem `ApprovalService.finalize`); `synced` chỉ được đặt SAU khi hiệu ứng thành công.
 */
@Injectable()
export class BusinessSyncService {
  private handlers = new Map<string, IBusinessSyncHandler>();
  constructor(private prisma: PrismaService) {}

  register(h: IBusinessSyncHandler) { this.handlers.set(h.objectType, h); }

  /** Các objectType có hiệu ứng nghiệp vụ đăng ký. */
  handledTypes(): string[] { return [...this.handlers.keys()]; }

  /**
   * Chạy hiệu ứng của phiếu. KHÔNG đổi trạng thái, KHÔNG đặt `synced` — việc đó của người gọi.
   * Thất bại ⇒ ghi nhận xét hệ thống thấy được lên phiếu và trả `{ ok: false }` (không ném).
   */
  async runEffect(requestId: number): Promise<EffectResult> {
    const req = await this.prisma.approvalRequest.findUnique({ where: { id: requestId } });
    if (!req) return { ok: false, msg: 'Phiếu không tồn tại' };
    const h = this.handlers.get(req.objectType);
    if (!h) return { ok: true }; // loại phiếu không có hiệu ứng nghiệp vụ
    try {
      await h.sync(req);
      return { ok: true };
    } catch (err) {
      const msg = (err as Error)?.message ?? String(err);
      await this.recordFailure(requestId, msg);
      return { ok: false, msg };
    }
  }

  /** Hiệu ứng của phiếu đã nằm trong sổ chưa (handler không khai `isApplied` ⇒ false). */
  async isApplied(requestId: number): Promise<boolean> {
    const req = await this.prisma.approvalRequest.findUnique({ where: { id: requestId } });
    if (!req) return false;
    const h = this.handlers.get(req.objectType);
    return h?.isApplied ? h.isApplied(req) : false;
  }

  /**
   * Dấu thất bại THẤY ĐƯỢC trên phiếu — giữ tinh thần nhận xét hệ thống của prod. Không ghi trùng
   * nếu nhận xét hệ thống mới nhất của phiếu đã y hệt (lượt quét chạy lại không được spam phiếu).
   */
  private async recordFailure(requestId: number, msg: string) {
    const comment = `${SYNC_FAIL_PREFIX}: ${msg}. Ví CHƯA bị trừ — phiếu CHƯA duyệt xong; kế toán kiểm tra số dư rồi duyệt lại.`;
    const last = await this.prisma.approvalComment.findFirst({
      where: { requestId, isSystem: true }, orderBy: { id: 'desc' }, select: { comment: true },
    });
    if (last?.comment === comment) return;
    await this.prisma.approvalComment.create({ data: {
      requestId, commentedBy: 'system', commentType: 'comment', comment, isSystem: true, cdate: nowSec(),
    } });
  }

  /**
   * Đồng bộ một phiếu ĐÃ APPROVED mà `synced=false` (dữ liệu cũ/đường khác — đường duyệt thường đã
   * chạy hiệu ứng trước khi đổi trạng thái). Khoá dòng phiếu ⇒ hai lượt gọi không chồng nhau;
   * `synced=true` chỉ đặt SAU khi hiệu ứng thành công. Thất bại ⇒ ném (fail-visible), synced giữ false.
   * Trả `true` khi CHÍNH lượt gọi này đã đồng bộ phiếu (lượt đến sau, thấy synced rồi ⇒ `false`) —
   * nhờ vậy nhiều máy quét cùng lúc không báo trùng một phiếu.
   */
  async onApproved(requestId: number): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ status: number; synced: boolean }[]>`
        SELECT status, synced FROM tbl_approval_requests WHERE id = ${requestId} FOR UPDATE`;
      if (!rows.length || rows[0].synced || rows[0].status !== AStatus.APPROVED) return false;
      const r = await this.runEffect(requestId);
      if (!r.ok) throw new Error(r.msg);
      await tx.approvalRequest.update({ where: { id: requestId }, data: { synced: true } });
      return true;
    }, FINALIZE_TX);
  }
}
