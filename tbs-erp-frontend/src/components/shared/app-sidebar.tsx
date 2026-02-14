'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { useSidebarStore } from '@/lib/stores/sidebar-store';
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Box,
  Warehouse,
  Ship,
  Truck,
  User,
  DollarSign,
  Receipt,
  FileText,
  CheckCircle,
  Settings,
  ChevronLeft,
  ChevronRight,
  MapPin,
  ShoppingBag,
  Building,
  Package,
  UserCheck,
  Banknote,
  ListTodo,
  AlertCircle,
  FolderOpen,
  type LucideIcon,
} from 'lucide-react';

interface SidebarNavItem {
  title: string;
  href: string;
  icon: LucideIcon;
}

interface SidebarNavGroup {
  label: string;
  items: SidebarNavItem[];
}

const navGroups: SidebarNavGroup[] = [
  {
    label: 'Tổng quan',
    items: [
      { title: 'Tổng quan', href: '/tong-quan', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Kinh doanh',
    items: [
      { title: 'Đơn hàng', href: '/don-hang', icon: ShoppingCart },
      { title: 'Báo giá', href: '/bao-gia', icon: FileText },
      { title: 'Khách hàng', href: '/khach-hang', icon: Users },
    ],
  },
  {
    label: 'Kho vận',
    items: [
      { title: 'Kho Trung Quốc', href: '/kho-trung-quoc', icon: Warehouse },
      { title: 'Container', href: '/container', icon: Box },
      { title: 'Kho Việt Nam', href: '/kho-viet-nam', icon: Ship },
      { title: 'Theo dõi', href: '/theo-doi', icon: MapPin },
    ],
  },
  {
    label: 'Vận tải',
    items: [
      { title: 'Phương tiện', href: '/phuong-tien', icon: Truck },
      { title: 'Tài xế', href: '/tai-xe', icon: User },
    ],
  },
  {
    label: 'Tài chính',
    items: [
      { title: 'Công nợ phải thu', href: '/tai-chinh/cong-no-phai-thu', icon: DollarSign },
      { title: 'Công nợ phải trả', href: '/tai-chinh/cong-no-phai-tra', icon: Receipt },
      { title: 'Phiếu thu chi', href: '/tai-chinh/phieu-thu-chi', icon: FileText },
      { title: 'Hóa đơn', href: '/tai-chinh/hoa-don', icon: FileText },
      { title: 'Mua hàng', href: '/mua-hang', icon: ShoppingBag },
    ],
  },
  {
    label: 'Mua hàng & Kho',
    items: [
      { title: 'Nhà cung cấp', href: '/nha-cung-cap', icon: Building },
      { title: 'Kho vật tư', href: '/kho-vat-tu', icon: Package },
    ],
  },
  {
    label: 'Nhân sự',
    items: [
      { title: 'Nhân sự', href: '/nhan-su', icon: UserCheck },
      { title: 'Bảng lương', href: '/luong', icon: Banknote },
    ],
  },
  {
    label: 'Hệ thống',
    items: [
      { title: 'Công việc', href: '/cong-viec', icon: ListTodo },
      { title: 'Khiếu nại', href: '/khieu-nai', icon: AlertCircle },
      { title: 'Tài liệu', href: '/tai-lieu', icon: FolderOpen },
      { title: 'Phê duyệt', href: '/phe-duyet', icon: CheckCircle },
      { title: 'Cài đặt', href: '/cai-dat', icon: Settings },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const isCollapsed = useSidebarStore((s) => s.isCollapsed);
  const toggleCollapsed = useSidebarStore((s) => s.toggleCollapsed);

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r bg-sidebar shadow-sm transition-all duration-300',
        isCollapsed ? 'w-16' : 'w-64',
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
        {!isCollapsed && (
          <Link href="/tong-quan" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-secondary text-primary-foreground font-bold text-sm shadow-md">
              TBS
            </div>
            <span className="font-heading font-semibold text-lg text-sidebar-foreground">TBS ERP</span>
          </Link>
        )}
        <button
          onClick={toggleCollapsed}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-sidebar-accent transition-colors cursor-pointer"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 scrollbar-thin scrollbar-thumb-sidebar-border">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-6">
            {!isCollapsed && (
              <p className="px-4 pb-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">
                {group.label}
              </p>
            )}
            <div className="space-y-1">
              {group.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'group relative flex items-center gap-3 mx-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 cursor-pointer',
                      isActive
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
                    )}
                    title={isCollapsed ? item.title : undefined}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 rounded-r-full bg-primary" />
                    )}
                    <item.icon className={cn(
                      "h-5 w-5 shrink-0 transition-colors",
                      isActive ? "text-primary" : "text-sidebar-foreground/70 group-hover:text-primary"
                    )} />
                    {!isCollapsed && <span>{item.title}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
