'use client';

import { Breadcrumbs } from './breadcrumbs';
import { UserMenu } from './user-menu';
import { NotificationBell } from './notification-bell';
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
  return (
    <header role="banner" aria-label="Thanh cong cu" className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-6">
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
  );
}
