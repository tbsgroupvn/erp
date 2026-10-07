// D5 Task 2 — mở rộng H3 (`fields.viaCustomer`) cho hai đường đọc cần nó:
//  - `viaCustomerKey: 'id'`: PO nối khách bằng `buyerId` (→ `Customer.id`), KHÔNG có cột mã khách
//    (`buyerCode` trong tài liệu D5 không tồn tại trên `PurchaseOrder`) — Q-D5-5 "PO theo khách".
//  - `unassigned: true`: Q-D5-7 — sale thấy giao dịch NH đã gán khách trong phạm vi + giao dịch CHƯA
//    gán khách (`cus_id` NULL hoặc ''). Luật đọc từ `saleSensitiveRule('bank.view').kind`.
// Đo THẬT trên tbs_test (findMany), không chỉ so hình dạng where.
import { prisma, resetIam, seedRole, assignRole } from '../helpers/iam-db';
import { resetMasterdata, seedCustomer } from '../helpers/masterdata-db';
import { resetPo, seedPo } from '../helpers/po-db';
import { resetFxBank, seedBankTransaction } from '../helpers/fx-bank-db';
import { PermService } from '../../src/iam/perm.service';
import { OrgService } from '../../src/iam/org.service';
import { ScopeService } from '../../src/iam/scope.service';
import { bankTxScope } from '../../src/bank/bank-scope';
import { PO_OWNER_FIELDS } from '../../src/po/po.constants';

const perm = new PermService(prisma as any);
const org = new OrgService(prisma as any);
const scope = new ScopeService(prisma as any, perm, org);

beforeEach(async () => {
  await resetIam(); await resetMasterdata(); await resetPo(); await resetFxBank(); perm.clearCache();
});
afterAll(() => prisma.$disconnect());

let seq = 0;
async function grant(uid: number, code: string, sc: any) {
  const r = await seedRole('rv' + uid + sc + ++seq, [{ code, scope: sc }]);
  await assignRole(uid, r.id);
  perm.clearCache();
}
const mkUser = (username: string) => prisma.user.create({ data: { username, password: 'x' } });

function assertNoFailOpen(w: any) {
  expect(w).not.toEqual({});
  const walk = (x: any) => {
    if (x === undefined) throw new Error('undefined trong where');
    if (x && typeof x === 'object') {
      if (!Array.isArray(x) && Object.keys(x).length === 0) throw new Error('{} lồng trong where');
      if (Array.isArray(x.AND) && x.AND.length === 0) throw new Error('AND: [] trong where');
      if (Array.isArray(x.OR) && x.OR.length === 0) throw new Error('OR: [] trong where');
      if (Array.isArray(x.in) && x.in.length === 0) throw new Error('in: [] trong where');
      for (const v of Object.values(x)) walk(v);
    }
  };
  walk(w);
}

describe('viaCustomerKey = id (PO theo buyerId)', () => {
  async function world() {
    const s1 = await mkUser('s1');
    const s2 = await mkUser('s2');
    const k1 = await seedCustomer('K1', 's1');
    const kPhu = await seedCustomer('K_PHU', 's2', ['s1']);
    const kOff = await seedCustomer('K_OFF', 's1');
    await prisma.customer.update({ where: { id: kOff.id }, data: { isactive: 0 } });
    const k2 = await seedCustomer('K2', 's2');
    const p1 = await seedPo('PO1', { buyerId: k1.id, createdBy: 's2' }); // s2 TẠO nhưng khách của s1
    const pPhu = await seedPo('PO_PHU', { buyerId: kPhu.id });
    const pOff = await seedPo('PO_OFF', { buyerId: kOff.id });
    const p2 = await seedPo('PO2', { buyerId: k2.id, createdBy: 's1' }); // s1 TẠO nhưng khách của s2
    const pNull = await seedPo('PO_NULL', { buyerId: null, createdBy: 's1' });
    const pZero = await seedPo('PO_ZERO', { buyerId: 0, createdBy: 's1' });
    return { s1, s2, p1, pPhu, pOff, p2, pNull, pZero };
  }
  const poCodes = async (where: any) =>
    (await prisma.purchaseOrder.findMany({ where, select: { poCode: true } })).map((r) => r.poCode).sort();

  test('own: PO của khách mình phụ trách (chính + phụ + ngừng hoạt động), KHÔNG theo người tạo; PO chưa gắn khách bị ẩn', async () => {
    const { s1 } = await world();
    await grant(s1.id, 'po.view', 'own');
    const w: any = await scope.buildDocScope('po.view', s1.id, PO_OWNER_FIELDS);
    assertNoFailOpen(w);
    expect(Object.keys(w)).toEqual(['buyerId']);
    expect(await poCodes(w)).toEqual(['PO1', 'PO_OFF', 'PO_PHU']);
  });

  test('giá trị trong `in` là Customer.id (số nguyên dương), không phải mã chuỗi', async () => {
    const { s1 } = await world();
    await grant(s1.id, 'po.view', 'own');
    const w: any = await scope.buildDocScope('po.view', s1.id, PO_OWNER_FIELDS);
    for (const v of w.buyerId.in) expect(Number.isInteger(v) && v > 0).toBe(true);
  });

  test('không có khách ⇒ DENY; không quyền ⇒ DENY; all ⇒ {}', async () => {
    await world();
    const u = await mkUser('trang');
    await grant(u.id, 'po.view', 'own');
    expect(await scope.buildDocScope('po.view', u.id, PO_OWNER_FIELDS)).toEqual({ id: -1 });
    const n = await mkUser('noperm');
    expect(await scope.buildDocScope('po.view', n.id, PO_OWNER_FIELDS)).toEqual({ id: -1 });
    const kt = await mkUser('kt');
    await grant(kt.id, 'po.view', 'all');
    expect(await scope.buildDocScope('po.view', kt.id, PO_OWNER_FIELDS)).toEqual({});
  });

  test('viaCustomerKey lạ ⇒ DENY (cấu hình sai, không đoán)', async () => {
    const { s1 } = await world();
    await grant(s1.id, 'po.view', 'own');
    expect(await scope.buildDocScope('po.view', s1.id, { viaCustomer: 'buyerId', viaCustomerKey: 'phone' as any })).toEqual({ id: -1 });
  });
});

describe('unassigned (Q-D5-7) — bankTxScope', () => {
  async function world() {
    const s1 = await mkUser('s1');
    await seedCustomer('K1', 's1');
    await seedCustomer('K_PHU', 's2', ['s1']);
    await seedCustomer('K2', 's2');
    for (const [bankid, cusId] of [['A', 'K1'], ['B', 'K_PHU'], ['C', 'K2'], ['D', null], ['E', ''], ['F', 'KHONG_CO']] as const) {
      await seedBankTransaction({ bankid, cusId });
    }
    return { s1 };
  }
  const ids = async (where: any) =>
    (await prisma.bankTransaction.findMany({ where, select: { bankid: true } })).map((r) => r.bankid).sort();

  test('sale own: giao dịch của khách mình (chính + phụ) + chưa gán (NULL, \'\'); KHÔNG thấy khách người khác / mã lạ', async () => {
    const { s1 } = await world();
    await grant(s1.id, 'bank.view', 'own');
    const w = await bankTxScope(scope, s1.id);
    assertNoFailOpen(w);
    expect(await ids(w)).toEqual(['A', 'B', 'D', 'E']);
  });

  test('sale không có khách nào ⇒ CHỈ giao dịch chưa gán (không DENY, không mở hết)', async () => {
    await world();
    const u = await mkUser('trang');
    await grant(u.id, 'bank.view', 'team');
    const w = await bankTxScope(scope, u.id);
    assertNoFailOpen(w);
    expect(await ids(w)).toEqual(['D', 'E']);
  });

  test('không quyền ⇒ DENY; username rỗng ⇒ DENY (danh tính hỏng KHÔNG được thấy cả giao dịch chưa gán)', async () => {
    await world();
    const n = await mkUser('noperm');
    expect(await bankTxScope(scope, n.id)).toEqual({ id: -1 });
    const e = await mkUser('');
    await grant(e.id, 'bank.view', 'own');
    expect(await bankTxScope(scope, e.id)).toEqual({ id: -1 });
    expect(await bankTxScope(scope, 0)).toEqual({ id: -1 });
    // DENY chạy được thật trên cột id BigInt (không ném lỗi kiểu) và trả rỗng
    expect(await ids(await bankTxScope(scope, n.id))).toEqual([]);
  });

  test('kế toán all ⇒ {} (không đổi hành vi người có all)', async () => {
    await world();
    const kt = await mkUser('kt');
    await grant(kt.id, 'bank.view', 'all');
    const w = await bankTxScope(scope, kt.id);
    expect(w).toEqual({});
    expect(await ids(w)).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
  });

  test('warehouse ⇒ DENY (khách không có cột kho)', async () => {
    await world();
    const u = await mkUser('kho');
    await grant(u.id, 'bank.view', 'warehouse');
    expect(await bankTxScope(scope, u.id)).toEqual({ id: -1 });
  });
});
