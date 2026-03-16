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
  '/hop-dong',
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
  '/so-cai',
  '/kiem-tra-chat-luong',
  '/tai-san',
  '/ngan-sach',
  '/chi-phi-van-hanh',
  '/nghi-phep',
  '/hoa-don',
  '/thong-quan',
  '/tro-chuyen',
  '/lich',
  '/bang-tin',
  '/okr',
  '/wiki',
  '/video',
  '/ai-assistant',
  '/ai-chat',
  '/automation',
  '/bao-cao/tong-hop',
  '/kho-trung-quoc/slotting',
  '/tai-chinh/bao-cao-vas',
  '/tai-chinh/doi-chieu',
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
    '/hop-dong',
    '/khach-hang',
    '/khieu-nai',
    '/cong-viec',
    '/duyet',
    '/phe-duyet',
    '/bao-cao',
    '/hoa-hong',
    '/cham-cong',
    '/nghi-phep',
    '/thong-bao',
    '/uy-quyen',
    '/tro-chuyen',
    '/lich',
    '/bang-tin',
    '/tai-lieu',
    '/okr',
    '/wiki',
    '/video',
    '/ai-assistant',
    '/ai-chat',
    '/automation',
  ],
  [UserRole.SALES_LEADER]: [
    '/dashboard',
    '/tong-quan',
    '/don-hang',
    '/bao-gia',
    '/hop-dong',
    '/khach-hang',
    '/khieu-nai',
    '/cong-viec',
    '/duyet',
    '/phe-duyet',
    '/cham-cong',
    '/thong-bao',
    '/uy-quyen',
    '/tro-chuyen',
    '/lich',
    '/bang-tin',
    '/tai-lieu',
    '/okr',
    '/wiki',
    '/video',
    '/ai-assistant',
    '/ai-chat',
    '/automation',
  ],
  [UserRole.SALE]: [
    '/dashboard',
    '/tong-quan',
    '/don-hang',
    '/bao-gia',
    '/hop-dong',
    '/khach-hang',
    '/khieu-nai',
    '/cong-viec',
    '/cham-cong',
    '/thong-bao',
    '/tro-chuyen',
    '/lich',
    '/bang-tin',
    '/tai-lieu',
    '/ai-assistant',
    '/ai-chat',
  ],
  [UserRole.MARKETING_STAFF]: [
    '/dashboard',
    '/tong-quan',
    '/khach-hang',
    '/cong-viec',
    '/bao-cao',
    '/cham-cong',
    '/thong-bao',
    '/tro-chuyen',
    '/lich',
    '/bang-tin',
    '/tai-lieu',
    '/ai-assistant',
    '/ai-chat',
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
    '/tro-chuyen',
    '/lich',
    '/bang-tin',
    '/tai-lieu',
    '/ai-assistant',
    '/ai-chat',
  ],

  // Accounting / Finance
  [UserRole.CHIEF_ACCOUNTANT]: [
    '/dashboard',
    '/tong-quan',
    '/don-hang',
    '/tai-chinh',
    '/tai-chinh/bao-cao-vas',
    '/tai-chinh/doi-chieu',
    '/so-cai',
    '/tai-san',
    '/ngan-sach',
    '/hoa-don',
    '/thong-quan',
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
    '/tro-chuyen',
    '/lich',
    '/bang-tin',
    '/tai-lieu',
    '/okr',
    '/wiki',
    '/video',
    '/ai-assistant',
    '/ai-chat',
    '/automation',
  ],
  [UserRole.ACCOUNTANT_AR]: [
    '/dashboard',
    '/tong-quan',
    '/don-hang',
    '/tai-chinh',
    '/tai-chinh/bao-cao-vas',
    '/tai-chinh/doi-chieu',
    '/so-cai',
    '/hoa-don',
    '/mua-hang',
    '/nha-cung-cap',
    '/cong-viec',
    '/cham-cong',
    '/thong-bao',
    '/tro-chuyen',
    '/lich',
    '/bang-tin',
    '/tai-lieu',
    '/ai-assistant',
    '/ai-chat',
  ],
  [UserRole.ACCOUNTANT_COST]: [
    '/dashboard',
    '/tong-quan',
    '/don-hang',
    '/tai-chinh',
    '/so-cai',
    '/chi-phi-van-hanh',
    '/hoa-don',
    '/mua-hang',
    '/nha-cung-cap',
    '/cong-viec',
    '/cham-cong',
    '/thong-bao',
    '/tro-chuyen',
    '/lich',
    '/bang-tin',
    '/tai-lieu',
    '/ai-assistant',
    '/ai-chat',
  ],

  // Import / Export
  [UserRole.XNK_MANAGER]: [
    '/dashboard',
    '/tong-quan',
    '/don-hang',
    '/container',
    '/kho',
    '/kho-trung-quoc',
    '/kho-trung-quoc/slotting',
    '/kho-viet-nam',
    '/thong-quan',
    '/theo-doi',
    '/kiem-tra-chat-luong',
    '/chi-phi-van-hanh',
    '/cong-viec',
    '/duyet',
    '/phe-duyet',
    '/bao-cao',
    '/cham-cong',
    '/thong-bao',
    '/uy-quyen',
    '/tro-chuyen',
    '/lich',
    '/bang-tin',
    '/tai-lieu',
    '/okr',
    '/wiki',
    '/video',
    '/ai-assistant',
    '/ai-chat',
    '/automation',
  ],
  [UserRole.XNK_STAFF]: [
    '/dashboard',
    '/tong-quan',
    '/don-hang',
    '/container',
    '/kho',
    '/kho-trung-quoc',
    '/kho-trung-quoc/slotting',
    '/kho-viet-nam',
    '/thong-quan',
    '/theo-doi',
    '/kiem-tra-chat-luong',
    '/chi-phi-van-hanh',
    '/cong-viec',
    '/cham-cong',
    '/thong-bao',
    '/tro-chuyen',
    '/lich',
    '/bang-tin',
    '/tai-lieu',
    '/ai-assistant',
    '/ai-chat',
  ],

  // Warehouse
  [UserRole.WAREHOUSE_CN_AGENT]: [
    '/dashboard',
    '/tong-quan',
    '/kho',
    '/kho-trung-quoc',
    '/kho-trung-quoc/slotting',
    '/container',
    '/theo-doi',
    '/kiem-tra-chat-luong',
    '/phuong-tien',
    '/tai-xe',
    '/cong-viec',
    '/cham-cong',
    '/thong-bao',
    '/tro-chuyen',
    '/lich',
    '/bang-tin',
    '/tai-lieu',
  ],
  [UserRole.WAREHOUSE_VN_MANAGER]: [
    '/dashboard',
    '/tong-quan',
    '/kho',
    '/kho-viet-nam',
    '/container',
    '/giao-hang',
    '/theo-doi',
    '/kiem-tra-chat-luong',
    '/phuong-tien',
    '/tai-xe',
    '/cong-viec',
    '/duyet',
    '/phe-duyet',
    '/cham-cong',
    '/nghi-phep',
    '/thong-bao',
    '/uy-quyen',
    '/tro-chuyen',
    '/lich',
    '/bang-tin',
    '/tai-lieu',
    '/okr',
    '/wiki',
    '/video',
    '/ai-assistant',
    '/ai-chat',
    '/automation',
  ],
  [UserRole.WAREHOUSE_VN_STAFF]: [
    '/dashboard',
    '/tong-quan',
    '/kho',
    '/kho-viet-nam',
    '/container',
    '/giao-hang',
    '/theo-doi',
    '/cong-viec',
    '/cham-cong',
    '/thong-bao',
    '/tro-chuyen',
    '/lich',
    '/bang-tin',
    '/tai-lieu',
  ],

  // CFO
  [UserRole.CFO]: [...ALL_ROUTES],

  // Director Operations
  [UserRole.DIRECTOR_OPERATIONS]: [...ALL_ROUTES],

  // HR Manager
  [UserRole.HR_MANAGER]: [
    '/dashboard', '/tong-quan',
    '/nhan-su', '/cham-cong', '/nghi-phep', '/luong',
    '/cong-viec', '/phe-duyet', '/duyet', '/thong-bao', '/uy-quyen',
    '/bao-cao', '/tro-chuyen', '/lich', '/bang-tin', '/tai-lieu',
    '/okr',
    '/wiki',
    '/video',
    '/ai-assistant',
    '/ai-chat',
    '/automation',
  ],

  // Accountant (general)
  [UserRole.ACCOUNTANT]: [
    '/dashboard', '/tong-quan',
    '/tai-chinh', '/so-cai', '/hoa-don', '/mua-hang', '/nha-cung-cap',
    '/cong-viec', '/cham-cong', '/thong-bao',
    '/tro-chuyen', '/lich', '/bang-tin', '/tai-lieu',
    '/ai-assistant', '/ai-chat',
  ],

  // Logistics Manager
  [UserRole.LOGISTICS_MANAGER]: [
    '/dashboard', '/tong-quan',
    '/don-hang', '/container', '/kho', '/kho-trung-quoc', '/kho-viet-nam',
    '/thong-quan', '/theo-doi', '/giao-hang',
    '/phuong-tien', '/tai-xe', '/chi-phi-van-hanh',
    '/cong-viec', '/phe-duyet', '/duyet', '/thong-bao', '/uy-quyen',
    '/bao-cao', '/tro-chuyen', '/lich', '/bang-tin', '/tai-lieu',
    '/okr',
    '/wiki',
    '/video',
    '/ai-assistant',
    '/ai-chat',
    '/automation',
  ],

  // Warehouse Manager
  [UserRole.WAREHOUSE_MANAGER]: [
    '/dashboard', '/tong-quan',
    '/kho', '/kho-trung-quoc', '/kho-trung-quoc/slotting', '/kho-viet-nam', '/container',
    '/giao-hang', '/theo-doi', '/kiem-tra-chat-luong',
    '/phuong-tien', '/tai-xe',
    '/cong-viec', '/phe-duyet', '/duyet', '/thong-bao', '/uy-quyen',
    '/tro-chuyen', '/lich', '/bang-tin', '/tai-lieu',
    '/okr',
    '/wiki',
    '/video',
    '/ai-assistant',
    '/ai-chat',
    '/automation',
  ],

  // Driver — minimal menu
  [UserRole.DRIVER]: [
    '/dashboard',
    '/tong-quan',
    '/giao-hang',
    '/cong-viec',
    '/cham-cong',
    '/thong-bao',
    '/tro-chuyen',
    '/lich',
    '/bang-tin',
  ],
};

// ============================================
// SIDEBAR NAVIGATION STRUCTURE
// ============================================

export interface NavItem {
  title: string;
  href: string;
  icon: string; // lucide icon name
  /** If set, this item is rendered as a tab inside the parent page (hidden from sidebar). */
  tabOf?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  // ── 1. Tổng quan ──────────────────────────────
  {
    label: 'Tổng quan',
    items: [
      { title: 'Tổng quan', href: '/tong-quan', icon: 'LayoutDashboard' },
      { title: 'Báo cáo', href: '/bao-cao', icon: 'BarChart3' },
      // Sub-reports → tabs inside /bao-cao
      { title: 'Báo cáo doanh số', href: '/bao-cao/doanh-so', icon: 'BarChart3', tabOf: '/bao-cao' },
      { title: 'Báo cáo tài chính', href: '/bao-cao/tai-chinh', icon: 'PieChart', tabOf: '/bao-cao' },
      { title: 'Xuất báo cáo', href: '/bao-cao/tong-hop', icon: 'Download', tabOf: '/bao-cao' },
    ],
  },
  // ── 2. Kinh doanh ─────────────────────────────
  {
    label: 'Kinh doanh',
    items: [
      { title: 'Khách hàng', href: '/khach-hang', icon: 'Users' },
      { title: 'Báo giá', href: '/bao-gia', icon: 'FileText' },
      { title: 'Đơn hàng', href: '/don-hang', icon: 'ShoppingCart' },
      { title: 'Hợp đồng', href: '/hop-dong', icon: 'FileText' },
      { title: 'Khiếu nại', href: '/khieu-nai', icon: 'AlertCircle' },
    ],
  },
  // ── 3. Vận hành (Kho + XNK + Logistics) ───────
  {
    label: 'Vận hành',
    items: [
      { title: 'Kho Trung Quốc', href: '/kho-trung-quoc', icon: 'Warehouse' },
      { title: 'Container', href: '/container', icon: 'Box' },
      { title: 'Thông quan', href: '/thong-quan', icon: 'Shield' },
      { title: 'Kho Việt Nam', href: '/kho-viet-nam', icon: 'Ship' },
      { title: 'Giao hàng', href: '/giao-hang', icon: 'PackageCheck' },
      { title: 'Phương tiện', href: '/phuong-tien', icon: 'Truck' },
      // Absorbed as tabs
      { title: 'Sơ đồ kho', href: '/kho-trung-quoc/slotting', icon: 'LayoutGrid', tabOf: '/kho-trung-quoc' },
      { title: 'Kiểm tra CL', href: '/kiem-tra-chat-luong', icon: 'ShieldCheck', tabOf: '/kho-viet-nam' },
      { title: 'Chi phí vận hành', href: '/chi-phi-van-hanh', icon: 'Calculator', tabOf: '/container' },
      { title: 'Theo dõi', href: '/theo-doi', icon: 'MapPin', tabOf: '/container' },
      { title: 'Tài xế', href: '/tai-xe', icon: 'User', tabOf: '/phuong-tien' },
    ],
  },
  // ── 4. Tài chính (Kế toán + Mua sắm) ─────────
  {
    label: 'Tài chính',
    items: [
      { title: 'Công nợ', href: '/tai-chinh/cong-no-phai-thu', icon: 'DollarSign' },
      { title: 'Phiếu thu chi', href: '/tai-chinh/phieu-thu-chi', icon: 'FileText' },
      { title: 'Sổ cái', href: '/so-cai', icon: 'BookOpen' },
      { title: 'Mua hàng', href: '/mua-hang', icon: 'ShoppingBag' },
      // Absorbed as tabs of Công nợ
      { title: 'Công nợ phải trả', href: '/tai-chinh/cong-no-phai-tra', icon: 'Receipt', tabOf: '/tai-chinh/cong-no-phai-thu' },
      { title: 'Hóa đơn', href: '/tai-chinh/hoa-don', icon: 'FileText', tabOf: '/tai-chinh/cong-no-phai-thu' },
      { title: 'Hoa hồng', href: '/hoa-hong', icon: 'Gem', tabOf: '/tai-chinh/cong-no-phai-thu' },
      { title: 'Đối chiếu NH', href: '/tai-chinh/doi-chieu', icon: 'ArrowLeftRight', tabOf: '/tai-chinh/cong-no-phai-thu' },
      { title: 'Bù trừ công nợ', href: '/tai-chinh/bu-tru-cong-no', icon: 'Scale', tabOf: '/tai-chinh/cong-no-phai-thu' },
      { title: 'Chưa phân bổ', href: '/tai-chinh/chua-phan-bo', icon: 'HelpCircle', tabOf: '/tai-chinh/cong-no-phai-thu' },
      // Absorbed as tabs of Sổ cái
      { title: 'Báo cáo VAS', href: '/tai-chinh/bao-cao-vas', icon: 'FileText', tabOf: '/so-cai' },
      { title: 'Tỷ giá', href: '/tai-chinh/ty-gia', icon: 'ArrowLeftRight', tabOf: '/so-cai' },
      { title: 'Tài sản', href: '/tai-san', icon: 'Building2', tabOf: '/so-cai' },
      { title: 'Ngân sách', href: '/ngan-sach', icon: 'PiggyBank', tabOf: '/so-cai' },
      // Absorbed as tabs of Mua hàng
      { title: 'Nhà cung cấp', href: '/nha-cung-cap', icon: 'Building', tabOf: '/mua-hang' },
      { title: 'Kho vật tư', href: '/kho-vat-tu', icon: 'Package', tabOf: '/mua-hang' },
    ],
  },
  // ── 5. Nhân sự ─────────────────────────────────
  {
    label: 'Nhân sự',
    items: [
      { title: 'Nhân sự', href: '/nhan-su', icon: 'UserCheck' },
      { title: 'Chấm công', href: '/cham-cong', icon: 'Clock' },
      { title: 'Bảng lương', href: '/luong', icon: 'Banknote' },
      // Absorbed as tab of Chấm công
      { title: 'Nghỉ phép', href: '/nghi-phep', icon: 'Calendar', tabOf: '/cham-cong' },
    ],
  },
  // ── 6. Workplace ───────────────────────────────
  {
    label: 'Workplace',
    items: [
      { title: 'Trò chuyện', href: '/tro-chuyen', icon: 'MessageSquare' },
      { title: 'Công việc', href: '/cong-viec', icon: 'ListTodo' },
      { title: 'Tài liệu', href: '/tai-lieu', icon: 'FolderOpen' },
      { title: 'Công cụ AI', href: '/ai-assistant', icon: 'Bot' },
      // Absorbed as tabs
      { title: 'Lịch làm việc', href: '/lich', icon: 'Calendar', tabOf: '/cong-viec' },
      { title: 'OKR / Mục tiêu', href: '/okr', icon: 'Target', tabOf: '/cong-viec' },
      { title: 'Bảng tin', href: '/bang-tin', icon: 'Newspaper', tabOf: '/tai-lieu' },
      { title: 'Wiki', href: '/wiki', icon: 'BookOpen', tabOf: '/tai-lieu' },
      { title: 'AI Chat', href: '/ai-chat', icon: 'MessageSquare', tabOf: '/ai-assistant' },
      { title: 'Video họp', href: '/video', icon: 'Video', tabOf: '/ai-assistant' },
      { title: 'Automation', href: '/automation', icon: 'Zap', tabOf: '/ai-assistant' },
    ],
  },
  // ── 7. Quản trị ────────────────────────────────
  {
    label: 'Quản trị',
    items: [
      { title: 'Phê duyệt', href: '/phe-duyet', icon: 'CheckCircle' },
      { title: 'Cài đặt', href: '/cai-dat', icon: 'Settings' },
      // Absorbed as tabs
      { title: 'Quản lý user', href: '/quan-ly-user', icon: 'Shield', tabOf: '/cai-dat' },
      { title: 'Ủy quyền', href: '/uy-quyen', icon: 'UserCog', tabOf: '/phe-duyet' },
      { title: 'Thông báo', href: '/thong-bao', icon: 'Bell', tabOf: '/phe-duyet' },
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
