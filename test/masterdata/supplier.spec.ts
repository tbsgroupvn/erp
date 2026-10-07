import { prisma } from '../helpers/db';
import { resetMasterdata } from '../helpers/masterdata-db';
import { SupplierService } from '../../src/masterdata/supplier.service';

const sup = new SupplierService(prisma as any);

describe('SupplierService', () => {
  beforeEach(async () => {
    await resetMasterdata();
  });
  afterAll(() => prisma.$disconnect());

  it('thêm STK trùng -> KHÔNG đẻ dòng mới, gộp vào dòng cũ', async () => {
    await sup.addPayInfo({ bankAccount: '622212', receiverName: 'Zhang', bankName: 'ICBC' }, 'kt1');
    await sup.addPayInfo({ bankAccount: '622212', receiverName: 'Zhang', bankName: 'ICBC' }, 'kt1');
    expect(await prisma.supplierPayInfo.count()).toBe(1);
  });

  it('markUsed tăng timesUsed + cập nhật lastUsedAt', async () => {
    await sup.addPayInfo({ bankAccount: '622213', receiverName: 'Li', bankName: 'BOC' }, 'kt1');
    await sup.markUsed('622213');
    const p = await prisma.supplierPayInfo.findUnique({ where: { bankAccount: '622213' } });
    expect(p!.timesUsed).toBe(2); // default 1 + 1 lần dùng
    expect(p!.lastUsedAt).toBeGreaterThan(0);
  });

  it('isKnownAccount: STK lạ trả false (cờ để soát trước khi chi)', async () => {
    await sup.addPayInfo({ bankAccount: '622214', receiverName: 'Wang', bankName: 'CCB' }, 'kt1');
    expect(await sup.isKnownAccount('622214')).toBe(true);
    expect(await sup.isKnownAccount('999999')).toBe(false);
  });

  it('chuẩn hoá STK: bỏ khoảng trắng để không lọt STK "lạ" giả', async () => {
    await sup.addPayInfo({ bankAccount: ' 622215 ', receiverName: 'X', bankName: 'Y' }, 'kt1');
    expect(await sup.isKnownAccount('622215')).toBe(true);
  });
});
