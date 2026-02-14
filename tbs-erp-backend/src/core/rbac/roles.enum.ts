import { UserRole, Branch } from '@prisma/client';

// Re-export UserRole and Branch from Prisma so modules don't need to import @prisma/client directly
export { UserRole, Branch };

/** Roles with full system access */
export const EXECUTIVE_ROLES: UserRole[] = [UserRole.CEO, UserRole.COO];

/** Sales-related roles in hierarchical order (highest first) */
export const SALES_ROLES: UserRole[] = [
  UserRole.SALES_DIRECTOR,
  UserRole.SALES_LEADER,
  UserRole.SALE,
];

/** Finance-related roles */
export const FINANCE_ROLES: UserRole[] = [
  UserRole.CHIEF_ACCOUNTANT,
  UserRole.ACCOUNTANT_AR,
  UserRole.ACCOUNTANT_COST,
];

/** Warehouse-related roles */
export const WAREHOUSE_ROLES: UserRole[] = [
  UserRole.WAREHOUSE_CN_AGENT,
  UserRole.WAREHOUSE_VN_MANAGER,
  UserRole.WAREHOUSE_VN_STAFF,
];

/** XNK (import-export) roles */
export const XNK_ROLES: UserRole[] = [
  UserRole.XNK_MANAGER,
  UserRole.XNK_STAFF,
];

/** Logistics/driver roles */
export const LOGISTICS_ROLES: UserRole[] = [UserRole.DRIVER];

/** Marketing-related roles */
export const MARKETING_ROLES: UserRole[] = [
  UserRole.MARKETING_STAFF,
  UserRole.CSKH,
];

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
    [UserRole.CEO]: 'Tong Giam doc',
    [UserRole.COO]: 'Giam doc Dieu hanh',
    [UserRole.SALES_DIRECTOR]: 'Giam doc Kinh doanh',
    [UserRole.SALES_LEADER]: 'Leader Kinh doanh',
    [UserRole.SALE]: 'Nhan vien Kinh doanh',
    [UserRole.MARKETING_STAFF]: 'Nhan vien Marketing',
    [UserRole.CSKH]: 'Nhan vien CSKH',
    [UserRole.CHIEF_ACCOUNTANT]: 'Ke toan Truong',
    [UserRole.ACCOUNTANT_AR]: 'Ke toan Thanh toan',
    [UserRole.ACCOUNTANT_COST]: 'Ke toan Chi phi',
    [UserRole.XNK_MANAGER]: 'Truong phong XNK',
    [UserRole.XNK_STAFF]: 'Nhan vien XNK',
    [UserRole.WAREHOUSE_CN_AGENT]: 'Agent kho TQ',
    [UserRole.WAREHOUSE_VN_MANAGER]: 'Truong kho VN',
    [UserRole.WAREHOUSE_VN_STAFF]: 'Nhan vien kho VN',
    [UserRole.DRIVER]: 'Tai xe',
  };
  return labels[role] || role;
}
