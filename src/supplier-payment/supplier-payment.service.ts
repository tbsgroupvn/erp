import {
  BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { Prisma, SupplierPayment } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ScopeService } from '../iam/scope.service';
import { PermService } from '../iam/perm.service';
import { ReturnService } from '../approval/return.service';
import { phpRound } from '../common/money';
import { toReturnStateDto, toSupplierPaymentDto } from '../common/dto/supplier-payment.dto';
import { SupplierPaymentListQuery } from './supplier-payment.query';
import { DOC_RETURN_REASONS } from './supplier-payment.body';

/** `object_type` của phiếu thanh toán NCC trong `tbl_return_state` (04b §2.3). */
export const PAYMENT_OBJECT_TYPE = 'payment';

/** Điểm duyệt `biz` của "Trả chứng từ" (`includes/return_checkpoints.php`, 04b §3.4). */
export const PAYMENT_CHECKPOINT = 'payment.duyet_ncc';

/** PHP `trim()` mặc định: CHỈ " \t\n\r\0\x0B" — KHÔNG phải `String.prototype.trim` của JS (JS còn
 *  gỡ NBSP, khoảng trắng full-width U+3000…). Dùng trim của JS cho luật chủ phiếu là nới rộng nó:
 *  `'bob　'` sẽ thành chủ của phiếu `'bob'` (memory: chốt tài khoản lọt bằng biến thể tên). */
export function phpTrim(s: string): string {
  return s.replace(/^[ \t\n\r\0\x0B]+|[ \t\n\r\0\x0B]+$/g, '');
}

/**
 * MỘT luật chủ phiếu duy nhất của phân hệ (G11): chủ ≡ `trim(saler) === actor` — nguyên văn
 * `process_doc_resubmit.php:35-36` (so chặt, phân biệt hoa thường, trim kiểu PHP). Dùng CHUNG cho
 * `resubmitDoc()` (ai được nộp lại) và `list()` (ai vẫn thấy phiếu `returned` của mình) — không
 * được có hai bản của luật này. `actor` rỗng/không phải chuỗi ⇒ KHÔNG là chủ của gì (fail-closed).
 */
export function laChuPhieu(saler: string | null | undefined, actor: string | null | undefined): boolean {
  if (typeof saler !== 'string' || typeof actor !== 'string' || actor === '') return false;
  return phpTrim(saler) === actor;
}

/** `json_encode` mặc định của PHP cho vết log: '/' thoát thành '\/' (không JSON_UNESCAPED_SLASHES). */
function phpJson(v: unknown): string {
  return JSON.stringify(v).replace(/\//g, '\\/');
}

/** PHP `number_format($x, 2, ',', '.')`: làm tròn nửa-xa-0 tới 2 chữ số, chấm nghìn, phẩy thập
 *  phân; PHP ≥ 8.0 không in "-0,00". */
export function phpNumberFormatVn(x: Prisma.Decimal): string {
  const r = x.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const neg = r.isNegative() && !r.isZero();
  const [int, frac] = r.abs().toFixed(2).split('.');
  return (neg ? '-' : '') + int.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + frac;
}

function sv(v: unknown): string | null {
  return v === null || v === undefined ? null : String(v);
}
function money2(d: Prisma.Decimal | null): string | null {
  return d === null ? null : d.toFixed(2);
}

/**
 * Cả dòng `tbl_payment` (33 cột, thứ tự §2.1) đúng hình dạng mysqli trả cho PHP: mọi giá trị là
 * CHUỖI, decimal(65,2) đủ 2 chữ số, NULL giữ null. Đây là `$cu` của `locDuLieuSua()` (so ép
 * chuỗi) và là `data_after` của `nopLai()` (04b §4.2).
 */
export function prodPaymentRow(r: SupplierPayment): Record<string, string | null> {
  return {
    id: sv(r.id), cdate: sv(r.cdate), mdate: sv(r.mdate), price_cyn: money2(r.priceCyn),
    currency: sv(r.currency), rate_buy: sv(r.rateBuy), saler: sv(r.saler), from: sv(r.from),
    source: sv(r.source), code_order: sv(r.codeOrder), order_id: sv(r.orderId), note: sv(r.note),
    note_payment: sv(r.notePayment), price_payment: money2(r.pricePayment), payment: sv(r.payment),
    pdate: sv(r.pdate), status: sv(r.status), confirm: sv(r.confirm), po_id: sv(r.poId),
    pay_type: sv(r.payType), bill_images: sv(r.billImages), account_code: sv(r.accountCode),
    ncc_receiver: sv(r.nccReceiver), ncc_bank_name: sv(r.nccBankName), ncc_bank_account: sv(r.nccBankAccount),
    ncc_qr_image: sv(r.nccQrImage), ncc_bank_note: sv(r.nccBankNote), ncc_pay_channel: sv(r.nccPayChannel),
    ncc_platform_order: sv(r.nccPlatformOrder), ncc_invoice_images: sv(r.nccInvoiceImages),
    ncc_packing_list_images: sv(r.nccPackingListImages), kt_note: sv(r.ktNote), tt_ngoai_kieu: sv(r.ttNgoaiKieu),
  };
}

/** `data_before` lúc trả: ĐÚNG 12 cột của `process_doc_return.php:43-52` (04b §4.2, bỏ `confirm`). */
const DATA_BEFORE_KEYS = [
  'id', 'code_order', 'saler', 'price_cyn', 'rate_buy', 'currency', 'ncc_invoice_images',
  'ncc_packing_list_images', 'ncc_receiver', 'ncc_bank_name', 'ncc_bank_account', 'ncc_bank_note',
] as const;

/**
 * Cột prod được nộp lại (8 khoá của `RETURN_CHECKPOINTS['payment.duyet_ncc']`) ⇒ trường Prisma +
 * bộ chuyển kiểu. Prod ghi thẳng `$_POST` vào `UPDATE` (STRICT ⇒ `'447,60'` làm hỏng câu lệnh,
 * §5.12); ở đây giá trị sai kiểu ⇒ 400 TRƯỚC mọi ghi — cùng kết cục "không ghi gì", có thông báo.
 * Khoá lạ (không có trong bảng này) KHÔNG BAO GIỜ được ghi, kể cả khi cấu hình whitelist có nó.
 */
const RESUBMIT_COLUMNS: Record<string, { field: keyof SupplierPayment; conv: (v: unknown) => unknown }> = {
  price_cyn: { field: 'priceCyn', conv: (v) => {
    const s = typeof v === 'number' || typeof v === 'string' ? String(v) : '';
    if (!/^\d{1,16}(\.\d{1,2})?$/.test(s)) throw new BadRequestException('Số tiền không hợp lệ');
    return new Prisma.Decimal(s);
  } },
  rate_buy: { field: 'rateBuy', conv: (v) => {
    const s = typeof v === 'number' || typeof v === 'string' ? String(v) : '';
    if (!/^[1-9]\d{0,9}$/.test(s) || Number(s) > 2147483647) throw new BadRequestException('Tỷ giá không hợp lệ');
    return Number(s);
  } },
  ncc_receiver: { field: 'nccReceiver', conv: (v) => textCol(v, 150, 'Người nhận') },
  ncc_bank_name: { field: 'nccBankName', conv: (v) => textCol(v, 150, 'Ngân hàng') },
  ncc_bank_account: { field: 'nccBankAccount', conv: (v) => textCol(v, 80, 'Số tài khoản') },
  ncc_bank_note: { field: 'nccBankNote', conv: (v) => textCol(v, 255, 'Ghi chú chuyển khoản') },
  ncc_invoice_images: { field: 'nccInvoiceImages', conv: (v) => textCol(v, 65535, 'Invoice') },
  ncc_packing_list_images: { field: 'nccPackingListImages', conv: (v) => textCol(v, 65535, 'Packing list') },
};

function textCol(v: unknown, max: number, label: string): string {
  if (typeof v !== 'string' || v.length > max) throw new BadRequestException(`${label} không hợp lệ`);
  return v;
}

const CHAN_TRUONG_NOTE = 'Người gửi cố đổi trường ngoài phạm vi cho phép';

/** Cột chủ sở hữu của `tbl_payment` cho ScopeService: chỉ `saler` (người TẠO phiếu), không có
 *  người phụ trách phụ, không có cột kho. PHẢI khớp dòng `supplierPayment` trong bảng tra của
 *  ScopeGuard (src/iam/scope.guard.ts) — guard và service trả lời CÙNG một câu hỏi phạm vi. */
const OWNER_FIELDS = { saler: 'saler', salerOther: null } as const;

const NOT_FOUND = 'Không tìm thấy';

function nowSec() { return Math.floor(Date.now() / 1000); }

/**
 * Nguyên văn `json_encode($old_snap, JSON_UNESCAPED_UNICODE)` của `process_delete.php` trên một
 * dòng mysqli: mọi giá trị là CHUỖI (mysqli trả chuỗi), NULL là `null`, decimal(65,2) luôn đủ 2
 * chữ số, và `/` bị thoát thành `\/` (prod KHÔNG bật JSON_UNESCAPED_SLASHES).
 */
function prodDeleteSnapshot(r: SupplierPayment): string {
  const s = (v: unknown) => (v === null || v === undefined ? null : String(v));
  const snap = {
    cdate: s(r.cdate),
    price_cyn: r.priceCyn === null ? null : r.priceCyn.toFixed(2),
    rate_buy: s(r.rateBuy),
    from: s(r.from),
    source: s(r.source),
    code_order: s(r.codeOrder),
    order_id: s(r.orderId),
    note: s(r.note),
  };
  return JSON.stringify(snap).replace(/\//g, '\\/');
}

/**
 * Phiếu thanh toán NCC (09a đợt 1, Task 2) — ĐỌC + XOÁ. Không hiệu ứng tiền (không ví, sổ quỹ,
 * GL, AP) — đặc tả §10 mục 2 và 5.
 *
 * Phạm vi: prod web lọc `saler = $username` khi `issale==1` (§5.16, `list.php:214-216`). v2 không
 * mang cờ nhóm `issale` làm nguồn phân quyền (01-iam.md) — "sale" là vai có `payment.view` phạm
 * vi `own`, mà `ScopeService.buildDocScope(own)` dựng đúng `saler = username`. Kế toán/vai khác:
 * phạm vi `all` (prod: mọi vai đều `all`, §4) ⇒ thấy hết, như prod với người không phải sale.
 *
 * ⚠ FAIL-CLOSED với danh tính: mọi phương thức tự tra lại user theo `uid` (đang hoạt động, có
 * username). Không xác định được ⇒ danh sách RỖNG / 404 — không bao giờ dựng `where` từ một giá
 * trị `undefined` (Prisma XOÁ key `undefined` khỏi `where` ⇒ điều kiện biến mất ⇒ khớp TẤT CẢ).
 */
@Injectable()
export class SupplierPaymentService {
  constructor(
    private prisma: PrismaService,
    private scope: ScopeService,
    private returns: ReturnService,
    private perm: PermService,
  ) {}

  /** Username ĐÃ LƯU + `gid` PHIÊN (`tbl_user.gid`) của người gọi, hoặc `null` nếu không xác định
   *  được (fail-closed). */
  private async actor(uid: number): Promise<{ username: string; gid: number | null } | null> {
    if (!Number.isInteger(uid) || uid <= 0) return null;
    const u = await this.prisma.user.findUnique({ where: { id: uid }, select: { username: true, isActive: true, gid: true } });
    if (!u || !u.isActive || typeof u.username !== 'string' || u.username === '') return null;
    return { username: u.username, gid: u.gid };
  }

  private async actorName(uid: number): Promise<string | null> {
    return (await this.actor(uid))?.username ?? null;
  }

  /**
   * prod `$gid == 1` — nhóm "Super Admin" CŨ (`tbl_user_group.id = 1`), KHÔNG phải
   * `CLS_STAFF::laSuperAdmin()` (đặc tả §4, 04b T4). v2 giữ nguyên cột `tbl_user.gid` ⇒ so thẳng.
   */
  private static laGid1(a: { gid: number | null }): boolean {
    return a.gid === 1;
  }

  /**
   * prod `$issale == 1` (cờ nhóm cũ). v2 KHÔNG mang cờ nhóm sang làm nguồn phân quyền (01-iam.md
   * §5 mục 5); cùng quy ước với `list()` (Task 2): "sale" ≡ `payment.view` có phạm vi KHÁC `all`
   * (prod: sale ⇒ `saler = $username`, tức `own`). Fail-closed: mọi phạm vi hẹp hơn `all` (kể cả
   * không có quyền) đều bị coi là sale — không ai "lọt" khỏi chốt chỉ vì phạm vi lạ.
   */
  private async laSale(uid: number): Promise<boolean> {
    return (await this.perm.scopeOf('payment.view', uid)) !== 'all';
  }

  /**
   * Khoá dòng `tbl_payment` (`SELECT … FOR UPDATE`) RỒI MỚI quyết "tồn tại trong phạm vi" bằng MỘT
   * truy vấn gộp định danh + phạm vi, trong CÙNG transaction với mọi ghi phía sau. Kiểm phạm vi
   * TRƯỚC khoá là không đủ: phiếu có thể bị đổi `saler` giữa lúc kiểm và lúc khoá (ca test
   * "delete — phiếu bị chuyển chủ"). Không có / ngoài phạm vi ⇒ CÙNG một 404.
   */
  private async lockInScope(
    tx: Prisma.TransactionClient, id: number, scope: Prisma.SupplierPaymentWhereInput,
  ): Promise<SupplierPayment> {
    await tx.$queryRaw`SELECT id FROM tbl_payment WHERE id = ${id} FOR UPDATE`;
    const row = await tx.supplierPayment.findFirst({ where: { AND: [{ id }, scope] } });
    if (!row) throw new NotFoundException(NOT_FOUND);
    return row;
  }

  private scopeWhere(perm: string, uid: number): Promise<Prisma.SupplierPaymentWhereInput> {
    return this.scope.buildDocScope(perm, uid, { ...OWNER_FIELDS });
  }

  /**
   * Danh sách (§5.16 + §10 mục 2). Ẩn phiếu đang `returned` của NGƯỜI KHÁC — chủ phiếu (`saler`)
   * vẫn thấy phiếu của mình để sửa & nộp lại (app `mobile-api/v1/payment/list.php:35-43`, 04b §5.2).
   * `resubmitted` KHÔNG bị ẩn.
   */
  async list(uid: number, q: SupplierPaymentListQuery = {}) {
    const page = q.page ?? 1;
    const perPage = q.perPage ?? 20;
    const me = await this.actorName(uid);
    if (me === null) return { items: [], page, perPage, total: 0 };
    const scope = await this.scopeWhere('payment.view', uid);

    const filters: Prisma.SupplierPaymentWhereInput[] = [];
    if (q.id !== undefined) {
      // Như web: có mã phiếu thì bỏ MỌI bộ lọc khác — nhưng KHÔNG bỏ phạm vi (bảo mật, không phải lọc).
      filters.push({ id: q.id });
    } else {
      if (q.confirm !== undefined) filters.push({ confirm: q.confirm });
      if (q.payment !== undefined) filters.push({ payment: q.payment });
      if (q.source !== undefined) filters.push({ source: q.source });
      if (q.payType !== undefined) filters.push({ payType: q.payType });
      if (q.poId !== undefined) filters.push({ poId: q.poId });
    }

    return this.prisma.$transaction(async (tx) => {
      // Ẩn phiếu `returned` KHÔNG thuộc người gọi. "Thuộc" = `laChuPhieu` — CÙNG hàm với
      // resubmitDoc() (trim kiểu PHP), không phải một mệnh đề `saler = me` viết riêng ở đây. Luật đó
      // không diễn đạt được trong `where` của Prisma ⇒ tính tập id cần ẩn bằng TS rồi `notIn`.
      // Không nới phạm vi: vẫn AND với `scope`; `me` đã chắc chắn khác null/rỗng ở trên.
      const returnedIds = (await this.returns.notReturnedWhere(PAYMENT_OBJECT_TYPE, tx)).id.notIn;
      let hidden: number[] = returnedIds;
      if (returnedIds.length) {
        const owners = await tx.supplierPayment.findMany({ where: { id: { in: returnedIds } }, select: { id: true, saler: true } });
        const mine = new Set(owners.filter((o) => laChuPhieu(o.saler, me)).map((o) => o.id));
        hidden = returnedIds.filter((x) => !mine.has(x));
      }
      const where: Prisma.SupplierPaymentWhereInput = {
        AND: [scope, { id: { notIn: hidden } }, ...filters],
      };
      const total = await tx.supplierPayment.count({ where });
      const rows = await tx.supplierPayment.findMany({
        where,
        orderBy: [{ cdate: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * perPage,
        take: perPage,
      });
      return { items: rows.map((r) => toSupplierPaymentDto(r)), page, perPage, total };
    });
  }

  /**
   * Chi tiết + `returnState` + `changedFields`. Ngoài phạm vi ≡ không tồn tại: MỘT truy vấn gộp
   * định danh + phạm vi, MỘT thông điệp 404 — không "tìm rồi mới kiểm phạm vi" (lộ sự tồn tại qua
   * mã lỗi hoặc thời gian).
   */
  async get(uid: number, id: number) {
    const me = await this.actorName(uid);
    if (me === null) throw new NotFoundException(NOT_FOUND);
    const scope = await this.scopeWhere('payment.view', uid);
    const row = await this.prisma.supplierPayment.findFirst({ where: { AND: [{ id }, scope] } });
    if (!row) throw new NotFoundException(NOT_FOUND);
    const st = await this.returns.state(PAYMENT_OBJECT_TYPE, id);
    return {
      ...toSupplierPaymentDto(row),
      returnState: toReturnStateDto(st),
      changedFields: this.returns.changedFields(st),
    };
  }

  /**
   * Xoá (§5.10, G10). Prod `process_delete.php` (bản ĐANG CHẠY): chỉ `confirm='no'`; log `delete`
   * 8 cột cũ; phiếu đã thật sự biến mất ⇒ dọn `tbl_return_state`. Ở đây tất cả trong MỘT
   * transaction, khoá dòng `FOR UPDATE` trước khi đọc `confirm` (khép cửa sổ đua với duyệt).
   *
   * Khác prod có chủ đích: prod xoá phiếu đã duyệt thì `DELETE` khớp 0 dòng và vẫn in `success`;
   * ở đây trả 409 để người gọi biết KHÔNG có gì bị xoá. Không đổi dữ liệu nào trong cả hai bản.
   * `tbl_payment_orders` của phiếu bị xoá theo (FK `onDelete: Cascade`, Task 1) — prod để lại mồ
   * côi (§5.10, 40 dòng).
   */
  async delete(uid: number, id: number) {
    const me = await this.actorName(uid);
    if (me === null) throw new NotFoundException(NOT_FOUND);
    const scope = await this.scopeWhere('payment.delete', uid);
    return this.prisma.$transaction(async (tx) => {
      // Tồn-tại-trong-phạm-vi quyết DƯỚI khoá dòng, MỘT truy vấn (Task 3, review Task 2): trước đây
      // kiểm phạm vi TRƯỚC khoá rồi đọc lại KHÔNG phạm vi ⇒ phiếu bị gán cho sale khác giữa hai
      // bước vẫn bị người `own` xoá. Câu DELETE cũng mang phạm vi (lớp thứ hai).
      const row = await this.lockInScope(tx, id, scope);
      if (row.confirm !== 'no') throw new ConflictException('Chỉ xoá được phiếu chưa duyệt');

      const del = await tx.supplierPayment.deleteMany({ where: { AND: [{ id }, { confirm: 'no' }, scope] } });
      if (del.count !== 1) throw new NotFoundException(NOT_FOUND);

      await tx.supplierPaymentLog.create({
        data: {
          paymentId: id,
          action: 'delete',
          oldData: prodDeleteSnapshot(row),
          createdBy: me,
          cdate: nowSec(),
        },
      });
      // G10 — phiếu đã thật sự biến mất (count===1 dưới khoá dòng) ⇒ dọn trạng thái trả về,
      // CÙNG transaction: không mồ côi theo chiều nào.
      await this.returns.clear(PAYMENT_OBJECT_TYPE, id, tx);
      return { id, deleted: true };
    });
  }

  /**
   * Trần còn lại của PO khi nộp lại làm TĂNG `price_cyn` — nguyên văn logic prod
   * `process_doc_resubmit.php:45-64` + `po_ncc_gia_tri_don()` / `po_ncc_da_yeu_cau()`
   * (`libs/cls.po.php:1462-1513`). Chạy trong `tx` SAU khoá dòng phiếu.
   *
   *   oids = đơn liên kết của CHÍNH phiếu này (`tbl_payment_orders`); rỗng ⇒ KHÔNG kiểm (prod).
   *   tong = Σ po_ncc_gia_tri_don(đơn)  — đơn không còn ⇒ bỏ qua
   *   da   = Σ po_ncc_da_yeu_cau(oids) − price_cyn CŨ   ("trừ chính phiếu này ra", VÔ ĐIỀU KIỆN)
   *   con  = tong − da;  mới > con + 0,01 ⇒ 'Vượt trần còn lại của PO (' + number_format(con,2,',','.') + ')'
   *
   * ⚠ QUIRK PROD CHÉP NGUYÊN (không sửa — xem báo cáo Task 3, Fix round 1): `da` trừ price_cyn cũ
   * kể cả khi phiếu này `pay_type=''` — tức chưa từng được đếm trong `po_ncc_da_yeu_cau` (chỉ đếm
   * `supplier`) ⇒ trần còn lại bị THỔI lên đúng bằng price_cyn cũ với phiếu luồng cũ.
   * Tiền tính bằng Decimal (không float) — biên `+0,01` so chính xác tới xu.
   */
  private async kiemTranPo(
    tx: Prisma.TransactionClient, id: number, oldCyn: Prisma.Decimal, newCyn: Prisma.Decimal,
  ): Promise<void> {
    const links = await tx.supplierPaymentOrder.findMany({ where: { paymentId: id }, select: { orderId: true } });
    const oids = [...new Set(links.map((l) => l.orderId))];
    if (!oids.length) return;

    const r2 = (d: Prisma.Decimal) => d.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    // po_ncc_gia_tri_don: dòng PO `supplier_cost_rmb` > 0 ưu tiên, không thì snapshot trên đơn.
    const orders = await tx.order.findMany({
      where: { id: { in: oids.map((o) => BigInt(o)) } },
      select: { id: true, poItemId: true, supplierCostRmb: true },
    });
    const itemIds = [...new Set(orders.map((o) => o.poItemId).filter((x) => x > 0))];
    const items = itemIds.length
      ? await tx.poItem.findMany({ where: { id: { in: itemIds } }, select: { id: true, supplierCostRmb: true } })
      : [];
    const itemCost = new Map(items.map((i) => [i.id, i.supplierCostRmb]));
    let tong = new Prisma.Decimal(0);
    for (const o of orders) {
      const ic = o.poItemId > 0 ? itemCost.get(o.poItemId) : undefined;
      tong = tong.plus(ic != null && ic.gt(0) ? r2(ic) : r2(o.supplierCostRmb ?? new Prisma.Decimal(0)));
    }

    // po_ncc_da_yeu_cau: Σ rmb của MỌI phiếu pay_type='supplier' (kể cả chưa duyệt) theo đơn, round 2.
    // prod po_ncc_da_yeu_cau() chỉ nhận id > 0 (liên kết order_id=0 vẫn giữ trong oids ở trên — kiểm vẫn chạy).
    const req = await tx.supplierPaymentOrder.findMany({
      where: { orderId: { in: oids.filter((o) => o > 0) }, payment: { payType: 'supplier' } },
      select: { orderId: true, rmb: true },
    });
    const perOrder = new Map<number, Prisma.Decimal>();
    for (const x of req) perOrder.set(x.orderId, (perOrder.get(x.orderId) ?? new Prisma.Decimal(0)).plus(x.rmb));
    let daSum = new Prisma.Decimal(0);
    for (const v of perOrder.values()) daSum = daSum.plus(r2(v));

    const da = daSum.minus(oldCyn);
    const con = tong.minus(da);
    if (newCyn.gt(con.plus('0.01'))) {
      throw new ConflictException('Vượt trần còn lại của PO (' + phpNumberFormatVn(con) + ')');
    }
  }

  /**
   * Trả chứng từ cho sale sửa — `ajaxs/payment/process_doc_return.php` (04b §2.2 T2, 09a §5.12,
   * G8b). Thứ tự kiểm như prod: cấm sale (trừ gid 1) → mã lý do → phiếu → `confirm==='yes'` →
   * cấu hình điểm duyệt (`CLS_TRAVE::tra`). KHÔNG đụng `tbl_payment` (04b §2.1).
   *
   * Khác prod có chủ đích: khoá dòng phiếu `FOR UPDATE` trước khi đọc `confirm` và ghi trạng thái
   * trong CÙNG transaction (G8b) ⇒ tuần tự hoá với duyệt/xoá; prod không khoá, không transaction.
   * Không kiểm "đang bị trả rồi" và không kiểm `payment='yes'` — như prod (gọi lại ⇒ `round+1`).
   * Thông báo `payment_tra_chungtu` tới sale: CHƯA có (v2 chưa có phân hệ thông báo).
   */
  async returnDoc(uid: number, id: number, reasonCode: string, note: string = '') {
    const who = await this.actor(uid);
    if (who === null) throw new NotFoundException(NOT_FOUND);
    if ((await this.laSale(uid)) && !SupplierPaymentService.laGid1(who)) {
      throw new ForbiddenException('Sale không được trả chứng từ');
    }
    const label = Object.prototype.hasOwnProperty.call(DOC_RETURN_REASONS, reasonCode) ? DOC_RETURN_REASONS[reasonCode] : undefined;
    if (label === undefined) throw new BadRequestException('Lý do trả về không hợp lệ');
    const reason = label + ': ' + (typeof note === 'string' ? note : '');
    if (reason.length > 255) throw new BadRequestException('Lý do trả về quá dài');
    const scope = await this.scopeWhere('payment.view', uid);

    return this.prisma.$transaction(async (tx) => {
      const row = await this.lockInScope(tx, id, scope);
      if (row.confirm === 'yes') throw new ConflictException('Phiếu đã duyệt, không trả về được');
      const cfg = await this.returns.config('biz', PAYMENT_CHECKPOINT);
      if (!cfg) throw new ConflictException('Điểm duyệt này không bật trả về.');
      // `require_reason` của CLS_TRAVE::tra: lý do ở đây luôn có nhãn ⇒ không bao giờ rỗng.
      const fieldsOpened = await this.returns.editableFields('biz', PAYMENT_CHECKPOINT);
      const full = prodPaymentRow(row);
      const dataBefore: Record<string, string | null> = {};
      for (const k of DATA_BEFORE_KEYS) dataBefore[k] = full[k];

      const st = await this.returns.returnObject(tx, {
        objectType: PAYMENT_OBJECT_TYPE,
        objectId: id,
        checkpointType: 'biz',
        checkpointRef: PAYMENT_CHECKPOINT,
        reason,
        fieldsOpened,
        dataBefore,
        returnedBy: who.username,
      });
      await tx.supplierPaymentLog.create({
        data: { paymentId: id, action: 'doc_return', oldData: '', newData: '', note: reason, createdBy: who.username, cdate: nowSec() },
      });
      return { id, state: st.state, round: st.round, reason: st.reason };
    });
  }

  /**
   * Sale nộp lại sau khi sửa — `ajaxs/payment/process_doc_resubmit.php` (04b §2.2 T4, §2.4, G11).
   * MỘT transaction, khoá dòng phiếu trước mọi đọc/ghi (prod: không transaction, UPDATE chạy trước
   * `nopLai()` và kết quả `nopLai()` không được kiểm).
   *
   * - `activeReturn` bắt buộc; chủ phiếu (`laChuPhieu`) hoặc gid 1.
   * - `mergeResubmit(editableFields(cấu hình HIỆN TẠI), cả dòng prod, fields)`; UPDATE CHỈ các khoá
   *   whitelist có mặt trong `fields` + `mdate`. Khoá ngoài whitelist mà đổi ⇒ giữ cũ + vết
   *   `doc_chan_truong`.
   * - Trần PO khi `price_cyn` tăng: `kiemTranPo()` — chép nguyên prod (kể cả quirk pay_type='').
   * - L1b (đồng bộ `tbl_payment_orders.rmb`): CHÉP prod — KHÔNG đồng bộ (plan, chờ Q1).
   * - Thông báo `payment_nop_lai` tới `returned_by`: CHƯA có (v2 chưa có phân hệ thông báo).
   */
  async resubmitDoc(uid: number, id: number, body: { fields?: Record<string, unknown>; note?: string }) {
    const who = await this.actor(uid);
    if (who === null) throw new NotFoundException(NOT_FOUND);
    const moi: Record<string, unknown> =
      body && typeof body.fields === 'object' && body.fields !== null && !Array.isArray(body.fields) ? body.fields : {};
    const rsNote = typeof body?.note === 'string' ? body.note : '';
    const scope = await this.scopeWhere('payment.view', uid);

    return this.prisma.$transaction(async (tx) => {
      const row = await this.lockInScope(tx, id, scope);
      const st = await this.returns.activeReturn(tx, PAYMENT_OBJECT_TYPE, id);
      if (!st) throw new ConflictException('Phiếu này không ở trạng thái chờ sửa chứng từ.');
      if (!laChuPhieu(row.saler, who.username) && !SupplierPaymentService.laGid1(who)) {
        throw new ForbiddenException('Chỉ người tạo phiếu mới nộp lại được');
      }

      const allowed = await this.returns.editableFields('biz', PAYMENT_CHECKPOINT);
      const { data, doi, chan } = this.returns.mergeResubmit(allowed, prodPaymentRow(row), moi);

      // UPDATE: chỉ khoá whitelist CÓ MẶT trong dữ liệu mới (process_doc_resubmit.php:66-73).
      const update: Record<string, unknown> = {};
      for (const k of allowed) {
        if (!Object.prototype.hasOwnProperty.call(moi, k)) continue;
        const col = Object.prototype.hasOwnProperty.call(RESUBMIT_COLUMNS, k) ? RESUBMIT_COLUMNS[k] : undefined;
        if (!col) continue; // khoá cấu hình lạ — không phải cột nộp lại được, không ghi
        update[col.field] = col.conv(data[k]);
      }

      const oldCyn = row.priceCyn ?? new Prisma.Decimal(0);
      const newCyn = (update.priceCyn as Prisma.Decimal | undefined) ?? row.priceCyn;
      if (row.poId > 0 && newCyn !== null && newCyn.gt(oldCyn)) {
        await this.kiemTranPo(tx, id, oldCyn, newCyn);
      }

      // ⚠ L1 — SỬA CÓ CHỦ ĐÍCH, KHÁC PROD (plan "Nguyên tắc với câu hỏi mở", đặc tả §12 L1, Q1).
      // prod nộp lại đổi price_cyn/rate_buy mà KHÔNG tính lại price_payment (#14455 lưu 158.702.310
      // thay vì 167.829.620). Bất biến I4: price_payment hoặc NULL, hoặc = ROUND(price_cyn*rate_buy)
      // — đúng 1.186/1.189 dòng prod, 3 lệch đều do lỗi này. Chỉ tính lại khi price_payment đang
      // KHÁC NULL/0; NULL/0 giữ nguyên (người đọc VND tự rơi về price_cyn*rate_buy, bẫy §11.1).
      // phpRound(float*float, 0) ≡ MySQL ROUND(decimal) trên 15.517 cặp thật (đặc tả §13).
      const newRate = (update.rateBuy as number | undefined) ?? row.rateBuy;
      const cynDoi = newCyn !== null && (row.priceCyn === null || !newCyn.eq(row.priceCyn));
      const rateDoi = newRate !== row.rateBuy;
      if (row.pricePayment !== null && !row.pricePayment.isZero() && (cynDoi || rateDoi)
          && newCyn !== null && newRate !== null) {
        update.pricePayment = new Prisma.Decimal(phpRound(newCyn.toNumber() * newRate, 0));
      }

      update.mdate = nowSec();
      await tx.supplierPayment.update({ where: { id }, data: update as Prisma.SupplierPaymentUpdateInput });
      const after = await tx.supplierPayment.findUniqueOrThrow({ where: { id } });

      const done = await this.returns.markResubmitted(tx, PAYMENT_OBJECT_TYPE, id, prodPaymentRow(after));
      const now = nowSec();
      await tx.supplierPaymentLog.create({
        data: {
          paymentId: id, action: 'doc_resubmit', oldData: phpJson(doi), newData: phpJson(Object.keys(doi)),
          note: rsNote, createdBy: who.username, cdate: now,
        },
      });
      if (chan.length) {
        await tx.supplierPaymentLog.create({
          data: {
            paymentId: id, action: 'doc_chan_truong', oldData: '', newData: phpJson(chan),
            note: CHAN_TRUONG_NOTE, createdBy: who.username, cdate: now,
          },
        });
      }
      return { id, state: done.state, round: done.round, changed: Object.keys(doi), blocked: chan };
    });
  }
}
