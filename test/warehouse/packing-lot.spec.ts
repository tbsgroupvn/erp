import { Logger } from '@nestjs/common';
import { prisma } from '../helpers/db';
import { resetWarehouse } from '../helpers/warehouse-db';
import { PackingLotService } from '../../src/warehouse/packing-lot.service';

const svc = new PackingLotService(prisma as any);

describe('PackingLotService — 1 dòng = 1 lô, duy nhất trong phạm vi PO (#07 Task 3)', () => {
  beforeEach(async () => {
    await resetWarehouse();
  });
  afterAll(() => prisma.$disconnect());

  describe('createLot() / listByPo()', () => {
    it('tạo lô, đọc lại đúng — planCbm giữ 4 số thập phân', async () => {
      const r = await svc.createLot(101, {
        lotNo: 1,
        supplierName: 'NCC Vải A',
        planPackages: 10,
        planQtyPerPack: '5.5',
        planSpec: '40x30x20',
        planWeightKg: '120.50',
        planCbm: '1.2345',
        expectedReadyDate: new Date('2026-10-01'),
      });
      expect(r.ok).toBe(true);
      if (!r.ok) throw new Error('setup');

      const reread = await prisma.packingLot.findUniqueOrThrow({ where: { id: r.lot.id } });
      expect(reread.poId).toBe(101);
      expect(reread.lotNo).toBe(1);
      expect(reread.supplierName).toBe('NCC Vải A');
      // Decimal -> toString(), KHÔNG so bằng số (Prisma trả Decimal object).
      expect(reread.planCbm?.toString()).toBe('1.2345');
      expect(reread.planWeightKg?.toString()).toBe('120.5');
    });

    it('cùng PO + cùng lotNo lần hai -> từ chối, chỉ CÒN MỘT dòng (đọc lại DB, không tin return)', async () => {
      const first = await svc.createLot(202, { lotNo: 5 });
      expect(first.ok).toBe(true);

      const second = await svc.createLot(202, { lotNo: 5 });
      expect(second.ok).toBe(false);

      const rows = await prisma.packingLot.findMany({ where: { poId: 202, lotNo: 5 } });
      expect(rows).toHaveLength(1);
    });

    // Fix round 2 (coordinator, sau Task 4): createLot() có 2 nhánh trong catch —
    // P2002 (nhánh ngay trên, message nghiệp vụ "1 dòng = 1 lô" — GIỮ NGUYÊN) và
    // nhánh generic nối thẳng e.message. Ép lỗi CSDL THẬT khác P2002 (supplierName
    // vượt VarChar(255)) để canh đúng nhánh generic, không đụng nhánh P2002.
    it('lỗi CSDL thật (supplierName vượt VarChar(255)) -> msg KHÔNG chứa đường dẫn file/chi tiết Postgres', async () => {
      const r = await svc.createLot(601, { lotNo: 1, supplierName: 'x'.repeat(300) });
      expect(r.ok).toBe(false);
      if (r.ok) throw new Error('setup');
      expect(r.msg).not.toMatch(/postgres|prisma|invocation|too long|column|packing-lot\.service\.ts|this\.prisma\.packingLot/i);
    });

    it('lỗi CSDL thật (supplierName vượt VarChar(255)) -> vẫn ghi log server-side (không nuốt mất)', async () => {
      const spy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined as unknown as void);
      try {
        await svc.createLot(602, { lotNo: 1, supplierName: 'x'.repeat(300) });
        expect(spy).toHaveBeenCalled();
        const logged = spy.mock.calls.map((c) => c.map(String).join(' ')).join('\n');
        expect(logged).toMatch(/too long|column/i);
      } finally {
        spy.mockRestore();
      }
    });

    it('nhánh P2002 (lô trùng) KHÔNG bị đổi bởi fix này — vẫn message nghiệp vụ "1 dòng = 1 lô"', async () => {
      await svc.createLot(603, { lotNo: 9 });
      const second = await svc.createLot(603, { lotNo: 9 });
      expect(second.ok).toBe(false);
      if (second.ok) throw new Error('setup');
      expect(second.msg).toMatch(/1 dòng = 1 lô/);
    });

    it('HAI PO khác nhau cùng lotNo -> cả hai đều thành công (chứng minh unique scope THEO PO, không toàn cục)', async () => {
      const a = await svc.createLot(301, { lotNo: 7 });
      const b = await svc.createLot(302, { lotNo: 7 });
      expect(a.ok).toBe(true);
      expect(b.ok).toBe(true);

      const rows = await prisma.packingLot.findMany({ where: { lotNo: 7 } });
      expect(rows).toHaveLength(2);
      expect(rows.map((r) => r.poId).sort()).toEqual([301, 302]);
    });

    it('listByPo() sắp theo lotNo, không lẫn lô của PO khác', async () => {
      await svc.createLot(401, { lotNo: 3 });
      await svc.createLot(401, { lotNo: 1 });
      await svc.createLot(401, { lotNo: 2 });
      await svc.createLot(402, { lotNo: 1 }); // PO khác — không được lẫn vào

      const rows = await svc.listByPo(401);
      expect(rows.map((r) => r.lotNo)).toEqual([1, 2, 3]);
      expect(rows.every((r) => r.poId === 401)).toBe(true);
    });
  });

  describe('addLotItem()', () => {
    it('gắn đúng vào lô đã tạo', async () => {
      const lot = await svc.createLot(501, { lotNo: 1 });
      expect(lot.ok).toBe(true);
      if (!lot.ok) throw new Error('setup');

      const r = await svc.addLotItem(lot.lot.id, {
        poItemId: 9001,
        productName: 'Áo thun',
        quantity: '10',
        unit: 'cái',
      });
      expect(r.ok).toBe(true);
      if (!r.ok) throw new Error('setup');

      const reread = await prisma.packingLotItem.findUniqueOrThrow({ where: { id: r.item.id } });
      expect(reread.lotId).toBe(lot.lot.id);
      expect(reread.productName).toBe('Áo thun');
      expect(reread.quantity?.toString()).toBe('10');

      // Không lẫn sang lô khác.
      const otherLot = await svc.createLot(501, { lotNo: 2 });
      expect(otherLot.ok).toBe(true);
      if (!otherLot.ok) throw new Error('setup');
      const itemsOfOther = await prisma.packingLotItem.findMany({ where: { lotId: otherLot.lot.id } });
      expect(itemsOfOther).toHaveLength(0);
    });

    it('lotId không tồn tại -> từ chối', async () => {
      const r = await svc.addLotItem(999999, { productName: 'X' });
      expect(r.ok).toBe(false);
    });
  });
});
