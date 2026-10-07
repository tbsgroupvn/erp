import { PrismaModule } from '../../src/prisma/prisma.module';
// test/warehouse/e2e.spec.ts — Task 6 #07: e2e qua WarehouseModule THẬT
// (Test.createTestingModule -> app.init()), chứng minh module tự wire đúng
// (Prisma + ScopeService của IamModule) VÀ chứng minh một vòng đời kho thật
// đi từ nhận hàng TQ -> lô đóng gói -> cont -> khoá thông quan -> sự cố
// kiện, cùng lối test/po/e2e.spec.ts.
//
// PO dùng làm "PO đã tạo qua module #06" được dựng bằng CHÍNH `PoService`
// (#06) gọi trực tiếp, không qua Nest DI của WarehouseModule — WarehouseModule
// không (và không cần) import PoModule (xem warehouse.module.ts), hai module
// chỉ chung CSDL đúng khuôn `QuotePoDiffService` (#06) đọc thẳng bảng quote.
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { WarehouseModule } from '../../src/warehouse/warehouse.module';
import { KhoTqReceiptService } from '../../src/warehouse/khotq-receipt.service';
import { PackingLotService } from '../../src/warehouse/packing-lot.service';
import { TransportFileService } from '../../src/warehouse/transport-file.service';
import { PackageIssueService } from '../../src/warehouse/package-issue.service';
import { PoService } from '../../src/po/po.service';
import { PermService } from '../../src/iam/perm.service';
import { OrgService } from '../../src/iam/org.service';
import { ScopeService } from '../../src/iam/scope.service';
import { prisma } from '../helpers/db';
import { resetWarehouse } from '../helpers/warehouse-db';
import { resetIam, seedUser, assignRole } from '../helpers/iam-db';
import { resetMasterdata, seedCustomer } from '../helpers/masterdata-db';
import { resetPo } from '../helpers/po-db';

let app: INestApplication;
let receiptSvc: KhoTqReceiptService;
let lotSvc: PackingLotService;
let fileSvc: TransportFileService;
let issueSvc: PackageIssueService;

// Dựng thẳng PoService (#06) — chỉ để SETUP một PO thật, không phải service
// đang test ở đây. Cùng lối `test/warehouse/khotq-receipt.spec.ts` dựng
// thẳng PermService/OrgService/ScopeService để setup, không qua Nest DI.
const perm = new PermService(prisma as any);
const org = new OrgService(prisma as any);
const scope = new ScopeService(prisma as any, perm, org);
const poSvc = new PoService(prisma as any, scope);

// Không dùng seedRole dùng chung (nó tách permCode bằng dấu '.') —
// 'khotq_view' không có dấu chấm nên tách hỏng. Mirror khotq-receipt.spec.ts.
let seq = 0;
async function grantWarehouse(uid: number, khoList: string[]) {
  const role = await prisma.role.create({ data: { code: `r${uid}_khotq_${seq++}`, ten: 'r' + uid } });
  await prisma.rolePermission.create({ data: { roleId: role.id, permCode: 'khotq_view', scope: 'warehouse' } });
  await assignRole(uid, role.id);
  for (const k of khoList) {
    await prisma.userScope.create({ data: { userId: uid, loai: 'warehouse', giaTri: k } });
  }
}

beforeAll(async () => {
  const mod = await Test.createTestingModule({ imports: [PrismaModule, WarehouseModule] }).compile();
  app = mod.createNestApplication();
  await app.init();
  receiptSvc = mod.get(KhoTqReceiptService);
  lotSvc = mod.get(PackingLotService);
  fileSvc = mod.get(TransportFileService);
  issueSvc = mod.get(PackageIssueService);
});

beforeEach(async () => {
  await resetIam();
  perm.clearCache();
  await resetMasterdata();
  await resetPo();
  await resetWarehouse();
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe('WarehouseModule e2e — vòng đời kho thật (Task 6 #07)', () => {
  it('nhận kho TQ (po_scan, gắn PO #06) -> lô -> cont -> mốc -> khoá thông quan chặn nạp -> sự cố kiện -> phạm vi kho cách ly', async () => {
    // ── 1. PO thật qua module #06 + nhận hàng kho TQ_NGHIAO nguồn po_scan ──
    const customer = await seedCustomer('TBS9401', 'sale1');
    const poCreated = await poSvc.createPo({ buyerId: customer.id }, 'sale1');
    expect(poCreated.ok).toBe(true);
    if (!poCreated.ok) throw new Error('setup');
    const poId = poCreated.po.id;

    const received = await receiptSvc.receive(
      { source: 'po_scan', kho: 'TQ_NGHIAO', customerId: customer.code, poId, trackingCode: 'TRK-E2E-1' },
      'nv1',
    );
    expect(received.ok).toBe(true);
    if (!received.ok) throw new Error('setup');
    const receiptId = received.id;

    const rereadReceipt = await prisma.khoTqReceipt.findUniqueOrThrow({ where: { id: receiptId } });
    expect(rereadReceipt.poId).toBe(poId);
    expect(rereadReceipt.kho).toBe('TQ_NGHIAO');
    expect(rereadReceipt.source).toBe('po_scan');

    // ── 2. Lô đóng gói cho PO + thêm dòng lô ──
    const lotCreated = await lotSvc.createLot(poId, { lotNo: 1, supplierName: 'NCC E2E' });
    expect(lotCreated.ok).toBe(true);
    if (!lotCreated.ok) throw new Error('setup');
    const lotItem = await lotSvc.addLotItem(lotCreated.lot.id, { productName: 'Áo thun E2E', quantity: '100', unit: 'cái' });
    expect(lotItem.ok).toBe(true);

    const lots = await lotSvc.listByPo(poId);
    expect(lots.map((l) => l.id)).toContain(lotCreated.lot.id);

    // ── 3. Cont: tạo hồ sơ vận chuyển, nạp 1 kiện, đặt packDate rồi runDate,
    //     syncStatus() tiến đúng 0 -> 1 -> 2 ──
    const fileCreated = await fileSvc.createFile({ fileCode: 'CONT-E2E-1' }, 'nv1');
    expect(fileCreated.ok).toBe(true);
    if (!fileCreated.ok) throw new Error('setup');
    const fileId = fileCreated.file.id;

    const initialSync = await fileSvc.syncStatus(fileId);
    expect(initialSync.ok).toBe(true);
    expect(initialSync.ok && initialSync.status).toBe(0);

    // ⚠ F6 (review cuối #07): kiện nạp lên cont ở bước này PHẢI là kiện đã
    // nhận ở bước 1 — trước bản vá, hai nửa của e2e "vòng đời kho thật" này
    // không chia sẻ một dòng nào (packageCode chỉ là chuỗi tự do, không nối
    // gì về receiptId), nên xoá NGUYÊN bước 1 vẫn không làm nửa cont đỏ. Gán
    // khotqReceiptId để đường receipt -> package -> container thật sự nối,
    // rồi khẳng định lại traversal ở bước 3b bên dưới.
    const pkgLoaded = await fileSvc.loadPackage(fileId, { packageCode: 'PKG-E2E-1', weight: '12.5', khotqReceiptId: receiptId });
    expect(pkgLoaded.ok).toBe(true);
    if (!pkgLoaded.ok) throw new Error('setup');
    const packageId = pkgLoaded.package.id;

    // ── 3b. Traversal NGƯỢC: cont -> phiếu nhận kho -> khách hàng/PO ──
    const receiptsOnFile = await fileSvc.receiptsForFile(fileId);
    expect(receiptsOnFile.map((r) => r.id)).toEqual([receiptId]);
    expect(receiptsOnFile[0].customerId).toBe(customer.code);
    expect(receiptsOnFile[0].poId).toBe(poId);

    const packSet = await fileSvc.setPackDate(fileId, new Date('2026-09-20'));
    expect(packSet.ok).toBe(true);
    expect(packSet.ok && packSet.status).toBe(1);
    const syncAfterPack = await fileSvc.syncStatus(fileId);
    expect(syncAfterPack.ok && syncAfterPack.status).toBe(1);

    const runSet = await fileSvc.setRunDate(fileId, new Date('2026-09-22'));
    expect(runSet.ok).toBe(true);
    expect(runSet.ok && runSet.status).toBe(2);
    const syncAfterRun = await fileSvc.syncStatus(fileId);
    expect(syncAfterRun.ok && syncAfterRun.status).toBe(2);

    // ── 4. customsLock -> nạp thêm kiện BỊ CHẶN, KHÔNG ghi gì (đếm trước/sau) ──
    const lock = await fileSvc.customsLock(fileId, 'kt1');
    expect(lock.ok).toBe(true);

    const beforeCount = await prisma.transportFilePackage.count({ where: { fileId } });
    const blockedLoad = await fileSvc.loadPackage(fileId, { packageCode: 'PKG-E2E-2' });
    expect(blockedLoad.ok).toBe(false);
    const afterCount = await prisma.transportFilePackage.count({ where: { fileId } });
    expect(afterCount).toBe(beforeCount);

    // ── 5. Sự cố kiện: raise -> ack -> countUnclosed()===1 -> close -> ===0 ──
    const raised = await issueSvc.raise(packageId, { khau: 'tren_cont', reasons: 'móp kiện' }, 'nv1');
    expect(raised.ok).toBe(true);
    if (!raised.ok) throw new Error('setup');

    const acked = await issueSvc.ack(raised.issue.id, 'kt1');
    expect(acked.ok).toBe(true);
    expect(await issueSvc.countUnclosed()).toBe(1);

    const closed = await issueSvc.close(raised.issue.id, 'kt_truong1');
    expect(closed.ok).toBe(true);
    expect(await issueSvc.countUnclosed()).toBe(0);

    // ── 6. Cách ly phạm vi kho — CẢ HAI vế, không chỉ "rỗng" ──
    // Vế A: NV chỉ gán TQ_BANGTUONG KHÔNG thấy phiếu của TQ_NGHIAO.
    // Vế B: NV gán ĐÚNG TQ_NGHIAO THẤY được phiếu đó — nếu chỉ kiểm vế A,
    // một service quên truyền `{warehouse:'kho'}` (DENY toàn bộ, rỗng với
    // BẤT KỲ ai) sẽ trông giống hệt "cách ly đúng" trong khi thực ra mù hoàn
    // toàn — đúng bài học đã ghi trong khotq-receipt.service.ts.
    const userOther = await seedUser({ username: 'nv_bangtuong' });
    await grantWarehouse(userOther.id, ['TQ_BANGTUONG']);
    const rowsOther = await receiptSvc.listForUser('khotq_view', userOther.id);
    expect(rowsOther.map((r) => r.id)).not.toContain(receiptId);

    const userSame = await seedUser({ username: 'nv_nghiao' });
    await grantWarehouse(userSame.id, ['TQ_NGHIAO']);
    const rowsSame = await receiptSvc.listForUser('khotq_view', userSame.id);
    expect(rowsSame.map((r) => r.id)).toContain(receiptId);
  });
});
