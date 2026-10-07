import { prisma } from '../helpers/db';
import { resetMasterdata } from '../helpers/masterdata-db';

describe('masterdata schema', () => {
  beforeEach(async () => { await resetMasterdata(); });

  it('tạo được Customer với code duy nhất + salerOther JSON', async () => {
    await prisma.customer.create({
      data: { code: 'TBS9001', name: 'KH thử', saler: 'sale1',
              salerOther: '["sale2","sale3"]', cdate: 1, mdate: 1 },
    });
    const c = await prisma.customer.findUnique({ where: { code: 'TBS9001' } });
    expect(c?.name).toBe('KH thử');
    expect(c?.creditLimit).toBe(0n);          // BigInt VND, mặc định 0
    await expect(
      prisma.customer.create({ data: { code: 'TBS9001', name: 'trùng', cdate: 1, mdate: 1 } }),
    ).rejects.toThrow();                       // code UNIQUE
  });

  it('Warehouse loai chỉ VN/TQ, PK là ma', async () => {
    await prisma.warehouse.create({ data: { ma: 'VN_HN', ten: 'Kho Hà Nội', loai: 'VN' } });
    const w = await prisma.warehouse.findUnique({ where: { ma: 'VN_HN' } });
    expect(w?.loai).toBe('VN');
  });

  it('SupplierPayInfo có bankAccount UNIQUE', async () => {
    await prisma.supplierPayInfo.create({ data: { bankAccount: '622212', receiverName: 'A', bankName: 'ACB' } });
    await expect(
      prisma.supplierPayInfo.create({ data: { bankAccount: '622212', receiverName: 'B', bankName: 'VCB' } }),
    ).rejects.toThrow();
  });
});
