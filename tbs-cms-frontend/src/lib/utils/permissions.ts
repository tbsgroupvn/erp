import { UserRole } from '@/lib/types/enums';
import { USER_ROLE_LABELS } from './constants';

// ============================================
// ROLE LABELS (alias for USER_ROLE_LABELS)
// ============================================
export const ROLE_LABELS: Record<UserRole, string> = USER_ROLE_LABELS;

// ============================================
// ROLE GROUPS
// ============================================
export const BOD_ROLES: UserRole[] = [UserRole.CEO, UserRole.COO];

export const SALES_ROLES: UserRole[] = [
  UserRole.SALES_DIRECTOR,
  UserRole.SALES_LEADER,
  UserRole.SALE,
  UserRole.MARKETING_STAFF,
  UserRole.CSKH,
];

export const FINANCE_ROLES: UserRole[] = [
  UserRole.CHIEF_ACCOUNTANT,
  UserRole.ACCOUNTANT_AR,
  UserRole.ACCOUNTANT_COST,
];

export const WAREHOUSE_ROLES: UserRole[] = [
  UserRole.XNK_MANAGER,
  UserRole.XNK_STAFF,
  UserRole.WAREHOUSE_CN_AGENT,
  UserRole.WAREHOUSE_VN_MANAGER,
  UserRole.WAREHOUSE_VN_STAFF,
];

// ============================================
// ROLE-BASED MENU ACCESS
// ============================================

/**
 * Maps each UserRole to the set of route prefixes it may access.
 * Used by `canAccessRoute` to gate navigation.
 */

/** All routes available in the application. */
const ALL_ROUTES = [
  '/dashboard',
  '/tong-quan',
  '/don-hang',
  '/bao-gia',
  '/khach-hang',
  '/tai-chinh',
  '/kho',
  '/kho-trung-quoc',
  '/kho-viet-nam',
  '/container',
  '/giao-hang',
  '/theo-doi',
  '/phuong-tien',
  '/tai-xe',
  '/mua-hang',
  '/nha-cung-cap',
  '/kho-vat-tu',
  '/nhan-su',
  '/luong',
  '/cong-viec',
  '/khieu-nai',
  '/tai-lieu',
  '/phe-duyet',
  '/duyet',
  '/bao-cao',
  '/hoa-hong',
  '/cham-cong',
  '/thong-bao',
  '/uy-quyen',
  '/quan-ly-user',
  '/cai-dat',
];

export const ROLE_MENU_ACCESS: Record<UserRole, string[]> = {
  // Board of Directors -- full access
  [UserRole.CEO]: [...ALL_ROUTES],
  [UserRole.COO]: [...ALL_ROUTES],

  // Sales team
  [UserRole.SALES_DIRECTOR]: [
    '/dashboard',
    '/tong-quan',
    '/don-hang',
    '/bao-gia',
    '/khach-hang',
    '/khieu-nai',
    '/cong-viec',
    '/duyet',
    '/phe-duyet',
    '/bao-cao',
    '/hoa-hong',
    '/cham-cong',
    '/thong-bao',
    '/uy-quyen',
  ],
  [UserRole.SALES_LEADER]: [
    '/dashboard',
    '/tong-quan',
    '/don-hang',
    '/bao-gia',
    '/khach-hang',
    '/khieu-nai',
    '/cong-viec',
    '/duyet',
    '/phe-duyet',
    '/cham-cong',
    '/thong-bao',
    '/uy-quyen',
  ],
  [UserRole.SALE]: [
    '/dashboard',
    '/tong-quan',
    '/don-hang',
    '/bao-gia',
    '/khach-hang',
    '/khieu-nai',
    '/cong-viec',
    '/cham-cong',
    '/thong-bao',
  ],
  [UserRole.MARKETING_STAFF]: [
    '/dashboard',
    '/tong-quan',
    '/khach-hang',
    '/cong-viec',
    '/bao-cao',
    '/cham-cong',
    '/thong-bao',
  ],
  [UserRole.CSKH]: [
    '/dashboard',
    '/tong-quan',
    '/don-hang',
    '/khach-hang',
    '/khieu-nai',
    '/cong-viec',
    '/cham-cong',
    '/thong-bao',
  ],

  // Accounting / Finance
  [UserRole.CHIEF_ACCOUNTANT]: [
    '/dashboard',
    '/tong-quan',
    '/don-hang',
    '/tai-chinh',
    '/mua-hang',
    '/nha-cung-cap',
    '/kho-vat-tu',
    '/luong',
    '/hoa-hong',
    '/cong-viec',
    '/duyet',
    '/phe-duyet',
    '/bao-cao',
    '/cham-cong',
    '/thong-bao',
    '/uy-quyen',
  ],
  [UserRole.ACCOUNTANT_AR]: [
    '/dashboard',
    '/tong-quan',
    '/don-hang',
    '/tai-chinh',
    '/mua-hang',
    '/nha-cung-cap',
    '/cong-viec',
    '/cham-cong',
    '/thong-bao',
  ],
  [UserRole.ACCOUNTANT_COST]: [
    '/dashboard',
    '/tong-quan',
    '/don-hang',
    '/tai-chinh',
    '/mua-hang',
    '/nha-cung-cap',
    '/cong-viec',
    '/cham-cong',
    '/thong-bao',
  ],

  // Import / Export
  [UserRole.XNK_MANAGER]: [
    '/dashboard',
    '/tong-quan',
    '/don-hang',
    '/container',
    '/kho',
    '/kho-trung-quoc',
    '/kho-viet-nam',
    '/theo-doi',
    '/cong-viec',
    '/duyet',
    '/phe-duyet',
    '/bao-cao',
    '/cham-cong',
    '/thong-bao',
    '/uy-quyen',
  ],
  [UserRole.XNK_STAFF]: [
    '/dashboard',
    '/tong-quan',
    '/don-hang',
    '/container',
    '/kho',
    '/kho-trung-quoc',
    '/kho-viet-nam',
    '/theo-doi',
    '/cong-viec',
    '/cham-cong',
    '/thong-bao',
  ],

  // Warehouse
  [UserRole.WAREHOUSE_CN_AGENT]: [
    '/dashboard',
    '/tong-quan',
    '/kho',
    '/kho-trung-quoc',
    '/container',
    '/theo-doi',
    '/phuong-tien',
    '/tai-xe',
    '/cong-viec',
    '/cham-cong',
    '/thong-bao',
  ],
  [UserRole.WAREHOUSE_VN_MANAGER]: [
    '/dashboard',
    '/tong-quan',
    '/kho',
    '/kho-viet-nam',
    '/container',
    '/giao-hang',
    '/theo-doi',
    '/phuong-tien',
    '/tai-xe',
    '/cong-viec',
    '/duyet',
    '/phe-duyet',
    '/cham-cong',
    '/thong-bao',
    '/uy-quyen',
  ],
  [UserRole.WAREHOUSE_VN_STAFF]: [
    '/dashboard',
    '/tong-quan',
    '/kho',
    '/kho-viet-nam',
    '/giao-hang',
    '/theo-doi',
    '/cong-viec',
    '/cham-cong',
    '/thong-bao',
  ],

  // Driver
  [UserRole.DRIVER]: [
    '/dashboard',
    '/tong-quan',
    '/giao-hang',
    '/cong-viec',
    '/cham-cong',
    '/thong-bao',
  ],
};

// ============================================
// SIDEBAR NAVIGATION STRUCTURE
// ============================================

export interface NavItem {
  title: string;
  href: string;
  icon: string; // lucide icon name
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Tổng quan',
    items: [
      { title: 'Tổng quan', href: '/tong-quan', icon: 'LayoutDashboard' },
    ],
  },
  {
    label: 'Kinh doanh',
    items: [
      { title: 'Đơn hàng', href: '/don-hang', icon: 'ShoppingCart' },
      { title: 'Báo giá', href: '/bao-gia', icon: 'FileText' },
      { title: 'Khách hàng', href: '/khach-hang', icon: 'Users' },
    ],
  },
  {
    label: 'Kho vận',
    items: [
      { title: 'Kho Trung Quốc', href: '/kho-trung-quoc', icon: 'Warehouse' },
      { title: 'Container', href: '/container', icon: 'Box' },
      { title: 'Kho Việt Nam', href: '/kho-viet-nam', icon: 'Ship' },
      { title: 'Theo dõi', href: '/theo-doi', icon: 'MapPin' },
    ],
  },
  {
    label: 'Vận tải',
    items: [
      { title: 'Giao hàng', href: '/giao-hang', icon: 'PackageCheck' },
      { title: 'Phương tiện', href: '/phuong-tien', icon: 'Truck' },
      { title: 'Tài xế', href: '/tai-xe', icon: 'User' },
    ],
  },
  {
    label: 'Tài chính',
    items: [
      { title: 'Công nợ phải thu', href: '/tai-chinh/cong-no-phai-thu', icon: 'DollarSign' },
      { title: 'Công nợ phải trả', href: '/tai-chinh/cong-no-phai-tra', icon: 'Receipt' },
      { title: 'Phiếu thu chi', href: '/tai-chinh/phieu-thu-chi', icon: 'FileText' },
      { title: 'Hóa đơn', href: '/tai-chinh/hoa-don', icon: 'FileText' },
      { title: 'Tỷ giá', href: '/tai-chinh/ty-gia', icon: 'ArrowLeftRight' },
      { title: 'Bù trừ công nợ', href: '/tai-chinh/bu-tru-cong-no', icon: 'Scale' },
      { title: 'Mua hàng', href: '/mua-hang', icon: 'ShoppingBag' },
    ],
  },
  {
    label: 'Mua hàng & Kho',
    items: [
      { title: 'Nhà cung cấp', href: '/nha-cung-cap', icon: 'Building' },
      { title: 'Kho vật tư', href: '/kho-vat-tu', icon: 'Package' },
    ],
  },
  {
    label: 'Nhân sự',
    items: [
      { title: 'Nhân sự', href: '/nhan-su', icon: 'UserCheck' },
      { title: 'Chấm công', href: '/cham-cong', icon: 'Clock' },
      { title: 'Bảng lương', href: '/luong', icon: 'Banknote' },
      { title: 'Hoa hồng', href: '/hoa-hong', icon: 'Gem' },
    ],
  },
  {
    label: 'Báo cáo',
    items: [
      { title: 'Báo cáo doanh số', href: '/bao-cao/doanh-so', icon: 'BarChart3' },
      { title: 'Báo cáo tài chính', href: '/bao-cao/tai-chinh', icon: 'PieChart' },
    ],
  },
  {
    label: 'Hệ thống',
    items: [
      { title: 'Công việc', href: '/cong-viec', icon: 'ListTodo' },
      { title: 'Khiếu nại', href: '/khieu-nai', icon: 'AlertCircle' },
      { title: 'Tài liệu', href: '/tai-lieu', icon: 'FolderOpen' },
      { title: 'Thông báo', href: '/thong-bao', icon: 'Bell' },
      { title: 'Phê duyệt', href: '/phe-duyet', icon: 'CheckCircle' },
      { title: 'Ủy quyền', href: '/uy-quyen', icon: 'UserCog' },
      { title: 'Quản lý user', href: '/quan-ly-user', icon: 'Shield' },
      { title: 'Cài đặt', href: '/cai-dat', icon: 'Settings' },
    ],
  },
];

// ============================================
// ACCESS HELPERS
// ============================================

/**
 * Check whether the given role is allowed to access a route path.
 *
 * @param role  The user's role
 * @param path  The current route path (e.g. "/don-hang/abc123")
 * @returns true if the role has access
 */
export function canAccessRoute(role: UserRole, path: string): boolean {
  const allowedPrefixes = ROLE_MENU_ACCESS[role];
  if (!allowedPrefixes) return false;
  return allowedPrefixes.some((prefix) => path.startsWith(prefix));
}

/**
 * Dashboard type by role -- determines which dashboard widgets to show.
 */
export type DashboardType =
  | 'executive'
  | 'sales'
  | 'finance'
  | 'warehouse'
  | 'logistics'
  | 'operations'
  | 'hr'
  | 'cskh';

export function getDashboardType(role: UserRole): DashboardType {
  switch (role) {
    case UserRole.CEO:
    case UserRole.COO:
      return 'executive';

    case UserRole.SALES_DIRECTOR:
    case UserRole.SALES_LEADER:
    case UserRole.SALE:
    case UserRole.MARKETING_STAFF:
      return 'sales';

    case UserRole.CSKH:
      return 'cskh';

    case UserRole.CHIEF_ACCOUNTANT:
    case UserRole.ACCOUNTANT_AR:
    case UserRole.ACCOUNTANT_COST:
      return 'finance';

    case UserRole.WAREHOUSE_CN_AGENT:
    case UserRole.WAREHOUSE_VN_MANAGER:
    case UserRole.WAREHOUSE_VN_STAFF:
      return 'warehouse';

    case UserRole.DRIVER:
      return 'logistics';

    case UserRole.XNK_MANAGER:
    case UserRole.XNK_STAFF:
      return 'operations';

    default:
      return 'sales';
  }
}
