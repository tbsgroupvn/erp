import { UserRole, Branch } from '@prisma/client';

// Re-export UserRole and Branch from Prisma so modules don't need to import @prisma/client directly
export { UserRole, Branch };

/** Roles with full system access */
export const EXECUTIVE_ROLES: UserRole[] = [
  UserRole.CEO,
  UserRole.COO,
  UserRole.DIRECTOR_OPERATIONS,
  UserRole.CFO,
];

/** Sales-related roles in hierarchical order (highest first) */
export const SALES_ROLES: UserRole[] = [
  UserRole.SALES_DIRECTOR,
  UserRole.SALES_LEADER,
  UserRole.SALE,
  UserRole.HR_MANAGER,
];

/** Finance-related roles */
export const FINANCE_ROLES: UserRole[] = [
  UserRole.CHIEF_ACCOUNTANT,
  UserRole.ACCOUNTANT,
  UserRole.ACCOUNTANT_AR,
  UserRole.ACCOUNTANT_COST,
];

/** Warehouse-related roles */
export const WAREHOUSE_ROLES: UserRole[] = [
  UserRole.WAREHOUSE_MANAGER,
  UserRole.WAREHOUSE_CN_AGENT,
  UserRole.WAREHOUSE_VN_MANAGER,
  UserRole.WAREHOUSE_VN_STAFF,
];

/** XNK (import-export) roles */
export const XNK_ROLES: UserRole[] = [UserRole.XNK_MANAGER, UserRole.XNK_STAFF];

/** Logistics/driver roles */
export const LOGISTICS_ROLES: UserRole[] = [UserRole.LOGISTICS_MANAGER, UserRole.DRIVER];

/** Marketing-related roles */
export const MARKETING_ROLES: UserRole[] = [UserRole.MARKETING_STAFF, UserRole.CSKH];

/** All 22 roles -- use @Roles(...ALL_ROLES) for endpoints accessible to any authenticated user */
export const ALL_ROLES: UserRole[] = Object.values(UserRole);

/**
 * Check if a role has executive-level access (CEO/COO).
 */
export function isExecutive(role: UserRole): boolean {
  return EXECUTIVE_ROLES.includes(role);
}

/**
 * Check if a role belongs to the sales department.
 */
export function isSalesRole(role: UserRole): boolean {
  return SALES_ROLES.includes(role);
}

/**
 * Check if a role belongs to the finance department.
 */
export function isFinanceRole(role: UserRole): boolean {
  return FINANCE_ROLES.includes(role);
}

/**
 * Check if a role belongs to warehouse operations.
 */
export function isWarehouseRole(role: UserRole): boolean {
  return WAREHOUSE_ROLES.includes(role);
}

/**
 * Check if a role belongs to the XNK (import-export) department.
 */
export function isXnkRole(role: UserRole): boolean {
  return XNK_ROLES.includes(role);
}

/**
 * Get a human-readable label for a role (Vietnamese).
 */
export function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    [UserRole.CEO]: 'Tổng Giám đốc',
    [UserRole.COO]: 'Giám đốc Điều hành',
    [UserRole.SALES_DIRECTOR]: 'Giám đốc Kinh doanh',
    [UserRole.SALES_LEADER]: 'Trưởng nhóm Kinh doanh',
    [UserRole.SALE]: 'Nhân viên Kinh doanh',
    [UserRole.MARKETING_STAFF]: 'Nhân viên Marketing',
    [UserRole.CSKH]: 'Chăm sóc Khách hàng',
    [UserRole.CHIEF_ACCOUNTANT]: 'Kế toán Trưởng',
    [UserRole.ACCOUNTANT_AR]: 'Kế toán Thanh toán',
    [UserRole.ACCOUNTANT_COST]: 'Kế toán Chi phí',
    [UserRole.XNK_MANAGER]: 'Trưởng phòng XNK',
    [UserRole.XNK_STAFF]: 'Nhân viên XNK',
    [UserRole.WAREHOUSE_CN_AGENT]: 'Agent kho Trung Quốc',
    [UserRole.DIRECTOR_OPERATIONS]: 'Giám đốc Vận hành',
    [UserRole.CFO]: 'Giám đốc Tài chính',
    [UserRole.HR_MANAGER]: 'Trưởng phòng Nhân sự',
    [UserRole.LOGISTICS_MANAGER]: 'Trưởng phòng Vận hành',
    [UserRole.ACCOUNTANT]: 'Kế toán viên',
    [UserRole.WAREHOUSE_MANAGER]: 'Trưởng phòng Kho',
    [UserRole.WAREHOUSE_VN_MANAGER]: 'Trưởng kho Việt Nam',
    [UserRole.WAREHOUSE_VN_STAFF]: 'Nhân viên kho Việt Nam',
    [UserRole.DRIVER]: 'Tài xế',
  };
  return labels[role] || role;
}
