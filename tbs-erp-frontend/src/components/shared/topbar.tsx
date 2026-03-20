'use client';

import { useAuthStore } from '@/lib/stores/auth-store';
import { Bell, LogOut, Search, User } from 'lucide-react';
import Link from 'next/link';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function Topbar() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <header className="flex h-14 items-center justify-between border-b border-border/60 bg-card/80 backdrop-blur-md px-4 transition-colors duration-200">
      {/* Left: placeholder for breadcrumbs or page title */}
      <div />

      {/* Right: actions */}
      <div className="flex items-center gap-1">
        {/* Search */}
        <button
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors duration-200"
          aria-label="Tim kiem"
        >
          <Search className="h-[15px] w-[15px]" />
        </button>

        {/* Thin divider */}
        <div className="mx-1 h-5 w-px bg-border/60" />

        {/* Notifications */}
        <button
          className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors duration-200"
          aria-label="Thong bao"
        >
          <Bell className="h-[15px] w-[15px]" />
        </button>

        {/* Thin divider */}
        <div className="mx-1 h-5 w-px bg-border/60" />

        {/* User section */}
        <div className="flex items-center gap-2.5 rounded-md px-2 py-1">
          {/* Avatar with initials */}
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-[10px] font-semibold shrink-0">
            {user?.fullName ? getInitials(user.fullName) : 'U'}
          </div>
          <div className="hidden md:block text-left">
            <p className="text-[13px] font-medium leading-tight text-foreground">
              {user?.fullName || 'Nguoi dung'}
            </p>
            <p className="text-[11px] text-muted-foreground leading-tight">
              {user?.role || ''}
            </p>
          </div>
        </div>

        {/* Thin divider */}
        <div className="mx-1 h-5 w-px bg-border/60" />

        {/* Profile link */}
        <Link
          href="/cai-dat"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors duration-200"
          aria-label="Ho so"
        >
          <User className="h-[15px] w-[15px]" />
        </Link>

        {/* Logout */}
        <button
          onClick={logout}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors duration-200"
          title="Dang xuat"
          aria-label="Dang xuat"
        >
          <LogOut className="h-[15px] w-[15px]" />
        </button>
      </div>
    </header>
  );
}
