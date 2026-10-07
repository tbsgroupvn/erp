// D5 Task 1 — H1 `TeamScopeService.teamSalers(uid)`: chép ĐÚNG prod
// `includes/team_scope.php:30-70` `tbs_team_salers` (xem
// docs/rewrite-spec/D5-pham-vi-sale-de-xuat.md §1.1, §3 H1).
//   me (đang hoạt động, username khác rỗng)
//   ∪ SalerTeam.saler của các team mà me là leaderId HOẶC deputyId (KHÔNG lọc trạng thái)
//   ∪ username của leader THẬT của các team đó (đang hoạt động)
//   ∪ username của User có leaderId ∈ {leader thật đang hoạt động} (đang hoạt động)
// me không thoả ⇒ [] (bên gọi DENY).
import { prisma, resetIam, seedUser } from '../helpers/iam-db';
import { TeamScopeService } from '../../src/iam/team-scope.service';

const svc = new TeamScopeService(prisma as any);
beforeEach(async () => { await resetIam(); });
afterAll(() => prisma.$disconnect());

const sorted = (a: string[]) => [...a].sort();
async function mkUser(username: string, extra: Partial<{ isActive: boolean; leaderId: number }> = {}) {
  return prisma.user.create({ data: { username, password: 'x', isActive: extra.isActive ?? true, leaderId: extra.leaderId ?? null } });
}
async function mkTeam(name: string, leaderId: number | null, deputyId: number | null, members: string[]) {
  const t = await prisma.team.create({ data: { name, leaderId, deputyId } });
  for (const m of members) await prisma.salerTeam.create({ data: { saler: m, teamName: name, teamId: t.id } });
  return t;
}

describe('TeamScopeService.teamSalers (H1)', () => {
  test('người thường (không leader/phó) ⇒ chỉ chính mình, dù có cấp dưới HRM', async () => {
    const u = await seedUser({ username: 'sale1' });
    await mkUser('capduoi', { leaderId: u.id }); // cấp dưới HRM nhưng sale1 KHÔNG là leader của Team nào
    expect(await svc.teamSalers(u.id)).toEqual(['sale1']);
  });

  test('leader ⇒ me + thành viên SalerTeam + cấp dưới HRM đang hoạt động', async () => {
    const lead = await seedUser({ username: 'lead1' });
    await mkTeam('T1', lead.id, null, ['m1', 'm2']);
    await mkUser('hrm1', { leaderId: lead.id });
    await mkUser('hrmOff', { leaderId: lead.id, isActive: false });
    expect(sorted(await svc.teamSalers(lead.id))).toEqual(['hrm1', 'lead1', 'm1', 'm2']);
  });

  test('thành viên SalerTeam KHÔNG lọc trạng thái (giống prod) — kể cả người đã nghỉ / không có dòng User', async () => {
    const lead = await seedUser({ username: 'lead1' });
    await mkUser('nghi', { isActive: false });
    await mkTeam('T1', lead.id, null, ['nghi', 'khongcouser']);
    expect(sorted(await svc.teamSalers(lead.id))).toEqual(['khongcouser', 'lead1', 'nghi']);
  });

  test('phó (deputy) ⇒ me + thành viên + username leader thật + cấp dưới HRM của LEADER (không phải của phó)', async () => {
    const lead = await seedUser({ username: 'lead1' });
    const dep = await seedUser({ username: 'dep1' });
    await mkTeam('T1', lead.id, dep.id, ['m1']);
    await mkUser('hrmLead', { leaderId: lead.id });
    await mkUser('hrmDep', { leaderId: dep.id }); // cấp dưới HRM của PHÓ — prod không tính
    expect(sorted(await svc.teamSalers(dep.id))).toEqual(['dep1', 'hrmLead', 'lead1', 'm1']);
  });

  test('leader đã NGHỈ: phó vẫn thấy thành viên, nhưng KHÔNG thấy username leader lẫn cấp dưới HRM của leader', async () => {
    const lead = await seedUser({ username: 'lead1' });
    await prisma.user.update({ where: { id: lead.id }, data: { isActive: false } });
    const dep = await seedUser({ username: 'dep1' });
    await mkTeam('T1', lead.id, dep.id, ['m1']);
    await mkUser('hrmLead', { leaderId: lead.id });
    expect(sorted(await svc.teamSalers(dep.id))).toEqual(['dep1', 'm1']);
  });

  test('leader đã nghỉ tự gọi ⇒ [] (me không hoạt động)', async () => {
    const lead = await seedUser({ username: 'lead1' });
    await mkTeam('T1', lead.id, null, ['m1']);
    await prisma.user.update({ where: { id: lead.id }, data: { isActive: false } });
    expect(await svc.teamSalers(lead.id)).toEqual([]);
  });

  test('team không có thành viên ⇒ vẫn chứa me (và cấp dưới HRM)', async () => {
    const lead = await seedUser({ username: 'lead1' });
    await mkTeam('Rong', lead.id, null, []);
    expect(await svc.teamSalers(lead.id)).toEqual(['lead1']);
  });

  test('cấp dưới HRM chỉ tính khi me là leader THẬT của một Team', async () => {
    const lead = await seedUser({ username: 'lead1' });
    await mkTeam('T1', lead.id, null, []);
    await mkUser('hrm1', { leaderId: lead.id });
    await mkUser('hrm2', { leaderId: lead.id });
    expect(sorted(await svc.teamSalers(lead.id))).toEqual(['hrm1', 'hrm2', 'lead1']);
  });

  test('nhiều team (leader T1 + phó T2) ⇒ hợp cả hai, không trùng', async () => {
    const a = await seedUser({ username: 'a' });
    const b = await seedUser({ username: 'b' });
    await mkTeam('T1', a.id, null, ['m1', 'b']); // SalerTeam.saler UNIQUE: một sale thuộc MỘT team
    await mkTeam('T2', b.id, a.id, ['m2']);
    expect(sorted(await svc.teamSalers(a.id))).toEqual(['a', 'b', 'm1', 'm2']);
  });

  test("SalerTeam.saler rỗng/khoảng trắng bị lọc bỏ (không bao giờ đưa '' vào `in`)", async () => {
    const lead = await seedUser({ username: 'lead1' });
    const t = await mkTeam('T1', lead.id, null, ['m1']);
    await prisma.salerTeam.create({ data: { saler: '', teamName: 'T1', teamId: t.id } });
    await prisma.salerTeam.create({ data: { saler: '   ', teamName: 'T1', teamId: t.id } });
    const names = await svc.teamSalers(lead.id);
    expect(sorted(names)).toEqual(['lead1', 'm1']);
    expect(names.every((n) => typeof n === 'string' && n.trim() !== '')).toBe(true);
  });

  test('SalerTeam không gắn teamId (null) không lọt vào team nào', async () => {
    const lead = await seedUser({ username: 'lead1' });
    await mkTeam('T1', lead.id, null, []);
    await prisma.salerTeam.create({ data: { saler: 'mocoi', teamName: 'T1', teamId: null } });
    expect(await svc.teamSalers(lead.id)).toEqual(['lead1']);
  });

  test('username rỗng ⇒ []', async () => {
    const u = await mkUser('');
    await mkTeam('T1', u.id, null, ['m1']);
    expect(await svc.teamSalers(u.id)).toEqual([]);
  });

  test('username chỉ khoảng trắng ⇒ []', async () => {
    const u = await mkUser('  ');
    expect(await svc.teamSalers(u.id)).toEqual([]);
  });

  test('uid không tồn tại / 0 / âm / NaN ⇒ []', async () => {
    expect(await svc.teamSalers(999999)).toEqual([]);
    expect(await svc.teamSalers(0)).toEqual([]);
    expect(await svc.teamSalers(-5)).toEqual([]);
    expect(await svc.teamSalers(NaN)).toEqual([]);
    expect(await svc.teamSalers(undefined as any)).toEqual([]);
  });

  test('me không hoạt động (không phải leader) ⇒ []', async () => {
    const u = await seedUser({ username: 'off' });
    await prisma.user.update({ where: { id: u.id }, data: { isActive: false } });
    expect(await svc.teamSalers(u.id)).toEqual([]);
  });

  test('Team.leaderId=null với me là phó ⇒ không có leader thật, không lấy cấp dưới HRM của ai', async () => {
    const dep = await seedUser({ username: 'dep1' });
    await mkUser('hrmNull'); // leaderId null
    await mkTeam('T1', null, dep.id, ['m1']);
    expect(sorted(await svc.teamSalers(dep.id))).toEqual(['dep1', 'm1']);
  });
});
