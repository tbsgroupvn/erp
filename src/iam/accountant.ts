// src/iam/accountant.ts
//
// "Super Admin HOẶC người thuộc nhóm kế toán" — MỘT định nghĩa cho cả hệ (tách nguyên văn từ
// `ApprovalService.selfApproveExempt`, I2 — #09d L11 Task 3 dùng lại cho đối soát bank, đặc tả 09d §9).
// prod:
//   $isadmin      = CLS_STAFF::laSuperAdmin($objuser)  ⇒ v2 `isSuperAdmin` canonical
//   $isaccountant = cờ `isaccountant` của NHÓM phiên (`tbl_user_group` WHERE id = tbl_user.gid AND isactive=1)
// Xét `gid` PHIÊN của người dùng, KHÔNG xét vai IAM ánh xạ gid (khoá ở test/approval/self-approve.spec.ts).
import { isSuperAdmin } from './super-admin';

type Db = {
  user: { findUnique: (args: any) => Promise<{ isSuperAdmin: boolean; gid: number | null } | null> };
  legacyGroup: { findUnique: (args: any) => Promise<{ isAccountant: boolean; isActive: boolean } | null> };
};

export async function laSuperAdminHoacKeToan(db: Db, where: { id: number } | { username: string }): Promise<boolean> {
  const u = await db.user.findUnique({ where, select: { isSuperAdmin: true, gid: true } });
  if (!u) return false;
  if (isSuperAdmin(u)) return true;
  if (!u.gid || u.gid <= 0) return false;
  const g = await db.legacyGroup.findUnique({ where: { id: u.gid }, select: { isAccountant: true, isActive: true } });
  return !!g && g.isActive && g.isAccountant;
}
