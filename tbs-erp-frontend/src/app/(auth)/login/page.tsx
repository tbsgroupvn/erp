'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLogin } from '@/lib/hooks/use-auth';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

const loginSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/tong-quan';
  const loginMutation = useLogin();
  const [showPassword, setShowPassword] = useState(false);

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
      onSuccess: () => {
        toast.success('Đăng nhập thành công');
        router.push(callbackUrl);
      },
      onError: (err: any) => {
        toast.error(err.response?.data?.message || 'Đăng nhập thất bại');
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Logo & Title */}
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground text-xl font-bold">
          TBS
        </div>
        <h1 className="mt-4 text-2xl font-bold">TBS ERP</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Đăng nhập để tiếp tục
        </p>
      </div>

      {/* Login Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Email */}
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            placeholder="email@tbs.vn"
            {...register('email')}
            className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium">
            Mật khẩu
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Nhập mật khẩu"
              {...register('password')}
              className="flex h-10 w-full rounded-md border bg-background px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-destructive">{errors.password.message}</p>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loginMutation.isPending}
          className="flex h-10 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {loginMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            'Đăng nhập'
          )}
        </button>
      </form>
    </div>
  );
}
