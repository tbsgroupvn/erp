import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { chuanTen } from './scope-names';

// Giữ tên xuất cũ cho bên gọi đã import từ đây; nguồn thật ở scope-names.ts.
export { tenHopLe } from './scope-names';

/**
 * D5 H1 — "tập người thuộc team tôi", chép ĐÚNG prod `includes/team_scope.php:30-70`
 * `tbs_team_salers($u)` (docs/rewrite-spec/D5-pham-vi-sale-de-xuat.md §1.1, §3 H1):
 *
 *   me (đang hoạt động, username khác rỗng)
 *   ∪ `SalerTeam.saler` của các `Team` mà me là `leaderId` HOẶC `deputyId` — KHÔNG lọc trạng thái
 *     (prod cũng không; thành viên đã nghỉ vẫn giữ khách cũ trong tầm nhìn của leader)
 *   ∪ username của leader THẬT của các team đó, nếu đang hoạt động (phó thấy khách của leader)
 *   ∪ username của `User` có `leaderId` ∈ {leader thật ĐANG hoạt động}, đang hoạt động (cấp dưới HRM
 *     của LEADER — không phải của phó, và không tính khi me không làm leader/phó của Team nào)
 *
 * Người không làm leader/phó ⇒ chỉ `[me]` ⇒ nhánh `team` ≡ `own` (đo prod: 41/41 sale thường).
 *
 * ⚠ FAIL-CLOSED: me không tồn tại / không hoạt động / username rỗng ⇒ `[]` và bên gọi PHẢI DENY.
 * Mọi tên rỗng/khoảng trắng/không phải chuỗi bị lọc TRƯỚC khi trả ra — một `''` lọt vào
 * `salerOther contains '""'` là khớp mọi khách có chuỗi rỗng trong `saler_other`. Tên trả ra đã qua
 * `chuanTen` (bỏ khoảng trắng CUỐI như PAD SPACE của prod, không bỏ đầu — xem scope-names.ts).
 *
 * ⚠ So khớp đúng từng byte (Postgres), prod MariaDB `_ci` — xem D4/Q6 `migration/01-iam.md`.
 */
@Injectable()
export class TeamScopeService {
  constructor(private prisma: PrismaService) {}

  async teamSalers(uid: number): Promise<string[]> {
    const id = Number(uid);
    if (!Number.isInteger(id) || id <= 0) return [];
    const me = await this.prisma.user.findUnique({ where: { id }, select: { username: true, isActive: true } });
    const meTen = me && me.isActive ? chuanTen(me.username) : null;
    if (meTen === null) return [];

    const out = new Set<string>([meTen]);
    const them = (n: unknown) => { const t = chuanTen(n); if (t !== null) out.add(t); };
    const teams = await this.prisma.team.findMany({
      where: { OR: [{ leaderId: id }, { deputyId: id }] },
      select: { id: true, leaderId: true },
    });
    if (!teams.length) return [...out];

    const teamIds = teams.map((t) => t.id);
    const members = await this.prisma.salerTeam.findMany({ where: { teamId: { in: teamIds } }, select: { saler: true } });
    for (const m of members) them(m.saler);

    const leaderIds = [...new Set(teams.map((t) => t.leaderId).filter((x): x is number => typeof x === 'number' && x > 0))];
    if (leaderIds.length) {
      const leaders = await this.prisma.user.findMany({
        where: { id: { in: leaderIds }, isActive: true },
        select: { id: true, username: true },
      });
      for (const l of leaders) them(l.username);
      const activeLeaderIds = leaders.map((l) => l.id);
      if (activeLeaderIds.length) {
        const reports = await this.prisma.user.findMany({
          where: { leaderId: { in: activeLeaderIds }, isActive: true },
          select: { username: true },
        });
        for (const r of reports) them(r.username);
      }
    }
    return [...out];
  }
}
