import { Injectable, Logger } from '@nestjs/common';
import { PurchaseOrder, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ScopeService } from '../iam/scope.service';
import { PoStatus } from './po.constants';
import { nowSec } from '../common/money';

export type PoResult =
  | { ok: true; msg: string; po: PurchaseOrder }
  | { ok: false; msg: string };

/** Lỗi nội bộ dùng để thoát khỏi `$transaction` khi không sinh được mã PO
 *  (khách không có `code`) — bắt riêng ở `createPo` để trả `{ok:false}`
 *  thay vì retry vô ích (khác `P2002`, lỗi này KHÔNG tự hết khi thử lại). */
class PoCodeRefused extends Error {}

export type CreatePoInput = {
  contractId?: number; contractNo?: string; buyerId?: number;
  // ⚠ F3 (review cuối #06): prod `po_date`/`delivery_deadline` là DATE, đổi
  // theo — bên gọi (controller/DTO) chịu trách nhiệm parse chuỗi -> Date,
  // KHÔNG truyền epoch số nguyên nữa. Đây là type nói lên đúng hợp đồng mới.
  poDate?: Date; currency?: string;
  subtotal?: number | string; vatAmount?: number | string; totalAmount?: number | string;
  advanceAmount?: number | string; vatRate?: number | string; fxRateCommit?: number | string;
  paymentTerms?: string; paymentSchedule?: string; poType?: string;
  deliveryPlace?: string; deliveryMethod?: string; deliveryExpected?: string; deliveryDeadline?: Date;
  shippingMode?: string; incoterm?: string; incotermPlace?: string; taxPaidBy?: string;
  assignedTo?: string; notes?: string;
};

@Injectable()
export class PoService {
  constructor(private prisma: PrismaService, private scope: ScopeService) {}

  // Cùng cơ chế (Logger của @nestjs/common) với src/common/http-exception.filter.ts
  // — lỗi CSDL không lường trước phải LOG đủ ở server, KHÔNG trả nguyên .message
  // ra client (Fix round 2, sau Task 4: 3 điểm cùng bệnh, xem po.service.ts:148).
  private readonly logger = new Logger(PoService.name);

  // ═══ Mã PO — chép ĐÚNG luật `libs/cls.po.php::generatePoCode($buyer_id)`,
  // ĐO trên prod 23/09/2026 (304 PO, 304 mã phân biệt): `PO002/2026-TBS984`.
  //
  //   cus_code = UPPER(TRIM(customer.code))     // khách không có code -> ''
  //   lastPo   = PO gần nhất CỦA CHÍNH khách này (buyer_id = ?, ORDER BY id DESC)
  //   seq      = match lastPo.po_code /^PO(\d+)[-\/]/ ? $1+1 : 1
  //   return   'PO' + zeroPad(seq,3) + '/' + năm hiện tại + '-' + cus_code
  //
  // ⚠⚠⚠ Bộ đếm là THEO TỪNG KHÁCH (buyer_id), KHÔNG PHẢI sequence toàn cục —
  // đây là khác biệt cốt lõi so với CustomerCodeService/QuoteService. Bỏ
  // `po_code_seq` (migration 20260923160000_po_code_seq vẫn giữ nguyên, ĐÃ
  // áp dụng lên tbs_test — không xoá/sửa migration đã chạy — nhưng KHÔNG còn
  // service nào đọc sequence này nữa; dọn nó là việc của một task riêng).
  //
  // ⚠ Tolerance `[-\/]`: trước 23/08/2026 định dạng dùng `-` giữa số thứ tự
  // và năm (`PO007-2026-TBS984`). PO gần nhất của một khách có thể vẫn ở
  // dạng cũ này — đọc số thứ tự PHẢI chấp nhận CẢ HAI dấu để không tính sai
  // số kế tiếp, nhưng LUÔN PHÁT ra dạng mới `/`.
  private readonly PO_CODE_SEQ_RE = /^PO(\d+)[-\/]/;

  /** Sinh mã PO tiếp theo cho `buyerId`, đọc trong CÙNG transaction `tx` với
   *  insert PO (đọc-rồi-tăng phải soi và ghi trên cùng một giao dịch để
   *  cặp với UNIQUE constraint + retry ở `createPo` — xem đó để biết vì sao
   *  an toàn dưới tranh chấp đồng thời). Trả `{ok:false}` khi khách không có
   *  `code` — bản gốc PHP trả mã RỖNG cho ca này rồi để nó tự vỡ ở UNIQUE
   *  constraint lần PO thứ hai; KHÔNG lặp lại lỗi tiềm ẩn đó ở đây, từ chối
   *  tạo PO ngay từ đầu thay vì âm thầm sinh mã trùng.
   */
  private async generatePoCode(
    buyerId: number | null | undefined,
    tx: Prisma.TransactionClient,
  ): Promise<{ ok: true; code: string } | { ok: false; msg: string }> {
    if (!buyerId) return { ok: false, msg: 'Thiếu buyer_id (khách hàng) — không sinh được mã PO' };
    const customer = await tx.customer.findUnique({ where: { id: buyerId }, select: { code: true } });
    const cusCode = (customer?.code ?? '').trim().toUpperCase();
    if (!cusCode) return { ok: false, msg: 'Khách hàng buyer_id=' + buyerId + ' chưa có mã — không sinh được mã PO' };

    const lastPo = await tx.purchaseOrder.findFirst({
      where: { buyerId },
      orderBy: { id: 'desc' },
      select: { poCode: true },
    });
    let seq = 1;
    const m = lastPo?.poCode?.match(this.PO_CODE_SEQ_RE);
    if (m) seq = parseInt(m[1], 10) + 1;

    const year = new Date().getFullYear();
    const code = `PO${String(seq).padStart(3, '0')}/${year}-${cusCode}`;
    return { ok: true, code };
  }

  /**
   * Tạo PO. Sinh mã trong CÙNG transaction với insert, rồi bọc bằng retry có
   * giới hạn bắt lỗi UNIQUE (Prisma `P2002` trên `po_code`).
   *
   * ⚠⚠⚠ AN TOÀN ĐỒNG THỜI — bản gốc PHP đọc "PO gần nhất" rồi ghi PO mới
   * KHÔNG trong cùng giao dịch nguyên tử: hai request tạo PO đồng thời cho
   * CÙNG một khách có thể cùng đọc một `lastPo`, cùng tính ra cùng `seq`, và
   * sinh ra HAI PO trùng mã (race thật, không phải giả thuyết). KHÔNG lặp
   * lại lỗi đó: đọc-và-tăng ở trên nằm trong CÙNG `$transaction` với insert
   * — dưới Postgres READ COMMITTED (mặc định Prisma), giao dịch A đọc
   * lastPo, insert; giao dịch B đọc lastPo (Post-A commit) sẽ thấy PO của A
   * và tính seq kế tiếp CHÍNH XÁC — trường hợp hiếm B đọc trước khi A commit
   * (B bắt đầu giữa lúc A đang mở) vẫn có thể tính trùng seq, nhưng khi đó
   * UNIQUE constraint trên `po_code` chặn INSERT trùng (Prisma ném `P2002`)
   * — bắt lỗi này và THỬ LẠI (đọc lại lastPo mới nhất, tính seq mới) tối đa
   * `MAX_RETRY` lần. UNIQUE + retry là lưới an toàn cuối cùng, không phải
   * "hy vọng không đụng độ".
   */
  async createPo(input: CreatePoInput, by: string): Promise<PoResult> {
    const MAX_RETRY = 5;
    for (let attempt = 0; attempt < MAX_RETRY; attempt++) {
      try {
        const po = await this.prisma.$transaction(async (tx) => {
          const codeResult = await this.generatePoCode(input.buyerId, tx);
          if (!codeResult.ok) throw new PoCodeRefused(codeResult.msg);

          const data: Prisma.PurchaseOrderUncheckedCreateInput = {
            poCode: codeResult.code,
            contractId: input.contractId ?? null,
            contractNo: input.contractNo ?? null,
            buyerId: input.buyerId ?? null,
            poDate: input.poDate ?? null,
            currency: input.currency ?? null,
            subtotal: input.subtotal ?? 0,
            vatAmount: input.vatAmount ?? 0,
            totalAmount: input.totalAmount ?? 0,
            advanceAmount: input.advanceAmount ?? 0,
            vatRate: input.vatRate ?? null,
            fxRateCommit: input.fxRateCommit ?? null,
            paymentTerms: input.paymentTerms ?? null,
            paymentSchedule: input.paymentSchedule ?? null,
            poType: input.poType ?? null,
            deliveryPlace: input.deliveryPlace ?? null,
            deliveryMethod: input.deliveryMethod ?? null,
            deliveryExpected: input.deliveryExpected ?? null,
            deliveryDeadline: input.deliveryDeadline ?? null,
            shippingMode: input.shippingMode ?? null,
            incoterm: input.incoterm ?? null,
            incotermPlace: input.incotermPlace ?? null,
            taxPaidBy: input.taxPaidBy ?? null,
            status: PoStatus.NHAP,
            assignedTo: input.assignedTo ?? null,
            createdBy: by ?? null,
            cdate: nowSec(),
            notes: input.notes ?? null,
          };
          return tx.purchaseOrder.create({ data });
        });
        return { ok: true, msg: 'OK', po };
      } catch (e: any) {
        if (e instanceof PoCodeRefused) return { ok: false, msg: e.message };
        if (e?.code === 'P2002') continue; // đụng UNIQUE po_code -> thử lại với seq mới
        // Lỗi KHÔNG lường trước (Prisma/Postgres thật) — .message có thể mang tên
        // bảng/cột/constraint/đường dẫn file (đo thật: "Invalid `tx.purchaseOrder.create()`
        // invocation in .../po.service.ts:142..."). KHÔNG nối .message vào response
        // (Fix round 2) — log đủ ở server, trả người gọi một câu ổn định.
        this.logger.error('createPo: ' + (e?.message ?? String(e)), e?.stack);
        return { ok: false, msg: 'Không tạo được PO — vui lòng thử lại hoặc liên hệ IT' };
      }
    }
    return { ok: false, msg: 'Không tạo được PO: đụng độ mã PO liên tục, thử lại sau' };
  }

  // ═══ Vòng đời — TUẦN TỰ, không nhảy cóc ═══════════════════════════════
  //
  // ⚠⚠⚠ F8 (review cuối #06, 23/09/2026) — CHECK-THEN-ACT ĐUA ĐƯỢC, ĐÃ VÁ.
  // Bản trước: `findUnique` (đọc) rồi `update({where:{id}})` (ghi) là HAI
  // câu lệnh RIÊNG — giữa hai câu đó một request khác có thể đọc CÙNG trạng
  // thái cũ, cùng qua được guard, rồi cả hai đều ghi. Ca thật: PO ở status 0,
  // `submit` và `cancel` chạy đồng thời đều đọc thấy 0, đều qua guard, `submit`
  // ghi status=1, `cancel` ghi status=-1+cancelPrevStatus=0 — `cancelPrevStatus`
  // SAI (chụp nhanh trước khi `submit` chạy), một `restoreFromCancel` sau đó
  // đưa PO về 0 thay vì 1, XOÁ ÂM THẦM việc `submit` vừa làm.
  //
  // Vá: gộp đọc-kiểm-ghi thành MỘT câu lệnh nguyên tử — `updateMany({where:
  // {id, status: from}})` chỉ ghi KHI CÒN đúng `from` tại thời điểm Postgres
  // thực thi câu UPDATE (không phải tại thời điểm code đọc trước đó).
  // `count === 0` nghĩa là ai đó đã đổi trạng thái xen giữa -> từ chối, đọc
  // lại DB LÚC ĐÓ (sau khi đã thua cuộc đua) chỉ để dựng thông điệp lỗi rõ
  // ràng, KHÔNG dùng để quyết định ok/không — quyết định đã chốt ở kết quả
  // `updateMany`. Cùng mức độ nghiêm ngặt "một câu lệnh nguyên tử quyết định,
  // không phải hai câu lệnh rời + hy vọng" mà `generatePoCode` (transaction +
  // retry trên UNIQUE) đã áp dụng ở trên.
  private async transition(
    poId: number,
    from: number,
    to: number,
    extra: Prisma.PurchaseOrderUncheckedUpdateInput,
  ): Promise<PoResult> {
    const result = await this.prisma.purchaseOrder.updateMany({
      where: { id: poId, status: from },
      data: { status: to, ...extra },
    });
    if (result.count === 0) {
      const po = await this.prisma.purchaseOrder.findUnique({ where: { id: poId } });
      if (!po) return { ok: false, msg: 'Không tìm thấy PO' };
      return {
        ok: false,
        msg: `PO đang ở trạng thái ${po.status}, không thể chuyển tiếp sang ${to} (cần đang ở ${from}) — không cho nhảy cóc`,
      };
    }
    const updated = await this.prisma.purchaseOrder.findUniqueOrThrow({ where: { id: poId } });
    return { ok: true, msg: 'OK', po: updated };
  }

  /** 0 (Nháp) -> 1 (Chờ Leader). */
  async submit(poId: number, by: string): Promise<PoResult> {
    return this.transition(poId, PoStatus.NHAP, PoStatus.CHO_LEADER, {
      submittedBy: by, submittedAt: nowSec(),
    });
  }

  /** 1 (Chờ Leader) -> 2 (Chờ TP.KD). */
  async leaderApprove(poId: number, by: string): Promise<PoResult> {
    return this.transition(poId, PoStatus.CHO_LEADER, PoStatus.CHO_TPKD, {
      leaderBy: by, leaderAt: nowSec(),
    });
  }

  /** 2 (Chờ TP.KD) -> 3 (Đã duyệt). */
  async tpkdApprove(poId: number, by: string): Promise<PoResult> {
    return this.transition(poId, PoStatus.CHO_TPKD, PoStatus.DA_DUYET, {
      tpkdBy: by, tpkdAt: nowSec(),
    });
  }

  /**
   * Từ chối — chỉ hợp lệ khi PO đang ở một trong hai bước chờ duyệt
   * (1 Chờ Leader / 2 Chờ TP.KD). Luôn đưa về 0 (Nháp) để sửa lại và nộp lại,
   * KHÔNG đưa về trạng thái trước đó (khác `cancel`, vốn phải trả đúng chỗ cũ).
   *
   * ⚠ F8 — cùng vá nguyên tử như `transition()` ở trên (`updateMany` với
   * `status: { in: [...] }` làm điều kiện GHI, không phải điều kiện đọc rời).
   */
  async reject(poId: number, note: string, by: string): Promise<PoResult> {
    const result = await this.prisma.purchaseOrder.updateMany({
      where: { id: poId, status: { in: [PoStatus.CHO_LEADER, PoStatus.CHO_TPKD] } },
      data: { status: PoStatus.NHAP, rejectBy: by, rejectAt: nowSec(), rejectNote: note ?? null },
    });
    if (result.count === 0) {
      const po = await this.prisma.purchaseOrder.findUnique({ where: { id: poId } });
      if (!po) return { ok: false, msg: 'Không tìm thấy PO' };
      return { ok: false, msg: `PO đang ở trạng thái ${po.status}, không ở bước chờ duyệt nên không thể từ chối` };
    }
    const updated = await this.prisma.purchaseOrder.findUniqueOrThrow({ where: { id: poId } });
    return { ok: true, msg: 'OK', po: updated };
  }

  /**
   * Huỷ — hợp lệ từ BẤT KỲ trạng thái nào khác Huỷ (kể cả đã duyệt/đang thực
   * hiện). Lưu `cancelPrevStatus` = trạng thái NGAY TRƯỚC khi huỷ để
   * `restoreFromCancel` trả PO về đúng chỗ nó đang đứng, không phải luôn về 0.
   *
   * ⚠⚠⚠ F8 — KHÔNG dùng `updateMany({where:{status:from}})` được ở đây như
   * `transition()`/`reject()`: `cancel` hợp lệ từ NHIỀU trạng thái khác nhau
   * (mọi giá trị khác Huỷ), không có một `from` cố định để đặt vào WHERE —
   * và giá trị cần GHI (`cancelPrevStatus`) lại CHÍNH LÀ trạng thái đang đọc,
   * nên không thể tách "đọc" và "ghi-có-điều-kiện" thành hai bước như trên mà
   * vẫn an toàn. Thay vào đó khoá DÒNG bằng `SELECT ... FOR UPDATE` trong một
   * transaction (cùng khuôn mẫu `WalletService`/`HoldService` #03 đã dùng:
   * `src/money/wallet.service.ts` dòng ~57-58) rồi ĐỌC VÀ GHI trong CÙNG
   * transaction đó — Postgres khoá dòng cho tới khi commit, nên một `submit`/
   * `transition` khác nhắm vào CÙNG dòng (dù chỉ là một `updateMany` đơn câu)
   * buộc phải CHỜ tới khi transaction này commit rồi mới thấy trạng thái MỚI
   * NHẤT — không còn khoảng hở giữa đọc và ghi để hai request cùng đọc một
   * `cancelPrevStatus` cũ. Kết quả đúng ở CẢ HAI thứ tự chạy đua với `submit`:
   *  - `cancel` khoá dòng trước: đọc 0, ghi Huỷ+cancelPrevStatus=0 — `submit`
   *    chạy sau đó thấy status=-1 (KHÔNG còn 0) -> `updateMany` của nó khớp 0
   *    dòng -> bị từ chối đúng.
   *  - `submit` ghi trước (0->1, commit ngay vì chỉ một câu lệnh): `cancel`
   *    khoá dòng SAU, đọc lại thấy 1 (KHÔNG phải giá trị cũ 0 nữa) -> ghi
   *    Huỷ+cancelPrevStatus=1 — `restoreFromCancel` sau này trả đúng về 1,
   *    KHÔNG về 0 — việc `submit` đã làm KHÔNG bị xoá âm thầm.
   */
  async cancel(poId: number, note: string, by: string): Promise<PoResult> {
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ status: number }>>`
        SELECT status FROM tbl_purchase_orders WHERE id = ${poId} FOR UPDATE
      `;
      if (locked.length === 0) return { ok: false, msg: 'Không tìm thấy PO' };
      const currentStatus = locked[0].status;
      if (currentStatus === PoStatus.HUY) return { ok: false, msg: 'PO đã ở trạng thái Huỷ' };

      const updated = await tx.purchaseOrder.update({
        where: { id: poId },
        data: {
          cancelPrevStatus: currentStatus,
          status: PoStatus.HUY,
          cancelBy: by,
          cancelAt: nowSec(),
          cancelNote: note ?? null,
        },
      });
      return { ok: true, msg: 'OK', po: updated };
    });
  }

  /**
   * Khôi phục PO đã huỷ về ĐÚNG trạng thái lưu ở `cancelPrevStatus`.
   *
   * ⚠ F8 — an toàn dưới đua đồng thời DÙ đọc `cancelPrevStatus` trước rồi mới
   * ghi (trông giống check-then-act): `cancelPrevStatus` chỉ có thể được GHI
   * bởi `cancel()`, và `cancel()` từ chối chạy khi PO đang ở Huỷ — nên MIỄN
   * LÀ PO còn đang ở Huỷ, không có đường nào khác đổi được `cancelPrevStatus`
   * xen giữa lúc đọc và lúc ghi ở đây. Điều kiện GHI vẫn đặt `status: HUY`
   * vào `updateMany` (không phải chỉ đọc rồi tin): hai `restoreFromCancel`
   * chạy đua nhau, người thắng đổi status khỏi Huỷ, người thua khớp 0 dòng ở
   * `updateMany` -> bị từ chối đúng, KHÔNG ghi đè lần hai.
   */
  async restoreFromCancel(poId: number, by: string): Promise<PoResult> {
    const po = await this.prisma.purchaseOrder.findUnique({ where: { id: poId } });
    if (!po) return { ok: false, msg: 'Không tìm thấy PO' };
    if (po.status !== PoStatus.HUY || po.cancelPrevStatus === null || po.cancelPrevStatus === undefined) {
      return { ok: false, msg: 'PO không ở trạng thái Huỷ nên không thể khôi phục' };
    }
    const result = await this.prisma.purchaseOrder.updateMany({
      where: { id: poId, status: PoStatus.HUY },
      data: { status: po.cancelPrevStatus },
    });
    if (result.count === 0) {
      return { ok: false, msg: 'PO không ở trạng thái Huỷ nên không thể khôi phục' };
    }
    const updated = await this.prisma.purchaseOrder.findUniqueOrThrow({ where: { id: poId } });
    return { ok: true, msg: 'OK', po: updated };
  }

  // ═══ Phạm vi xem (#01 ScopeService) ════════════════════════════════════
  //
  // PurchaseOrder có `createdBy` là cột chủ-sở-hữu, KHÔNG có cột phụ trách
  // PHỤ, KHÔNG có cột kho ⇒ truyền { saler:'createdBy', salerOther:null } và
  // KHÔNG truyền `warehouse` (mặc định null trong buildDocScope) để một
  // quyền phạm vi 'warehouse' bị DENY ({id:-1}) thay vì dựng where trên một
  // cột không tồn tại — đúng bản vá 23/09/2026 của ScopeService, đã cắn thật
  // ở CustomerService (#02) và QuoteService (#05).
  async listForUser(perm: string, uid: number): Promise<PurchaseOrder[]> {
    const where = await this.scope.buildDocScope(perm, uid, { saler: 'createdBy', salerOther: null });
    return this.prisma.purchaseOrder.findMany({ where, orderBy: { id: 'desc' } });
  }
}
