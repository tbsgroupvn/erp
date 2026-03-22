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
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          aria-hidden="true"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        role="navigation"
        aria-label="Menu chinh"
        className={cn(
          'flex h-screen flex-col bg-sidebar text-sidebar-foreground transition-all duration-300 ease-out',
          // Right border — very subtle on dark sidebar
          'border-r border-sidebar-border/40',
          // Desktop: collapse/expand
          'hidden lg:flex',
          isCollapsed ? 'lg:w-[68px]' : 'lg:w-[272px]',
          // Mobile: fixed overlay drawer
          isOpen && 'fixed inset-y-0 left-0 z-50 flex w-[272px] lg:relative lg:z-auto'
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
              {/* Logo mark */}
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary shadow-sm">
                <span className="font-heading text-[11px] font-bold tracking-wide text-sidebar-primary-foreground">
                  {(process.env.NEXT_PUBLIC_APP_TITLE || 'TBS')[0]}
                </span>
              </div>
              {/* Brand text */}
              <div className="leading-none">
                <p className="font-heading text-[15px] font-semibold tracking-tight text-sidebar-foreground">
                  {process.env.NEXT_PUBLIC_APP_TITLE || 'TBS ERP'}
                </p>
                <p className="text-[10px] font-medium tracking-[0.08em] text-sidebar-foreground/40 uppercase mt-0.5">
                  Enterprise Resource Planning
                </p>
              </div>
            </Link>
          )}

          {/* Collapsed: show logo mark only, centered */}
          {isCollapsed && (
            <Link
              href="/tong-quan"
              title={process.env.NEXT_PUBLIC_APP_TITLE || 'TBS ERP'}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary shadow-sm transition-opacity duration-200 hover:opacity-80"
            >
              <span className="font-heading text-[11px] font-bold tracking-wide text-sidebar-primary-foreground">
                {(process.env.NEXT_PUBLIC_APP_TITLE || 'TBS')[0]}
              </span>
            </Link>
          )}
        </div>

        {/* ── Navigation ──────────────────────────────── */}
        <ScrollArea className="flex-1 py-3">
          <nav id="sidebar-nav" className="flex flex-col px-2">
            {NAV_GROUPS.map((group) => {
              const filteredItems = group.items.filter(
                (item) => allowedPaths.includes(item.href) && !item.tabOf
              );

              if (filteredItems.length === 0) return null;

              /* ── Collapsed state: icons only ── */
              if (isCollapsed) {
                return (
                  <div key={group.label} className="flex flex-col items-center gap-0.5 mb-3">
                    {/* Thin separator between groups */}
                    <div className="mb-1 h-px w-8 bg-sidebar-border/30" />
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
                            'relative flex h-9 w-9 mx-auto items-center justify-center rounded-md transition-all duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-sidebar-ring',
                            isActive
                              ? 'bg-sidebar-accent text-sidebar-primary'
                              : 'text-sidebar-foreground/50 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
                          )}
                        >
                          {/* Active left border indicator */}
                          {isActive && (
                            <span className="absolute -left-2 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-sidebar-primary" />
                          )}
                          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                          {showBadge && (
                            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white leading-none">
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

              /* ── Expanded state: group + items ── */
              return (
                <Collapsible.Root
                  key={group.label}
                  open={openGroups[group.label]}
                  onOpenChange={() => toggleGroup(group.label)}
                  className="mb-1"
                >
                  <Collapsible.Trigger asChild>
                    <button
                      className="group flex w-full items-center justify-between rounded-sm px-2 py-1.5 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-sidebar-ring"
                      aria-expanded={openGroups[group.label]}
                      aria-controls={`nav-group-${group.label}`}
                    >
                      <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-sidebar-foreground/40 group-hover:text-sidebar-foreground/60 transition-colors duration-200">
                        {group.label}
                      </span>
                      <ChevronDown
                        className={cn(
                          'h-3 w-3 text-sidebar-foreground/30 transition-transform duration-200 group-hover:text-sidebar-foreground/50',
                          openGroups[group.label] ? '' : '-rotate-90'
                        )}
                        aria-hidden="true"
                      />
                    </button>
                  </Collapsible.Trigger>

                  <Collapsible.Content
                    id={`nav-group-${group.label}`}
                    className="flex flex-col gap-0.5 pb-1"
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
                            'group relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-all duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-sidebar-ring',
                            isActive
                              ? 'bg-sidebar-accent text-sidebar-foreground'
                              : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
                          )}
                        >
                          {/* Active left border accent */}
                          {isActive && (
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-sidebar-primary" />
                          )}
                          <Icon
                            className={cn(
                              'h-[18px] w-[18px] shrink-0 transition-colors duration-200',
                              isActive
                                ? 'text-sidebar-primary'
                                : 'text-sidebar-foreground/40 group-hover:text-sidebar-foreground/70'
                            )}
                            aria-hidden="true"
                          />
                          <span className="flex-1 truncate">{item.title}</span>
                          {showBadge && (
                            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white leading-none">
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

        {/* ── User footer ─────────────────────────────── */}
        {user && (
          <>
            <div className="h-px bg-sidebar-border/40" />
            <div
              className={cn(
                'flex items-center gap-3 px-3 py-3',
                isCollapsed && 'justify-center px-0'
              )}
            >
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarFallback className="text-[10px] font-semibold bg-sidebar-primary text-sidebar-primary-foreground">
                  {getInitials(user.fullName)}
                </AvatarFallback>
              </Avatar>
              {!isCollapsed && (
                <div className="flex-1 overflow-hidden">
                  <p className="truncate text-[13px] font-medium text-sidebar-foreground leading-tight">
                    {user.fullName}
                  </p>
                  <p className="truncate text-[11px] text-sidebar-foreground/40 mt-0.5">
                    {roleLabel}
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Collapse / Expand button ─────────────────── */}
        <div className="h-px bg-sidebar-border/40" />
        <div className="flex items-center justify-center py-2">
          {/* Desktop collapse toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCollapsed}
            className="h-7 w-7 text-sidebar-foreground/30 hover:text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hidden lg:flex transition-colors duration-200"
            aria-label={isCollapsed ? 'Mo rong sidebar' : 'Thu gon sidebar'}
            aria-expanded={!isCollapsed}
            aria-controls="sidebar-nav"
          >
            {isCollapsed ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronLeft className="h-3.5 w-3.5" />
            )}
          </Button>
          {/* Mobile close button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setOpen(false)}
            className="h-7 w-7 text-sidebar-foreground/30 hover:text-sidebar-foreground/70 hover:bg-sidebar-accent/60 lg:hidden transition-colors duration-200"
            aria-label="Dong menu"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
        </div>
      </aside>
    </>
  );
}
