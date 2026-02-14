'use client';

import { useAuthStore } from '@/lib/stores/auth-store';
import { Bell, LogOut, User } from 'lucide-react';
import Link from 'next/link';

export function Topbar() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-6">
      <div />

      <div className="flex items-center gap-4">
        {/* Notifications */}
        <button className="relative inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent">
          <Bell className="h-4 w-4" />
        </button>

        {/* User menu */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-medium">{user?.fullName || 'Người dùng'}</p>
            <p className="text-xs text-muted-foreground">{user?.role || ''}</p>
          </div>

          <div className="flex items-center gap-1">
            <Link
              href="/cai-dat"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent"
            >
              <User className="h-4 w-4" />
            </Link>
            <button
              onClick={logout}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent text-destructive"
              title="Đăng xuất"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
