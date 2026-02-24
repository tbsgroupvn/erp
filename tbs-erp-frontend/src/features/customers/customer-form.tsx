'use client';

import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2, Loader2, ShieldAlert } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CustomerTier, Branch } from '@/lib/types';
import { CUSTOMER_TIER_LABELS, BRANCH_LABELS } from '@/lib/utils/constants';
import { useEmployees } from '@/lib/hooks/use-employees';
import { useAuthStore } from '@/lib/stores/auth-store';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card';
import type { BaseResponse } from '@/lib/types';

// ---------------------------------------------------------------------------
// Exchange Rate Mode enum
// ---------------------------------------------------------------------------
export enum ExchangeRateMode {
  FLOATING = 'FLOATING',
  FIXED = 'FIXED',
}

const EXCHANGE_RATE_MODE_LABELS: Record<ExchangeRateMode, string> = {
  [ExchangeRateMode.FLOATING]: 'Tha noi',
  [ExchangeRateMode.FIXED]: 'Chot cung',
};

// ---------------------------------------------------------------------------
// Zod Schema
// ---------------------------------------------------------------------------
const VN_PHONE_REGEX = /^(0|\+84)\d{9,10}$/;
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

const contactSchema = z.object({
  fullName: z.string().min(1, 'Ten lien he bat buoc'),
  phone: z.string().regex(VN_PHONE_REGEX, 'SDT khong hop le (VD: 0912345678)').optional().or(z.literal('')),
  email: z.string().regex(EMAIL_REGEX, 'Email khong hop le').optional().or(z.literal('')).transform((v) => v || undefined),
  position: z.string().optional(),
  isPrimary: z.boolean().default(false),
});

export const customerFormSchema = z.object({
  fullName: z.string().min(1, 'Ho ten bat buoc'),
  phone: z.string().min(1, 'So dien thoai bat buoc').regex(VN_PHONE_REGEX, 'So dien thoai khong hop le (VD: 0912345678)'),
  companyName: z.string().optional(),
  email: z.string().regex(EMAIL_REGEX, 'Email khong hop le').optional().or(z.literal('')).transform((v) => v || undefined),
  address: z.string().optional(),
  taxCode: z.string().optional(),
  tier: z.nativeEnum(CustomerTier).default(CustomerTier.NEW),
  branch: z
    .union([z.nativeEnum(Branch), z.literal('')])
    .optional()
    .transform((v) => v || undefined),
  saleId: z.string().optional(),
  creditLimit: z.coerce.number().min(0, 'Han muc >= 0').default(0),
  depositRate: z.coerce.number().min(0, 'Ty le coc >= 0').max(100, 'Ty le coc <= 100').default(0),
  exchangeRateMode: z.nativeEnum(ExchangeRateMode).default(ExchangeRateMode.FLOATING),
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
  /** Additional customer data needed for grace period logic */
  customerData?: {
    id: string;
    isBlocked?: boolean;
    currentDebt?: number;
    creditLimit?: number;
  };
}

// ---------------------------------------------------------------------------
// Grace Period Dialog
// ---------------------------------------------------------------------------
function GracePeriodDialog({
  open,
  onClose,
  customerId,
}: {
  open: boolean;
  onClose: () => void;
  customerId: string;
}) {
  const [days, setDays] = useState('');
  const [reason, setReason] = useState('');

  const requestGracePeriod = useMutation({
    mutationFn: (data: { customerId: string; days: number; reason: string }) =>
      apiClient
        .post<BaseResponse<{ id: string }>>('/customers/grace-period', data)
        .then((r) => r.data.data),
    onSuccess: () => {
      toast.success('Da gui yeu cau an han thanh cong');
      handleClose();
    },
    onError: () => {
      toast.error('Khong the gui yeu cau an han. Vui long thu lai.');
    },
  });

  const handleClose = () => {
    setDays('');
    setReason('');
    onClose();
  };

  const handleSubmit = () => {
    if (!days || Number(days) <= 0) {
      toast.error('So ngay phai lon hon 0');
      return;
    }
    requestGracePeriod.mutate({
      customerId,
      days: Number(days),
      reason,
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/80"
        onClick={handleClose}
        aria-hidden="true"
      />
      <div className="relative z-50 w-full max-w-md rounded-lg border bg-background p-6 shadow-lg">
        <h2 className="text-lg font-semibold mb-1">Xin an han</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Yeu cau gia han thoi gian thanh toan cho khach hang nay.
        </p>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>So ngay an han *</Label>
            <Input
              type="number"
              min={1}
              max={90}
              placeholder="VD: 7"
              value={days}
              onChange={(e) => setDays(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Toi da 90 ngay. Yeu cau se can duoc phe duyet.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Ly do (tuy chon)</Label>
            <textarea
              rows={3}
              placeholder="Ly do xin an han..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={handleClose} disabled={requestGracePeriod.isPending}>
            Huy
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={requestGracePeriod.isPending || !days || Number(days) <= 0}
          >
            {requestGracePeriod.isPending ? 'Dang gui...' : 'Gui yeu cau'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function CustomerForm({
  mode,
  defaultValues,
  onSubmit,
  isPending,
  customerData,
}: CustomerFormProps) {
  const user = useAuthStore((s) => s.user);
  const [gracePeriodOpen, setGracePeriodOpen] = useState(false);

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
      branch: undefined,
      saleId: '',
      creditLimit: 0,
      depositRate: 0,
      exchangeRateMode: ExchangeRateMode.FLOATING,
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

  // Determine if grace period button should be shown
  const showGracePeriodButton =
    mode === 'edit' &&
    customerData &&
    (customerData.isBlocked === true ||
      (typeof customerData.currentDebt === 'number' &&
        typeof customerData.creditLimit === 'number' &&
        customerData.currentDebt > customerData.creditLimit));

  const selectClassName =
    'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Grace Period Alert Banner */}
        {showGracePeriodButton && (
          <Card className="border-amber-300 bg-amber-50">
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <ShieldAlert className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="text-sm font-medium text-amber-800">
                    {customerData.isBlocked
                      ? 'Khach hang dang bi khoa'
                      : 'Vuot han muc tin dung'}
                  </p>
                  <p className="text-xs text-amber-600">
                    {customerData.isBlocked
                      ? 'Khach hang bi chan do vi pham chinh sach.'
                      : `Cong no hien tai vuot han muc tin dung cho phep.`}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="border-amber-400 text-amber-700 hover:bg-amber-100"
                onClick={() => setGracePeriodOpen(true)}
              >
                Xin an han
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Card 1: Thong tin co ban */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Thong tin co ban</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* fullName */}
              <div className="space-y-2">
                <Label htmlFor="fullName">Ho ten *</Label>
                <Input id="fullName" placeholder="Ho ten khach hang" {...register('fullName')} />
                {errors.fullName && (
                  <p className="text-xs text-destructive">{errors.fullName.message}</p>
                )}
              </div>

              {/* phone */}
              <div className="space-y-2">
                <Label htmlFor="phone">So dien thoai *</Label>
                <Input id="phone" placeholder="So dien thoai" {...register('phone')} />
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
                <Label htmlFor="companyName">Cong ty</Label>
                <Input id="companyName" placeholder="Ten cong ty" {...register('companyName')} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Thong tin bo sung */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Thong tin bo sung</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* address */}
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="address">Dia chi</Label>
                <Input id="address" placeholder="Dia chi" {...register('address')} />
              </div>

              {/* taxCode */}
              <div className="space-y-2">
                <Label htmlFor="taxCode">Ma so thue</Label>
                <Input id="taxCode" placeholder="MST" {...register('taxCode')} />
              </div>

              {/* branch */}
              <div className="space-y-2">
                <Label htmlFor="branch">Chi nhanh</Label>
                <select
                  id="branch"
                  {...register('branch')}
                  className={selectClassName}
                >
                  <option value="">Chon chi nhanh</option>
                  {Object.entries(BRANCH_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* saleId */}
              <div className="space-y-2">
                <Label htmlFor="saleId">Sale phu trach</Label>
                <select
                  id="saleId"
                  {...register('saleId')}
                  className={selectClassName}
                >
                  <option value="">Chon Sale</option>
                  {salesEmployees.map((emp: any) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName} ({emp.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* tier */}
              <div className="space-y-2">
                <Label htmlFor="tier">Hang khach hang</Label>
                <select
                  id="tier"
                  {...register('tier')}
                  className={selectClassName}
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
                <Label htmlFor="creditLimit">Han muc tin dung</Label>
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
                <Label htmlFor="depositRate">Ty le coc (%)</Label>
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

              {/* exchangeRateMode (A4: Exchange Rate Mode) */}
              <div className="space-y-2">
                <Label htmlFor="exchangeRateMode">Che do ty gia</Label>
                <select
                  id="exchangeRateMode"
                  {...register('exchangeRateMode')}
                  className={selectClassName}
                >
                  {Object.entries(EXCHANGE_RATE_MODE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  {mode === 'create'
                    ? '"Tha noi" ap dung ty gia tai thoi diem thanh toan. "Chot cung" ap dung ty gia tai thoi diem tao don.'
                    : null}
                </p>
              </div>

              {/* note */}
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="note">Ghi chu</Label>
                <textarea
                  id="note"
                  rows={3}
                  placeholder="Ghi chu..."
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
                  <Label htmlFor="isActive">Dang hoat dong</Label>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Nguoi lien he */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Nguoi lien he</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="grid grid-cols-1 gap-3 sm:grid-cols-6 items-end rounded-md border p-4"
              >
                {/* fullName */}
                <div className="sm:col-span-2 space-y-1">
                  <Label className="text-xs">Ho ten *</Label>
                  <Input
                    placeholder="Ho ten"
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
                  <Label className="text-xs">SDT</Label>
                  <Input
                    placeholder="SDT"
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
                  <Label className="text-xs">Chuc vu</Label>
                  <Input
                    placeholder="Chuc vu"
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
                    Chinh
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
              Them lien he
            </Button>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="flex justify-end gap-3">
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === 'create' ? 'Tao khach hang' : 'Luu thay doi'}
          </Button>
        </div>
      </form>

      {/* Grace Period Dialog */}
      {customerData && (
        <GracePeriodDialog
          open={gracePeriodOpen}
          onClose={() => setGracePeriodOpen(false)}
          customerId={customerData.id}
        />
      )}
    </>
  );
}
