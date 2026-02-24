'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const registerSchema = z.object({
  fullName: z.string().min(2, 'Họ tên tối thiểu 2 ký tự').max(100, 'Họ tên tối đa 100 ký tự')
    .transform((v) => v.trim().replace(/<[^>]*>/g, '')),
  email: z.string().email('Email không hợp lệ').max(255, 'Email tối đa 255 ký tự'),
  phone: z.string().min(10, 'Số điện thoại không hợp lệ').max(15, 'Số điện thoại tối đa 15 ký tự')
    .regex(/^[0-9+\-\s()]+$/, 'Số điện thoại chỉ được chứa số và ký tự +, -, (, )'),
  companyName: z.string().min(1, 'Tên công ty là bắt buộc').max(200, 'Tên công ty tối đa 200 ký tự')
    .transform((v) => v.trim().replace(/<[^>]*>/g, '')),
  needs: z.string().max(1000, 'Nội dung tối đa 1000 ký tự').optional()
    .transform((v) => v?.trim().replace(/<[^>]*>/g, '')),
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      companyName: '',
      needs: '',
    },
  });

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/public/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: data.fullName,
          phone: data.phone,
          email: data.email,
          company: data.companyName,
          service: 'GENERAL',
          message: data.needs || 'Registration from website'
        })
      });

      if (response.ok) {
        toast.success('Đăng ký thành công! Chúng tôi sẽ liên hệ bạn sớm.');
        router.push('/login?registered=true');
      } else {
        throw new Error('Registration failed');
      }
    } catch (error) {
      toast.error('Đăng ký thất bại. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold text-gray-900">Đăng ký</h1>
          <p className="text-gray-600">
            Tạo tài khoản để bắt đầu sử dụng dịch vụ TBS ERP
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label
                htmlFor="company-name"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Tên công ty <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="company-name"
                {...register('companyName')}
                className={`w-full rounded-lg border px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${errors.companyName ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="Nhập tên công ty"
              />
              {errors.companyName && (
                <p className="mt-1 text-sm text-red-500">{errors.companyName.message}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="contact-name"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Họ và tên <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="contact-name"
                {...register('fullName')}
                className={`w-full rounded-lg border px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${errors.fullName ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="Nhập họ và tên"
              />
              {errors.fullName && (
                <p className="mt-1 text-sm text-red-500">{errors.fullName.message}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                id="email"
                {...register('email')}
                className={`w-full rounded-lg border px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${errors.email ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="email@example.com"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="phone"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Số điện thoại <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                id="phone"
                {...register('phone')}
                className={`w-full rounded-lg border px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${errors.phone ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="0xxx xxx xxx"
              />
              {errors.phone && (
                <p className="mt-1 text-sm text-red-500">{errors.phone.message}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="message"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Nhu cầu sử dụng
              </label>
              <textarea
                id="message"
                {...register('needs')}
                rows={4}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Mô tả ngắn về nhu cầu sử dụng dịch vụ của bạn"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition-all hover:bg-blue-700 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Đang xử lý...' : 'Đăng ký ngay'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-600">
            Đã có tài khoản?{' '}
            <Link
              href="/login"
              className="font-semibold text-blue-600 hover:text-blue-700"
            >
              Đăng nhập
            </Link>
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-gray-600 transition-colors hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Quay lại trang chủ
          </Link>
        </div>
      </div>
    </div>
  );
}
