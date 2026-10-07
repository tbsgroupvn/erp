// test/po/order-gen.spec.ts — #06 đợt 2, Task 3: hàm LÕI `createOrdersPerItem` (order-gen.core.ts,
// KHÔNG cổng — cổng nằm ở OrderGenService.generateOrdersForPo, xem order-gen-gates.spec.ts),
// port 1:1 `CLS_PO::createOrdersPerItem` (libs/cls.po.php:479-560), đọc
// read-only trên prod 24/09/2026 (lõi sinh đơn — TIỀN CORE của module). Mọi
// dữ liệu thử tiền tố ZZPO2_.
import { prisma } from '../helpers/db';
import { resetPo, seedOrder, seedPo, seedPoItem, seedPoSuborder } from '../helpers/po-db';
import { resetQuote, seedQuote, seedItem } from '../helpers/quote-db';
import { resetMasterdata } from '../helpers/masterdata-db';
import { createOrdersPerItem } from '../../src/po/order-gen.core';

async function seedBuyer(overrides: Partial<Parameters<typeof prisma.customer.create>[0]['data']> = {}) {
  return prisma.customer.create({
    data: {
      code: 'ZZPO2_BUYER01',
      name: 'ZZPO2 tên gọi',
      companyNameVn: 'Công ty TNHH ZZPO2 (DN)',
      phone: '0900000001',
      address: '1 Đường ZZPO2, HN',
      cdate: 1,
      mdate: 1,
      ...overrides,
    },
  });
}

describe('#06 đợt 2 Task 3 — createOrdersPerItem (lõi sinh đơn, KHÔNG cổng)', () => {
  beforeEach(async () => {
    await resetPo();
    await resetQuote();
    await resetMasterdata();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('dòng line_kind=fee KHÔNG sinh đơn; dòng goods CÙNG phụ lục vẫn sinh (đối chứng)', async () => {
    const po = await seedPo('ZZPO2_OG_0001');
    const sub = await seedPoSuborder(po.id, { subCode: 'ZZPO2_OG_0001-Đ01' });
    const goods = await seedPoItem(po.id, {
      suborderId: sub.id, sortOrder: 1, amount: '100000', lineKind: 'goods',
    });
    const fee = await seedPoItem(po.id, {
      suborderId: sub.id, sortOrder: 2, amount: '999999', lineKind: 'fee',
    });

    const orderIds = await createOrdersPerItem(prisma, sub.id);

    expect(orderIds.length).toBe(1);
    const goodsOrder = await prisma.order.findFirst({ where: { poItemId: goods.id, orderType: 1 } });
    const feeOrder = await prisma.order.findFirst({ where: { poItemId: fee.id, orderType: 1 } });
    expect(goodsOrder).not.toBeNull();
    expect(feeOrder).toBeNull();
  });

  it('⚠ seq CHỈ tăng cho dòng KHÔNG bị bỏ qua: [goods, fee, goods] ⇒ mã -01 và -02, KHÔNG -01/-03', async () => {
    const po = await seedPo('ZZPO2_OG_0002');
    const sub = await seedPoSuborder(po.id, { subCode: 'ZZPO2_OG_0002-Đ01' });
    const g1 = await seedPoItem(po.id, { suborderId: sub.id, sortOrder: 1, amount: '10000', lineKind: 'goods' });
    await seedPoItem(po.id, { suborderId: sub.id, sortOrder: 2, amount: '20000', lineKind: 'fee' });
    const g2 = await seedPoItem(po.id, { suborderId: sub.id, sortOrder: 3, amount: '30000', lineKind: 'goods' });

    await createOrdersPerItem(prisma, sub.id);

    const o1 = await prisma.order.findFirstOrThrow({ where: { poItemId: g1.id, orderType: 1 } });
    const o2 = await prisma.order.findFirstOrThrow({ where: { poItemId: g2.id, orderType: 1 } });
    expect(o1.codeOrder).toBe('ZZPO2_OG_0002-Đ01-01');
    expect(o2.codeOrder).toBe('ZZPO2_OG_0002-Đ01-02');
  });

  it('gọi lại lần hai ⇒ KHÔNG đẻ đơn trùng, trả đúng id CŨ (đối chứng: tổng số Order không đổi)', async () => {
    const po = await seedPo('ZZPO2_OG_0003');
    const sub = await seedPoSuborder(po.id, { subCode: 'ZZPO2_OG_0003-Đ01' });
    const item = await seedPoItem(po.id, { suborderId: sub.id, sortOrder: 1, amount: '50000', lineKind: 'goods' });

    const first = await createOrdersPerItem(prisma, sub.id);
    const second = await createOrdersPerItem(prisma, sub.id);

    expect(second).toEqual(first);
    const count = await prisma.order.count({ where: { poItemId: item.id, orderType: 1 } });
    expect(count).toBe(1);
  });

  it('VAT: amount=1.000.000, vat_rate=8 ⇒ vat=80.000, price_vn=1.000.000, total_money=1.080.000', async () => {
    const po = await seedPo('ZZPO2_OG_0004');
    const sub = await seedPoSuborder(po.id, { subCode: 'ZZPO2_OG_0004-Đ01' });
    const item = await seedPoItem(po.id, {
      suborderId: sub.id, sortOrder: 1, amount: '1000000', vatRate: '8.0000', lineKind: 'goods',
    });

    await createOrdersPerItem(prisma, sub.id);

    const order = await prisma.order.findFirstOrThrow({ where: { poItemId: item.id, orderType: 1 } });
    expect(order.vatAmount).toBe(80000n);
    expect(order.priceVn).toBe(1000000n);
    expect(order.totalMoney).toBe(1080000n);
  });

  it('quan GIỮ thập phân: quantity=2.5 ⇒ order.quan=2.5, KHÔNG bị ép về 2', async () => {
    const po = await seedPo('ZZPO2_OG_0005');
    const sub = await seedPoSuborder(po.id, { subCode: 'ZZPO2_OG_0005-Đ01' });
    const item = await seedPoItem(po.id, {
      suborderId: sub.id, sortOrder: 1, amount: '10000', quantity: '2.50', lineKind: 'goods',
    });

    await createOrdersPerItem(prisma, sub.id);

    const order = await prisma.order.findFirstOrThrow({ where: { poItemId: item.id, orderType: 1 } });
    expect(order.quan?.toString()).toBe('2.5');
  });

  it('KHÔNG nối báo giá ⇒ rate_sell=3500 (mặc định)', async () => {
    const po = await seedPo('ZZPO2_OG_0006');
    const sub = await seedPoSuborder(po.id, { subCode: 'ZZPO2_OG_0006-Đ01' });
    const item = await seedPoItem(po.id, {
      suborderId: sub.id, sortOrder: 1, amount: '10000', lineKind: 'goods', quoteItemId: null,
    });

    await createOrdersPerItem(prisma, sub.id);

    const order = await prisma.order.findFirstOrThrow({ where: { poItemId: item.id, orderType: 1 } });
    expect(order.rateSell).toBe(3500);
  });

  it('CÓ nối báo giá ⇒ rate_sell lấy rate_rmb_vnd THẬT (đối chứng của ca không-nối-báo-giá)', async () => {
    const quote = await seedQuote('ZZPO2_QT_0007', { rateRmbVnd: '4123.5000' });
    const qi = await seedItem(quote.id, { unitPriceRmb: '12.3400', domesticShipRmb: '1.5000' });
    const po = await seedPo('ZZPO2_OG_0007');
    const sub = await seedPoSuborder(po.id, { subCode: 'ZZPO2_OG_0007-Đ01' });
    const item = await seedPoItem(po.id, {
      suborderId: sub.id, sortOrder: 1, amount: '10000', lineKind: 'goods', quoteItemId: qi.id,
    });

    await createOrdersPerItem(prisma, sub.id);

    const order = await prisma.order.findFirstOrThrow({ where: { poItemId: item.id, orderType: 1 } });
    // rate_rmb_vnd=4123.5 -> MySQL int(11) column rounds (không truncate).
    expect(order.rateSell).toBe(4124);
    expect(order.priceCyn?.toString()).toBe('12.34');
    expect(order.feeShip?.toString()).toBe('1.5');
  });

  it('suborder.order_id CHỈ đặt khi đang NULL/0 — gọi lại KHÔNG ghi đè (đối chứng: đơn thứ 2 vẫn sinh)', async () => {
    const po = await seedPo('ZZPO2_OG_0008');
    const sub = await seedPoSuborder(po.id, { subCode: 'ZZPO2_OG_0008-Đ01', orderId: 0 });
    const item1 = await seedPoItem(po.id, { suborderId: sub.id, sortOrder: 1, amount: '10000', lineKind: 'goods' });

    const first = await createOrdersPerItem(prisma, sub.id);
    const subAfterFirst = await prisma.poSuborder.findUniqueOrThrow({ where: { id: sub.id } });
    expect(subAfterFirst.orderId).toBe(Number(first[0]));

    // Thêm dòng hàng MỚI, chưa từng sinh đơn — gọi lại phải sinh đơn MỚI cho
    // dòng này (không phải call thứ hai câm), nhưng order_id của suborder
    // GIỮ NGUYÊN giá trị cũ (đã khác NULL/0), không bị ghi đè bởi đơn mới.
    const item2 = await seedPoItem(po.id, { suborderId: sub.id, sortOrder: 2, amount: '20000', lineKind: 'goods' });
    await createOrdersPerItem(prisma, sub.id);
    const subAfterSecond = await prisma.poSuborder.findUniqueOrThrow({ where: { id: sub.id } });
    expect(subAfterSecond.orderId).toBe(subAfterFirst.orderId);

    // ⚠⚠⚠ ĐÃ SỬA ở Task 4 (task-4-brief.md mục Fix 2, deviation CÓ CHỦ Ý so
    // với prod): bản gốc port 1:1 từ PHP có `$seq = 0` khai lại mỗi lần gọi
    // (biến cục bộ, chỉ đếm dòng MỚI-INSERT trong ĐÚNG lượt gọi này) — nên
    // đơn mới của item2 từng mang mã "-01" dù đứng sau item1 trong phụ lục.
    // ⚠ ĐÍNH CHÍNH (review cuối): trên prod kịch bản "thêm dòng SAU khi đã
    // sinh đơn rồi sinh lại" KHÔNG TỚI ĐƯỢC qua nơi gọi — process_gen_orders.php
    // chặn bằng orders_generated=1 và cờ đó không bao giờ reset; hệ mới giữ
    // nguyên cổng đó (OrderGenService.generateOrdersForPo). Test này gọi THẲNG
    // hàm lõi để ghim lớp phòng thủ thứ hai. `seq` giờ được suy từ mã "-NN" LỚN
    // NHẤT đã có của CHÍNH suborder này (xem đầu `order-gen.service.ts`),
    // nên đơn mới của item2 tiếp nối đúng dãy số, không khởi động lại từ 0.
    const order2 = await prisma.order.findFirstOrThrow({ where: { poItemId: item2.id, orderType: 1 } });
    expect(order2.id).not.toBe(first[0]);
    expect(order2.codeOrder).toBe('ZZPO2_OG_0008-Đ01-02');
  });

  // ═══ Task 4 Fix 2 — seq nối tiếp mã LỚN NHẤT đã có, KHÔNG khởi động lại từ 0 ═══
  it('⚠⚠⚠ Fix 2: sinh → thêm dòng mới → sinh lại ⇒ mã MỚI nối tiếp dãy số cũ và KHÔNG đụng mã nào đã có', async () => {
    const po = await seedPo('ZZPO2_OG_0020');
    const sub = await seedPoSuborder(po.id, { subCode: 'ZZPO2_OG_0020-Đ01' });
    const item1 = await seedPoItem(po.id, { suborderId: sub.id, sortOrder: 1, amount: '10000', lineKind: 'goods' });

    await createOrdersPerItem(prisma, sub.id);
    const o1 = await prisma.order.findFirstOrThrow({ where: { poItemId: item1.id, orderType: 1 } });
    expect(o1.codeOrder).toBe('ZZPO2_OG_0020-Đ01-01');

    // Thêm dòng hàng MỚI SAU khi đã sinh đơn lượt đầu — đúng kịch bản rủi ro
    // (task-4-brief.md Fix 2): "thêm dòng vào phụ lục SAU khi đã sinh đơn,
    // rồi sinh lại".
    const item2 = await seedPoItem(po.id, { suborderId: sub.id, sortOrder: 2, amount: '20000', lineKind: 'goods' });
    await createOrdersPerItem(prisma, sub.id);
    const o2 = await prisma.order.findFirstOrThrow({ where: { poItemId: item2.id, orderType: 1 } });
    expect(o2.codeOrder).toBe('ZZPO2_OG_0020-Đ01-02'); // NỐI TIẾP -01, không khởi động lại

    // Lặp thêm một vòng nữa — mã thứ ba vẫn nối tiếp đúng, không lặp lại -02.
    const item3 = await seedPoItem(po.id, { suborderId: sub.id, sortOrder: 3, amount: '30000', lineKind: 'goods' });
    await createOrdersPerItem(prisma, sub.id);
    const o3 = await prisma.order.findFirstOrThrow({ where: { poItemId: item3.id, orderType: 1 } });
    expect(o3.codeOrder).toBe('ZZPO2_OG_0020-Đ01-03');

    // ĐỐI CHỨNG "collides with nothing" — cả ba mã của CÙNG suborder này
    // phải khác nhau tuyệt đối, không có mã nào bị cấp lại.
    const allOrders = await prisma.order.findMany({ where: { poSuborderId: sub.id, orderType: 1 } });
    const codes = allOrders.map((o) => o.codeOrder);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.sort()).toEqual([
      'ZZPO2_OG_0020-Đ01-01', 'ZZPO2_OG_0020-Đ01-02', 'ZZPO2_OG_0020-Đ01-03',
    ]);
  });

  it('buyer_name = cus_ten_dn(buyer) — ưu tiên company_name_vn, cus_info mang đủ code/name/phone/addr', async () => {
    const buyer = await seedBuyer({ code: 'ZZPO2_BUYER02' });
    const po = await seedPo('ZZPO2_OG_0009', { buyerId: buyer.id });
    const sub = await seedPoSuborder(po.id, { subCode: 'ZZPO2_OG_0009-Đ01' });
    const item = await seedPoItem(po.id, { suborderId: sub.id, sortOrder: 1, amount: '10000', lineKind: 'goods' });

    await createOrdersPerItem(prisma, sub.id);

    const order = await prisma.order.findFirstOrThrow({ where: { poItemId: item.id, orderType: 1 } });
    expect(order.cusId).toBe('ZZPO2_BUYER02');
    const cusInfo = JSON.parse(order.cusInfo ?? '{}');
    expect(cusInfo).toEqual({
      code: 'ZZPO2_BUYER02', name: 'Công ty TNHH ZZPO2 (DN)',
      phone: '0900000001', addr: '1 Đường ZZPO2, HN',
    });
  });

  it('buyer_name rơi về TÊN GỌI khi company_name_vn rỗng (đối chứng của ca trên)', async () => {
    const buyer = await seedBuyer({ code: 'ZZPO2_BUYER03', companyNameVn: '', name: 'ZZPO2 tên gọi riêng' });
    const po = await seedPo('ZZPO2_OG_0010', { buyerId: buyer.id });
    const sub = await seedPoSuborder(po.id, { subCode: 'ZZPO2_OG_0010-Đ01' });
    const item = await seedPoItem(po.id, { suborderId: sub.id, sortOrder: 1, amount: '10000', lineKind: 'goods' });

    await createOrdersPerItem(prisma, sub.id);

    const order = await prisma.order.findFirstOrThrow({ where: { poItemId: item.id, orderType: 1 } });
    const cusInfo = JSON.parse(order.cusInfo ?? '{}');
    expect(cusInfo.name).toBe('ZZPO2 tên gọi riêng');
  });

  it('PO không có buyer_id ⇒ buyer_code rơi về PO<sub.po_id> (đối chứng phía trên có buyer)', async () => {
    const po = await seedPo('ZZPO2_OG_0011');
    const sub = await seedPoSuborder(po.id, { subCode: 'ZZPO2_OG_0011-Đ01' });
    const item = await seedPoItem(po.id, { suborderId: sub.id, sortOrder: 1, amount: '10000', lineKind: 'goods' });

    await createOrdersPerItem(prisma, sub.id);

    const order = await prisma.order.findFirstOrThrow({ where: { poItemId: item.id, orderType: 1 } });
    expect(order.cusId).toBe(`PO${po.id}`);
  });

  it('notes: RỖNG ⇒ chuỗi tự động, KHÔNG ghi ngược tbl_po_items.notes (đối chứng của ca ghi tay)', async () => {
    const po = await seedPo('ZZPO2_OG_0012');
    const sub = await seedPoSuborder(po.id, { subCode: 'ZZPO2_OG_0012-Đ01' });
    const item = await seedPoItem(po.id, { suborderId: sub.id, sortOrder: 1, amount: '10000', lineKind: 'goods' });

    await createOrdersPerItem(prisma, sub.id);

    const order = await prisma.order.findFirstOrThrow({ where: { poItemId: item.id, orderType: 1 } });
    expect(order.notes).toBe(`Tự động từ PO ZZPO2_OG_0012 (dòng hàng #${item.id})`);
    const itemReread = await prisma.poItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(itemReread.notes).toBeNull();
  });

  it('notes: ghi tay qua notesMap ⇒ dùng ghi chú đó VÀ ghi ngược lại tbl_po_items.notes', async () => {
    const po = await seedPo('ZZPO2_OG_0013');
    const sub = await seedPoSuborder(po.id, { subCode: 'ZZPO2_OG_0013-Đ01' });
    const item = await seedPoItem(po.id, { suborderId: sub.id, sortOrder: 1, amount: '10000', lineKind: 'goods' });

    await createOrdersPerItem(prisma, sub.id, { [item.id]: 'Ghi chú tay ZZPO2' });

    const order = await prisma.order.findFirstOrThrow({ where: { poItemId: item.id, orderType: 1 } });
    expect(order.notes).toBe('Ghi chú tay ZZPO2');
    const itemReread = await prisma.poItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(itemReread.notes).toBe('Ghi chú tay ZZPO2');
  });

  it('oid DÙNG CHUNG cho cả lượt sinh — hai dòng hàng trong CÙNG một lần gọi ra CÙNG một oid', async () => {
    const po = await seedPo('ZZPO2_OG_0014');
    const sub = await seedPoSuborder(po.id, { subCode: 'ZZPO2_OG_0014-Đ01' });
    const item1 = await seedPoItem(po.id, { suborderId: sub.id, sortOrder: 1, amount: '10000', lineKind: 'goods' });
    const item2 = await seedPoItem(po.id, { suborderId: sub.id, sortOrder: 2, amount: '20000', lineKind: 'goods' });

    await createOrdersPerItem(prisma, sub.id);

    const o1 = await prisma.order.findFirstOrThrow({ where: { poItemId: item1.id, orderType: 1 } });
    const o2 = await prisma.order.findFirstOrThrow({ where: { poItemId: item2.id, orderType: 1 } });
    expect(o1.oid).toBe(o2.oid);
  });

  it('currency: dòng PO currency=USD ⇒ order.currency=USD (đối chứng: null/khác ⇒ CNY)', async () => {
    const po = await seedPo('ZZPO2_OG_0015');
    const sub = await seedPoSuborder(po.id, { subCode: 'ZZPO2_OG_0015-Đ01' });
    const usdItem = await seedPoItem(po.id, {
      suborderId: sub.id, sortOrder: 1, amount: '10000', lineKind: 'goods', currency: 'USD',
    });
    const defaultItem = await seedPoItem(po.id, {
      suborderId: sub.id, sortOrder: 2, amount: '10000', lineKind: 'goods', currency: null,
    });

    await createOrdersPerItem(prisma, sub.id);

    const usdOrder = await prisma.order.findFirstOrThrow({ where: { poItemId: usdItem.id, orderType: 1 } });
    const cnyOrder = await prisma.order.findFirstOrThrow({ where: { poItemId: defaultItem.id, orderType: 1 } });
    expect(usdOrder.currency).toBe('USD');
    expect(cnyOrder.currency).toBe('CNY');
  });

  it('supplierCostRmb + nccId truyền THẲNG từ po_item sang order, không biến đổi', async () => {
    const po = await seedPo('ZZPO2_OG_0016');
    const sub = await seedPoSuborder(po.id, { subCode: 'ZZPO2_OG_0016-Đ01' });
    const item = await seedPoItem(po.id, {
      suborderId: sub.id, sortOrder: 1, amount: '10000', lineKind: 'goods',
      supplierCostRmb: '99.88', nccId: 42,
    });

    await createOrdersPerItem(prisma, sub.id);

    const order = await prisma.order.findFirstOrThrow({ where: { poItemId: item.id, orderType: 1 } });
    expect(order.supplierCostRmb.toString()).toBe('99.88');
    expect(order.nccId).toBe(42);
  });

  it('saler = po.assigned_to ?: po.created_by — ưu tiên assigned_to (đối chứng: rỗng thì rơi về created_by)', async () => {
    const poA = await seedPo('ZZPO2_OG_0017A', { assignedTo: 'sale_gan', createdBy: 'sale_tao' });
    const subA = await seedPoSuborder(poA.id, { subCode: 'ZZPO2_OG_0017A-Đ01' });
    const itemA = await seedPoItem(poA.id, { suborderId: subA.id, sortOrder: 1, amount: '10000', lineKind: 'goods' });

    const poB = await seedPo('ZZPO2_OG_0017B', { createdBy: 'sale_tao' });
    const subB = await seedPoSuborder(poB.id, { subCode: 'ZZPO2_OG_0017B-Đ01' });
    const itemB = await seedPoItem(poB.id, { suborderId: subB.id, sortOrder: 1, amount: '10000', lineKind: 'goods' });

    await createOrdersPerItem(prisma, subA.id);
    await createOrdersPerItem(prisma, subB.id);

    const orderA = await prisma.order.findFirstOrThrow({ where: { poItemId: itemA.id, orderType: 1 } });
    const orderB = await prisma.order.findFirstOrThrow({ where: { poItemId: itemB.id, orderType: 1 } });
    expect(orderA.saler).toBe('sale_gan');
    expect(orderB.saler).toBe('sale_tao');
  });

  it('code_order = <sub_code>-<seq 2 số>; isactive=2, order_type=1, po_id/po_suborder_id/po_item_id đúng khoá truy vết', async () => {
    const po = await seedPo('ZZPO2_OG_0018');
    const sub = await seedPoSuborder(po.id, { subCode: 'ZZPO2_OG_0018-Đ01' });
    const item = await seedPoItem(po.id, { suborderId: sub.id, sortOrder: 1, amount: '10000', lineKind: 'goods' });

    await createOrdersPerItem(prisma, sub.id);

    const order = await prisma.order.findFirstOrThrow({ where: { poItemId: item.id, orderType: 1 } });
    expect(order.codeOrder).toBe('ZZPO2_OG_0018-Đ01-01');
    expect(order.isactive).toBe(2);
    expect(order.orderType).toBe(1);
    expect(order.poId).toBe(po.id);
    expect(order.poSuborderId).toBe(sub.id);
    expect(order.poItemId).toBe(item.id);
  });

  it('suborder rỗng (không tìm thấy) ⇒ trả mảng RỖNG, không ném lỗi', async () => {
    const result = await createOrdersPerItem(prisma, 999999);
    expect(result).toEqual([]);
  });

  it('suborder KHÔNG có dòng hàng nào ⇒ trả mảng RỖNG (đối chứng phạm vi WHERE suborder_id)', async () => {
    const po = await seedPo('ZZPO2_OG_0019');
    const sub = await seedPoSuborder(po.id, { subCode: 'ZZPO2_OG_0019-Đ01' });
    const result = await createOrdersPerItem(prisma, sub.id);
    expect(result).toEqual([]);
  });

  // ═══ Review cuối I-1 — vatRate LƯU trên đơn chưa từng được khẳng định ═══
  // Mutant `vatRate: rate / 100` (0.08 thay vì 8 — đúng bẫy ×100 PO↔báo giá)
  // từng sống qua MỌI test vì chỉ vatAmount/totalMoney được soi.
  it('I-1: vatRate LƯU là PHẦN TRĂM — vat_rate=8 ⇒ order.vatRate = 8 (không phải 0.08)', async () => {
    const po = await seedPo('ZZPO2_OG_0040');
    const sub = await seedPoSuborder(po.id, { subCode: 'ZZPO2_OG_0040-Đ01' });
    const item = await seedPoItem(po.id, {
      suborderId: sub.id, sortOrder: 1, amount: '1000000', vatRate: '8.0000', lineKind: 'goods',
    });
    await createOrdersPerItem(prisma, sub.id);
    const order = await prisma.order.findFirstOrThrow({ where: { poItemId: item.id, orderType: 1 } });
    expect(order.vatRate.toString()).toBe('8');
  });

  it('I-1 đối chứng: vat_rate=10 ⇒ order.vatRate = 10 (bắt mutant ghi hằng số)', async () => {
    const po = await seedPo('ZZPO2_OG_0041');
    const sub = await seedPoSuborder(po.id, { subCode: 'ZZPO2_OG_0041-Đ01' });
    const item = await seedPoItem(po.id, {
      suborderId: sub.id, sortOrder: 1, amount: '1000000', vatRate: '10.0000', lineKind: 'goods',
    });
    await createOrdersPerItem(prisma, sub.id);
    const order = await prisma.order.findFirstOrThrow({ where: { poItemId: item.id, orderType: 1 } });
    expect(order.vatRate.toString()).toBe('10');
  });

  // ═══ Review cuối M-4 — oid: trước đây chỉ khẳng định hai đơn BẰNG nhau ═══
  // Giá trị kỳ vọng tính ĐỘC LẬP bằng Intl (múi Asia/Ho_Chi_Minh), không dùng
  // lại hàm của service. Chấp nhận mốc phút TRƯỚC hoặc SAU lời gọi (chống đỏ
  // ma khi lời gọi vắt qua ranh giới phút).
  describe('oid = str_replace("TBS", "", buyer_code . "." . date("dmy.Hi")) giờ HCM', () => {
    function hcmDmyHi(d: Date): string {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: '2-digit',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
      }).formatToParts(d);
      const g = (t: string) => parts.find((p) => p.type === t)!.value;
      return `${g('day')}${g('month')}${g('year')}.${g('hour')}${g('minute')}`;
    }
    async function genAndReadOid(poCode: string, buyerCode: string | null) {
      const buyer = buyerCode ? await seedBuyer({ code: buyerCode }) : null;
      const po = await seedPo(poCode, buyer ? { buyerId: buyer.id } : {});
      const sub = await seedPoSuborder(po.id, { subCode: `${poCode}-Đ01` });
      const item = await seedPoItem(po.id, { suborderId: sub.id, sortOrder: 1, amount: '10000', lineKind: 'goods' });
      const before = hcmDmyHi(new Date());
      await createOrdersPerItem(prisma, sub.id);
      const after = hcmDmyHi(new Date());
      const order = await prisma.order.findFirstOrThrow({ where: { poItemId: item.id, orderType: 1 } });
      return { oid: order.oid, before, after, poId: po.id };
    }

    it('buyer TBS4321 ⇒ oid "4321.<dmy.Hi HCM>" (bỏ tiền tố TBS, đúng định dạng)', async () => {
      const r = await genAndReadOid('ZZPO2_OG_0042', 'TBS4321');
      expect([`4321.${r.before}`, `4321.${r.after}`]).toContain(r.oid);
    });

    it('đối chứng: PO không buyer ⇒ oid "PO<po_id>.<dmy.Hi HCM>"', async () => {
      const r = await genAndReadOid('ZZPO2_OG_0043', null);
      expect([`PO${r.poId}.${r.before}`, `PO${r.poId}.${r.after}`]).toContain(r.oid);
    });

    // ⚠ KHÔNG có ca "đổi TZ tiến trình": process.env.TZ gán trong Jest KHÔNG tới
    // được tiến trình thật (sandbox chép env riêng) — đã thử, mutant dùng giờ
    // ĐỊA PHƯƠNG (getHours) vẫn XANH trên máy UTC+7 này. Mutant lệch múi
    // (UTC) thì hai ca trên bắt được; mutant giờ địa phương chỉ lộ trên máy
    // chủ chạy test ở múi KHÁC +7.
  });

  // ═══ Review cuối M-1 — Fix 2 phải PHÂN BIỆT max-số với đếm / max-chữ / không lọc ═══
  // Dữ liệu cũ (-01..-03 liền mạch) làm max = count = max-chữ ⇒ ba mutant
  // cùng sống. Mỗi ca dưới đây phá ĐÚNG một sự trùng hợp, kèm ca đối chứng
  // dùng CÙNG đường mã với dữ liệu không phá gì.
  // Prod: 95/1.272 mã order_type=1 đã bị người dùng ĐỔI TÊN qua
  // ajaxs/orders/process_updateCode.php — mã lạ trong cùng phụ lục là dữ liệu THẬT.
  async function nextCodeAfter(poCode: string, existingCodes: string[]): Promise<string | null> {
    const po = await seedPo(poCode);
    const subCode = `${poCode}-Đ01`;
    const sub = await seedPoSuborder(po.id, { subCode });
    let fakeItemId = 80000;
    for (const c of existingCodes) {
      await seedOrder({ poId: po.id, poSuborderId: sub.id, orderType: 1, poItemId: fakeItemId++, codeOrder: c });
    }
    const item = await seedPoItem(po.id, { suborderId: sub.id, sortOrder: 1, amount: '10000', lineKind: 'goods' });
    await createOrdersPerItem(prisma, sub.id);
    const order = await prisma.order.findFirstOrThrow({ where: { poItemId: item.id, orderType: 1 } });
    return order.codeOrder;
  }

  it('Fix 2 / KHOẢNG TRỐNG: đã có -01,-05 ⇒ mã mới -06 (đếm sẽ ra -03)', async () => {
    const P = 'ZZPO2_OG_0050';
    expect(await nextCodeAfter(P, [`${P}-Đ01-01`, `${P}-Đ01-05`])).toBe(`${P}-Đ01-06`);
  });

  it('Fix 2 / đối chứng khoảng trống: đã có -01,-02 ⇒ -03', async () => {
    const P = 'ZZPO2_OG_0051';
    expect(await nextCodeAfter(P, [`${P}-Đ01-01`, `${P}-Đ01-02`])).toBe(`${P}-Đ01-03`);
  });

  it('Fix 2 / SỐ vs CHỮ: đã có -99,-100 ⇒ mã mới -101 (max-chữ "99" sẽ ra -100, ĐỤNG mã cũ)', async () => {
    const P = 'ZZPO2_OG_0052';
    expect(await nextCodeAfter(P, [`${P}-Đ01-99`, `${P}-Đ01-100`])).toBe(`${P}-Đ01-101`);
  });

  it('Fix 2 / đối chứng số vs chữ: đã có -98,-99 ⇒ -100', async () => {
    const P = 'ZZPO2_OG_0053';
    expect(await nextCodeAfter(P, [`${P}-Đ01-98`, `${P}-Đ01-99`])).toBe(`${P}-Đ01-100`);
  });

  it('Fix 2 / ĐỔI TÊN: mã Taobao 19 chữ số trong CÙNG phụ lục bị bỏ qua ⇒ -03 (không lọc tiền tố sẽ ra -05)', async () => {
    const P = 'ZZPO2_OG_0054';
    // `${P}-Đ01-` dài 18 ký tự ⇒ bỏ lọc tiền tố, slice(18) của mã 19 chữ số ra "4".
    expect(await nextCodeAfter(P, [`${P}-Đ01-01`, `${P}-Đ01-02`, '3316385895128173684'])).toBe(`${P}-Đ01-03`);
  });

  it('Fix 2 / đối chứng đổi tên: cùng dữ liệu KHÔNG có mã đổi tên ⇒ -03', async () => {
    const P = 'ZZPO2_OG_0055';
    expect(await nextCodeAfter(P, [`${P}-Đ01-01`, `${P}-Đ01-02`])).toBe(`${P}-Đ01-03`);
  });

  it('Fix 2 / HẬU TỐ DỊ DẠNG đúng tiền tố ("1e3", " 7", "02 (shop A)") bị bỏ qua ⇒ -02 (Number() trần sẽ ra -1001)', async () => {
    const P = 'ZZPO2_OG_0056';
    expect(
      await nextCodeAfter(P, [`${P}-Đ01-01`, `${P}-Đ01-1e3`, `${P}-Đ01- 7`, `${P}-Đ01-02 (shop A)`]),
    ).toBe(`${P}-Đ01-02`);
  });

  it('Fix 2 / đối chứng dị dạng: chỉ có -01 ⇒ -02', async () => {
    const P = 'ZZPO2_OG_0057';
    expect(await nextCodeAfter(P, [`${P}-Đ01-01`])).toBe(`${P}-Đ01-02`);
  });

  // ═══ Chốt chặn DB-level chống trùng (deviation có chủ ý so với prod) ═══
  // Prod CHỈ có check-then-insert tầng ứng dụng (race thật: 2 lượt gọi song
  // song cùng thấy "chưa có đơn" rồi cùng insert). Đo prod 24/09/2026: 0
  // trùng hiện tại, tbl_order không có unique index nào ngoài PRIMARY — nên
  // thêm NGAY một partial unique index (po_item_id) WHERE order_type=1 AND
  // po_item_id>0 làm lưới chặn tầng DB, giữ NGUYÊN check tầng ứng dụng ở
  // trên (đường bình thường vẫn trả về id cũ, index chỉ là lưới cho race).
  describe('partial unique index (po_item_id) WHERE order_type=1 AND po_item_id>0', () => {
    it('CHẶN insert trùng po_item_id khi order_type=1 (mô phỏng race: bỏ qua check tầng app, insert thẳng)', async () => {
      await prisma.order.create({ data: { poItemId: 5001, orderType: 1, supplierCostRmb: 0 } });
      await expect(
        prisma.order.create({ data: { poItemId: 5001, orderType: 1, supplierCostRmb: 0 } }),
      ).rejects.toThrow();
    });

    it('KHÔNG chặn cùng po_item_id khi order_type KHÁC 1 (đối chứng phạm vi WHERE)', async () => {
      await prisma.order.create({ data: { poItemId: 5002, orderType: 0, supplierCostRmb: 0 } });
      await expect(
        prisma.order.create({ data: { poItemId: 5002, orderType: 0, supplierCostRmb: 0 } }),
      ).resolves.toBeDefined();
    });

    it('KHÔNG chặn hai dòng po_item_id=0 cùng order_type=1 — GIỚI HẠN đã biết (0 là sentinel #3, không phải khoá thật)', async () => {
      await prisma.order.create({ data: { poItemId: 0, orderType: 1, supplierCostRmb: 0 } });
      await expect(
        prisma.order.create({ data: { poItemId: 0, orderType: 1, supplierCostRmb: 0 } }),
      ).resolves.toBeDefined();
    });
  });
});
