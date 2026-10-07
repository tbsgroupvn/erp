import { prisma } from '../helpers/db';
import {
  resetWarehouse,
  seedKhoTqReceipt,
  seedPackingLot,
  seedTransportFile,
  seedPackageIssue,
} from '../helpers/warehouse-db';

describe('warehouse schema (#07 — kho/kiện/lô/container, Task 1)', () => {
  beforeEach(async () => {
    await resetWarehouse();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // ⚠ prod: source đo được lark 1.249 · unclaimed 234 · po_scan 85 · claimed 0 ·
  // manual 0 — 'unclaimed' TỪNG THIẾU trong enum trên prod và chặn cả luồng
  // vô-chủ→nhận-chủ. Pin cả 'unclaimed' lẫn 'claimed' round-trip.
  it("⚠ KhoTqReceipt.source round-trip 'unclaimed' và 'claimed'", async () => {
    const unclaimed = await seedKhoTqReceipt({ source: 'unclaimed', kho: 'TQ_NGHIAO' });
    const claimed = await seedKhoTqReceipt({ source: 'claimed', kho: 'TQ_NGHIAO' });

    const rereadUnclaimed = await prisma.khoTqReceipt.findUniqueOrThrow({ where: { id: unclaimed.id } });
    const rereadClaimed = await prisma.khoTqReceipt.findUniqueOrThrow({ where: { id: claimed.id } });
    expect(rereadUnclaimed.source).toBe('unclaimed');
    expect(rereadClaimed.source).toBe('claimed');
  });

  it('KhoTqReceipt.source từ chối giá trị lạ ngoài 5 giá trị enum', async () => {
    await expect(
      prisma.khoTqReceipt.create({
        data: { status: 1, source: 'khong_ton_tai' as any },
      }),
    ).rejects.toThrow();
  });

  // 4 số lẻ — cùng bẫy F1 của #05 (QuoteItem.cbm) / #06 (PoItem.cbm). Làm
  // tròn về 2 số lẻ là dương tính giả đã từng cắn thật ở module khác.
  it('⚠ KhoTqReceipt.volume giữ ĐÚNG 4 số lẻ — không bị làm tròn về 2', async () => {
    const r = await seedKhoTqReceipt({ volume: '1.2345', source: 'lark' });
    const reread = await prisma.khoTqReceipt.findUniqueOrThrow({ where: { id: r.id } });
    expect(reread.volume?.toString()).toBe('1.2345');
  });

  it('KhoTqReceipt.kho có index và round-trip cột phạm vi kho', async () => {
    const r = await seedKhoTqReceipt({ kho: 'TQ_QC', source: 'po_scan' });
    const reread = await prisma.khoTqReceipt.findUniqueOrThrow({ where: { id: r.id } });
    expect(reread.kho).toBe('TQ_QC');
    // Chứng minh có thể lọc theo cột kho — đây là cột phạm vi kho Task 2 sẽ dùng.
    const filtered = await prisma.khoTqReceipt.findMany({ where: { kho: 'TQ_QC' } });
    expect(filtered.map((x: { id: number }) => x.id)).toContain(r.id);
  });

  // Workflow tách lô CHƯA từng chạy trên prod (split_status=0 ở 100% dòng)
  // nhưng cột phải tồn tại + round-trip để migrate dữ liệu thật không mất gì.
  it('⚠ cột workflow tách lô tồn tại + round-trip dù chưa dựng service', async () => {
    const r = await seedKhoTqReceipt({
      source: 'lark',
      splitStatus: 2,
      splitParentId: 111,
      splitSeq: 3,
      splitReqBy: 'nv1',
      splitReqAt: 1000,
      splitReqNote: 'yêu cầu tách',
      splitBy: 'nv2',
      splitAt: 2000,
      splitNote: 'đã tách',
      splitXnkBy: 'xnk1',
      splitXnkAt: 3000,
      splitOnCont: 5,
    });
    const reread = await prisma.khoTqReceipt.findUniqueOrThrow({ where: { id: r.id } });
    expect(reread.splitStatus).toBe(2);
    expect(reread.splitParentId).toBe(111);
    expect(reread.splitSeq).toBe(3);
    expect(reread.splitReqBy).toBe('nv1');
    expect(reread.splitReqAt).toBe(1000);
    expect(reread.splitReqNote).toBe('yêu cầu tách');
    expect(reread.splitBy).toBe('nv2');
    expect(reread.splitAt).toBe(2000);
    expect(reread.splitNote).toBe('đã tách');
    expect(reread.splitXnkBy).toBe('xnk1');
    expect(reread.splitXnkAt).toBe(3000);
    expect(reread.splitOnCont).toBe(5);
  });

  // "1 dòng = 1 lô" — unique (poId, lotNo). Chứng minh CẢ HAI nửa: trùng
  // trong CÙNG PO bị chặn, và CÙNG lotNo ở HAI PO khác nhau vẫn được phép
  // (chứng minh ràng buộc được SCOPE theo từng PO, không phải toàn cục).
  it('⚠ PackingLot: unique(poId, lotNo) — trùng trong cùng PO bị chặn, khác PO thì được', async () => {
    await seedPackingLot(9001, 1);
    await expect(seedPackingLot(9001, 1)).rejects.toThrow();
    // Hai PO khác nhau, cùng lotNo=1 — PHẢI thành công cả hai.
    await expect(seedPackingLot(9002, 1)).resolves.toBeDefined();
  });

  it('PackingLot.lotNo là số nguyên (Int), không phải chuỗi', async () => {
    const lot = await seedPackingLot(9003, 7, { supplierName: 'NCC test' });
    const reread = await prisma.packingLot.findUniqueOrThrow({ where: { id: lot.id } });
    expect(reread.lotNo).toBe(7);
    expect(typeof reread.lotNo).toBe('number');
  });

  it('PackingLotItem gắn vào PackingLot round-trip', async () => {
    const lot = await seedPackingLot(9004, 1);
    const item = await prisma.packingLotItem.create({
      data: { lotId: lot.id, poItemId: 555, productName: 'Hàng test', quantity: '10', unit: 'cái' },
    });
    const reread = await prisma.packingLotItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(reread.lotId).toBe(lot.id);
    expect(reread.quantity?.toString()).toBe('10');
  });

  // Bài học #06: KHÔNG map mốc DATE sang Int — round-trip như ngày thật.
  it('⚠ TransportFile: mốc ngày (packDate/runDate/arrivalDate/clearanceDate) round-trip DATE thật', async () => {
    const file = await seedTransportFile({
      fileCode: 'CONT-TEST-0001',
      transportType: 'cont_ghep',
      cargoType: 'ghep',
      packDate: new Date('2026-09-01'),
      runDate: new Date('2026-09-05'),
      arrivalDate: new Date('2026-09-20'),
      clearanceDate: new Date('2026-09-22'),
    });
    const reread = await prisma.transportFile.findUniqueOrThrow({ where: { id: file.id } });
    expect(reread.packDate?.toISOString().slice(0, 10)).toBe('2026-09-01');
    expect(reread.runDate?.toISOString().slice(0, 10)).toBe('2026-09-05');
    expect(reread.arrivalDate?.toISOString().slice(0, 10)).toBe('2026-09-20');
    expect(reread.clearanceDate?.toISOString().slice(0, 10)).toBe('2026-09-22');
  });

  it('TransportFile.transportType/cargoType từ chối giá trị lạ ngoài enum', async () => {
    await expect(
      prisma.transportFile.create({ data: { status: 0, transportType: 'khong_ton_tai' as any } }),
    ).rejects.toThrow();
    await expect(
      prisma.transportFile.create({ data: { status: 0, cargoType: 'khong_ton_tai' as any } }),
    ).rejects.toThrow();
  });

  it('TransportFile.customsLocked + customsLockedBy/At round-trip', async () => {
    const file = await seedTransportFile({
      customsLocked: 1,
      customsLockedBy: 'kt1',
      customsLockedAt: 5000,
      totalCost: '12345678.90',
    });
    const reread = await prisma.transportFile.findUniqueOrThrow({ where: { id: file.id } });
    expect(reread.customsLocked).toBe(1);
    expect(reread.customsLockedBy).toBe('kt1');
    expect(reread.customsLockedAt).toBe(5000);
    expect(reread.totalCost?.toString()).toBe('12345678.9');
  });

  it('TransportFileItem/TransportFilePackage gắn vào TransportFile round-trip', async () => {
    const file = await seedTransportFile();
    const item = await prisma.transportFileItem.create({
      data: { fileId: file.id, productName: 'Item test', quantity: '3' },
    });
    const pkg = await prisma.transportFilePackage.create({
      data: { fileId: file.id, packageCode: 'PKG-0001' },
    });
    const rereadItem = await prisma.transportFileItem.findUniqueOrThrow({ where: { id: item.id } });
    const rereadPkg = await prisma.transportFilePackage.findUniqueOrThrow({ where: { id: pkg.id } });
    expect(rereadItem.fileId).toBe(file.id);
    expect(rereadPkg.fileId).toBe(file.id);
  });

  it('PackageContent round-trip', async () => {
    const file = await seedTransportFile();
    const pkg = await prisma.transportFilePackage.create({ data: { fileId: file.id, packageCode: 'PKG-0002' } });
    const content = await prisma.packageContent.create({
      data: {
        packageId: pkg.id,
        fileId: file.id,
        orderId: 12345,
        customerId: 'TBS0001',
        quantity: '2',
        netWeight: '1.50',
      },
    });
    const reread = await prisma.packageContent.findUniqueOrThrow({ where: { id: content.id } });
    expect(reread.packageId).toBe(pkg.id);
    expect(reread.customerId).toBe('TBS0001');
    expect(reread.netWeight?.toString()).toBe('1.5');
  });

  // §4.10: sự cố kiện phải "ack rồi đóng" — prod đo 1.464 dòng, 1.457 đã ack,
  // 0 ĐÃ ĐÓNG. Pin đúng hình dạng nullable của hai mốc này.
  it('⚠ PackageIssue.ackBy/ackAt và closedBy/closedAt nullable, round-trip khi có giá trị', async () => {
    const file = await seedTransportFile();
    const pkg = await prisma.transportFilePackage.create({ data: { fileId: file.id, packageCode: 'PKG-0003' } });

    const fresh = await seedPackageIssue(pkg.id, { khau: 'tren_cont', reasons: 'vỡ', createdBy: 'nv1', createdAt: 100 });
    expect(fresh.ackBy).toBeNull();
    expect(fresh.ackAt).toBeNull();
    expect(fresh.closedBy).toBeNull();
    expect(fresh.closedAt).toBeNull();

    const acked = await prisma.packageIssue.update({
      where: { id: fresh.id },
      data: { ackBy: 'kt1', ackAt: 200, ackNote: 'đã xác nhận' },
    });
    expect(acked.ackBy).toBe('kt1');
    expect(acked.ackAt).toBe(200);
    expect(acked.ackNote).toBe('đã xác nhận');
    expect(acked.closedBy).toBeNull();

    const closed = await prisma.packageIssue.update({
      where: { id: fresh.id },
      data: { closedBy: 'kt1', closedAt: 300, closeNote: 'đã xử lý xong' },
    });
    expect(closed.closedBy).toBe('kt1');
    expect(closed.closedAt).toBe(300);
    expect(closed.closeNote).toBe('đã xử lý xong');
  });

  it('PackageIssue.packageId có index — lọc theo kiện', async () => {
    const file = await seedTransportFile();
    const pkg = await prisma.transportFilePackage.create({ data: { fileId: file.id, packageCode: 'PKG-0004' } });
    await seedPackageIssue(pkg.id, { khau: 'tren_cont' });
    const found = await prisma.packageIssue.findMany({ where: { packageId: pkg.id } });
    expect(found.length).toBe(1);
  });
});
