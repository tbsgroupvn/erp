// test/po/suborder.spec.ts — #06 đợt 2, Task 2: `SuborderService`, port 1:1
// `CLS_PO::autoGenerateSuborder`/`recalcSuborder` (libs/cls.po.php, đọc
// read-only trên prod 24/09/2026). Mọi dữ liệu thử tiền tố ZZPO2_.
import { prisma } from '../helpers/db';
import { resetPo, seedPo, seedPoItem, seedPoSuborder } from '../helpers/po-db';
import { SuborderService } from '../../src/po/suborder.service';

const suborderSvc = new SuborderService(prisma as any);

describe('#06 đợt 2 Task 2 — SuborderService (tách đơn con)', () => {
  beforeEach(async () => {
    await resetPo();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('generateDefault: sinh <po_code>-Đ01, gán mọi po_item chưa có đơn con về nó, đặt cờ suborderGenerated=1', async () => {
    const po = await seedPo('ZZPO2_SUB_0001', { tpkdBy: 'tpkd_zzpo2', createdBy: 'sale_zzpo2' });
    const item1 = await seedPoItem(po.id, { amount: '100000' }); // suborderId mặc định NULL (chưa gán)
    const item2 = await seedPoItem(po.id, { amount: '200000', suborderId: 0 }); // sentinel 0 kiểu prod

    const result = await suborderSvc.generateDefault(po.id);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.suborder.subCode).toBe('ZZPO2_SUB_0001-Đ01');
    expect(result.suborder.poId).toBe(po.id);
    // created_by = tpkd_by ?: created_by — có tpkd_by thì ưu tiên nó.
    expect(result.suborder.createdBy).toBe('tpkd_zzpo2');

    const poReread = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: po.id } });
    expect(poReread.suborderGenerated).toBe(1);

    const item1Reread = await prisma.poItem.findUniqueOrThrow({ where: { id: item1.id } });
    const item2Reread = await prisma.poItem.findUniqueOrThrow({ where: { id: item2.id } });
    expect(item1Reread.suborderId).toBe(result.suborder.id);
    expect(item2Reread.suborderId).toBe(result.suborder.id);
  });

  // ═══ Review cuối M-4 — ba cột generateDefault ghi nhưng chưa ai đọc lại ═══
  // Prod: cả 550/550 dòng tbl_po_suborders có cdate=0 (LITERAL trong
  // autoGenerateSuborder, không phải quên time()). Đọc lại từ CSDL, không từ
  // giá trị trả về.
  it('generateDefault: cdate = 0 LITERAL (quirk prod), không phải thời điểm hiện tại', async () => {
    const po = await seedPo('ZZPO2_SUB_0010');
    const r = await suborderSvc.generateDefault(po.id);
    if (!r.ok) throw new Error('setup');
    const sub = await prisma.poSuborder.findUniqueOrThrow({ where: { id: r.suborder.id } });
    expect(sub.cdate).toBe(0);
  });

  it('generateDefault: title = "Đơn hàng từ PO <po_code>"', async () => {
    const po = await seedPo('ZZPO2_SUB_0011');
    const r = await suborderSvc.generateDefault(po.id);
    if (!r.ok) throw new Error('setup');
    const sub = await prisma.poSuborder.findUniqueOrThrow({ where: { id: r.suborder.id } });
    expect(sub.title).toBe('Đơn hàng từ PO ZZPO2_SUB_0011');
  });

  it('generateDefault: status = 1 (cột mặc định là 0 — ghi tường minh)', async () => {
    const po = await seedPo('ZZPO2_SUB_0012');
    const r = await suborderSvc.generateDefault(po.id);
    if (!r.ok) throw new Error('setup');
    const sub = await prisma.poSuborder.findUniqueOrThrow({ where: { id: r.suborder.id } });
    expect(sub.status).toBe(1);
  });

  it('generateDefault: created_by rơi về created_by khi PO chưa có tpkd_by (?: PHP)', async () => {
    const po = await seedPo('ZZPO2_SUB_0002', { createdBy: 'sale_zzpo2' });

    const result = await suborderSvc.generateDefault(po.id);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.suborder.createdBy).toBe('sale_zzpo2');
  });

  it('generateDefault: đơn con không đụng tới po_item của PO KHÁC (đối chứng phạm vi WHERE poId)', async () => {
    const poA = await seedPo('ZZPO2_SUB_0003A');
    const poB = await seedPo('ZZPO2_SUB_0003B');
    const itemOther = await seedPoItem(poB.id, { amount: '999999' });

    await suborderSvc.generateDefault(poA.id);

    const itemOtherReread = await prisma.poItem.findUniqueOrThrow({ where: { id: itemOther.id } });
    expect(itemOtherReread.suborderId).toBeNull();
  });

  it('generateDefault idempotent: gọi lần hai KHÔNG sinh thêm đơn con, trả ok:false', async () => {
    const po = await seedPo('ZZPO2_SUB_0004');
    await seedPoItem(po.id, { amount: '50000' });

    const first = await suborderSvc.generateDefault(po.id);
    expect(first.ok).toBe(true);

    const second = await suborderSvc.generateDefault(po.id);
    expect(second.ok).toBe(false);

    const subs = await prisma.poSuborder.findMany({ where: { poId: po.id } });
    expect(subs.length).toBe(1);
  });

  it('recalcTotals(subId): subtotal=SUM(amount), totalItems=COUNT(*) — chỉ dòng thuộc ĐÚNG đơn con này', async () => {
    const po = await seedPo('ZZPO2_SUB_0005');
    const sub = await seedPoSuborder(po.id, { subCode: 'ZZPO2_SUB_0005-Đ01' });
    await seedPoItem(po.id, { amount: '100000.50', suborderId: sub.id });
    await seedPoItem(po.id, { amount: '200000.25', suborderId: sub.id });
    // Dòng CHƯA gán đơn con này — phải bị LOẠI khỏi tổng (đối chứng WHERE suborder_id).
    await seedPoItem(po.id, { amount: '999999', suborderId: 0 });

    const updated = await suborderSvc.recalcTotals(sub.id);

    expect(updated.subtotal?.toString()).toBe('300000.75');
    expect(updated.totalItems).toBe(2);
  });

  it('recalcTotals(subId): đơn con RỖNG (không có dòng nào) ra subtotal=0, totalItems=0', async () => {
    const po = await seedPo('ZZPO2_SUB_0006');
    const sub = await seedPoSuborder(po.id, { subCode: 'ZZPO2_SUB_0006-Đ01' });

    const updated = await suborderSvc.recalcTotals(sub.id);

    expect(updated.subtotal?.toString()).toBe('0');
    expect(updated.totalItems).toBe(0);
  });
});
