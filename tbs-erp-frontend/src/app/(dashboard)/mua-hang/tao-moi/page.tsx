'use client';

import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Plus, Trash2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import { useCreatePurchaseRequest } from '@/lib/hooks/use-purchases';
import { Currency } from '@/lib/types';

const purchaseItemSchema = z.object({
  description: z.string().min(1, 'Mô tả bắt buộc'),
  quantity: z.coerce.number().min(1, 'Số lượng >= 1'),
  unit: z.string().min(1, 'Đơn vị bắt buộc'),
  unitPrice: z.coerce.number().min(0, 'Đơn giá >= 0'),
});

const createPRSchema = z.object({
  vendorId: z.string().min(1, 'Chọn nhà cung cấp'),
  orderId: z.string().optional(),
  currency: z.nativeEnum(Currency),
  notes: z.string().optional(),
  items: z.array(purchaseItemSchema).min(1, 'Cần ít nhất 1 sản phẩm'),
});

type CreatePRForm = z.infer<typeof createPRSchema>;

export default function TaoMoiMuaHangPage() {
  const router = useRouter();
  const createPR = useCreatePurchaseRequest();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    watch,
  } = useForm<CreatePRForm>({
    resolver: zodResolver(createPRSchema),
    defaultValues: {
      vendorId: '',
      orderId: '',
      currency: Currency.CNY,
      notes: '',
      items: [{ description: '', quantity: 1, unit: 'cai', unitPrice: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const watchedItems = watch('items');
  const totalAmount = watchedItems.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
    0,
  );

  const onSubmit = (data: CreatePRForm) => {
    const payload = {
      ...data,
      orderId: data.orderId || undefined,
      notes: data.notes || undefined,
    };
    createPR.mutate(payload, {
      onSuccess: () => {
        router.push('/mua-hang');
      },
      onError: (err: any) => {
        toast.error(err.response?.data?.message || 'Lỗi tạo yêu cầu mua');
      },
    });
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link href="/mua-hang" className="inline-flex h-9 w-9 items-center justify-center rounded-md border hover:bg-accent">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <PageHeader title="Tạo yêu cầu mua hàng" className="pb-0" />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <h3 className="text-lg font-semibold">Thông tin chung</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium">Nhà cung cấp *</p>
              <input
                {...register('vendorId')}
                placeholder="ID nhà cung cấp"
                className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {errors.vendorId && (
                <p className="text-xs text-destructive">{errors.vendorId.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Đơn hàng liên quan</p>
              <input
                {...register('orderId')}
                placeholder="ID đơn hàng (tùy chọn)"
                className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Tiền tệ *</p>
              <select
                {...register('currency')}
                className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="CNY">CNY</option>
                <option value="VND">VND</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Ghi chú</p>
            <textarea
              {...register('notes')}
              rows={3}
              placeholder="Ghi chú cho yêu cầu mua..."
              className="flex w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6 space-y-4">
          <h3 className="text-lg font-semibold">Danh sách hàng hóa</h3>
          {fields.map((field, index) => (
            <div key={field.id} className="grid grid-cols-1 gap-3 sm:grid-cols-6 items-end border-b pb-4">
              <div className="sm:col-span-2 space-y-1">
                <p className="text-xs font-medium">Mô tả *</p>
                <input
                  {...register(`items.${index}.description`)}
                  placeholder="Mô tả sản phẩm"
                  className="flex h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium">Số lượng</p>
                <input
                  type="number"
                  {...register(`items.${index}.quantity`)}
                  className="flex h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium">Đơn vị</p>
                <input
                  {...register(`items.${index}.unit`)}
                  placeholder="cai, kg, ..."
                  className="flex h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium">Đơn giá</p>
                <input
                  type="number"
                  {...register(`items.${index}.unitPrice`)}
                  className="flex h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => fields.length > 1 && remove(index)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => append({ description: '', quantity: 1, unit: 'cai', unitPrice: 0 })}
              className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent"
            >
              <Plus className="h-4 w-4" /> Thêm sản phẩm
            </button>
            <p className="text-sm font-medium">
              Tổng: <span className="text-lg font-bold">{totalAmount.toLocaleString('vi-VN')}</span>
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={createPR.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {createPR.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Tạo yêu cầu mua
          </button>
        </div>
      </form>
    </div>
  );
}
