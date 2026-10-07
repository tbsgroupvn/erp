import { CustomerCodeService } from '../../src/masterdata/customer-code.service';
import { prisma } from '../helpers/db';
import { resetMasterdata } from '../helpers/masterdata-db';

const svc = new CustomerCodeService(prisma as any);

describe('CustomerCodeService', () => {
  beforeEach(async () => { await resetMasterdata(); });
  afterAll(() => prisma.$disconnect());

  it('sinh mã dạng TBS<number>, không đệm 0', async () => {
    const code = await svc.next();
    expect(code).toMatch(/^TBS\d+$/);
    expect(code).not.toMatch(/^TBS0\d/);
  });

  it('tăng đơn điệu và KHÔNG trùng dù gọi song song', async () => {
    const codes = await Promise.all(Array.from({ length: 50 }, () => svc.next()));
    expect(new Set(codes).size).toBe(50);              // không trùng
    const nums = codes.map((c) => Number(c.slice(3))).sort((a, b) => a - b);
    expect(nums[nums.length - 1] - nums[0]).toBe(49);  // liên tục, không nhảy
  });

  it('số ĐÃ PHÁT không tái dùng kể cả khi transaction rollback', async () => {
    const before = await svc.nextNum();
    await prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(`SELECT nextval('customer_code_seq')`); // đốt 1 số trên chính connection của tx
      throw new Error('rollback');
    }).catch(() => {});
    const after = await svc.nextNum();
    expect(after).toBeGreaterThan(before + 1);          // số cháy, KHÔNG quay lại
  });

  it('tôn trọng prefix truyền vào', async () => {
    expect(await svc.next('ZZQA')).toMatch(/^ZZQA\d+$/);
  });
});
