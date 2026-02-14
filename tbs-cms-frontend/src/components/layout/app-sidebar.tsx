'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as Collapsible from '@radix-ui/react-collapsible';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LayoutDashboard,
  ShoppingCart,
  FileText,
  Users,
  Warehouse,
  Box,
  Ship,
  MapPin,
  Truck,
  User,
  DollarSign,
  Receipt,
  ShoppingBag,
  Building,
  Package,
  UserCheck,
  Banknote,
  ListTodo,
  AlertCircle,
  FolderOpen,
  CheckCircle,
  Settings,
  ArrowLeftRight,
  Scale,
  Gem,
  BarChart3,
  PieChart,
  Clock,
  Bell,
  UserCog,
  Shield,
  type LucideIcon,
  PackageCheck,
} from 'lucide-react';

import { cn } from '@/lib/utils/cn';
import {
  NAV_GROUPS,
  ROLE_MENU_ACCESS,
  ROLE_LABELS,
} from '@/lib/utils/permissions';
import { ROLE_LABELS as ROLE_LABELS_CONSTANTS } from '@/lib/utils/constants';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useSidebarStore } from '@/lib/stores/sidebar-store';
import { useApprovalCounts } from '@/lib/hooks/use-approvals';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Avatar,
  AvatarFallback,
} from '@/components/ui/avatar';
import type { UserRole } from '@/lib/types';

/** Map icon string names from NAV_GROUPS to actual Lucide components */
const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  ShoppingCart,
  FileText,
  Users,
  Warehouse,
  Box,
  Ship,
  MapPin,
  Truck,
  User,
  DollarSign,
  Receipt,
  ShoppingBag,
  Building,
  Package,
  PackageCheck,
  ArrowLeftRight,
  Scale,
  Gem,
  BarChart3,
  PieChart,
  UserCheck,
  Banknote,
  ListTodo,
  AlertCircle,
  FolderOpen,
  Clock,
  Bell,
  UserCog,
  Shield,
  CheckCircle,
  Settings,
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/**
 * Derive allowed navigation paths based on user role using ROLE_MENU_ACCESS.
 */
function getAllowedPaths(role: UserRole): string[] {
  const prefixes = ROLE_MENU_ACCESS[role];
  if (!prefixes) return ['/tong-quan'];
  // Match NAV_GROUPS items whose href starts with any allowed prefix
  const paths: string[] = [];
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (prefixes.some((prefix) => item.href === prefix || item.href.startsWith(prefix + '/'))) {
        paths.push(item.href);
      }
    }
  }
  return paths;
}

export function AppSidebar() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const { isCollapsed, toggleCollapsed } = useSidebarStore();
  const approvalCounts = useApprovalCounts();
  const pendingCount = approvalCounts.data?.pendingForMe ?? 0;

  const allowedPaths = React.useMemo(
    () => (user ? getAllowedPaths(user.role) : []),
    [user]
  );

  // Track which groups are open
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>(
    () => {
      const initial: Record<string, boolean> = {};
      NAV_GROUPS.forEach((group) => {
        initial[group.label] = true;
      });
      return initial;
    }
  );

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const roleLabel = user ? (ROLE_LABELS[user.role] ?? ROLE_LABELS_CONSTANTS[user.role] ?? user.role) : '';

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-300',
        isCollapsed ? 'w-[68px]' : 'w-[280px]'
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center border-b px-4">
        <Link href="/tong-quan" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-bold text-sm">
            T
          </div>
          {!isCollapsed && (
            <span className="text-lg font-bold tracking-tight">
              TBS ERP
            </span>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-2 py-4">
        <nav className="flex flex-col gap-1">
          {NAV_GROUPS.map((group) => {
            const filteredItems = group.items.filter((item) =>
              allowedPaths.includes(item.href)
            );

            if (filteredItems.length === 0) return null;

            if (isCollapsed) {
              return (
                <div key={group.label} className="flex flex-col gap-1 mb-2">
                  {filteredItems.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      pathname.startsWith(item.href + '/');
                    const Icon = ICON_MAP[item.icon] ?? LayoutDashboard;
                    const showBadge = item.href === '/phe-duyet' && pendingCount > 0;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={item.title}
                        className={cn(
                          'relative flex h-10 w-10 mx-auto items-center justify-center rounded-md transition-colors',
                          isActive
                            ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        {showBadge && (
                          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                            {pendingCount > 9 ? '9+' : pendingCount}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              );
            }

            return (
              <Collapsible.Root
                key={group.label}
                open={openGroups[group.label]}
                onOpenChange={() => toggleGroup(group.label)}
                className="mb-1"
              >
                <Collapsible.Trigger asChild>
                  <button className="flex w-full items-center justify-between rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50 hover:text-sidebar-foreground/80 transition-colors">
                    <span>{group.label}</span>
                    <ChevronDown
                      className={cn(
                        'h-3.5 w-3.5 transition-transform',
                        openGroups[group.label] ? '' : '-rotate-90'
                      )}
                    />
                  </button>
                </Collapsible.Trigger>

                <Collapsible.Content className="flex flex-col gap-0.5">
                  {filteredItems.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      pathname.startsWith(item.href + '/');
                    const Icon = ICON_MAP[item.icon] ?? LayoutDashboard;
                    const showBadge = item.href === '/phe-duyet' && pendingCount > 0;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                          isActive
                            ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="flex-1">{item.title}</span>
                        {showBadge && (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">
                            {pendingCount > 99 ? '99+' : pendingCount}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </Collapsible.Content>
              </Collapsible.Root>
            );
          })}
        </nav>
      </ScrollArea>

      {/* User info (collapsed shows only avatar) */}
      {user && (
        <>
          <Separator />
          <div
            className={cn(
              'flex items-center gap-3 p-4',
              isCollapsed && 'justify-center px-2'
            )}
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs bg-sidebar-primary text-sidebar-primary-foreground">
                {getInitials(user.fullName)}
              </AvatarFallback>
            </Avatar>
            {!isCollapsed && (
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-sm font-medium">
                  {user.fullName}
                </p>
                <p className="truncate text-xs text-sidebar-foreground/60">
                  {roleLabel}
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Collapse / Expand button */}
      <Separator />
      <div className="flex items-center justify-center p-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleCollapsed}
          className="h-8 w-8 text-sidebar-foreground/60 hover:text-sidebar-foreground"
          aria-label={isCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>
    </aside>
  );
}
