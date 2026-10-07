// src/po/order-gen.service.ts — #06 đợt 2: ĐIỂM VÀO DUY NHẤT của việc sinh
// đơn hàng từ PO. Port `ajaxs/po/process_gen_orders.php` (prod, md5
// 7f3ef171ddaa96f2f1bfaed60e0fd3ea, đọc read-only 24/09/2026) — nơi gọi DUY
// NHẤT của `CLS_PO::createOrdersPerItem` trên prod, và là nơi giữ MỌI cổng
// nghiệp vụ. Hàm lõi (src/po/order-gen.core.ts) KHÔNG có cổng nào.
//
// ⛔ BÀI HỌC (review cuối, I-2): chép "hàm lõi" là chép THIẾU — chốt chặn prod
// nằm ở file ajax gọi nó. Bản đầu của nhánh này export thẳng hàm lõi qua DI,
// nên bất kỳ ai nối nút "Sinh đơn" vào API đều có thể tạo nghĩa vụ tiền với
// khách từ PO CHƯA DUYỆT. Nay `OrderGenService` CHỈ lộ `generateOrdersForPo`;
// lưới test/po/order-gen-surface.spec.ts canh điều đó.
//
// Thứ tự cổng Y HỆT prod (thứ tự quyết định thông báo nào người dùng thấy khi
// PO vướng nhiều cổng cùng lúc — test ghim cả thứ tự):
//   0. PO không tồn tại                      -> 'Không tìm thấy PO'
//   1. declares_customs = 1                  -> từ chối (đặt TRƯỚC mọi cổng khác)
//   2. COUNT(po_items, line_kind<>'fee') = 0 -> từ chối (PO toàn phí, hoặc 0 dòng)
//   3. status < 3 (chưa đủ 2 cấp duyệt)      -> từ chối
//   4. orders_generated = 1                  -> THÀNH CÔNG 'already', trả id đơn
//      cũ (po_id, order_type=1, po_item_id>0, ORDER BY id), KHÔNG sinh gì
//   5. chưa có phụ lục -> autoGenerateSuborder; vẫn không có -> từ chối
//   6. lặp MỌI phụ lục (sort_order, id) với CÙNG notesMap
//   7. không sinh/thu được id nào -> từ chối (cờ KHÔNG được đặt; phụ lục vừa
//      tự tách ở bước 5 VẪN được giữ — giống prod, nơi autoGenerateSuborder
//      đã ghi xong trước đó; transaction commit chứ không rollback ở nhánh này)
//   8. orders_generated = 1
//
// Hai cổng declares_customs và "toàn dòng phí" CỐ Ý tách riêng (prod ghi rõ:
// ô tích tắt được qua một lần lưu header, dòng phí là DỮ LIỆU) — đừng gộp.
//
// ⚠ line_kind NULL: prod cột này `varchar(8) NOT NULL DEFAULT 'goods'` (đo
// 24/09/2026: 1.608/1.608 dòng 'goods'), nên NULL không bao giờ có trên prod.
// Model mới để `String?`; cổng 2 coi NULL là 'goods' — NHẤT QUÁN với hàm lõi
// (`it.lineKind ?? 'goods'`). Đếm kiểu SQL thô `line_kind <> 'fee'` sẽ loại
// NULL và từ chối một PO mà hàm lõi vẫn sinh đơn được.
//
// ⚠ Không port ở đây, thuộc tầng khác: `Permission('po')` (tầng route — gắn
// quyền 'po' khi nối API) và `po_audit_after` (prod ghi CLS_AUDIT cho thay
// đổi orders_generated 0->1; #06 chưa port audit PO ở bất kỳ đâu).
//
// ═══ TRANSACTION + NGƯỜI THUA CUỘC ĐUA — quyết định (review cuối, M-3) ═══
// Prod không có transaction: lượt gọi thua cuộc đua có thể đã INSERT vài đơn
// rồi mới đụng lỗi. Ở đây TOÀN BỘ lượt sinh của một PO (kể cả tự tách phụ lục)
// chạy trong MỘT transaction, mở đầu bằng `SELECT ... FOR UPDATE` trên dòng
// PO:
//   - Hai lượt gọi CÙNG PO (double-click, hai tab): lượt sau CHỜ khoá, rồi đọc
//     lại PO thấy orders_generated=1 ⇒ nhận đúng kết quả 'already' với CÙNG id
//     như đường thường của prod. Không ai thấy lỗi.
//   - Đụng index `tbl_order_po_item_dedup` (P2002) — chỉ còn xảy ra khi một
//     đường ghi KHÁC (không qua khoá PO này) chen vào giữa check và insert:
//     transaction rollback TRỌN — không đơn nào, không phụ lục tự tách nào,
//     cờ không đổi — và trả kết quả từ chối 'CONFLICT' với thông báo không lộ
//     chi tiết nội bộ. Lỗi khác P2002 vẫn ném (rollback như nhau).
// Kiểm tầng ứng dụng lẫn partial unique index đều GIỮ NGUYÊN.
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SuborderService } from './suborder.service';
import { PoStatus } from './po.constants';
import { createOrdersPerItem, NotesMap } from './order-gen.core';

export type GenOrdersRefusal =
  | 'NOT_FOUND'
  | 'DECLARES_CUSTOMS'
  | 'NO_GOODS'
  | 'NOT_APPROVED'
  | 'NO_SUBORDER'
  | 'NOTHING_GENERATED'
  | 'CONFLICT';

export type GenOrdersResult =
  | { ok: true; already: boolean; orderIds: bigint[]; msg: string }
  | { ok: false; reason: GenOrdersRefusal; msg: string };

// Thông báo lấy NGUYÊN VĂN prod (process_gen_orders.php) — viết cho người dùng
// cuối, không chứa tên bảng/cột/lỗi CSDL. CONFLICT là thông báo mới (prod
// không có nhánh này).
export const GEN_ORDERS_MSG = {
  NOT_FOUND: 'Không tìm thấy PO',
  DECLARES_CUSTOMS: 'PO khách tự đứng tên không sinh đơn hàng — PO này chỉ gồm cước và phí dịch vụ.',
  NO_GOODS: 'PO này chỉ có dòng cước/phí dịch vụ — không có hàng hoá để sinh đơn.',
  NOT_APPROVED: 'PO chưa được duyệt đủ 2 cấp — chưa thể sinh đơn hàng.',
  NO_SUBORDER: 'PO chưa có dòng hàng để sinh đơn.',
  NOTHING_GENERATED: 'Không sinh được đơn hàng nào (PO không có dòng hàng?).',
  CONFLICT: 'Đơn hàng của PO này vừa được tạo bởi một thao tác khác. Vui lòng tải lại trang để xem kết quả.',
} as const;

const NOTE_MAX_CHARS = 255;

/**
 * Port vòng làm sạch `$notesMap` của prod: key `intval() > 0`, value
 * `trim()` khác rỗng, cắt `mb_substr($v, 0, 255)` — đếm theo KÝ TỰ (code
 * point UTF-8), không theo byte hay UTF-16 unit.
 */
export function sanitizeNotesMap(raw: Record<string, unknown> | null | undefined): NotesMap {
  const out: NotesMap = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw)) {
    const id = parseInt(k, 10);
    const note = String(v ?? '').trim();
    if (id > 0 && note !== '') out[id] = Array.from(note).slice(0, NOTE_MAX_CHARS).join('');
  }
  return out;
}

function refuse(reason: GenOrdersRefusal): GenOrdersResult {
  return { ok: false, reason, msg: GEN_ORDERS_MSG[reason] };
}

@Injectable()
export class OrderGenService {
  constructor(
    private prisma: PrismaService,
    private suborders: SuborderService,
  ) {}

  /**
   * "Sinh đơn" cho MỘT PO — port `process_gen_orders.php` (xem đầu file).
   * `notes` = ghi chú tay nhập ở modal, khoá theo `po_item.id`.
   */
  async generateOrdersForPo(poId: number, notes: Record<string, unknown> = {}): Promise<GenOrdersResult> {
    const notesMap = sanitizeNotesMap(notes);
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          // Khoá dòng PO: lượt gọi song song cùng PO xếp hàng ở đây.
          await tx.$queryRaw`SELECT id FROM "tbl_purchase_orders" WHERE id = ${poId} FOR UPDATE`;
          const po = await tx.purchaseOrder.findUnique({ where: { id: poId } });
          if (!po) return refuse('NOT_FOUND');

          if (po.declaresCustoms === 1) return refuse('DECLARES_CUSTOMS');

          const goods = await tx.poItem.count({
            where: { poId, OR: [{ lineKind: null }, { lineKind: { not: 'fee' } }] },
          });
          if (goods === 0) return refuse('NO_GOODS');

          if (po.status < PoStatus.DA_DUYET) return refuse('NOT_APPROVED');

          if (po.ordersGenerated === 1) {
            const existing = await tx.order.findMany({
              where: { poId, orderType: 1, poItemId: { gt: 0 } },
              orderBy: { id: 'asc' },
              select: { id: true },
            });
            return {
              ok: true,
              already: true,
              orderIds: existing.map((o) => o.id),
              msg: `PO này đã sinh đơn hàng rồi (${existing.length} đơn).`,
            };
          }

          const listSubs = () =>
            tx.poSuborder.findMany({
              where: { poId },
              orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
              select: { id: true },
            });
          let subs = await listSubs();
          if (subs.length === 0) {
            await this.suborders.generateDefaultWith(tx, poId);
            subs = await listSubs();
          }
          if (subs.length === 0) return refuse('NO_SUBORDER');

          const orderIds: bigint[] = [];
          for (const sb of subs) {
            orderIds.push(...(await createOrdersPerItem(tx, sb.id, notesMap)));
          }
          if (orderIds.length === 0) return refuse('NOTHING_GENERATED');

          await tx.purchaseOrder.update({ where: { id: poId }, data: { ordersGenerated: 1 } });
          return {
            ok: true,
            already: false,
            orderIds,
            msg: `Đã sinh ${orderIds.length} đơn hàng (mỗi dòng 1 ID).`,
          };
        },
        // Một PO prod có tới vài chục dòng, mỗi dòng vài truy vấn; lượt chờ
        // khoá PO cũng tính vào timeout của chính nó.
        { maxWait: 10_000, timeout: 60_000 },
      );
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return refuse('CONFLICT');
      }
      throw e;
    }
  }
}
