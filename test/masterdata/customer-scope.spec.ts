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

// Không dùng seedRole/seedPerm dùng chung ở đây: seedPerm tách code bằng dấu
// '.' để suy module/action ('order.view' -> module 'order'), còn perm dùng
// trong bài này ('customer_view') không có dấu chấm nên tách hỏng. tbl_role_perm
// không có FK sang tbl_perm (permCode chỉ là string lỏng lẻo) nên bỏ qua
// bước tạo permission, tạo thẳng role + rolePermission.
async function grant(uid: number, code: string, sc: any) {
  const role = await prisma.role.create({ data: { code: 'r' + uid + '_' + code + '_' + sc, ten: 'r' + uid } });
  await prisma.rolePermission.create({ data: { roleId: role.id, permCode: code, scope: sc } });
  await assignRole(uid, role.id);
}

describe('CustomerService.listForUser (scope #01)', () => {
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

  it('scope own: sale chính thấy, sale phụ thấy, người ngoài không thấy', async () => {
    await seedCustomer('TBS8001', 'sale1'); // của sale1
    await seedCustomer('TBS8002', 'sale2', ['sale1', 'sale9']); // sale1 là sale PHỤ
    await seedCustomer('TBS8003', 'sale2'); // không liên quan sale1

    const rows = await svc.listForUser('customer_view', uidSale1);
    const codes = rows.map((r) => r.code).sort();
    expect(codes).toEqual(['TBS8001', 'TBS8002']);
    expect(codes).not.toContain('TBS8003');
  });

  it('không khớp nhầm username là tiền tố của username khác', async () => {
    await seedCustomer('TBS8010', 'x', ['sale10']); // sale10, KHÔNG phải sale1
    const rows = await svc.listForUser('customer_view', uidSale1);
    expect(rows.map((r) => r.code)).not.toContain('TBS8010');
  });

  it('thiếu quyền -> KHÔNG trả gì (fail-closed)', async () => {
    await seedCustomer('TBS8020', 'sale1');
    const rows = await svc.listForUser('perm_khong_ton_tai', uidSale1);
    expect(rows).toHaveLength(0);
  });
});
