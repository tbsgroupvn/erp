'use client';

import { useState } from 'react';
import { Settings, X, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { customersApi } from '@/lib/api/customers.api';
import type { Customer } from '@/lib/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const quickCustomerSchema = z.object({
  fullName: z.string().min(2, 'Tên khách hàng phải có ít nhất 2 ký tự'),
  phone: z.string().min(10, 'Số điện thoại không hợp lệ').max(15, 'Số điện thoại quá dài'),
  email: z.string().email('Email không hợp lệ').optional().or(z.literal('')),
  note: z.string().optional(),
});

type QuickCustomerForm = z.infer<typeof quickCustomerSchema>;

export interface QuickCustomerDialogProps {
  onCustomerCreated: (customer: Customer) => void;
  onClose: () => void;
  initialPhone?: string;
}

export function QuickCustomerDialog({
  onCustomerCreated,
  onClose,
  initialPhone = '',
}: QuickCustomerDialogProps) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<QuickCustomerForm>({
    resolver: zodResolver(quickCustomerSchema),
    defaultValues: {
      fullName: '',
      phone: initialPhone,
      email: '',
      note: '',
    },
  });

  const mutation = useMutation({
    mutationFn: (data: QuickCustomerForm) => customersApi.createQuick(data),
    onSuccess: (newCustomer) => {
      toast.success('Thêm mới khách hàng thành công');
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      onCustomerCreated(newCustomer);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Có lỗi xảy ra khi tạo khách hàng';
      toast.error(msg);
    },
  });

  const onSubmit = (data: QuickCustomerForm) => {
    mutation.mutate(data);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card w-full max-w-md rounded-lg border shadow-lg overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">Thêm Mới Khách Hàng Nhanh</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto">
          <form id="quick-customer-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Họ và tên *</label>
              <input
                {...register('fullName')}
                placeholder="VD: Nguyễn Văn A"
                className="w-full h-10 px-3 py-2 text-sm bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {errors.fullName && (
                <p className="text-xs text-destructive">{errors.fullName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Số điện thoại *</label>
              <input
                {...register('phone')}
                placeholder="VD: 0987123456"
                className="w-full h-10 px-3 py-2 text-sm bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {errors.phone && (
                <p className="text-xs text-destructive">{errors.phone.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Email (Tùy chọn)</label>
              <input
                {...register('email')}
                type="email"
                placeholder="VD: a@example.com"
                className="w-full h-10 px-3 py-2 text-sm bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Ghi chú (Tùy chọn)</label>
              <textarea
                {...register('note')}
                rows={2}
                placeholder="Nguồn: Zalo/Facebook..."
                className="w-full px-3 py-2 text-sm bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex items-center justify-end gap-3 bg-muted/20">
          <button
            type="button"
            onClick={onClose}
            disabled={mutation.isPending}
            className="px-4 py-2 text-sm font-medium rounded-md hover:bg-accent border bg-background"
          >
            Hủy bỏ
          </button>
          <button
            type="submit"
            form="quick-customer-form"
            disabled={mutation.isPending}
            className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang lưu...
              </>
            ) : (
              'Tạo khách hàng'
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
