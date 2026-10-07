import { User } from '@prisma/client';

// ⚠ User.password (hash bcrypt đăng nhập nội bộ) và User.gsecret (khoá TOTP
// 2FA, `tbl_user.gsecret`) KHÔNG BAO GIỜ được đi ra ngoài. ALLOW-LIST như
// customer.dto.ts — cột mới thêm vào model mặc định bị GIỮ LẠI, không rò.
export const USER_DTO_KEYS = [
  'id', 'username', 'firstname', 'lastname', 'email', 'gid', 'phongbanId',
  'leaderId', 'jobTitleId', 'isSuperAdmin', 'isActive', 'lastLogin',
] as const;

export interface UserDto {
  id: number;
  username: string;
  firstname: string | null;
  lastname: string | null;
  email: string | null;
  gid: number | null;
  phongbanId: number | null;
  leaderId: number | null;
  jobTitleId: number | null;
  isSuperAdmin: boolean;
  isActive: boolean;
  lastLogin: Date | null;
}

export function toUserDto(row: User | null | undefined): UserDto | null {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    firstname: row.firstname,
    lastname: row.lastname,
    email: row.email,
    gid: row.gid,
    phongbanId: row.phongbanId,
    leaderId: row.leaderId,
    jobTitleId: row.jobTitleId,
    isSuperAdmin: row.isSuperAdmin,
    isActive: row.isActive,
    lastLogin: row.lastLogin,
  };
}
