'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { authApi } from '@/lib/api/auth.api';
import { useAuthStore } from '@/lib/stores/auth-store';
import type { LoginDto } from '@/lib/types';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const authKeys = {
  all: ['auth'] as const,
  profile: () => [...authKeys.all, 'profile'] as const,
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/** Mutation: login with email & password */
export function useLogin() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (dto: LoginDto) => authApi.login(dto),
    onSuccess: (res) => {
      // If 2FA is required, don't set auth state yet — the login page handles this
      if ((res as { requires2FA?: boolean })?.requires2FA) {
        return;
      }
      const { user, tokens } = res as { user: import('@/lib/types').UserProfile; tokens: import('@/lib/types').TokenResponse };
      // refreshToken is now in HttpOnly cookie, not in response body
      useAuthStore.getState().setAuth(user, tokens.accessToken);
      qc.setQueryData(authKeys.profile(), user);
    },
  });
}

/** Mutation: logout */
export function useLogout() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: () => authApi.logout(),
    onSettled: () => {
      // Always clear client state regardless of API success
      useAuthStore.getState().logout();
      qc.clear();
      toast.success('Đã đăng xuất');
    },
  });
}

/** Query: current user profile */
export function useProfile() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: authKeys.profile(),
    queryFn: () => authApi.getProfile(),
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });
}

/** Mutation: change password */
export function useChangePassword() {
  return useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      authApi.changePassword(data),
    onSuccess: () => {
      toast.success('Đổi mật khẩu thành công');
    },
  });
}
