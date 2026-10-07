// Cờ canonical mới; migration đã gộp (gid==1 OR group.isadmin==1 OR user.isroot==1) -> isSuperAdmin.
export function isSuperAdmin(user: { isSuperAdmin?: boolean } | null | undefined): boolean {
  return !!user?.isSuperAdmin;
}
