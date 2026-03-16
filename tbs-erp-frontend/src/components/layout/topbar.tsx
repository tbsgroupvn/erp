'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Menu } from 'lucide-react';
import { Breadcrumbs } from './breadcrumbs';
import { UserMenu } from './user-menu';
import { NotificationBell } from './notification-bell';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useSidebarStore } from '@/lib/stores/sidebar-store';
import { apiClient } from '@/lib/api/client';
import type { Notification } from '@/lib/types';

interface TopbarProps {
  notifications?: Notification[];
  onMarkAsRead?: (id: string) => void;
  onMarkAllAsRead?: () => void;
  onNotificationClick?: (notification: Notification) => void;
}

export function Topbar({
  notifications = [],
  onMarkAsRead,
  onMarkAllAsRead,
  onNotificationClick,
}: TopbarProps) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const toggleMobile = useSidebarStore((s) => s.toggle);
  const [endingImpersonation, setEndingImpersonation] = useState(false);

  const openCommandPalette = () => {
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }),
    );
  };

  // Check if the current session is an impersonation.
  // impersonatedBy is an optional server-injected field not present in UserProfile.
  const impersonatedBy = (user as (typeof user & { impersonatedBy?: string | { customerName?: string; fullName?: string; email?: string } }))?.impersonatedBy;
  const isImpersonating = !!impersonatedBy;

  const handleEndImpersonation = async () => {
    setEndingImpersonation(true);
    try {
      await apiClient.post('/auth/end-impersonation');
      // Clear current auth and redirect to admin
      useAuthStore.getState().logout();
      router.push('/admin');
    } catch (error) {
      console.error('Failed to end impersonation:', error);
      // Force redirect even on error
      useAuthStore.getState().logout();
      router.push('/admin');
    } finally {
      setEndingImpersonation(false);
    }
  };

  return (
    <>
      {/* Impersonation Banner */}
      {isImpersonating && (
        <div className="sticky top-0 z-50 flex items-center justify-center gap-3 bg-red-600 px-4 py-2 text-sm font-medium text-white">
          <span>
            Đang xem với tư cách khách hàng{' '}
            <strong>
              {typeof impersonatedBy === 'object'
                ? impersonatedBy.customerName || impersonatedBy.fullName || impersonatedBy.email
                : user?.fullName || ''}
            </strong>
            .
          </span>
          <button
            type="button"
            onClick={handleEndImpersonation}
            disabled={endingImpersonation}
            className="inline-flex items-center rounded-md bg-white/20 px-3 py-1 text-xs font-semibold text-white hover:bg-white/30 disabled:opacity-50 transition-colors"
          >
            {endingImpersonation ? 'Đang kết thúc...' : 'Kết thúc'}
          </button>
        </div>
      )}

      <header
        role="banner"
        aria-label="Thanh công cụ"
        className={`sticky ${isImpersonating ? 'top-[36px]' : 'top-0'} z-30 flex h-14 items-center justify-between border-b bg-background/80 backdrop-blur-md px-6`}
      >
        {/* Left: Hamburger (mobile) + Breadcrumbs */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleMobile}
            aria-label="Mo menu"
            className="flex lg:hidden h-9 w-9 items-center justify-center rounded-md border border-input bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <Menu className="h-4 w-4" />
          </button>
          <Breadcrumbs />
        </div>

        {/* Right: Search + Notifications + User Menu */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openCommandPalette}
            title="Tìm kiếm (Ctrl+K)"
            aria-label="Mở tìm kiếm toàn hệ thống"
            className="inline-flex items-center gap-2 h-9 rounded-md border border-input bg-background px-3 text-sm text-muted-foreground shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <Search className="h-4 w-4" />
            <span className="hidden md:inline">Tìm kiếm...</span>
            <kbd className="hidden md:inline-flex h-5 items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              Ctrl+K
            </kbd>
          </button>
          <NotificationBell
            notifications={notifications}
            onMarkAsRead={onMarkAsRead}
            onMarkAllAsRead={onMarkAllAsRead}
            onNotificationClick={onNotificationClick}
          />
          <UserMenu />
        </div>
      </header>
    </>
  );
}
