'use client';

import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { CustomerTier, Branch } from '@/lib/types';
import { CUSTOMER_TIER_LABELS, BRANCH_LABELS } from '@/lib/utils/constants';
import { useEmployees } from '@/lib/hooks/use-employees';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card';

// ---------------------------------------------------------------------------
// Zod Schema
// ---------------------------------------------------------------------------
const contactSchema = z.object({
  fullName: z.string().min(1, 'Tên liên hệ bắt buộc'),
  phone: z.string().optional(),
  email: z.string().email('Email không hợp lệ').optional().or(z.literal('')).transform((v) => v || undefined),
  position: z.string().optional(),
  isPrimary: z.boolean().default(false),
});

export const customerFormSchema = z.object({
  fullName: z.string().min(1, 'Họ tên bắt buộc'),
  phone: z.string().min(1, 'Số điện thoại bắt buộc'),
  companyName: z.string().optional(),
  email: z.string().email('Email không hợp lệ').optional().or(z.literal('')).transform((v) => v || undefined),
  address: z.string().optional(),
  taxCode: z.string().optional(),
  tier: z.nativeEnum(CustomerTier).default(CustomerTier.NEW),
  branch: z
    .union([z.nativeEnum(Branch), z.literal('')])
    .optional()
    .transform((v) => v || undefined),
  saleId: z.string().optional(),
  creditLimit: z.coerce.number().min(0, 'Hạn mức >= 0').default(0),
  depositRate: z.coerce.number().min(0, 'Tỷ lệ cọc >= 0').max(100, 'Tỷ lệ cọc <= 100').default(0),
  note: z.string().optional(),
  isActive: z.boolean().optional(),
  contacts: z.array(contactSchema).default([]),
});

export type CustomerFormData = z.infer<typeof customerFormSchema>;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface CustomerFormProps {
  mode: 'create' | 'edit';
  defaultValues?: Partial<CustomerFormData>;
  onSubmit: (data: CustomerFormData) => void;
  isPending: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function CustomerForm({ mode, defaultValues, onSubmit, isPending }: CustomerFormProps) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      fullName: '',
      phone: '',
      companyName: '',
      email: '',
      address: '',
      taxCode: '',
      tier: CustomerTier.NEW,
      branch: '' as any,
      saleId: '',
      creditLimit: 0,
      depositRate: 0,
      note: '',
      isActive: true,
      contacts: [],
      ...defaultValues,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'contacts',
  });

  // Fetch sales employees for dropdown
  const { data: salesData } = useEmployees({ departmentCode: 'SALES', limit: 100 });
  const salesEmployees = salesData?.data ?? [];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Card 1: Thong tin co ban */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Thông tin cơ bản</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* fullName */}
            <div className="space-y-2">
              <Label htmlFor="fullName">Họ tên *</Label>
              <Input id="fullName" placeholder="Họ tên khách hàng" {...register('fullName')} />
              {errors.fullName && (
                <p className="text-xs text-destructive">{errors.fullName.message}</p>
              )}
            </div>

            {/* phone */}
            <div className="space-y-2">
              <Label htmlFor="phone">Số điện thoại *</Label>
              <Input id="phone" placeholder="Số điện thoại" {...register('phone')} />
              {errors.phone && (
                <p className="text-xs text-destructive">{errors.phone.message}</p>
              )}
            </div>

            {/* email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="Email" {...register('email')} />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>

            {/* companyName */}
            <div className="space-y-2">
              <Label htmlFor="companyName">Công ty</Label>
              <Input id="companyName" placeholder="Tên công ty" {...register('companyName')} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card 2: Thong tin bo sung */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Thông tin bổ sung</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* address */}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="address">Địa chỉ</Label>
              <Input id="address" placeholder="Địa chỉ" {...register('address')} />
            </div>

            {/* taxCode */}
            <div className="space-y-2">
              <Label htmlFor="taxCode">Mã số thuế</Label>
              <Input id="taxCode" placeholder="MST" {...register('taxCode')} />
            </div>

            {/* branch */}
            <div className="space-y-2">
              <Label htmlFor="branch">Chi nhánh</Label>
              <select
                id="branch"
                {...register('branch')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Chọn chi nhánh</option>
                {Object.entries(BRANCH_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* saleId */}
            <div className="space-y-2">
              <Label htmlFor="saleId">Sale phụ trách</Label>
              <select
                id="saleId"
                {...register('saleId')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Chọn Sale</option>
                {salesEmployees.map((emp: any) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.fullName} ({emp.code})
                  </option>
                ))}
              </select>
            </div>

            {/* tier */}
            <div className="space-y-2">
              <Label htmlFor="tier">Hạng khách hàng</Label>
              <select
                id="tier"
                {...register('tier')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {Object.entries(CUSTOMER_TIER_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* creditLimit */}
            <div className="space-y-2">
              <Label htmlFor="creditLimit">Hạn mức tín dụng</Label>
              <Input
                id="creditLimit"
                type="number"
                min={0}
                placeholder="0"
                {...register('creditLimit')}
              />
              {errors.creditLimit && (
                <p className="text-xs text-destructive">{errors.creditLimit.message}</p>
              )}
            </div>

            {/* depositRate */}
            <div className="space-y-2">
              <Label htmlFor="depositRate">Tỷ lệ cọc (%)</Label>
              <Input
                id="depositRate"
                type="number"
                min={0}
                max={100}
                placeholder="0"
                {...register('depositRate')}
              />
              {errors.depositRate && (
                <p className="text-xs text-destructive">{errors.depositRate.message}</p>
              )}
            </div>

            {/* note */}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="note">Ghi chú</Label>
              <textarea
                id="note"
                rows={3}
                placeholder="Ghi chú..."
                {...register('note')}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>

            {/* isActive — only in edit mode */}
            {mode === 'edit' && (
              <div className="flex items-center gap-3 sm:col-span-2">
                <input
                  id="isActive"
                  type="checkbox"
                  {...register('isActive')}
                  className="h-4 w-4 rounded border-input"
                />
                <Label htmlFor="isActive">Đang hoạt động</Label>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Card 3: Nguoi lien he */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Người liên hệ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="grid grid-cols-1 gap-3 sm:grid-cols-6 items-end rounded-md border p-4"
            >
              {/* fullName */}
              <div className="sm:col-span-2 space-y-1">
                <Label className="text-xs">Họ tên *</Label>
                <Input
                  placeholder="Họ tên"
                  {...register(`contacts.${index}.fullName`)}
                />
                {errors.contacts?.[index]?.fullName && (
                  <p className="text-xs text-destructive">
                    {errors.contacts[index].fullName.message}
                  </p>
                )}
              </div>

              {/* phone */}
              <div className="space-y-1">
                <Label className="text-xs">SĐT</Label>
                <Input
                  placeholder="SĐT"
                  {...register(`contacts.${index}.phone`)}
                />
              </div>

              {/* email */}
              <div className="space-y-1">
                <Label className="text-xs">Email</Label>
                <Input
                  placeholder="Email"
                  {...register(`contacts.${index}.email`)}
                />
              </div>

              {/* position */}
              <div className="space-y-1">
                <Label className="text-xs">Chức vụ</Label>
                <Input
                  placeholder="Chức vụ"
                  {...register(`contacts.${index}.position`)}
                />
              </div>

              {/* isPrimary + delete */}
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs cursor-pointer whitespace-nowrap">
                  <input
                    type="checkbox"
                    {...register(`contacts.${index}.isPrimary`)}
                    className="h-4 w-4 rounded border-input"
                  />
                  Chính
                </label>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              append({
                fullName: '',
                phone: '',
                email: '',
                position: '',
                isPrimary: false,
              })
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            Thêm liên hệ
          </Button>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {mode === 'create' ? 'Tạo khách hàng' : 'Lưu thay đổi'}
        </Button>
      </div>
    </form>
  );
}
