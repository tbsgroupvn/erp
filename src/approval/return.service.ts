import { Injectable } from '@nestjs/common';
import { Prisma, ReturnConfig, ReturnState } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RETURN_CHECKPOINTS } from './return-checkpoints';

function nowSec() { return Math.floor(Date.now() / 1000); }

/** Kết nối dùng được cho các hàm nhận `db`/`tx`: PrismaService (ngoài transaction) hoặc
 *  client của `prisma.$transaction(async (tx) => …)`. */
type Db = PrismaService | Prisma.TransactionClient;

/** PHP `(string)$x` — scalar ép chuỗi thường, `null` ép chuỗi rỗng. KHÔNG chép bẫy prod
 *  (mảng ép thành literal `"Array"`, PHP notice): giá trị không vô hướng ở đây được so bằng
 *  `JSON.stringify` đã chuẩn hoá, theo Q6 mặc định "so JSON chuẩn hoá khoá" của đặc tả §13. */
function stringifyForCompare(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export type MergeResubmitResult = {
  data: Record<string, unknown>;
  doi: Record<string, { cu: unknown; moi: unknown }>;
  chan: string[];
};

export type ReturnObjectParams = {
  objectType: string;
  objectId: number;
  checkpointType: 'approval' | 'biz';
  checkpointRef: string;
  reason: string;
  fieldsOpened: string[];
  dataBefore: unknown;
  returnedBy: string;
};

/**
 * Cổng "trả về cho người nộp sửa" — 1-1 `libs/cls.tra_ve.php` (CLS_TRAVE) prod.
 * Không biết gì về payment hay approval; mọi màn gọi cùng bộ hàm bằng
 * `(checkpointType, checkpointRef)`. Xem docs/rewrite-spec/04b-tra-ve-nguoi-nop-sua.md.
 *
 * Task 1: chỉ phần KHÔNG đụng luồng duyệt (`ApprovalService` chưa gọi lớp này — Task 2/3).
 */
@Injectable()
export class ReturnService {
  constructor(private prisma: PrismaService) {}

  /** `$ctype` khác 'approval' bị ép thành 'biz' — nguyên văn `cauHinh()` (`cls.tra_ve.php:18-28`). */
  private normalizeType(type: string): 'approval' | 'biz' {
    return type === 'approval' ? 'approval' : 'biz';
  }

  /** Đọc 1 dòng `tbl_return_config`. Không có dòng hoặc `edit_mode='off'` ⇒ `null`
   *  (= điểm duyệt TẮT trả về). */
  async config(type: string, ref: string): Promise<ReturnConfig | null> {
    const ctype = this.normalizeType(type);
    const row = await this.prisma.returnConfig.findUnique({
      where: { checkpointType_checkpointRef: { checkpointType: ctype, checkpointRef: ref } },
    });
    if (!row || row.editMode === 'off') return null;
    return row;
  }

  /** `field_key => nhãn`. `approval`: mọi trường của MẪU chứa bước `ref` (id bước), thứ tự
   *  `sort_order, id`. `biz`: hằng số `RETURN_CHECKPOINTS[ref].fields`, khoá lạ ⇒ `{}`. */
  async catalog(type: string, ref: string): Promise<Record<string, string>> {
    const ctype = this.normalizeType(type);
    if (ctype === 'biz') return { ...(RETURN_CHECKPOINTS[ref]?.fields ?? {}) };

    const stepId = Number(ref);
    if (!Number.isFinite(stepId)) return {};
    const step = await this.prisma.approvalStep.findUnique({ where: { id: stepId } });
    if (!step) return {};
    const fields = await this.prisma.approvalFormField.findMany({
      where: { templateId: step.templateId },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    const dm: Record<string, string> = {};
    for (const f of fields) dm[f.fieldKey] = f.label ?? '';
    return dm;
  }

  /** Danh sách `field_key` được sửa — nguyên văn giả mã §3.3: `off`/không dòng ⇒ `[]`;
   *  `all` ⇒ mọi khoá của danh mục; `whitelist` ⇒ giao `tbl_return_fields` ∩ danh mục
   *  (trường đã bị xoá khỏi mẫu mà còn trong whitelist thì bị bỏ, không thành cửa hậu). */
  async editableFields(type: string, ref: string): Promise<string[]> {
    const cfg = await this.config(type, ref);
    if (!cfg) return [];
    const dm = await this.catalog(type, ref);
    if (cfg.editMode === 'all') return Object.keys(dm);
    const rows = await this.prisma.returnConfigField.findMany({ where: { configId: cfg.id } });
    return rows.map((r) => r.fieldKey).filter((k) => k in dm);
  }

  /**
   * Cửa DUY NHẤT hợp nhất dữ liệu nộp lại — hàm THUẦN, không đụng CSDL (`locDuLieuSua()`,
   * `cls.tra_ve.php:70-89`). So sánh bằng ép chuỗi; khoá ngoài whitelist mà giá trị mới không
   * đổi thì bỏ qua êm; khoá ngoài whitelist mà THỰC SỰ đổi thì bị chặn (`chan`) và giá trị cũ
   * giữ nguyên; khoá mới không được phép rơi mất (không vào `data`, không vào `chan`).
   */
  mergeResubmit(
    allowed: string[],
    cu: Record<string, unknown>,
    moi: Record<string, unknown>,
  ): MergeResubmitResult {
    const allow = new Set(allowed);
    const data: Record<string, unknown> = { ...cu };
    const doi: Record<string, { cu: unknown; moi: unknown }> = {};
    const chan: string[] = [];

    for (const [k, v] of Object.entries(moi)) {
      if (!allow.has(k)) {
        if (Object.prototype.hasOwnProperty.call(data, k) && stringifyForCompare(data[k]) !== stringifyForCompare(v)) {
          chan.push(k);
        }
        continue; // giá trị cũ GIỮ NGUYÊN — không ghi vào data
      }
      const hasOld = Object.prototype.hasOwnProperty.call(data, k);
      if (!hasOld || stringifyForCompare(data[k]) !== stringifyForCompare(v)) {
        doi[k] = { cu: hasOld ? data[k] : null, moi: v };
      }
      data[k] = v;
    }
    return { data, doi, chan };
  }

  /** Dòng trạng thái nếu `state='returned'`, ngược lại `null`. Mọi cổng chặn dùng hàm này.
   *  Nhận `db` là `PrismaService` (ngoài transaction) hoặc `tx` (trong `$transaction`) —
   *  Task 2/3 gọi trong cùng khoá dòng phiếu (`lockPending`). */
  async activeReturn(db: Db, objectType: string, objectId: number): Promise<ReturnState | null> {
    const row = await db.returnState.findUnique({
      where: { objectType_objectId: { objectType, objectId } },
    });
    return row && row.state === 'returned' ? row : null;
  }

  /** Dòng trạng thái ở BẤT KỲ state nào (`trangThai()`). */
  async state(objectType: string, objectId: number): Promise<ReturnState | null> {
    return this.prisma.returnState.findUnique({
      where: { objectType_objectId: { objectType, objectId } },
    });
  }

  /**
   * Upsert trạng thái `returned` (`tra()`, `cls.tra_ve.php:92-118`). Chưa có dòng ⇒ tạo `round=1`.
   * Đã có dòng (kể cả đang `resubmitted` hoặc gọi lại khi đang `returned` — ON DUPLICATE KEY như
   * prod) ⇒ `round+1`, ghi đè `reason/fieldsOpened/dataBefore/returnedBy/returnedAt`,
   * `resubmittedAt=null`; **giữ nguyên `dataAfter`** của vòng trước — nguyên văn prod (A3).
   *
   * Fix round 1 (review, Important): trước là `findUnique` rồi `create`/`update` tay — hai lượt
   * gọi đồng thời trên đối tượng CHƯA có dòng có thể cùng thấy "chưa có" rồi cùng `create`, lượt
   * sau vỡ `P2002` thay vì tăng `round` (đã tái hiện bằng ca test có thêm độ trễ giả lập, xem
   * `test-1-report.md` "Fix round 1"). Nay dùng MỘT lệnh `upsert` — Prisma dịch thành
   * `INSERT … ON CONFLICT (object_type, object_id) DO UPDATE` nguyên tử ở Postgres, đúng tinh
   * thần `INSERT ... ON DUPLICATE KEY UPDATE` của MySQL prod; `round: { increment: 1 }` cũng
   * nguyên tử (không đọc-rồi-cộng ở tầng ứng dụng).
   *
   * ⚠ Nguyên tử ở ĐÂY chỉ đảm bảo cho DÒNG `ReturnState` — KHÔNG thay cho khoá dòng của đối
   * tượng gốc. Bên gọi (Task 2/3, ví dụ `returnToSubmitter()`) vẫn PHẢI giữ `lockPending()` (hay
   * tương đương) trên chính phiếu duyệt/phiếu chi TRƯỚC khi gọi hàm này, để đảm bảo tính nhất
   * quán giữa dòng trạng thái trả về và trạng thái của đối tượng nghiệp vụ mà nó mô tả (ví dụ
   * không trả một phiếu đã APPROVED xen giữa lúc đọc và lúc ghi).
   */
  async returnObject(tx: Db, p: ReturnObjectParams): Promise<ReturnState> {
    const now = nowSec();
    return tx.returnState.upsert({
      where: { objectType_objectId: { objectType: p.objectType, objectId: p.objectId } },
      create: {
        objectType: p.objectType,
        objectId: p.objectId,
        checkpointType: p.checkpointType,
        checkpointRef: p.checkpointRef,
        state: 'returned',
        reason: p.reason,
        round: 1,
        fieldsOpened: p.fieldsOpened as Prisma.InputJsonValue,
        dataBefore: (p.dataBefore ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        dataAfter: Prisma.JsonNull,
        returnedBy: p.returnedBy,
        returnedAt: now,
        resubmittedAt: null,
      },
      update: {
        checkpointType: p.checkpointType,
        checkpointRef: p.checkpointRef,
        state: 'returned',
        reason: p.reason,
        round: { increment: 1 },
        fieldsOpened: p.fieldsOpened as Prisma.InputJsonValue,
        dataBefore: (p.dataBefore ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        returnedBy: p.returnedBy,
        returnedAt: now,
        resubmittedAt: null,
        // dataAfter: KHÔNG đụng — giữ nguyên của vòng trước (A3)
      },
    });
  }

  /** `returned → resubmitted` (`nopLai()`). */
  async markResubmitted(tx: Db, objectType: string, objectId: number, dataAfter: unknown): Promise<ReturnState> {
    return tx.returnState.update({
      where: { objectType_objectId: { objectType, objectId } },
      data: {
        state: 'resubmitted',
        resubmittedAt: nowSec(),
        dataAfter: (dataAfter ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    });
  }

  /** `DELETE` cứng dòng trạng thái (`xoaTrangThai()`). Vô hại khi không có dòng.
   *  `db` tuỳ chọn (mặc định `this.prisma`) — truyền `tx` để dọn trong CÙNG transaction với thao
   *  tác trên đối tượng gốc (vd `SupplierPaymentService.delete()`, G10): xoá phiếu mà rollback
   *  thì dòng trạng thái cũng phải còn, không được mồ côi theo chiều ngược lại. */
  async clear(objectType: string, objectId: number, db: Db = this.prisma): Promise<void> {
    await db.returnState.deleteMany({ where: { objectType, objectId } });
  }

  /**
   * Diff trường đã đổi sau nộp lại (`truongDaDoi()`, §4.3). Chỉ khi `state='resubmitted'`;
   * so `dataBefore[k]` với `dataAfter[k]` (ép chuỗi, thiếu khoá = `null`) CHỈ trên các khoá của
   * `fieldsOpened` (ảnh chụp lúc trả — không phải cấu hình hiện tại).
   */
  changedFields(st: ReturnState | null): Record<string, { cu: unknown; moi: unknown }> {
    if (!st || st.state !== 'resubmitted') return {};
    const opened: string[] = Array.isArray(st.fieldsOpened) ? (st.fieldsOpened as unknown[]).map(String) : [];
    const before = (st.dataBefore ?? {}) as Record<string, unknown>;
    const after = (st.dataAfter ?? {}) as Record<string, unknown>;
    const out: Record<string, { cu: unknown; moi: unknown }> = {};
    for (const k of opened) {
      const cu = Object.prototype.hasOwnProperty.call(before, k) ? before[k] : null;
      const moi = Object.prototype.hasOwnProperty.call(after, k) ? after[k] : null;
      if (stringifyForCompare(cu) !== stringifyForCompare(moi)) out[k] = { cu, moi };
    }
    return out;
  }

  /**
   * Điều kiện Prisma loại đối tượng đang `returned` (`dieuKienChuaBiTraSql()`) — MỘT định nghĩa
   * duy nhất, dùng chung cho mọi câu đếm/liệt kê (§5.2). Chỉ loại `state='returned'`, KHÔNG loại
   * `resubmitted` — đối tượng đã nộp lại duyệt tiếp bình thường.
   *
   * CHỈ DÙNG CHO LIỆT KÊ/ĐẾM hiển thị (danh sách, KPI, hộp "chờ tôi duyệt") — KHÔNG PHẢI cổng
   * chặn. Cổng chặn (approve/revoke/confirm…) PHẢI dùng `activeReturn()` dưới khoá dòng của
   * chính đối tượng (`lockPending()`), không dùng hàm này: đây vẫn là HAI câu truy vấn riêng
   * (đọc danh sách `returned` rồi mới `notIn` ở câu sau) — không phải `NOT EXISTS` nguyên tử như
   * prod, nên có cửa sổ TOCTOU nếu câu thứ hai chạy NGOÀI transaction. Để bên gọi tự khép cửa sổ
   * đó, hàm nhận `db` tuỳ chọn (mặc định `this.prisma`) — truyền `tx` để câu loại-trừ này chạy
   * trong CÙNG snapshot/transaction với câu `findMany`/`count` chính của màn liệt kê.
   */
  async notReturnedWhere(objectType: string, db: Db = this.prisma): Promise<{ id: { notIn: number[] } }> {
    const rows = await db.returnState.findMany({
      where: { objectType, state: 'returned' },
      select: { objectId: true },
    });
    return { id: { notIn: rows.map((r) => r.objectId) } };
  }
}
