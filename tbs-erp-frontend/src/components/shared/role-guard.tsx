'use client';

import type { ReactNode } from 'react';
import { useAuthStore } from '@/lib/stores/auth-store';
import type { UserRole } from '@/lib/types';

interface RoleGuardProps {
  allowedRoles: UserRole[];
  children: ReactNode;
  fallback?: ReactNode;
}

export function RoleGuard({
  allowedRoles,
  children,
  fallback = null,
}: RoleGuardProps) {
  const user = useAuthStore((s) => s.user);

  if (!user) return <>{fallback}</>;

  if (!allowedRoles.includes(user.role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
