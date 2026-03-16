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
  Building2,
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
  ShieldCheck,
  BookOpen,
  PiggyBank,
  Calculator,
  Calendar,
  type LucideIcon,
  PackageCheck,
  MessageSquare,
  Newspaper,
  HelpCircle,
  Target,
  Download,
  Video,
  Bot,
  Zap,
  LayoutGrid,
  Network,
  ClipboardList,
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
import { useChatUnreadCount } from '@/lib/hooks/use-chat';
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
  Building2,
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
  ShieldCheck,
  BookOpen,
  PiggyBank,
  Calculator,
  Calendar,
  CheckCircle,
  Settings,
  MessageSquare,
  Newspaper,
  HelpCircle,
  Target,
  Download,
  Video,
  Bot,
  Zap,
  LayoutGrid,
  Network,
  ClipboardList,
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
  const { isCollapsed, toggleCollapsed, isOpen, toggle: toggleMobile, setOpen } = useSidebarStore();
  const approvalCounts = useApprovalCounts();
  const pendingCount = approvalCounts.data?.pendingForMe ?? 0;
  const chatUnreadCount = useChatUnreadCount();
  const chatUnread = chatUnreadCount.data ?? 0;

  // Close mobile sidebar when route changes
  React.useEffect(() => {
    setOpen(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

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
    <>
      {/* Mobile overlay backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          aria-hidden="true"
          onClick={() => setOpen(false)}
        />
      )}

    <aside
      role="navigation"
      aria-label="Menu chinh"
      className={cn(
        'flex h-screen flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-300',
        // Desktop: collapse/expand
        'hidden lg:flex',
        isCollapsed ? 'lg:w-[68px]' : 'lg:w-[280px]',
        // Mobile: fixed overlay drawer
        isOpen && 'fixed inset-y-0 left-0 z-50 flex w-[280px] lg:relative lg:z-auto'
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center border-b px-4 bg-gradient-to-r from-primary/5 to-transparent">
        <Link href="/tong-quan" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-bold text-sm shadow-md shadow-primary/20">
            {(process.env.NEXT_PUBLIC_APP_TITLE || 'ERP')[0]}
          </div>
          {!isCollapsed && (
            <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
              {process.env.NEXT_PUBLIC_APP_TITLE || 'ERP System'}
            </span>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-2 py-4">
        <nav id="sidebar-nav" className="flex flex-col gap-1">
          {NAV_GROUPS.map((group) => {
            const filteredItems = group.items.filter(
              (item) => allowedPaths.includes(item.href) && !item.tabOf
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
                    const showBadge =
                      (item.href === '/phe-duyet' && pendingCount > 0) ||
                      (item.href === '/tro-chuyen' && chatUnread > 0);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={item.title}
                        aria-current={isActive ? 'page' : undefined}
                        aria-label={item.title}
                        className={cn(
                          'relative flex h-10 w-10 mx-auto items-center justify-center rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring',
                          isActive
                            ? 'bg-primary/10 text-primary font-medium shadow-sm'
                            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                        )}
                      >
                        <Icon className="h-5 w-5" aria-hidden="true" />
                        {showBadge && (
                          <span
                            className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white"
                          >
                            {item.href === '/tro-chuyen'
                              ? chatUnread > 9 ? '9+' : chatUnread
                              : pendingCount > 9 ? '9+' : pendingCount}
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
                  <button
                    className="flex w-full items-center justify-between rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50 hover:text-sidebar-foreground/80 transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
                    aria-expanded={openGroups[group.label]}
                    aria-controls={`nav-group-${group.label}`}
                  >
                    <span>{group.label}</span>
                    <ChevronDown
                      className={cn(
                        'h-3.5 w-3.5 transition-transform',
                        openGroups[group.label] ? '' : '-rotate-90'
                      )}
                      aria-hidden="true"
                    />
                  </button>
                </Collapsible.Trigger>

                <Collapsible.Content
                  id={`nav-group-${group.label}`}
                  className="flex flex-col gap-0.5"
                >
                  {filteredItems.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      pathname.startsWith(item.href + '/');
                    const Icon = ICON_MAP[item.icon] ?? LayoutDashboard;
                    const showBadge =
                      (item.href === '/phe-duyet' && pendingCount > 0) ||
                      (item.href === '/tro-chuyen' && chatUnread > 0);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={isActive ? 'page' : undefined}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring',
                          isActive
                            ? 'bg-primary/10 text-primary font-medium sidebar-active-indicator'
                            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                        )}
                      >
                        <Icon className={cn('h-4 w-4 shrink-0', isActive && 'text-primary')} aria-hidden="true" />
                        <span className="flex-1">{item.title}</span>
                        {showBadge && (
                          <span
                            className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white"
                          >
                            {item.href === '/tro-chuyen'
                              ? chatUnread > 99 ? '99+' : chatUnread
                              : pendingCount > 99 ? '99+' : pendingCount}
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
              <AvatarFallback className="text-xs bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
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

      {/* Collapse / Expand button — desktop only */}
      <Separator />
      <div className="flex items-center justify-center p-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleCollapsed}
          className="h-8 w-8 text-sidebar-foreground/60 hover:text-sidebar-foreground hidden lg:flex"
          aria-label={isCollapsed ? 'Mo rong sidebar' : 'Thu gon sidebar'}
          aria-expanded={!isCollapsed}
          aria-controls="sidebar-nav"
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
        {/* Mobile close button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setOpen(false)}
          className="h-8 w-8 text-sidebar-foreground/60 hover:text-sidebar-foreground lg:hidden"
          aria-label="Dong menu"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>
    </aside>
    </>
  );
}
