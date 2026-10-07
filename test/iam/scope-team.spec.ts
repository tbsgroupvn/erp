// D5 Task 1 — H2 (`buildDocScope` nhánh `team` viết lại theo prod `tbs_team_salers`)
// và H3 (`fields.viaCustomer`: sở hữu gián tiếp qua khách).
// Nguồn: docs/rewrite-spec/D5-pham-vi-sale-de-xuat.md §3 H2/H3 + QUYẾT ĐỊNH 25/09:
//  - Q-D5-1/2: leader + phó thấy team; `saler_other` tính là sở hữu.
//  - Q-D5-9: H3 KHÔNG lọc `isactive=1` — khách ngừng hoạt động vẫn thấy.
import { prisma, resetIam, seedRole, assignRole } from '../helpers/iam-db';
import { resetMasterdata, seedCustomer } from '../helpers/masterdata-db';
import { PermService } from '../../src/iam/perm.service';
import { OrgService } from '../../src/iam/org.service';
import { ScopeService } from '../../src/iam/scope.service';
import { TeamScopeService } from '../../src/iam/team-scope.service';

const perm = new PermService(prisma as any);
const org = new OrgService(prisma as any);
const team = new TeamScopeService(prisma as any);
const scope = new ScopeService(prisma as any, perm, org, team);

beforeEach(async () => { await resetIam(); await resetMasterdata(); perm.clearCache(); });
afterAll(() => prisma.$disconnect());

let seq = 0;
async function grant(uid: number, code: string, sc: any) {
  const r = await seedRole('r' + uid + sc + ++seq, [{ code, scope: sc }]);
  await assignRole(uid, r.id);
  perm.clearCache();
}
async function mkUser(username: string, extra: Partial<{ isActive: boolean; leaderId: number }> = {}) {
  return prisma.user.create({ data: { username, password: 'x', isActive: extra.isActive ?? true, leaderId: extra.leaderId ?? null } });
}
async function mkTeam(name: string, leaderId: number | null, deputyId: number | null, members: string[]) {
  const t = await prisma.team.create({ data: { name, leaderId, deputyId } });
  for (const m of members) await prisma.salerTeam.create({ data: { saler: m, teamName: name, teamId: t.id } });
  return t;
}
async function codesFor(where: any): Promise<string[]> {
  const rows = await prisma.customer.findMany({ where, select: { code: true } });
  return rows.map((r) => r.code).sort();
}
/** Không một `{}` / `AND: []` / giá trị `undefined` nào được lọt ra ngoài nhánh `all`. */
function assertNoFailOpen(w: any) {
  expect(w).not.toEqual({});
  const walk = (x: any) => {
    if (x === undefined) throw new Error('undefined trong where');
    if (x && typeof x === 'object') {
      if (!Array.isArray(x) && Object.keys(x).length === 0) throw new Error('{} lồng trong where');
      if (Array.isArray(x.AND) && x.AND.length === 0) throw new Error('AND: [] trong where');
      if (Array.isArray(x.OR) && x.OR.length === 0) throw new Error('OR: [] trong where');
      // contains '""' khớp mọi saler_other có chuỗi rỗng; contains '' khớp MỌI dòng
      if ('contains' in x && (x.contains === '""' || x.contains === '')) throw new Error('contains rỗng');
      for (const v of Object.values(x)) walk(v);
    }
  };
  walk(w);
}

/** Bộ dữ liệu: T1 leader=lead, phó=dep, thành viên m1,m2; m3 ngoài team. */
async function seedWorld() {
  const lead = await mkUser('lead');
  const dep = await mkUser('dep');
  const m1 = await mkUser('m1');
  const m2 = await mkUser('m2');
  const m3 = await mkUser('m3');
  await mkTeam('T1', lead.id, dep.id, ['m1', 'm2']);
  await seedCustomer('K_LEAD', 'lead');
  await seedCustomer('K_DEP', 'dep');
  await seedCustomer('K_M1', 'm1');
  await seedCustomer('K_M2_PHU', 'm3', ['m2']); // m2 là sale PHỤ
  await seedCustomer('K_M3', 'm3');
  await seedCustomer('K_M1_OFF', 'm1');
  await prisma.customer.update({ where: { code: 'K_M1_OFF' }, data: { isactive: 0 } });
  return { lead, dep, m1, m2, m3 };
}

describe('H2 — buildDocScope nhánh team', () => {
  test('người thường: team ≡ own (cùng where, cùng tập khách)', async () => {
    const { m1 } = await seedWorld();
    await grant(m1.id, 'customer.view', 'own');
    await grant(m1.id, 'customer.edit', 'team');
    const wOwn = await scope.buildDocScope('customer.view', m1.id);
    const wTeam = await scope.buildDocScope('customer.edit', m1.id);
    expect(wTeam).toEqual(wOwn);
    expect(await codesFor(wTeam)).toEqual(['K_M1', 'K_M1_OFF']);
  });

  test('người thường có cấp dưới HRM nhưng KHÔNG là leader Team ⇒ team ≡ own', async () => {
    const boss = await mkUser('boss');
    await mkUser('rep', { leaderId: boss.id });
    await seedCustomer('K_BOSS', 'boss');
    await seedCustomer('K_REP', 'rep');
    await grant(boss.id, 'customer.view', 'team');
    expect(await codesFor(await scope.buildDocScope('customer.view', boss.id))).toEqual(['K_BOSS']);
  });

  // ⚠ Leader KHÔNG thấy khách của PHÓ trừ khi phó là thành viên SalerTeam — đúng prod
  // `tbs_team_salers` (phó thấy leader, chiều ngược lại thì không).
  test('leader thấy khách của cả team, kể cả khách mà thành viên là sale PHỤ; không thấy người ngoài / phó', async () => {
    const { lead } = await seedWorld();
    await grant(lead.id, 'customer.view', 'team');
    const w = await scope.buildDocScope('customer.view', lead.id);
    assertNoFailOpen(w);
    expect(await codesFor(w)).toEqual(['K_LEAD', 'K_M1', 'K_M1_OFF', 'K_M2_PHU']);
  });

  test('phó thấy khách của team + của leader', async () => {
    const { dep } = await seedWorld();
    await grant(dep.id, 'customer.view', 'team');
    expect(await codesFor(await scope.buildDocScope('customer.view', dep.id)))
      .toEqual(['K_DEP', 'K_LEAD', 'K_M1', 'K_M1_OFF', 'K_M2_PHU']);
  });

  test('cấp dưới HRM của leader thật được tính', async () => {
    const { lead } = await seedWorld();
    await mkUser('hrm', { leaderId: lead.id });
    await seedCustomer('K_HRM', 'hrm');
    await grant(lead.id, 'customer.view', 'team');
    expect(await codesFor(await scope.buildDocScope('customer.view', lead.id))).toContain('K_HRM');
  });

  test('leader đã NGHỈ ⇒ phó mất khách của leader; leader tự gọi ⇒ DENY', async () => {
    const { lead, dep } = await seedWorld();
    await prisma.user.update({ where: { id: lead.id }, data: { isActive: false } });
    await grant(dep.id, 'customer.view', 'team');
    await grant(lead.id, 'customer.view', 'team');
    expect(await codesFor(await scope.buildDocScope('customer.view', dep.id))).toEqual(['K_DEP', 'K_M1', 'K_M1_OFF', 'K_M2_PHU']);
    expect(await scope.buildDocScope('customer.view', lead.id)).toEqual({ id: -1 });
  });

  test('team ⊇ own với mọi người (đo trên dữ liệu)', async () => {
    const w = await seedWorld();
    for (const u of [w.lead, w.dep, w.m1, w.m2, w.m3]) {
      await grant(u.id, 'customer.view', 'own');
      await grant(u.id, 'customer.edit', 'team');
      const own = await codesFor(await scope.buildDocScope('customer.view', u.id));
      const tm = await codesFor(await scope.buildDocScope('customer.edit', u.id));
      for (const c of own) expect(tm).toContain(c);
    }
  });

  test('salerOther có ⇒ OR saler=n / salerOther contains "\\"n\\""', async () => {
    const lead = await mkUser('lead');
    await mkTeam('T1', lead.id, null, ['m1']);
    await grant(lead.id, 'customer.view', 'team');
    const w: any = await scope.buildDocScope('customer.view', lead.id);
    expect(w.OR).toEqual(expect.arrayContaining([
      { saler: 'lead' }, { salerOther: { contains: '"lead"' } },
      { saler: 'm1' }, { salerOther: { contains: '"m1"' } },
    ]));
    expect(w.OR).toHaveLength(4);
  });

  test('salerOther=null ⇒ {createdBy:{in:names}}, không vế OR', async () => {
    const lead = await mkUser('lead');
    await mkTeam('T1', lead.id, null, ['m1']);
    await grant(lead.id, 'quote.view', 'team');
    const w: any = await scope.buildDocScope('quote.view', lead.id, { saler: 'createdBy', salerOther: null });
    expect(Object.keys(w)).toEqual(['createdBy']);
    expect([...w.createdBy.in].sort()).toEqual(['lead', 'm1']);
  });

  test('username rỗng ⇒ DENY (không {}, không AND:[], không contains \'""\')', async () => {
    const u = await mkUser('');
    await mkTeam('T1', u.id, null, ['m1']);
    await grant(u.id, 'customer.view', 'team');
    await seedCustomer('K_RONG', 'm1', ['']);
    const w = await scope.buildDocScope('customer.view', u.id);
    expect(w).toEqual({ id: -1 });
    expect(await codesFor(w)).toEqual([]);
  });

  test('user không tồn tại nhưng có vai team ⇒ DENY', async () => {
    const r = await seedRole('r_ghost_team', [{ code: 'customer.view', scope: 'team' }]);
    await assignRole(999999, r.id);
    perm.clearCache();
    expect(await scope.buildDocScope('customer.view', 999999)).toEqual({ id: -1 });
  });

  test('me không hoạt động ⇒ DENY', async () => {
    const u = await mkUser('off', { isActive: false });
    await grant(u.id, 'customer.view', 'team');
    expect(await scope.buildDocScope('customer.view', u.id)).toEqual({ id: -1 });
  });

  test("teamSalers trả về tên rỗng/undefined/null ⇒ bị lọc; chỉ còn rác ⇒ DENY", async () => {
    const u = await mkUser('lead');
    await grant(u.id, 'customer.view', 'team');
    await grant(u.id, 'quote.view', 'team');
    const fake = { teamSalers: jest.fn() } as unknown as TeamScopeService;
    const s2 = new ScopeService(prisma as any, perm, org, fake);

    (fake.teamSalers as jest.Mock).mockResolvedValue(['', undefined, null, '  ', 'lead', 'lead']);
    const w: any = await s2.buildDocScope('customer.view', u.id);
    assertNoFailOpen(w);
    expect(w).toEqual({ OR: [{ saler: 'lead' }, { salerOther: { contains: '"lead"' } }] });
    const wq: any = await s2.buildDocScope('quote.view', u.id, { saler: 'createdBy', salerOther: null });
    expect(wq).toEqual({ createdBy: { in: ['lead'] } });

    (fake.teamSalers as jest.Mock).mockResolvedValue(['', undefined, null]);
    expect(await s2.buildDocScope('customer.view', u.id)).toEqual({ id: -1 });
    expect(await s2.buildDocScope('quote.view', u.id, { saler: 'createdBy', salerOther: null })).toEqual({ id: -1 });

    (fake.teamSalers as jest.Mock).mockResolvedValue([]);
    expect(await s2.buildDocScope('customer.view', u.id)).toEqual({ id: -1 });
  });

  test('team không có thành viên ⇒ leader vẫn thấy khách của chính mình', async () => {
    const lead = await mkUser('lead');
    await mkTeam('Rong', lead.id, null, []);
    await seedCustomer('K_LEAD', 'lead');
    await seedCustomer('K_X', 'x');
    await grant(lead.id, 'customer.view', 'team');
    expect(await codesFor(await scope.buildDocScope('customer.view', lead.id))).toEqual(['K_LEAD']);
  });
});

describe('H3 — fields.viaCustomer (sở hữu gián tiếp qua khách)', () => {
  const VIA = { viaCustomer: 'cusId' };

  test('own: mã khách của mình (chính + phụ), KỂ CẢ khách ngừng hoạt động (Q-D5-9)', async () => {
    const { m1, m2 } = await seedWorld();
    await grant(m1.id, 'order.view', 'own');
    await grant(m2.id, 'order.view', 'own');
    const w1: any = await scope.buildDocScope('order.view', m1.id, VIA);
    expect(Object.keys(w1)).toEqual(['cusId']);
    expect([...w1.cusId.in].sort()).toEqual(['K_M1', 'K_M1_OFF']);
    const w2: any = await scope.buildDocScope('order.view', m2.id, VIA);
    expect(w2).toEqual({ cusId: { in: ['K_M2_PHU'] } });
  });

  test('team leader: mã khách của cả team (kể cả sale phụ, kể cả ngừng hoạt động)', async () => {
    const { lead } = await seedWorld();
    await grant(lead.id, 'order.view', 'team');
    const w: any = await scope.buildDocScope('order.view', lead.id, VIA);
    expect([...w.cusId.in].sort()).toEqual(['K_LEAD', 'K_M1', 'K_M1_OFF', 'K_M2_PHU']);
  });

  test('không có khách nào trong phạm vi ⇒ DENY (codes=[] ⇒ rỗng, không {cusId:{in:[]}} lẫn {})', async () => {
    const u = await mkUser('trang');
    await seedCustomer('K_X', 'x');
    await grant(u.id, 'order.view', 'own');
    expect(await scope.buildDocScope('order.view', u.id, VIA)).toEqual({ id: -1 });
  });

  test('username rỗng ⇒ DENY', async () => {
    const u = await mkUser('');
    await seedCustomer('K_RONG', 'x', ['']);
    await grant(u.id, 'order.view', 'team');
    expect(await scope.buildDocScope('order.view', u.id, VIA)).toEqual({ id: -1 });
  });

  test('all ⇒ {} (không truy vấn khách)', async () => {
    const u = await mkUser('kt');
    await grant(u.id, 'order.view', 'all');
    expect(await scope.buildDocScope('order.view', u.id, VIA)).toEqual({});
  });

  test('không có quyền ⇒ DENY', async () => {
    const u = await mkUser('s');
    expect(await scope.buildDocScope('order.view', u.id, VIA)).toEqual({ id: -1 });
  });

  test('warehouse + viaCustomer ⇒ DENY (khách không có cột kho)', async () => {
    const u = await mkUser('kho');
    await prisma.userScope.create({ data: { userId: u.id, loai: 'warehouse', giaTri: 'VN_HN' } });
    await seedCustomer('K_KHO', 'kho');
    await grant(u.id, 'order.view', 'warehouse');
    expect(await scope.buildDocScope('order.view', u.id, VIA)).toEqual({ id: -1 });
  });

  test('viaCustomer rỗng/khoảng trắng ⇒ DENY (cấu hình sai, không dựng where lên cột "")', async () => {
    const u = await mkUser('s');
    await seedCustomer('K_S', 's');
    await grant(u.id, 'order.view', 'own');
    expect(await scope.buildDocScope('order.view', u.id, { viaCustomer: '' })).toEqual({ id: -1 });
    expect(await scope.buildDocScope('order.view', u.id, { viaCustomer: '  ' })).toEqual({ id: -1 });
  });

  test('viaCustomer bỏ qua saler/salerOther của chứng từ — sở hữu tính theo khách', async () => {
    const { m1 } = await seedWorld();
    await grant(m1.id, 'po.view', 'own');
    const w: any = await scope.buildDocScope('po.view', m1.id, { viaCustomer: 'buyerCode', saler: 'createdBy', salerOther: null });
    expect(Object.keys(w)).toEqual(['buyerCode']);
    expect([...w.buyerCode.in].sort()).toEqual(['K_M1', 'K_M1_OFF']);
  });
});

// Fix round 1 (review 7ea9277): Prisma 6 `contains` KHÔNG thoát `%`/`_`/`\` — `{contains:'"a_b"'}`
// ⇒ `LIKE '%"a_b"%'`, `_` khớp MỌI ký tự. Tên đi vào `salerOther contains` phải được thoát.
// Các ca dưới đây đo THẬT trên tbs_test (đọc lại bằng findMany), không chỉ so hình dạng where.
describe('LIKE-escape trong salerOther contains (own + team)', () => {
  async function seedRaw(code: string, saler: string, salerOtherRaw: string | null) {
    return prisma.customer.create({ data: { code, name: code, saler, salerOther: salerOtherRaw, cdate: 1, mdate: 1 } });
  }

  test("own: username 'sale_hn' KHÔNG khớp saler_other [\"saleXhn\"]", async () => {
    const u = await mkUser('sale_hn');
    await seedRaw('K_EXACT', 'x', '["sale_hn"]');
    await seedRaw('K_WILD', 'x', '["saleXhn"]');
    await grant(u.id, 'customer.view', 'own');
    expect(await codesFor(await scope.buildDocScope('customer.view', u.id))).toEqual(['K_EXACT']);
  });

  test("team: username 'sale_hn' KHÔNG khớp saler_other [\"saleXhn\"]", async () => {
    const u = await mkUser('sale_hn');
    await seedRaw('K_EXACT', 'x', '["sale_hn"]');
    await seedRaw('K_WILD', 'x', '["saleXhn"]');
    await grant(u.id, 'customer.view', 'team');
    expect(await codesFor(await scope.buildDocScope('customer.view', u.id))).toEqual(['K_EXACT']);
  });

  test("team: thành viên SalerTeam '%' KHÔNG nới phạm vi ra mọi khách có saler_other", async () => {
    const lead = await mkUser('lead');
    await mkTeam('T1', lead.id, null, ['%']);
    await seedRaw('K_LEAD', 'lead', null);
    await seedRaw('K_PCT', 'x', '["%"]');
    await seedRaw('K_OTHER1', 'y', '["ai_do"]');
    await seedRaw('K_OTHER2', 'z', '["a","b"]');
    await grant(lead.id, 'customer.view', 'team');
    expect(await codesFor(await scope.buildDocScope('customer.view', lead.id))).toEqual(['K_LEAD', 'K_PCT']);
  });

  test("own: username có '%' chỉ khớp đúng chuỗi", async () => {
    const u = await mkUser('a%b');
    await seedRaw('K_EXACT', 'x', '["a%b"]');
    await seedRaw('K_WILD', 'x', '["aZZZb"]');
    await grant(u.id, 'customer.view', 'own');
    expect(await codesFor(await scope.buildDocScope('customer.view', u.id))).toEqual(['K_EXACT']);
  });

  // Dấu gạch ngược dựng bằng mã 92 — viết literal trong mã nguồn quá dễ bị shell/escape nuốt mất
  // (bản đầu của ca này thành ký tự backspace và XANH GIẢ).
  test('own: username có dấu gạch ngược chỉ khớp đúng chuỗi (BS+b không được hiểu là b)', async () => {
    const BS = String.fromCharCode(92);
    const name = 'a' + BS + 'b';
    expect(name).toHaveLength(3);
    const u = await mkUser(name);
    await seedRaw('K_EXACT', 'x', '["' + name + '"]');
    await seedRaw('K_AB', 'x', '["ab"]');
    await grant(u.id, 'customer.view', 'own');
    expect(await codesFor(await scope.buildDocScope('customer.view', u.id))).toEqual(['K_EXACT']);
  });
});

// Fix round 1 (3): prod MariaDB so sánh PAD SPACE ⇒ 'lead' = 'lead ' (chỉ khoảng trắng CUỐI).
// Chuẩn hoá tên bằng trimEnd (KHÔNG trim đầu: ' lead' ≠ 'lead' cả ở prod — trim đầu là NỚI phạm vi).
describe('chuẩn hoá khoảng trắng cuối tên (PAD SPACE)', () => {
  test("own + team: username 'lead ' dựng where trên 'lead'", async () => {
    const u = await mkUser('lead ');
    await grant(u.id, 'customer.view', 'own');
    await grant(u.id, 'customer.edit', 'team');
    const want = { OR: [{ saler: 'lead' }, { salerOther: { contains: '"lead"' } }] };
    expect(await scope.buildDocScope('customer.view', u.id)).toEqual(want);
    expect(await scope.buildDocScope('customer.edit', u.id)).toEqual(want);
  });

  test("thành viên SalerTeam 'm1  ' ⇒ 'm1'; ' m2' giữ nguyên (không trim đầu)", async () => {
    const lead = await mkUser('lead');
    await mkTeam('T1', lead.id, null, ['m1  ', ' m2']);
    expect((await team.teamSalers(lead.id)).sort()).toEqual([' m2', 'lead', 'm1'].sort());
  });

  test("'m1' và 'm1 ' gộp thành một tên", async () => {
    const lead = await mkUser('lead');
    await mkTeam('T1', lead.id, null, ['m1 ']);
    await mkUser('m1', { leaderId: lead.id });
    expect((await team.teamSalers(lead.id)).sort()).toEqual(['lead', 'm1']);
  });
});
