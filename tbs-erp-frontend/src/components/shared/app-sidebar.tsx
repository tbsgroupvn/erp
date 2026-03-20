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
    label: 'Tong quan',
    items: [
      { title: 'Tong quan', href: '/tong-quan', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Kinh doanh',
    items: [
      { title: 'Don hang', href: '/don-hang', icon: ShoppingCart },
      { title: 'Bao gia', href: '/bao-gia', icon: FileText },
      { title: 'Khach hang', href: '/khach-hang', icon: Users },
    ],
  },
  {
    label: 'Kho van',
    items: [
      { title: 'Kho Trung Quoc', href: '/kho-trung-quoc', icon: Warehouse },
      { title: 'Container', href: '/container', icon: Box },
      { title: 'Kho Viet Nam', href: '/kho-viet-nam', icon: Ship },
      { title: 'Theo doi', href: '/theo-doi', icon: MapPin },
    ],
  },
  {
    label: 'Van tai',
    items: [
      { title: 'Phuong tien', href: '/phuong-tien', icon: Truck },
      { title: 'Tai xe', href: '/tai-xe', icon: User },
    ],
  },
  {
    label: 'Tai chinh',
    items: [
      { title: 'Cong no phai thu', href: '/tai-chinh/cong-no-phai-thu', icon: DollarSign },
      { title: 'Cong no phai tra', href: '/tai-chinh/cong-no-phai-tra', icon: Receipt },
      { title: 'Phieu thu chi', href: '/tai-chinh/phieu-thu-chi', icon: FileText },
      { title: 'Hoa don', href: '/tai-chinh/hoa-don', icon: FileText },
      { title: 'Mua hang', href: '/mua-hang', icon: ShoppingBag },
    ],
  },
  {
    label: 'Mua hang & Kho',
    items: [
      { title: 'Nha cung cap', href: '/nha-cung-cap', icon: Building },
      { title: 'Kho vat tu', href: '/kho-vat-tu', icon: Package },
    ],
  },
  {
    label: 'Nhan su',
    items: [
      { title: 'Nhan su', href: '/nhan-su', icon: UserCheck },
      { title: 'Bang luong', href: '/luong', icon: Banknote },
    ],
  },
  {
    label: 'He thong',
    items: [
      { title: 'Cong viec', href: '/cong-viec', icon: ListTodo },
      { title: 'Khieu nai', href: '/khieu-nai', icon: AlertCircle },
      { title: 'Tai lieu', href: '/tai-lieu', icon: FolderOpen },
      { title: 'Phe duyet', href: '/phe-duyet', icon: CheckCircle },
      { title: 'Cai dat', href: '/cai-dat', icon: Settings },
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
        'flex h-screen flex-col border-r border-sidebar-border/40 bg-sidebar text-sidebar-foreground transition-all duration-300 ease-out',
        isCollapsed ? 'w-[68px]' : 'w-[272px]',
      )}
    >
      {/* ── Logo / Brand ─────────────────────────────── */}
      <div
        className={cn(
          'flex h-16 items-center border-b border-sidebar-border/40',
          isCollapsed ? 'justify-center px-0' : 'justify-between px-4'
        )}
      >
        {!isCollapsed && (
          <Link
            href="/tong-quan"
            className="flex items-center gap-3 transition-opacity duration-200 hover:opacity-80"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary shadow-sm">
              <span className="font-heading text-[11px] font-bold tracking-wide text-sidebar-primary-foreground">
                T
              </span>
            </div>
            <div className="leading-none">
              <p className="font-heading text-[15px] font-semibold tracking-tight text-sidebar-foreground">
                TBS ERP
              </p>
              <p className="text-[10px] font-medium tracking-[0.08em] text-sidebar-foreground/40 uppercase mt-0.5">
                Enterprise
              </p>
            </div>
          </Link>
        )}

        {isCollapsed && (
          <Link
            href="/tong-quan"
            title="TBS ERP"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary shadow-sm transition-opacity duration-200 hover:opacity-80"
          >
            <span className="font-heading text-[11px] font-bold tracking-wide text-sidebar-primary-foreground">
              T
            </span>
          </Link>
        )}

        {!isCollapsed && (
          <button
            onClick={toggleCollapsed}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-sidebar-foreground/30 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground/70 transition-colors duration-200 cursor-pointer"
            aria-label="Thu gon sidebar"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* ── Navigation ──────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 scrollbar-thin scrollbar-thumb-sidebar-border">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-1">
            {!isCollapsed && (
              <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-sidebar-foreground/40">
                {group.label}
              </p>
            )}
            {isCollapsed && (
              <div className="mb-2 flex justify-center">
                <div className="h-px w-8 bg-sidebar-border/30" />
              </div>
            )}
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'group relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-all duration-200 ease-out',
                      isCollapsed && 'h-9 w-9 mx-auto justify-center px-0',
                      isActive
                        ? 'bg-sidebar-accent text-sidebar-foreground'
                        : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
                    )}
                    title={isCollapsed ? item.title : undefined}
                  >
                    {/* Active left border accent */}
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-sidebar-primary" />
                    )}
                    <item.icon className={cn(
                      'h-[18px] w-[18px] shrink-0 transition-colors duration-200',
                      isActive
                        ? 'text-sidebar-primary'
                        : 'text-sidebar-foreground/40 group-hover:text-sidebar-foreground/70'
                    )} />
                    {!isCollapsed && <span className="truncate">{item.title}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Collapse button (collapsed state only) ─── */}
      {isCollapsed && (
        <>
          <div className="h-px bg-sidebar-border/40" />
          <div className="flex items-center justify-center py-2">
            <button
              onClick={toggleCollapsed}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-sidebar-foreground/30 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground/70 transition-colors duration-200 cursor-pointer"
              aria-label="Mo rong sidebar"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
