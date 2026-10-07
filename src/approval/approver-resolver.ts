import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Một mục người duyệt của bước: `members` là những username thoả được mục này. */
export type ApproverEntry = { kind: 'group' | 'user'; ref: number | null; members: string[] };

@Injectable()
export class ApproverResolver {
  constructor(private prisma: PrismaService) {}

  /** Mọi ứng viên của bước (hợp của các mục) — cổng "ai được bấm duyệt". */
  async resolveStepApprovers(
    step: { approvers: { approverType: string; approverRef: number | null }[] },
    ctx: { submitterUsername: string; selfSelected?: string[] },
  ): Promise<string[]> {
    const out = new Set<string>();
    for (const e of await this.resolveStepEntries(step, ctx)) for (const n of e.members) out.add(n);
    return [...out];
  }

  /**
   * I1 — mục `group` LUÔN được phát, kể cả khi nhóm không có ai (prod cũng vậy): mục đó bắt buộc
   * và không thể thoả ⇒ bước đứng chờ, KHÔNG rơi vào empty_approver_action. Các loại khác khi không
   * ra ai thì KHÔNG phát mục (user không tồn tại, không tìm ra quản lý, người nộp không có trong
   * tbl_user) — giống prod.
   *
   * D2 — danh sách MỤC người duyệt của bước, giữ ranh giới từng mục (prod: `$resolved` của
   * resolveStepApprovers()). Bước AND cần MỘT chữ ký cho MỖI mục; mục `group` được thoả bởi MỘT
   * thành viên bất kỳ của nhóm (prod isStepFullySatisfied()). `self_select`: prod ghi mỗi người
   * được chọn thành một override 'added' riêng ⇒ ở đây mỗi người là một mục.
   */
  async resolveStepEntries(
    step: { approvers: { approverType: string; approverRef: number | null }[] },
    ctx: { submitterUsername: string; selfSelected?: string[] },
  ): Promise<ApproverEntry[]> {
    const out: ApproverEntry[] = [];
    for (const a of step.approvers ?? []) {
      switch (a.approverType) {
        case 'group': {
          if (!a.approverRef) break;
          out.push({ kind: 'group', ref: a.approverRef, members: await this.groupMembers(a.approverRef) });
          break;
        }
        case 'user': {
          if (!a.approverRef) break;
          const u = await this.prisma.user.findUnique({ where: { id: a.approverRef }, select: { username: true } });
          if (u?.username) out.push({ kind: 'user', ref: a.approverRef, members: [u.username] });
          break;
        }
        case 'submitter_manager': {
          const sub = await this.prisma.user.findUnique({ where: { username: ctx.submitterUsername }, select: { leaderId: true } });
          if (sub?.leaderId) {
            const m = await this.prisma.user.findUnique({ where: { id: sub.leaderId }, select: { username: true } });
            if (m?.username) out.push({ kind: 'user', ref: sub.leaderId, members: [m.username] });
          }
          break;
        }
        case 'requester': {
          // prod: chỉ phát mục khi người nộp CÓ trong tbl_user (không thì không có mục nào)
          const u = await this.prisma.user.findUnique({ where: { username: ctx.submitterUsername }, select: { id: true } });
          if (u) out.push({ kind: 'user', ref: u.id, members: [ctx.submitterUsername] });
          break;
        }
        case 'self_select': for (const s of ctx.selfSelected ?? []) out.push({ kind: 'user', ref: null, members: [s] }); break;
        case 'step_approver': /* giải ở runtime (Task 7) */ break;
      }
    }
    return out;
  }

  /**
   * D1 — thành viên "nhóm gid N". `approver_ref` của `group` là **gid cũ** (`tbl_user_group.id`),
   * KHÔNG phải id vai IAM: trên prod vai 28 = "Kế toán" trong khi gid 28 = "Giám đốc Kinh doanh".
   * Chép `usersInLegacyOrIamGroup()` (prod `libs/cls.approval.php`, HEAD):
   *   (a) `tbl_user.gid = N` và user còn hoạt động, CỘNG
   *   (b) user còn hoạt động có vai IAM đang hiệu lực, vai `active`, `mo_ta` KẾT THÚC bằng
   *       "gid N" (prod: `r.mo_ta LIKE '%gid N'`, collation *_ci ⇒ không phân biệt hoa thường) —
   *       quy ước lúc migrate sinh vai từ nhóm cũ, vd "Sinh tu nhom quyen cu gid 51".
   */
  async groupMembers(gid: number): Promise<string[]> {
    if (!Number.isInteger(gid) || gid <= 0) return [];
    const out = new Set<string>();
    for (const u of await this.prisma.user.findMany({ where: { gid, isActive: true }, select: { username: true } }))
      out.add(u.username);
    const today = new Date();
    const t = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    const userRoles = await this.prisma.userRole.findMany({
      where: {
        role: { active: true, moTa: { endsWith: `gid ${gid}`, mode: 'insensitive' } },
        hieuLucTu: { lte: t },
        OR: [{ hieuLucDen: null }, { hieuLucDen: { gte: t } }],
      },
      select: { userId: true },
    });
    const userIds = [...new Set(userRoles.map((r) => r.userId))];
    if (userIds.length) {
      for (const u of await this.prisma.user.findMany({
        where: { id: { in: userIds }, isActive: true }, select: { username: true },
      })) out.add(u.username);
    }
    return [...out];
  }
}
