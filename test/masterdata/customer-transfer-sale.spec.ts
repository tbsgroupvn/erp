import { prisma, resetIam, seedUser, assignRole } from '../helpers/iam-db';
import { resetMasterdata, seedCustomer } from '../helpers/masterdata-db';
import { PermService } from '../../src/iam/perm.service';
import { OrgService } from '../../src/iam/org.service';
import { ScopeService } from '../../src/iam/scope.service';
import { CustomerCodeService } from '../../src/masterdata/customer-code.service';
import { CustomerService } from '../../src/masterdata/customer.service';

const perm = new PermService(prisma as any);
const org = new OrgService(prisma as any);
const scope = new ScopeService(prisma as any, perm, org);
const codeSvc = new CustomerCodeService(prisma as any);
const svc = new CustomerService(prisma as any, codeSvc, scope);

async function grant(uid: number, code: string, sc: any) {
  const role = await prisma.role.create({ data: { code: 'r' + uid + '_' + code + '_' + sc, ten: 'r' + uid } });
  await prisma.rolePermission.create({ data: { roleId: role.id, permCode: code, scope: sc } });
  await assignRole(uid, role.id);
}

describe('CustomerService.setSalers', () => {
  let uidSale1: number;

  beforeEach(async () => {
    await resetIam();
    perm.clearCache();
    await resetMasterdata();
    const u = await seedUser({ username: 'sale1' });
    uidSale1 = u.id;
    await grant(uidSale1, 'customer_view', 'own');
  });
  afterAll(() => prisma.$disconnect());

  it('đổi sale chính: KH sang sale mới, sale cũ mất quyền xem', async () => {
    await seedCustomer('TBS8100', 'sale1');
    await svc.setSalers('TBS8100', 'sale2', [], 'admin');
    const c = await prisma.customer.findUnique({ where: { code: 'TBS8100' } });
    expect(c!.saler).toBe('sale2');
    expect(await svc.listForUser('customer_view', uidSale1)).toHaveLength(0);
  });

  it('salerOther ghi đúng JSON mảng (khớp format prod)', async () => {
    await seedCustomer('TBS8101', 'sale1');
    await svc.setSalers('TBS8101', 'sale1', ['sale2', 'sale3'], 'admin');
    const c = await prisma.customer.findUnique({ where: { code: 'TBS8101' } });
    expect(c!.salerOther).toBe('["sale2","sale3"]');
  });

  it('mảng rỗng -> null, KHÔNG ghi "[]" (tránh LIKE khớp rác)', async () => {
    await seedCustomer('TBS8102', 'sale1');
    await svc.setSalers('TBS8102', 'sale1', [], 'admin');
    const c = await prisma.customer.findUnique({ where: { code: 'TBS8102' } });
    expect(c!.salerOther).toBeNull();
  });

  it('từ chối để trống sale chính (KH không được mồ côi)', async () => {
    await seedCustomer('TBS8103', 'sale1');
    const r = await svc.setSalers('TBS8103', '  ', ['sale2'], 'admin');
    expect(r.ok).toBe(false);
    const c = await prisma.customer.findUnique({ where: { code: 'TBS8103' } });
    expect(c!.saler).toBe('sale1');
  });

  it('loại trùng: sale chính không được lặp trong salerOther', async () => {
    await seedCustomer('TBS8104', 'sale1');
    await svc.setSalers('TBS8104', 'sale2', ['sale2', 'sale3'], 'admin');
    const c = await prisma.customer.findUnique({ where: { code: 'TBS8104' } });
    expect(c!.salerOther).toBe('["sale3"]');
  });
});
