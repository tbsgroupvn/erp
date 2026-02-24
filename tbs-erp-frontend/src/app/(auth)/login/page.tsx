'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLogin } from '@/lib/hooks/use-auth';
import { useAuthStore } from '@/lib/stores/auth-store';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { TwoFactorChallenge } from '@/components/auth/two-factor-challenge';
import type { UserProfile } from '@/lib/types';

const loginSchema = z.object({
  email: z.string().email('Email khong hop le'),
  password: z.string().min(6, 'Mat khau toi thieu 6 ky tu'),
});

type LoginFormData = z.infer<typeof loginSchema>;

function sanitizeCallbackUrl(url: string | null): string {
  const fallback = '/tong-quan';
  if (!url) return fallback;
  // Only allow relative paths, block protocol-relative and absolute URLs
  if (url.startsWith('/') && !url.startsWith('//') && !url.includes('://')) {
    return url;
  }
  return fallback;
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = sanitizeCallbackUrl(searchParams.get('callbackUrl'));
  const loginMutation = useLogin();
  const [showPassword, setShowPassword] = useState(false);

  // 2FA challenge state
  const [twoFactorChallenge, setTwoFactorChallenge] = useState<{
    userId: string;
    methods: string[];
    tempToken: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = (data: LoginFormData) => {
    loginMutation.mutate(data, {
      onSuccess: (res: any) => {
        // Check if 2FA is required
        if (res.requires2FA) {
          setTwoFactorChallenge({
            userId: res.userId,
            methods: res.methods || ['TOTP'],
            tempToken: res.tempToken,
          });
          return;
        }
        toast.success('Dang nhap thanh cong');
        router.push(callbackUrl);
      },
      onError: (err: any) => {
        toast.error(err.response?.data?.message || 'Dang nhap that bai');
      },
    });
  };

  const handleTwoFactorSuccess = (user: UserProfile, accessToken: string) => {
    useAuthStore.getState().completeTwoFactorLogin(user, accessToken);
    toast.success('Dang nhap thanh cong');
    router.push(callbackUrl);
  };

  const handleTwoFactorBack = () => {
    setTwoFactorChallenge(null);
  };

  // Show 2FA challenge if needed
  if (twoFactorChallenge) {
    return (
      <TwoFactorChallenge
        userId={twoFactorChallenge.userId}
        methods={twoFactorChallenge.methods}
        tempToken={twoFactorChallenge.tempToken}
        onSuccess={handleTwoFactorSuccess}
        onBack={handleTwoFactorBack}
      />
    );
  }

  return (
    <div className="space-y-6" role="region" aria-label="Dang nhap">
      {/* Logo & Title */}
      <div className="text-center">
        <div
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground text-xl font-bold"
          aria-hidden="true"
        >
          {(process.env.NEXT_PUBLIC_COMPANY_NAME || 'ERP').substring(0, 3)}
        </div>
        <h1 className="mt-4 text-2xl font-bold">{process.env.NEXT_PUBLIC_APP_TITLE || 'ERP System'}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Dang nhap de tiep tuc
        </p>
      </div>

      {/* Login Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {/* Email */}
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium">
            Email <span aria-hidden="true" className="text-destructive">*</span>
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="email@tbs.vn"
            aria-required="true"
            aria-invalid={errors.email ? 'true' : undefined}
            aria-describedby={errors.email ? 'email-error' : undefined}
            {...register('email')}
            className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          />
          {errors.email && (
            <p id="email-error" className="text-xs text-destructive" role="alert">
              {errors.email.message}
            </p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium">
            Mat khau <span aria-hidden="true" className="text-destructive">*</span>
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Nhap mat khau"
              aria-required="true"
              aria-invalid={errors.password ? 'true' : undefined}
              aria-describedby={errors.password ? 'password-error' : undefined}
              {...register('password')}
              className="flex h-10 w-full rounded-md border bg-background px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring rounded-sm"
              aria-label={showPassword ? 'An mat khau' : 'Hien mat khau'}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
          {errors.password && (
            <p id="password-error" className="text-xs text-destructive" role="alert">
              {errors.password.message}
            </p>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loginMutation.isPending}
          className="flex h-10 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-busy={loginMutation.isPending}
        >
          {loginMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden="true" />
              <span>Dang xu ly...</span>
            </>
          ) : (
            'Dang nhap'
          )}
        </button>
      </form>
    </div>
  );
}
