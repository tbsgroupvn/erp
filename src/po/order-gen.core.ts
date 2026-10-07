// src/po/order-gen.core.ts — #06 đợt 2: LÕI sinh đơn `createOrdersPerItem`,
// port 1:1 `CLS_PO::createOrdersPerItem` (libs/cls.po.php:479-560), đọc
// read-only trên prod 24/09/2026.
//
// ⛔⛔⛔ HÀM NÀY KHÔNG CÓ CỔNG CHẶN NÀO. ĐỪNG GỌI NÓ NGOÀI `OrderGenService`.
// Trên prod, nơi gọi DUY NHẤT của nó là `ajaxs/po/process_gen_orders.php`, và
// CHÍNH FILE ĐÓ giữ mọi cổng nghiệp vụ: `declares_customs`, PO toàn dòng phí,
// `status >= 3` (đủ 2 cấp duyệt), `orders_generated` — rồi lặp MỌI phụ lục
// và ghi `orders_generated = 1`. Gọi thẳng hàm lõi này = tạo nghĩa vụ tiền
// với khách từ một PO CHƯA DUYỆT. Điểm vào duy nhất có cổng là
// `OrderGenService.generateOrdersForPo` (src/po/order-gen.service.ts).
// Lưới `test/po/order-gen-surface.spec.ts` chặn mọi file src/ khác import
// file này, và chặn `OrderGenService` lộ lại hàm lõi ra DI.
//
// Hàm nhận `db` (một Prisma transaction client) thay vì tự giữ PrismaService:
// `generateOrdersForPo` chạy TOÀN BỘ lượt sinh của một PO trong MỘT
// transaction, nên hàm lõi phải ghi qua đúng client của transaction đó.
//
// Nguyên văn đoạn PHP cốt lõi để đối chiếu khi có nghi ngờ:
//
//   foreach($items as $it){
//     if((string)($it['line_kind'] ?? 'goods') === 'fee') continue;
//     $chk->Query("SELECT id FROM tbl_order WHERE po_item_id=".intval($it['id'])." AND order_type=1 LIMIT 1");
//     if($chk->Num_rows() > 0){ $ex=$chk->Fetch_Assoc(); $order_ids[]=intval($ex['id']); continue; }
//     $seq++;
//     $code = $sub['sub_code'].'-'.str_pad($seq,2,'0',STR_PAD_LEFT);
//     ...
//     $__vat  = round($__amt * $__rate / 100);
//     ...
//     'quan'=>floatval($it['quantity']),
//     'rate_sell'=>($__rate_sell>0 ? $__rate_sell : 3500),
//     ...
//   }
//   if(!empty($order_ids)){
//     UPDATE tbl_po_suborders SET order_id=$order_ids[0] WHERE id=$sub_id AND (order_id IS NULL OR order_id=0)
//   }
//
// ⚠⚠⚠ THỨ TỰ hai điều kiện `continue` — dòng fee bị loại TRƯỚC khi chạm tới
// check trùng, và check trùng chạy TRƯỚC `$seq++`. Hệ quả: một phụ lục
// [goods, fee, goods] ra mã `-01`/`-02` (không phải `-01`/`-03`), và gọi lại
// lần hai (mọi dòng đã có đơn) chỉ trả lại đúng id cũ — KHÔNG đẻ đơn trùng.
//
// ⚠⚠ BẪY prod tự ghi (libs/cls.po.php:1238): `PoItem.suborderId` trỏ
// `PoSuborder.id`, KHÔNG PHẢI id đơn hàng. Đơn hàng nối PO item bằng
// `Order.poItemId` — khoá chống trùng (`po_item_id=? AND order_type=1`).
//
// ⚠⚠⚠ SENTINEL — LUÔN GHI 0 vào các cột prod DEFAULT 0 khi tạo mới, LUÔN ĐỌC
// "chưa gán" bằng điều kiện chấp nhận CẢ null LẪN 0 — cùng quy ước
// `suborder.service.ts`, để không lặp bẫy `package_issue.closed_at` (#07).
//
// ⚠⚠⚠ `Order.poItemId` là `Int` NOT NULL `@default(0)` — bỏ trống field khi
// `create()` KHÔNG ném lỗi, nó lặng lẽ ghi 0. Vì đây CHÍNH LÀ khoá chống
// trùng, hàm này LUÔN gán `poItemId` tường minh từ `it.id`.
//
// ⚠⚠⚠ LỆCH PROD #1 có chủ ý — partial unique index `(po_item_id) WHERE
// order_type=1 AND po_item_id>0` (migration 20260924180000) làm lưới TẦNG DB
// cho cuộc đua check-then-insert. Check tầng ứng dụng dưới đây VẪN GIỮ: đường
// thường phải trả lại id CŨ lặng lẽ như prod; index chỉ đỡ nhánh đua, và nhánh
// đó được `generateOrdersForPo` dịch thành một kết quả từ chối xác định, không
// để lại đơn dở (xem order-gen.service.ts).
//
// ⚠⚠⚠ LỆCH PROD #2 có chủ ý — `seq` suy từ hậu tố "-NN" LỚN NHẤT (theo GIÁ TRỊ
// SỐ) đã cấp cho CHÍNH phụ lục này, thay vì `$seq = 0` mỗi lượt gọi như prod.
// ⚠ ĐÍNH CHÍNH lý do (review cuối 24/09/2026): trên prod, đường "sinh lần hai
// trên cùng phụ lục" KHÔNG TỚI ĐƯỢC qua nơi gọi — `process_gen_orders.php` chặn
// mọi lượt sau bằng `orders_generated=1`, và cờ đó KHÔNG BAO GIỜ được reset
// (grep ajaxs/components/libs/mobile-api/cron: chỉ có cổng, lệnh ghi =1 và mã
// hiển thị). `generateOrdersForPo` giữ nguyên cổng đó, nên ở hệ mới đường này
// cũng không tới được qua điểm vào có cổng. Fix này là PHÒNG THỦ NHIỀU LỚP cho
// ngày có ai đó reset cờ hoặc thêm đường gọi mới — không phải vá một bug đã
// cắn ai. Chỉ đếm hậu tố TOÀN CHỮ SỐ (`/^\d+$/`) sau đúng tiền tố
// `<sub_code>-`: 95/1.272 mã `order_type=1` trên prod đã bị người dùng ĐỔI TÊN
// qua `ajaxs/orders/process_updateCode.php` (UPDATE tbl_order SET
// code_order=...), vd thành mã Taobao 19 chữ số — các mã đó phải bị bỏ qua,
// không được làm lệch `seq`.
import { Prisma } from '@prisma/client';
import { nowSec, toVnd, phpRound } from '../common/money';
import { DEFAULT_CUSTOMER_PREFIX } from '../masterdata/customer-code.service';

export type NotesMap = Record<number, string>;
export type OrderGenDb = Prisma.TransactionClient;

// `cus_ten_dn($row, 'company_name_vn', 'name')` (includes/customer_name.php) —
// company_name_vn đóng băng ưu tiên, rơi về `name` (tên gọi) khi rỗng.
function custenDn(buyer: { companyNameVn?: string | null; name?: string | null }): string {
  const dn = (buyer.companyNameVn ?? '').trim();
  if (dn !== '') return dn;
  return (buyer.name ?? '').trim();
}

// PHP `date("dmy.Hi")` chạy trên prod với `date.timezone=Asia/Ho_Chi_Minh`
// (UTC+7 cố định, không DST). Tính bằng offset cố định +7h trên UTC thay vì
// dựa vào TZ của tiến trình — tránh oid đổi hình dạng theo múi giờ máy chủ.
export function formatOidTimestamp(d: Date): string {
  const HCM_OFFSET_MS = 7 * 60 * 60 * 1000;
  const t = new Date(d.getTime() + HCM_OFFSET_MS);
  const dd = String(t.getUTCDate()).padStart(2, '0');
  const mm = String(t.getUTCMonth() + 1).padStart(2, '0');
  const yy = String(t.getUTCFullYear() % 100).padStart(2, '0');
  const HH = String(t.getUTCHours()).padStart(2, '0');
  const ii = String(t.getUTCMinutes()).padStart(2, '0');
  return `${dd}${mm}${yy}.${HH}${ii}`;
}

/**
 * ⛔ KHÔNG CỔNG — chỉ `OrderGenService.generateOrdersForPo` được gọi (xem đầu file).
 *
 * Sinh MỖI DÒNG HÀNG (po_item, line_kind != 'fee') của một suborder thành
 * MỘT `tbl_order` riêng (order_type=1). Trả về mảng `id` — id CŨ cho dòng đã
 * có đơn, id MỚI cho dòng vừa sinh — theo thứ tự `sort_order ASC, id ASC`.
 */
export async function createOrdersPerItem(
  db: OrderGenDb,
  subId: number,
  notesMap: NotesMap = {},
): Promise<bigint[]> {
  const sub = await db.poSuborder.findUnique({ where: { id: subId } });
  if (!sub) return [];

  const items = await db.poItem.findMany({
    where: { suborderId: subId },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  });
  if (items.length === 0) return [];

  const poId = sub.poId ?? 0;
  const po = poId > 0 ? await db.purchaseOrder.findUnique({ where: { id: poId } }) : null;
  const buyer =
    po?.buyerId != null && po.buyerId > 0
      ? await db.customer.findUnique({ where: { id: po.buyerId } })
      : null;

  const buyerCode = buyer?.code ? buyer.code : `PO${poId}`;
  const buyerName = buyer ? custenDn(buyer) : '';
  const saler = po ? po.assignedTo || po.createdBy || '' : '';
  // ⚠ Byte KHÁC prod dù giá trị giống hệt: PHP json_encode(..., UNESCAPED_UNICODE)
  // không kèm JSON_UNESCAPED_SLASHES nên prod ghi `\/`; JSON.stringify ghi `/`.
  // Xem docs/rewrite-spec/migration/06-po-dot2.md mục 9.
  const cusInfo = JSON.stringify({
    code: buyerCode, name: buyerName,
    phone: buyer?.phone ?? '', addr: buyer?.address ?? '',
  });
  const proInfo = JSON.stringify({ link: '', img: '' });

  // `str_replace(CUSTOMER_CODE, '', $buyer_code.'.'.date("dmy.Hi"))` — TÍNH
  // MỘT LẦN trước vòng lặp, dùng chung cho mọi đơn sinh trong lượt này.
  const sharedOid = (buyerCode + '.' + formatOidTimestamp(new Date())).split(DEFAULT_CUSTOMER_PREFIX).join('');

  const orderIds: bigint[] = [];

  // LỆCH PROD #2 (xem đầu file) — `seq` khởi điểm = hậu tố số LỚN NHẤT đã cấp.
  const subPrefix = `${sub.subCode}-`;
  const issuedForSub = await db.order.findMany({
    where: { poSuborderId: subId, orderType: 1, codeOrder: { startsWith: subPrefix } },
    select: { codeOrder: true },
  });
  let seq = 0;
  for (const o of issuedForSub) {
    const suffix = (o.codeOrder ?? '').slice(subPrefix.length);
    // CHỈ chuỗi toàn chữ số: `Number()` một mình còn nhận " 7", "1e3" (→1000),
    // "0x10" (→16) — các dạng chỉ có thể tới từ đổi tên tay, phải bị bỏ qua.
    if (!/^\d+$/.test(suffix)) continue;
    const n = Number(suffix);
    if (n > seq) seq = n;
  }

  for (const it of items) {
    if ((it.lineKind ?? 'goods') === 'fee') continue;

    const existing = await db.order.findFirst({
      where: { poItemId: it.id, orderType: 1 },
    });
    if (existing) {
      orderIds.push(existing.id);
      continue;
    }

    seq++;
    const code = `${sub.subCode}-${String(seq).padStart(2, '0')}`;
    const detailInfo = JSON.stringify({
      name: `${it.productName ?? ''}${it.spec ? ' — ' + it.spec : ''}`,
    });
    const now = nowSec();

    // Thuế GTGT theo DÒNG HÀNG — tbl_po_items.vat_rate lưu PHẦN TRĂM (8/10).
    // price_vn = tiền hàng CHƯA thuế; total_money = số KHÁCH PHẢI TRẢ (gồm
    // thuế). round() PHP là round-half-away-from-zero -> phpRound(..,0).
    const amt = Number(it.amount);
    const rate = Number(it.vatRate ?? 0);
    const vat = phpRound((amt * rate) / 100, 0);

    let cynUnit = 0;
    let cynShip = 0;
    let rateSell = 0;
    if (it.quoteItemId != null && it.quoteItemId > 0) {
      const qi = await db.quoteItem.findUnique({ where: { id: it.quoteItemId } });
      if (qi) {
        cynUnit = Number(qi.unitPriceRmb);
        cynShip = Number(qi.domesticShipRmb);
        const q = await db.quote.findUnique({ where: { id: qi.quoteId } });
        rateSell = q ? Number(q.rateRmbVnd) : 0;
      }
    }

    // Ghi chú nhập tay modal "Sinh đơn" — trống thì giữ chuỗi tự động cũ.
    const noteRaw = (notesMap[it.id] ?? '').trim();
    const autoNote = `Tự động từ PO ${po?.poCode ?? ''} (dòng hàng #${it.id})`;
    const note = noteRaw !== '' ? noteRaw : autoNote;

    const created = await db.order.create({
      data: {
        oid: sharedOid, shop: '', sku: '[]', cusId: buyerCode, cusInfo,
        proId: '0', proInfo, detailInfo,
        priceCyn: cynUnit, feeShip: cynShip, priceVn: toVnd(amt),
        // tbl_order.rate_sell là int(11) — MySQL LÀM TRÒN (không cắt).
        rateSell: rateSell > 0 ? Math.round(rateSell) : 3500,
        // tbl_po_items.quantity DECIMAL(14,2) -> tbl_order.quan giữ thập phân.
        quan: it.quantity,
        cdate: now, mdate: now,
        saler, store: '',
        // ⚠⚠⚠ PHẦN TRĂM (8 nghĩa là 8%), KHÔNG chia 100 — ca test
        // "vatRate LƯU là PHẦN TRĂM" trong order-gen.spec.ts ghim cột này.
        vatRate: rate, vatAmount: toVnd(vat),
        totalMoney: toVnd(amt + vat),
        codeOrder: code,
        notes: note,
        orderType: 1, isactive: 2,
        poId, poSuborderId: subId,
        poItemId: it.id,
        supplierCostRmb: it.supplierCostRmb ?? 0,
        currency: it.currency === 'USD' ? 'USD' : 'CNY',
        nccId: it.nccId ?? 0,
      },
    });
    orderIds.push(created.id);

    // Chỉ ghi ngược khi có ghi chú TAY (đúng `if($__note !== '')` của prod).
    if (noteRaw !== '') {
      await db.poItem.update({ where: { id: it.id }, data: { notes: noteRaw } });
    }
  }

  // suborder.order_id = đơn ĐẦU TIÊN của lượt này, CHỈ khi đang NULL/0 — điều
  // kiện nằm ngay trong WHERE, giữ tính nguyên tử của UPDATE...WHERE gốc.
  if (orderIds.length > 0) {
    await db.poSuborder.updateMany({
      where: { id: subId, OR: [{ orderId: null }, { orderId: 0 }] },
      data: { orderId: Number(orderIds[0]) },
    });
  }

  return orderIds;
}
