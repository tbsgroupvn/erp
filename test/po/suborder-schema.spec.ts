import { prisma } from '../helpers/db';
import { resetPo, seedPo, seedPoSuborder, seedOrder } from '../helpers/po-db';

// #06 đợt 2, Task 1 — schema `PoSuborder` (tbl_po_suborders, 13/13 cột đo
// trên prod) + `Order` (tbl_order, phạm vi order_type=1 — 31/68 cột, đúng
// tập cột `createOrdersPerItem` ghi + id; xem comment đầu `model Order` ở
// prisma/schema.prisma và migration 20260924100000 để biết 37 cột NGOÀI
// phạm vi). Mọi giá trị test dùng tiền tố ZZPO2_ theo quy ước dự án.
describe('#06 đợt 2 Task 1 — PoSuborder + Order (phạm vi order_type=1)', () => {
  beforeEach(async () => {
    await resetPo();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('PoSuborder round-trip đủ 13/13 cột đo trên prod (kể cả sub_date là DATE thật)', async () => {
    const po = await seedPo('ZZPO2_PO_0001');
    const sub = await seedPoSuborder(po.id, {
      subCode: 'ZZPO2_PO_0001-Đ01',
      title: 'Đợt 1',
      subDate: new Date('2026-09-24'),
      status: 1,
      subtotal: '1234567.89',
      totalItems: 3,
      sortOrder: 2,
      notes: 'Ghi chú phụ lục',
      createdBy: 'sale_zzpo2',
      cdate: 1758700000,
      orderId: 0,
    });

    const reread = await prisma.poSuborder.findUniqueOrThrow({ where: { id: sub.id } });
    expect(reread.poId).toBe(po.id);
    expect(reread.subCode).toBe('ZZPO2_PO_0001-Đ01');
    expect(reread.title).toBe('Đợt 1');
    expect(reread.subDate?.toISOString().slice(0, 10)).toBe('2026-09-24');
    expect(reread.status).toBe(1);
    expect(reread.subtotal?.toString()).toBe('1234567.89');
    expect(reread.totalItems).toBe(3);
    expect(reread.sortOrder).toBe(2);
    expect(reread.notes).toBe('Ghi chú phụ lục');
    expect(reread.createdBy).toBe('sale_zzpo2');
    expect(reread.cdate).toBe(1758700000);
    expect(reread.orderId).toBe(0);
  });

  // Luật zero-date '0000-00-00' ⇒ NULL (cùng bẫy F3 của PurchaseOrder.poDate,
  // đợt 1) — pin ở tầng schema rằng NULL round-trip sạch.
  it('PoSuborder.subDate NULL round-trip sạch (luật zero-date -> NULL, cùng F3 đợt 1)', async () => {
    const po = await seedPo('ZZPO2_PO_0002');
    const sub = await seedPoSuborder(po.id, { subDate: null });

    const reread = await prisma.poSuborder.findUniqueOrThrow({ where: { id: sub.id } });
    expect(reread.subDate).toBeNull();
  });

  it('PoSuborder.cdate là epoch int, KHÔNG phải datetime — đo riêng, không suy theo subDate cạnh nó', async () => {
    const po = await seedPo('ZZPO2_PO_0003');
    const sub = await seedPoSuborder(po.id, { cdate: 1758700123 });

    const reread = await prisma.poSuborder.findUniqueOrThrow({ where: { id: sub.id } });
    // Nếu cdate lỡ bị mô hình thành DateTime, gán một số nguyên epoch vào đây
    // sẽ ném lỗi kiểu ngay ở bước seed phía trên (không tới được expect này).
    expect(reread.cdate).toBe(1758700123);
  });

  it('Order round-trip đủ 30 cột createOrdersPerItem ghi + id (phạm vi order_type=1)', async () => {
    const po = await seedPo('ZZPO2_PO_0004');
    const sub = await seedPoSuborder(po.id, { subCode: 'ZZPO2_PO_0004-Đ01' });

    const order = await seedOrder({
      oid: 'ZZPO2_BUYER.240926.1200',
      shop: '',
      sku: '[]',
      cusId: 'ZZPO2_CUS_0001',
      cusInfo: '{"code":"ZZPO2_CUS_0001"}',
      proId: '0',
      proInfo: '{"link":"","img":""}',
      detailInfo: '{"name":"Hàng mẫu ZZPO2"}',
      codeOrder: 'ZZPO2_PO_0004-Đ01-01',
      priceCyn: '12.3400',
      feeShip: '1.500',
      priceVn: 1000000n,
      rateSell: 3600,
      quan: '2.50',
      cdate: 1758700200,
      mdate: 1758700300,
      saler: 'sale_zzpo2',
      store: '',
      vatRate: '8.0000',
      vatAmount: 80000n,
      totalMoney: 1080000n,
      notes: 'Tự động từ PO ZZPO2_PO_0004 (dòng hàng #1)',
      orderType: 1,
      isactive: 2,
      poId: po.id,
      poSuborderId: sub.id,
      poItemId: 111,
      supplierCostRmb: '12.34',
      currency: 'CNY',
      nccId: 5,
    });

    const reread = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(reread.oid).toBe('ZZPO2_BUYER.240926.1200');
    expect(reread.shop).toBe('');
    expect(reread.sku).toBe('[]');
    expect(reread.cusId).toBe('ZZPO2_CUS_0001');
    expect(reread.cusInfo).toBe('{"code":"ZZPO2_CUS_0001"}');
    // ⚠⚠⚠ pro_id là varchar(255) thật trên prod — round-trip phải ra CHUỖI '0',
    // không phải số 0 (đo trực tiếp, không suy theo tên cột).
    expect(reread.proId).toBe('0');
    expect(reread.proInfo).toBe('{"link":"","img":""}');
    expect(reread.detailInfo).toBe('{"name":"Hàng mẫu ZZPO2"}');
    expect(reread.codeOrder).toBe('ZZPO2_PO_0004-Đ01-01');
    expect(reread.priceCyn?.toString()).toBe('12.34');
    expect(reread.feeShip?.toString()).toBe('1.5');
    expect(reread.priceVn).toBe(1000000n);
    expect(reread.rateSell).toBe(3600);
    // ⚠⚠⚠ quan giữ thập phân — quantity=2.5 phải đọc lại đúng 2.5, KHÔNG bị
    // ép về 2 (bẫy CÔNG THỨC của plan #06 đợt 2).
    expect(reread.quan?.toString()).toBe('2.5');
    expect(reread.cdate).toBe(1758700200);
    expect(reread.mdate).toBe(1758700300);
    expect(reread.saler).toBe('sale_zzpo2');
    expect(reread.store).toBe('');
    // ⚠⚠⚠ vat_rate là PHẦN TRĂM (8 = 8%, KHÔNG phải 0.08) — 8.0000 round-trip
    // phải ra '8', khớp công thức vat = amount*vat_rate/100 của #06 đợt 2.
    expect(reread.vatRate.toString()).toBe('8');
    expect(reread.vatAmount).toBe(80000n);
    expect(reread.totalMoney).toBe(1080000n);
    expect(reread.notes).toBe('Tự động từ PO ZZPO2_PO_0004 (dòng hàng #1)');
    expect(reread.orderType).toBe(1);
    expect(reread.isactive).toBe(2);
    expect(reread.poId).toBe(po.id);
    expect(reread.poSuborderId).toBe(sub.id);
    expect(reread.poItemId).toBe(111);
    expect(reread.supplierCostRmb.toString()).toBe('12.34');
    expect(reread.currency).toBe('CNY');
    expect(reread.nccId).toBe(5);
  });

  // TRUY VẾT: tbl_order.id là bigint(255) trên prod — id sinh ra phải là
  // BigInt ở phía client, không lặng lẽ tràn/ép về number.
  it('Order.id là BigInt (prod: bigint(255))', async () => {
    const order = await seedOrder({ poItemId: 0, supplierCostRmb: 0 });
    expect(typeof order.id).toBe('bigint');
  });

  // po_item_id NOT NULL trên prod (dù có DEFAULT 0 nên bỏ trống hợp lệ, tự
  // nhận 0) — ca cần pin là gán THẲNG null cũng bị chặn, không được âm thầm
  // lọt qua (đây là khoá TRUY VẾT chống trùng đơn của createOrdersPerItem:
  // WHERE po_item_id=? AND order_type=1 — NULL ở đây sẽ làm câu chống trùng
  // đó câm lặng).
  it('Order.poItemId vẫn NOT NULL: gán thẳng null bị Postgres từ chối', async () => {
    await expect(
      prisma.order.create({
        data: {
          poItemId: null,
          supplierCostRmb: 0,
          // ép `as any` để mô phỏng ca gọi sai kiểu lọt qua tới runtime.
        } as any,
      }),
    ).rejects.toThrow();
  });

  // ⚠⚠ Bẫy prod tự ghi (libs/cls.po.php:1238): PoItem.suborderId (đã có ở
  // #06 đợt 1) KHÔNG phải id đơn hàng — nó trỏ PoSuborder.id. Đơn hàng thật
  // nối PO item bằng Order.poItemId (cột NÀY), không phải suborderId. Ca
  // này pin đúng hai khoá không được lẫn vào nhau.
  it('⚠⚠ Order.poItemId nối tới PoItem.id, KHÔNG phải PoSuborder.id — hai khoá không được lẫn', async () => {
    const po = await seedPo('ZZPO2_PO_0005');
    const sub = await seedPoSuborder(po.id);
    const order = await seedOrder({ poItemId: 777, poSuborderId: sub.id, supplierCostRmb: 0 });

    const reread = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(reread.poItemId).toBe(777);
    expect(reread.poSuborderId).not.toBe(reread.poItemId);
  });
});
