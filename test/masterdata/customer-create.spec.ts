import { Logger } from '@nestjs/common';
import { prisma, resetDb } from '../helpers/db';
import { resetMasterdata } from '../helpers/masterdata-db';
import { CustomerCodeService } from '../../src/masterdata/customer-code.service';
import { CustomerService } from '../../src/masterdata/customer.service';
import { ScopeService } from '../../src/iam/scope.service';
import { PermService } from '../../src/iam/perm.service';
import { OrgService } from '../../src/iam/org.service';
import { resetIam, seedUser, assignRole } from '../helpers/iam-db';

const perm = new PermService(prisma as any);
const codeSvc = new CustomerCodeService(prisma as any);
const scope = new ScopeService(prisma as any, perm, new OrgService(prisma as any));
const svc = new CustomerService(prisma as any, codeSvc, scope);

// Cùng khuôn với test/masterdata/customer-scope.spec.ts: role/rolePermission
// không FK sang tbl_perm nên bỏ qua bước tạo permission, tạo thẳng role.
async function grant(uid: number, code: string, sc: any) {
  const role = await prisma.role.create({ data: { code: 'r' + uid + '_' + code + '_' + sc, ten: 'r' + uid } });
  await prisma.rolePermission.create({ data: { roleId: role.id, permCode: code, scope: sc } });
  await assignRole(uid, role.id);
}

describe('CustomerService.create', () => {
  beforeEach(async () => {
    await resetIam();
    perm.clearCache();
    await resetMasterdata(); // tbl_customer,...
    await resetDb();         // tbl_wallet,... — tránh rò ví giữa các ca test
  });
  afterAll(() => prisma.$disconnect());

  it('tạo KH: có code ngay, có ví ngay, username = code', async () => {
    const r = await svc.create({ name: 'Công ty A', phone: '0900', saler: 'sale1' }, 'sale1');
    expect(r.ok).toBe(true);
    const c = await prisma.customer.findUnique({ where: { code: r.code! } });
    expect(c!.code).toMatch(/^TBS\d+$/);
    expect(c!.username).toBe(c!.code);            // username = code (prod line 78)
    expect(c!.saler).toBe('sale1');
    const w = await prisma.wallet.findUnique({ where: { cusId: r.code! } });
    expect(w).not.toBeNull();                     // VÍ phải có ngay
    expect(w!.total).toBe(0n);
  });

  it('KHÔNG BAO GIỜ để lại khách không có mã (nguyên tử)', async () => {
    await svc.create({ name: 'Công ty B' }, 'sale1');
    // `code` là String @unique KHÔNG NULL trong schema — Prisma client-side validation
    // còn từ chối cả filter `code: null` (không biểu diễn được qua Prisma Client cho cột
    // not-null), nên kiểm thẳng bằng SQL thô xuống đúng bảng để xác nhận không có hàng
    // nào lọt lưới NOT NULL/UNIQUE đó.
    const orphans = await prisma.$queryRawUnsafe<Array<{ code: string | null }>>(
      `SELECT code FROM tbl_customer WHERE code = '' OR code IS NULL`,
    );
    expect(orphans).toHaveLength(0);
  });

  it('từ chối khi thiếu tên', async () => {
    const r = await svc.create({ name: '  ' }, 'sale1');
    expect(r.ok).toBe(false);
    expect(r.msg).toContain('tên');
  });

  it('ví và khách cùng sống cùng chết — lỗi ví thì KHÔNG có khách mồ côi', async () => {
    // Đốt SỐ HIỆN TẠI (nextval) rồi seed sẵn ví ở đúng SỐ KẾ TIẾP — chính là mã mà
    // svc.create() sẽ sinh ra khi nó tự gọi codeSvc.next() bên trong. tbl_wallet.cus_id
    // @unique ⇒ tx.wallet.create() bên trong transaction chắc chắn ném lỗi ⇒ ca test
    // xác định (không còn "if (!r.ok)" phòng thủ) thay vì tình cờ mới trúng.
    const burned = await codeSvc.next();
    const collideCode = 'TBS' + (Number(burned.slice(3)) + 1);
    await prisma.wallet.create({ data: { cusId: collideCode, total: 0n } });

    const r = await svc.create({ name: 'Sẽ hỏng' }, 'sale1');

    expect(r.ok).toBe(false);                      // xác định: PHẢI hỏng, không phải "có thể"
    const c = await prisma.customer.findFirst({ where: { name: 'Sẽ hỏng' } });
    expect(c).toBeNull();                           // rollback sạch, không còn khách mồ côi
  });

  // Fix round 2 (coordinator, sau Task 4): create() nối thẳng e.message vào msg khi
  // lỗi KHÔNG lường trước — đo thật (ca trên, cùng kỹ thuật ép lỗi ví trùng cusId):
  // "Invalid `tx.wallet.create()` invocation in .../customer.service.ts:71...
  //  Unique constraint failed on the fields: (`cus_id`)". Trả HTTP 200 {ok:false,msg}
  // nên filter Task 4 không chặn được — phải sửa TẠI ĐÂY.
  it('lỗi CSDL thật (ví trùng cus_id) -> msg KHÔNG chứa đường dẫn file/chi tiết Prisma', async () => {
    const burned = await codeSvc.next();
    const collideCode = 'TBS' + (Number(burned.slice(3)) + 1);
    await prisma.wallet.create({ data: { cusId: collideCode, total: 0n } });

    const r = await svc.create({ name: 'Sẽ hỏng lộ chi tiết' }, 'sale1');

    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('setup');
    expect(r.msg).not.toMatch(/prisma|invocation|unique constraint|cus_id|customer\.service\.ts|tx\.wallet/i);
  });

  it('lỗi CSDL thật (ví trùng cus_id) -> vẫn ghi log server-side (không nuốt mất)', async () => {
    const spy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined as unknown as void);
    try {
      const burned = await codeSvc.next();
      const collideCode = 'TBS' + (Number(burned.slice(3)) + 1);
      await prisma.wallet.create({ data: { cusId: collideCode, total: 0n } });

      await svc.create({ name: 'Sẽ hỏng lộ chi tiết 2' }, 'sale1');

      expect(spy).toHaveBeenCalled();
      const logged = spy.mock.calls.map((c) => c.map(String).join(' ')).join('\n');
      expect(logged).toMatch(/unique constraint|cus_id/i);
    } finally {
      spy.mockRestore();
    }
  });

  it('không truyền saler -> mặc định gán NGƯỜI TẠO (by) làm sale chính, KHÔNG mồ côi', async () => {
    const u = await seedUser({ username: 'sale1' });
    await grant(u.id, 'customer_view', 'own');

    const r = await svc.create({ name: 'Công ty C' }, 'sale1'); // input.saler bỏ trống, by='sale1'
    expect(r.ok).toBe(true);
    const c = await prisma.customer.findUnique({ where: { code: r.code! } });
    expect(c!.saler).toBe('sale1'); // giống setSalers(): không được ghi NULL

    // Cùng bất biến setSalers() bảo vệ ("Thiếu sale chính — khách không được mồ côi"):
    // saler=NULL sẽ vô hình với ScopeService::buildDocScope kể cả người vừa tạo.
    const rows = await svc.listForUser('customer_view', u.id);
    expect(rows.map((x) => x.code)).toContain(r.code);
  });

  it('thiếu CẢ saler lẫn by (người tạo) -> từ chối tạo, KHÔNG ghi khách mồ côi', async () => {
    const before = await prisma.customer.count();
    const r = await svc.create({ name: 'Công ty D' }, ''); // by rỗng, không có ai để gán mặc định
    expect(r.ok).toBe(false);
    expect(await prisma.customer.count()).toBe(before); // không đẻ ra hàng nào
  });
});
