import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PermService } from './perm.service';
import { PermKind, Scope } from '@prisma/client';

const ADMIN_PERMS = ['iam.manage', 'perm.manage'];

@Injectable()
export class PermAdminService {
  constructor(private prisma: PrismaService, private perm: PermService) {}

  private async log(userId: number | null, hanhDong: string, actorUid: number, before: any, after: any, lyDo?: string) {
    await this.prisma.staffLog.create({ data: {
      userId: userId ?? null, hanhDong, boi: actorUid,
      truocJson: before ? JSON.stringify(before) : null, sauJson: after ? JSON.stringify(after) : null, lydo: lyDo ?? null,
    }});
  }

  // ⚠ M-4 (review cuối fix/auth-fidelity, CHƯA SỬA — ghi lại có chủ ý): từ D8 có UNIQUE uq_user_role
  // (user_id, role_id, hieu_luc_tu) ⇒ gán TRÙNG ném Prisma P2002 thay vì âm thầm thêm dòng thứ hai.
  // Hôm nay chưa có caller HTTP; khi nối endpoint phải quyết: upsert, hay trả 409 rõ ràng.
  async assignRole(userId: number, roleId: number, actorUid: number, w?: { tu?: string; den?: string | null }) {
    await this.prisma.userRole.create({ data: {
      userId, roleId, capBoi: String(actorUid),
      hieuLucTu: new Date(w?.tu ?? new Date().toISOString().slice(0, 10)),
      hieuLucDen: w?.den ? new Date(w.den) : null,
    }});
    await this.log(userId, 'gan_vai', actorUid, null, { roleId });
    await this.perm.bumpVersion();
  }

  async removeRole(userId: number, roleId: number, actorUid: number) {
    // SoD: chặn actor tự gỡ vai đang giữ nếu vai đó cấp quyền quản trị mà actor đang có
    if (userId === actorUid) {
      const grants = await this.prisma.rolePermission.findMany({
        where: { roleId, permCode: { in: ADMIN_PERMS } },
      });
      if (grants.length) {
        const myScopes = await this.perm.of(actorUid);
        if (grants.some((g) => g.permCode in myScopes)) {
          throw new ForbiddenException('Không thể tự gỡ quyền quản trị của vai mình đang giữ');
        }
      }
    }
    await this.prisma.userRole.deleteMany({ where: { userId, roleId } });
    await this.log(userId, 'go_vai', actorUid, { roleId }, null);
    await this.perm.bumpVersion();
  }

  async setLenPerm(userId: number, permCode: string, loai: PermKind, scope: Scope, actorUid: number, lyDo?: string) {
    const code = permCode.toLowerCase();
    // ⚠ M-4: như assignRole — UNIQUE uq_user_perm (user_id, perm_code, loai) ⇒ cấp trùng ném P2002.
    await this.prisma.userPermission.create({ data: { userId, permCode: code, loai, scope, lyDo, capBoi: String(actorUid) } });
    await this.log(userId, 'cap_le', actorUid, null, { permCode: code, loai, scope }, lyDo);
    await this.perm.bumpVersion();
  }

  async saveMatrix(changes: { roleId: number; permCode: string; bat: boolean; scope: Scope }[], actorUid: number) {
    // SoD: chặn actor gỡ quyền quản trị khỏi vai mà chính actor đang giữ (chỉ ĐỌC, chạy TRƯỚC mọi ghi)
    const myScopes = await this.perm.of(actorUid);
    for (const c of changes) {
      const code = c.permCode.toLowerCase();
      if (!c.bat && ADMIN_PERMS.includes(code)) {
        const holdsViaRole = await this.prisma.userRole.findFirst({ where: { userId: actorUid, roleId: c.roleId } });
        if (holdsViaRole && code in myScopes) throw new ForbiddenException('Không thể tự gỡ quyền quản trị của vai mình đang giữ');
      }
    }
    // Áp dụng cả loạt trong MỘT transaction: lỗi giữa chừng (FK, timeout...) phải cuốn
    // ngược toàn bộ, không để half-applied trước khi bumpVersion.
    await this.prisma.$transaction(async (tx) => {
      for (const c of changes) {
        const code = c.permCode.toLowerCase();
        if (c.bat) {
          await tx.rolePermission.upsert({
            where: { roleId_permCode: { roleId: c.roleId, permCode: code } },
            create: { roleId: c.roleId, permCode: code, scope: c.scope }, update: { scope: c.scope },
          });
        } else {
          await tx.rolePermission.deleteMany({ where: { roleId: c.roleId, permCode: code } });
        }
        await tx.staffLog.create({ data: {
          userId: null, hanhDong: 'sua_quyen_o', boi: actorUid,
          truocJson: null, sauJson: JSON.stringify({ ...c, permCode: code }), lydo: null,
        }});
      }
    });
    await this.perm.bumpVersion();
  }
}
