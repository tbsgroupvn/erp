'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Breadcrumbs } from './breadcrumbs';
import { UserMenu } from './user-menu';
import { NotificationBell } from './notification-bell';
import { useAuthStore } from '@/lib/stores/auth-store';
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
  const [endingImpersonation, setEndingImpersonation] = useState(false);

  // Check if the current session is an impersonation
  const impersonatedBy = (user as any)?.impersonatedBy;
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
            Dang xem voi tu cach khach hang{' '}
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
            {endingImpersonation ? 'Dang ket thuc...' : 'Ket thuc'}
          </button>
        </div>
      )}

      <header
        role="banner"
        aria-label="Thanh cong cu"
        className={`sticky ${isImpersonating ? 'top-[36px]' : 'top-0'} z-30 flex h-16 items-center justify-between border-b bg-background px-6`}
      >
        {/* Left: Breadcrumbs */}
        <div className="flex items-center">
          <Breadcrumbs />
        </div>

        {/* Right: Notifications + User Menu */}
        <div className="flex items-center gap-2">
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
