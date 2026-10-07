// src/po/suborder.service.ts — #06 đợt 2, Task 2: tách PO thành đơn con
// (phụ lục) mặc định. Chép ĐÚNG `CLS_PO::autoGenerateSuborder($po_id)` +
// `CLS_PO::recalcSuborder($sub_id)`, đọc read-only trên prod
// `libs/cls.po.php` (~dòng 305-360) ngày 24/09/2026.
//
// ⚠⚠ Bẫy prod tự ghi (libs/cls.po.php:1238, nhắc lại ở comment `model Order`
// trong schema.prisma): `tbl_po_items.suborder_id` trỏ `tbl_po_suborders.id`,
// KHÔNG PHẢI id đơn hàng (`tbl_order`). File này CHỈ đụng PoSuborder + PoItem
// + cờ `PurchaseOrder.suborderGenerated` — KHÔNG đụng `tbl_order` (đó là
// `OrderGenService`, Task 3, đọc `po_item_id`, một trục hoàn toàn khác).
//
// ⚠⚠⚠ `CLS_PO::recalcTotals($po_id)` (khác tên, PO-HEADER, dùng
// `po_thue_nhom` gộp theo mức thuế) là một hàm KHÁC HẲN, NGOÀI PHẠM VI Task
// này — `recalcTotals` ở ĐÂY là bản SUBORDER (`recalcSuborder`'s inner
// query), chỉ SUM(amount)/COUNT(*) theo `suborder_id`, không cascade lên PO.
//
// ⚠ LỆCH so với prod (review cuối, M-7): prod `recalcSuborder` kết bằng
// `$this->recalcTotals($s['po_id'])` — cascade viết lại subtotal/VAT/total của
// HEADER PO qua `po_thue_nhom`. Bản này KHÔNG cascade (xem đoạn trên). Vô hại
// khi header đang đúng, vì gán `suborder_id` không đổi số tiền dòng nào — nhưng
// đây là lệch có ghi nhận, không phải "chép đúng".
//
// Mọi thao tác ghi đi qua `db` (Prisma transaction client) để
// `OrderGenService.generateOrdersForPo` gộp được việc tách phụ lục vào CÙNG
// transaction sinh đơn — Prisma không lồng được interactive transaction.
import { Injectable } from '@nestjs/common';
import { PoSuborder, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type SuborderResult =
  | { ok: true; msg: string; suborder: PoSuborder }
  | { ok: false; msg: string };

@Injectable()
export class SuborderService {
  constructor(private prisma: PrismaService) {}

  /**
   * Sinh đơn con MẶC ĐỊNH duy nhất `<po_code>-Đ01`, gán mọi `po_item` của PO
   * CHƯA thuộc đơn con nào về nó, rồi đặt `suborderGenerated=1`.
   *
   * ⚠ Idempotent Y HỆT prod: `if(suborder_generated==1) return false` — CHỈ
   * kiểm cờ này, không kiểm gì thêm (không tự dò xem đã có sub_code trùng
   * hay chưa) — gọi lần hai luôn bị chặn ngay từ đầu bởi cờ, không đi tới
   * bước tạo/gán nào cả.
   *
   * ⚠ `created_by = po.tpkd_by ?: po.created_by` (PHP `?:` coi `''` là
   * falsy giống `||` của JS/TS) — ưu tiên người TP.KD duyệt cuối, rơi về
   * người tạo PO nếu chưa ai duyệt.
   *
   * ⚠⚠⚠ `cdate=0` là LITERAL trong prod (`'cdate'=>0` viết thẳng ở lệnh
   * insert, KHÔNG phải quên set `nowSec()`) — đo trực tiếp dòng insert, giữ
   * nguyên chứ không "sửa cho đúng hơn" (out of scope, đây là port 1:1).
   *
   * ⚠ Câu WHERE gán `po_item` "chưa thuộc đơn con nào" dùng cả `suborderId:
   * null` LẪN `suborderId: 0`: prod (MySQL) cột này NOT NULL DEFAULT 0 nên
   * sentinel "chưa gán" luôn là 0; schema Postgres của #06 đợt 2 (Task 1)
   * KHÔNG đặt `@default(0)` cho `PoItem.suborderId` (cột nullable, không có
   * default) — dữ liệu seed/migrate có thể để trống thành NULL thay vì 0.
   * Khớp CẢ HAI để không bỏ sót dòng tuỳ theo đường dữ liệu đã đi.
   */
  async generateDefault(poId: number): Promise<SuborderResult> {
    return this.prisma.$transaction((tx) => this.generateDefaultWith(tx, poId));
  }

  /** Như `generateDefault`, nhưng ghi qua transaction client `db` của nơi gọi. */
  async generateDefaultWith(db: Prisma.TransactionClient, poId: number): Promise<SuborderResult> {
    const po = await db.purchaseOrder.findUnique({ where: { id: poId } });
    if (!po) return { ok: false, msg: 'Không tìm thấy PO' };
    if (po.suborderGenerated === 1) {
      return { ok: false, msg: 'PO đã sinh đơn con (suborder_generated=1) — không sinh lại' };
    }

    const subCode = `${po.poCode}-Đ01`;
    // ⚠ prod `po_db_insert` ép (string) nên ghi '' khi cả hai rỗng; ở đây ghi
    // NULL — luật NULLIF/sentinel ở docs/rewrite-spec/migration/06-po-dot2.md mục 3.
    const createdBy = po.tpkdBy || po.createdBy || null;

    const sub = await db.poSuborder.create({
      data: {
        poId,
        subCode,
        title: `Đơn hàng từ PO ${po.poCode}`,
        status: 1,
        createdBy,
        cdate: 0,
      },
    });
    await db.poItem.updateMany({
      where: { poId, OR: [{ suborderId: null }, { suborderId: 0 }] },
      data: { suborderId: sub.id },
    });
    await db.purchaseOrder.update({ where: { id: poId }, data: { suborderGenerated: 1 } });

    // prod: autoGenerateSuborder() kết bằng gọi recalcSuborder($sub_id) ngay
    // — đơn con mới sinh phải có subtotal/total_items đúng ngay lập tức.
    const suborder = await this.recalcTotalsWith(db, sub.id);
    return { ok: true, msg: 'OK', suborder };
  }

  /**
   * `subtotal = SUM(amount)`, `totalItems = COUNT(*)` của các `po_item`
   * thuộc đơn con `subId` — port `CLS_PO::recalcSuborder`'s inner SQL:
   * `SELECT COALESCE(SUM(amount),0) subtotal, COUNT(*) total_items FROM
   * tbl_po_items WHERE suborder_id=$sub_id`.
   */
  async recalcTotals(subId: number): Promise<PoSuborder> {
    return this.recalcTotalsWith(this.prisma, subId);
  }

  private async recalcTotalsWith(db: Prisma.TransactionClient, subId: number): Promise<PoSuborder> {
    const agg = await db.poItem.aggregate({
      where: { suborderId: subId },
      _sum: { amount: true },
      _count: { _all: true },
    });
    return db.poSuborder.update({
      where: { id: subId },
      data: {
        subtotal: agg._sum.amount ?? 0,
        totalItems: agg._count._all,
      },
    });
  }
}
