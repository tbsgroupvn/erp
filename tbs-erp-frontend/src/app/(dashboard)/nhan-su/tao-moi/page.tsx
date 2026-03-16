'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import { useCreateEmployee } from '@/lib/hooks/use-employees';
import { Branch } from '@/lib/types';
import { BRANCH_LABELS } from '@/lib/utils/constants';

const createEmployeeSchema = z.object({
  fullName: z.string().min(1, 'Họ tên bắt buộc'),
  email: z.string().email('Email không hợp lệ').optional().or(z.literal('')),
  phone: z.string().optional(),
  departmentCode: z.string().min(1, 'Chọn phòng ban'),
  positionTitle: z.string().min(1, 'Chức vụ bắt buộc'),
  branch: z.nativeEnum(Branch),
  managerId: z.string().optional(),
  joinDate: z.string().min(1, 'Ngày vào làm bắt buộc'),
  salary: z.coerce.number().min(0, 'Lương >= 0').optional(),
});

type CreateEmployeeForm = z.infer<typeof createEmployeeSchema>;

export default function TaoMoiNhanVienPage() {
  const router = useRouter();
  const createEmployee = useCreateEmployee();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateEmployeeForm>({
    resolver: zodResolver(createEmployeeSchema),
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      departmentCode: '',
      positionTitle: '',
      branch: Branch.HN,
      managerId: '',
      joinDate: '',
      salary: undefined,
    },
  });

  const onSubmit = (data: CreateEmployeeForm) => {
    createEmployee.mutate(data, {
      onSuccess: () => {
        toast.success('Tạo nhân viên thành công');
        router.push('/nhan-su');
      },
      onError: (err: any) => {
        toast.error(err.response?.data?.message || 'Lỗi tạo nhân viên');
      },
    });
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link href="/nhan-su" className="inline-flex h-9 w-9 items-center justify-center rounded-md border hover:bg-accent">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <PageHeader title="Thêm nhân viên mới" className="pb-0" />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium">Họ tên *</p>
              <input
                {...register('fullName')}
                placeholder="Nhập họ tên"
                className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {errors.fullName && (
                <p className="text-xs text-destructive">{errors.fullName.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Email</p>
              <input
                {...register('email')}
                type="email"
                placeholder="email@company.com"
                className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Số điện thoại</p>
              <input
                {...register('phone')}
                placeholder="0912345678"
                className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Phòng ban *</p>
              <input
                {...register('departmentCode')}
                placeholder="Mã phòng ban"
                className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {errors.departmentCode && (
                <p className="text-xs text-destructive">{errors.departmentCode.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Chức vụ *</p>
              <input
                {...register('positionTitle')}
                placeholder="Chức vụ"
                className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {errors.positionTitle && (
                <p className="text-xs text-destructive">{errors.positionTitle.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Chi nhánh *</p>
              <select
                {...register('branch')}
                className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {Object.entries(BRANCH_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Quản lý trực tiếp</p>
              <input
                {...register('managerId')}
                placeholder="ID quản lý"
                className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Ngày vào làm *</p>
              <input
                {...register('joinDate')}
                type="date"
                className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {errors.joinDate && (
                <p className="text-xs text-destructive">{errors.joinDate.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Lương</p>
              <input
                {...register('salary')}
                type="number"
                placeholder="0"
                className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Link href="/nhan-su" className="rounded-md border px-4 py-2 text-sm hover:bg-accent">
              Hủy
            </Link>
            <button
              type="submit"
              disabled={createEmployee.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {createEmployee.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Tạo nhân viên
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
