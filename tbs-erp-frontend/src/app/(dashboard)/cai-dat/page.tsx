'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { Loader2, User, Lock, GitBranch, Shield, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useChangePassword } from '@/lib/hooks/use-auth';
import { USER_ROLE_LABELS, BRANCH_LABELS } from '@/lib/utils/constants';
import { cn } from '@/lib/utils/cn';
import type { UserRole, Branch } from '@/lib/types';

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Mật khẩu hiện tại bắt buộc'),
    newPassword: z.string().min(6, 'Mật khẩu mới tối thiểu 6 ký tự'),
    confirmPassword: z.string().min(1, 'Xác nhận mật khẩu bắt buộc'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  });

type ChangePasswordForm = z.infer<typeof changePasswordSchema>;

const TABS = [
  { key: 'profile', label: 'Hồ sơ', icon: User },
  { key: 'password', label: 'Đổi mật khẩu', icon: Lock },
  { key: 'security', label: 'Bảo mật', icon: Shield },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function CaiDatPage() {
  const user = useAuthStore((s) => s.user);
  const changePassword = useChangePassword();
  const [activeTab, setActiveTab] = useState<TabKey>('profile');

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
  });

  const onChangePassword = (data: ChangePasswordForm) => {
    changePassword.mutate(
      { currentPassword: data.currentPassword, newPassword: data.newPassword },
      {
        onSuccess: () => {
          toast.success('Đổi mật khẩu thành công');
          reset();
        },
        onError: (err: any) => {
          toast.error(err.response?.data?.message || 'Đổi mật khẩu thất bại');
        },
      },
    );
  };

  return (
    <div>
      <PageHeader title="Cài đặt" description="Quản lý tài khoản cá nhân" />

      {/* Tabs */}
      <div className="border-b mb-6">
        <div className="flex gap-4">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'flex items-center gap-2 border-b-2 px-3 py-2 text-sm transition-colors',
                  activeTab === tab.key
                    ? 'border-primary text-primary font-medium'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="rounded-lg border bg-card p-6 max-w-2xl">
          <h3 className="text-lg font-semibold mb-4">Thông tin cá nhân</h3>
          <dl className="space-y-4 text-sm">
            <div className="grid grid-cols-3 gap-4">
              <dt className="text-muted-foreground">Họ tên</dt>
              <dd className="col-span-2 font-medium">{user?.fullName || '---'}</dd>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="col-span-2">{user?.email || '---'}</dd>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <dt className="text-muted-foreground">Vai trò</dt>
              <dd className="col-span-2">
                {user?.role ? USER_ROLE_LABELS[user.role as UserRole] || user.role : '---'}
              </dd>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <dt className="text-muted-foreground">Chi nhánh</dt>
              <dd className="col-span-2">
                {user && (user as any).branch ? BRANCH_LABELS[(user as any).branch as Branch] || (user as any).branch : '---'}
              </dd>
            </div>
          </dl>
        </div>
      )}

      {/* Admin Section - only for CEO/COO */}
      {activeTab === 'profile' && (user?.role === 'CEO' || user?.role === 'COO') && (
        <div className="rounded-lg border bg-card p-6 max-w-2xl mt-6">
          <h3 className="text-lg font-semibold mb-4">Quản trị hệ thống</h3>
          <div className="space-y-2">
            <Link
              href="/cai-dat/quy-trinh-phe-duyet"
              className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <GitBranch className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Quy trình phê duyệt</p>
                  <p className="text-xs text-muted-foreground">
                    Quản lý và thiết kế các quy trình phê duyệt
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </div>
        </div>
      )}

      {/* Change Password Tab */}
      {activeTab === 'password' && (
        <div className="rounded-lg border bg-card p-6 max-w-md">
          <h3 className="text-lg font-semibold mb-4">Đổi mật khẩu</h3>
          <form onSubmit={handleSubmit(onChangePassword)} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Mật khẩu hiện tại</label>
              <input
                type="password"
                {...register('currentPassword')}
                className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {errors.currentPassword && (
                <p className="text-xs text-destructive">{errors.currentPassword.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Mật khẩu mới</label>
              <input
                type="password"
                {...register('newPassword')}
                className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {errors.newPassword && (
                <p className="text-xs text-destructive">{errors.newPassword.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Xác nhận mật khẩu mới</label>
              <input
                type="password"
                {...register('confirmPassword')}
                className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {errors.confirmPassword && (
                <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={changePassword.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {changePassword.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Đổi mật khẩu
            </button>
          </form>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="rounded-lg border bg-card p-6 max-w-2xl">
          <h3 className="text-lg font-semibold mb-4">Bảo mật tài khoản</h3>
          <div className="space-y-2">
            <Link
              href="/cai-dat/bao-mat"
              className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Xác thực 2 yếu tố (2FA)</p>
                  <p className="text-xs text-muted-foreground">
                    Thiết lập và quản lý xác thực 2 yếu tố cho tài khoản
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
