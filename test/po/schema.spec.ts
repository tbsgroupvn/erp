import { prisma } from '../helpers/db';
import { resetPo, seedPo, seedPoItem, seedPoReceipt } from '../helpers/po-db';
import { HoldService } from '../../src/money/hold.service';

describe('PO schema (#06 — PurchaseOrder + PoItem, mở rộng PoReceipt)', () => {
  beforeEach(async () => {
    await resetPo();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('tạo PurchaseOrder + PoItem, đọc lại đúng quan hệ', async () => {
    const po = await seedPo('PO-TEST-0001');
    const item = await seedPoItem(po.id);

    const found = await prisma.purchaseOrder.findUnique({ where: { id: po.id } });
    expect(found).not.toBeNull();
    const items = await prisma.poItem.findMany({ where: { poId: po.id } });
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe(item.id);
  });

  it('poCode là UNIQUE — trùng mã phải bị chặn', async () => {
    await seedPo('PO-TEST-0002');
    await expect(seedPo('PO-TEST-0002')).rejects.toThrow();
  });

  // ⚠⚠⚠ tbl_po_items.vat_rate lưu PHẦN TRĂM (đo prod 23/09/2026: 8.0000 x1460,
  // 10.0000 x50, 26.0000 x1) — NGƯỢC với tbl_quote_items.vat_pct (PHÂN SỐ,
  // 0.0800). Round-trip đúng chuỗi thập phân để pin đơn vị này lại.
  it('⚠⚠⚠ PoItem.vatRate round-trip là PHẦN TRĂM — 8.0000 đọc lại phải là 8, KHÔNG phải 0.08', async () => {
    const po = await seedPo('PO-TEST-0003');
    const item = await seedPoItem(po.id, { vatRate: '8.0000' });

    const reread = await prisma.poItem.findUniqueOrThrow({ where: { id: item.id } });
    // Prisma trả Decimal (decimal.js) — so bằng .toString() để tránh nhầm
    // với việc ép qua Number() rồi so sánh lỏng lẻo (xem test/quote/schema.spec.ts).
    expect(reread.vatRate?.toString()).toBe('8');
    expect(Number(reread.vatRate)).toBeCloseTo(8, 6);
  });

  // Cùng bẫy F1 đã cắn ở #05 (QuoteItem.cbm) — PoItem.cbm cũng phải giữ 4 số lẻ.
  it('⚠⚠ PoItem.cbm giữ 4 số lẻ — KHÔNG bị làm tròn về 2 (cùng bẫy F1 của #05)', async () => {
    const po = await seedPo('PO-TEST-0004');
    const item = await seedPoItem(po.id, { cbm: '0.1479' });

    const reread = await prisma.poItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(reread.cbm?.toString()).toBe('0.1479');
  });

  it('PoItem.quoteItemId nullable và có index — round-trip null và một giá trị', async () => {
    const po = await seedPo('PO-TEST-0005');
    const withoutJoin = await seedPoItem(po.id, { quoteItemId: null });
    const withJoin = await seedPoItem(po.id, { quoteItemId: 999 });

    const rereadNull = await prisma.poItem.findUniqueOrThrow({ where: { id: withoutJoin.id } });
    const rereadJoin = await prisma.poItem.findUniqueOrThrow({ where: { id: withJoin.id } });
    expect(rereadNull.quoteItemId).toBeNull();
    expect(rereadJoin.quoteItemId).toBe(999);
  });

  it('PurchaseOrder pin vòng đời: status + cancelPrevStatus round-trip', async () => {
    const po = await seedPo('PO-TEST-0006', {
      status: 3,
      submittedBy: 'sale1',
      submittedAt: 100,
      leaderBy: 'leader1',
      leaderAt: 200,
      tpkdBy: 'tpkd1',
      tpkdAt: 300,
    });
    // Huỷ từ trạng thái KHÁC 0 để chứng minh cancelPrevStatus thật (không phải trùng mặc định).
    const cancelled = await prisma.purchaseOrder.update({
      where: { id: po.id },
      data: { status: -1, cancelPrevStatus: 3, cancelBy: 'admin1', cancelAt: 400, cancelNote: 'test huỷ' },
    });
    expect(cancelled.status).toBe(-1);
    expect(cancelled.cancelPrevStatus).toBe(3);
    expect(cancelled.cancelBy).toBe('admin1');
  });

  // ═══ F2 (review cuối #06) — cột prod có dữ liệu thật, thêm lại vào schema ═══
  it('⚠ F2 — PoItem.suborderId/notes round-trip (1.224/1.539 dòng prod có suborder_id)', async () => {
    const po = await seedPo('PO-TEST-F2-0001');
    const item = await seedPoItem(po.id, { suborderId: 4321, notes: 'Ghi chú dòng hàng' });

    const reread = await prisma.poItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(reread.suborderId).toBe(4321);
    expect(reread.notes).toBe('Ghi chú dòng hàng');
  });

  it('⚠ F2 — PurchaseOrder: buyerContact/sellerContact/sellerRep/documents round-trip', async () => {
    const po = await seedPo('PO-TEST-F2-0002', {
      buyerContact: 'Nguyễn Văn A',
      buyerContactPhone: '0900000001',
      sellerContact: 'Zhang San',
      sellerContactPhone: '13800000001',
      sellerRep: 'TBS Sourcing HK',
      documents: 'invoice.pdf;packing-list.pdf',
    });

    const reread = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: po.id } });
    expect(reread.buyerContact).toBe('Nguyễn Văn A');
    expect(reread.buyerContactPhone).toBe('0900000001');
    expect(reread.sellerContact).toBe('Zhang San');
    expect(reread.sellerContactPhone).toBe('13800000001');
    expect(reread.sellerRep).toBe('TBS Sourcing HK');
    expect(reread.documents).toBe('invoice.pdf;packing-list.pdf');
  });

  it('⚠ F2 — PurchaseOrder: guarantee/credit-risk/dossier/sentToCustomer round-trip (0-1 dòng prod, vẫn phải có chỗ đứng)', async () => {
    const po = await seedPo('PO-TEST-F2-0003', {
      guaranteedBy: 'kt1',
      guaranteedAt: 100,
      guaranteeNote: 'Đã bảo lãnh TT',
      creditRiskAt: 200,
      creditRiskBy: 'kttruong1',
      dossierClosedAt: 300,
      sentToCustomerAt: 400,
    });

    const reread = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: po.id } });
    expect(reread.guaranteedBy).toBe('kt1');
    expect(reread.guaranteedAt).toBe(100);
    expect(reread.guaranteeNote).toBe('Đã bảo lãnh TT');
    expect(reread.creditRiskAt).toBe(200);
    expect(reread.creditRiskBy).toBe('kttruong1');
    expect(reread.dossierClosedAt).toBe(300);
    expect(reread.sentToCustomerAt).toBe(400);
  });

  it('⚠ F2 — PoReceipt.note round-trip (225/226 phiếu thu prod có note, varchar(500))', async () => {
    const receipt = await seedPoReceipt({
      customerId: 'TBS-F2-NOTE',
      amount: '100000',
      method: 'bank',
      status: 'no',
      note: 'Chuyển khoản đợt 1, đã đối soát ngân hàng',
      cdate: 1,
    });
    const reread = await prisma.poReceipt.findUniqueOrThrow({ where: { id: receipt.id } });
    expect(reread.note).toBe('Chuyển khoản đợt 1, đã đối soát ngân hàng');
  });

  // ═══ F3 (review cuối #06) — 3 cột DATE đúng kiểu, không còn epoch/text ═══
  it('⚠⚠⚠ F3 — PurchaseOrder.poDate/deliveryDeadline là DATE thật, round-trip đúng NGÀY (không giờ/phút/giây)', async () => {
    const po = await seedPo('PO-TEST-F3-0001', {
      poDate: new Date('2026-01-15'),
      deliveryDeadline: new Date('2026-03-01'),
    });

    const reread = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: po.id } });
    expect(reread.poDate?.toISOString().slice(0, 10)).toBe('2026-01-15');
    expect(reread.deliveryDeadline?.toISOString().slice(0, 10)).toBe('2026-03-01');
  });

  // ⚠⚠⚠ 111/305 po_date đo trên prod là NULL hoặc chuỗi-0 MySQL '0000-00-00'.
  // Luật nạp: zero-date -> NULL, KHÔNG BAO GIỜ một epoch/ngày tính toán. Ca
  // này pin ở TẦNG SCHEMA rằng NULL round-trip sạch — luật "zero-date -> NULL"
  // tự nó là việc của bước ETL (ngoài repo, xem migration doc), không phải
  // logic Prisma/Postgres có thể tự enforce.
  it('⚠⚠⚠ F3 — poDate NULL round-trip sạch (đại diện cho 111/305 dòng prod NULL/0000-00-00 sau khi ETL áp luật zero-date -> NULL)', async () => {
    const po = await seedPo('PO-TEST-F3-0002', { poDate: null });
    const reread = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: po.id } });
    expect(reread.poDate).toBeNull();
  });

  it('⚠ F3 — PoReceipt.receiptDate là DATE thật (226/226 phiếu thu prod có giá trị — KHÔNG phải cột "chỉ mô tả")', async () => {
    const receipt = await seedPoReceipt({
      customerId: 'TBS-F3-RCPT',
      amount: '50000',
      method: 'bank',
      status: 'yes',
      receiptDate: new Date('2026-02-20'),
      cdate: 1,
    });
    const reread = await prisma.poReceipt.findUniqueOrThrow({ where: { id: receipt.id } });
    expect(reread.receiptDate?.toISOString().slice(0, 10)).toBe('2026-02-20');
  });

  // ⚠ F3 — cdate NOT NULL giữ nguyên; 1/305 PO prod có cdate NULL/0 là dữ liệu
  // LỊCH SỬ được coerce ở tầng ETL (xem migration doc + comment schema.prisma
  // ngay trên PurchaseOrder.cdate), KHÔNG phải lý do nới lỏng ràng buộc ở đây.
  it('⚠ F3 — PurchaseOrder.cdate vẫn NOT NULL: thiếu cdate bị Postgres từ chối', async () => {
    await expect(
      prisma.purchaseOrder.create({
        data: {
          poCode: 'PO-TEST-F3-0003',
          subtotal: 0,
          vatAmount: 0,
          totalAmount: 0,
          advanceAmount: 0,
          status: 0,
          // cdate cố ý bỏ trống — Prisma UncheckedCreateInput bắt buộc field
          // này nên ép `as any` để mô phỏng đúng ca "quên set cdate".
        } as any,
      }),
    ).rejects.toThrow();
  });

  it('mở rộng PoReceipt không phá HoldService của #03 (method:wallet, status:no vẫn đếm hold)', async () => {
    await seedPoReceipt({
      customerId: 'TBS0001',
      amount: '1500000',
      method: 'wallet',
      status: 'no',
      receiptCode: 'RC-TEST-0001',
      dot: 1,
      createdBy: 'kt1',
      cdate: 1,
    });

    const hold = new HoldService(prisma as any);
    const amount = await hold.holdAmount('TBS0001');
    expect(amount).toBe(1500000n);
  });
});
