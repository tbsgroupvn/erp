'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Plus, Trash2, Loader2, Search, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import { useCreateQuotation, useUpdateQuotation, useQuotation } from '@/lib/hooks/use-quotations';
import { apiClient } from '@/lib/api/client';
import { ServiceType, ShippingRoute, Branch } from '@/lib/types';
import { SERVICE_TYPE_LABELS, SHIPPING_ROUTE_LABELS, BRANCH_LABELS } from '@/lib/utils/constants';
import { formatCurrency } from '@/lib/utils/format';

// --- Schema ---
const quotationItemSchema = z.object({
  productName: z.string().min(2, 'Tên sản phẩm tối thiểu 2 ký tự'),
  productUrl: z.string().url('URL không hợp lệ').optional().or(z.literal('')),
  quantity: z.coerce.number().min(1, 'Số lượng >= 1'),
  unitPrice: z.coerce.number().min(0, 'Đơn giá >= 0'),
  note: z.string().optional(),
});

const createQuotationSchema = z.object({
  customerId: z.string().min(1, 'Vui lòng chọn khách hàng'),
  serviceType: z.nativeEnum(ServiceType),
  branch: z.nativeEnum(Branch),
  shippingRoute: z.nativeEnum(ShippingRoute).optional(),
  discountPercent: z.coerce.number().min(0).max(100).optional(),
  validityDays: z.coerce.number().min(1, 'Tối thiểu 1 ngày').optional(),
  note: z.string().optional(),
  items: z.array(quotationItemSchema).min(1, 'Cần ít nhất 1 hàng mục'),
});

type CreateQuotationForm = z.infer<typeof createQuotationSchema>;

interface CustomerOption {
  id: string;
  code: string;
  fullName: string;
  companyName?: string;
  phone?: string;
  tier?: string;
}

export default function TaoMoiBaoGiaPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-[60vh]"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
      <TaoMoiBaoGiaContent />
    </Suspense>
  );
}

function TaoMoiBaoGiaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('editId');
  const isEditMode = !!editId;
  const { data: editQuotation } = useQuotation(editId || '');
  const createQuotation = useCreateQuotation();
  const updateQuotation = useUpdateQuotation();

  // Customer search state
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerOptions, setCustomerOptions] = useState<CustomerOption[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [searchingCustomer, setSearchingCustomer] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    watch,
    setValue,
  } = useForm<CreateQuotationForm>({
    resolver: zodResolver(createQuotationSchema),
    defaultValues: {
      customerId: '',
      serviceType: ServiceType.VCT,
      branch: Branch.HN,
      discountPercent: 0,
      validityDays: 30,
      note: '',
      items: [{ productName: '', productUrl: '', quantity: 1, unitPrice: 0, note: '' }],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({ control, name: 'items' });
  const watchItems = watch('items');
  const watchDiscount = watch('discountPercent') || 0;

  // Pre-fill form data in edit mode
  useEffect(() => {
    if (isEditMode && editQuotation) {
      const q = editQuotation as any;
      setValue('customerId', q.customerId || q.customer?.id || '');
      setValue('serviceType', q.serviceType);
      setValue('branch', q.branch);
      setValue('shippingRoute', q.shippingRoute || undefined);
      setValue('discountPercent', Number(q.discountPercent) || 0);
      setValue('validityDays', q.validityDays || 30);
      setValue('note', q.note || '');
      if (q.customer) {
        setSelectedCustomer({
          id: q.customer.id,
          code: q.customer.code,
          fullName: q.customer.fullName,
          companyName: q.customer.companyName,
          phone: q.customer.phone,
        });
      }
      if (q.items && q.items.length > 0) {
        replace(
          q.items.map((item: any) => ({
            productName: item.productName,
            productUrl: item.productUrl || '',
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            note: item.note || '',
          })),
        );
      }
    }
  }, [isEditMode, editQuotation, setValue, replace]);

  // Calculations
  const subtotal = watchItems?.reduce((sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0), 0) || 0;
  const discountAmount = subtotal * (watchDiscount / 100);
  const afterDiscount = subtotal - discountAmount;
  const taxRate = 0.1;
  const taxAmount = afterDiscount * taxRate;
  const total = afterDiscount + taxAmount;

  // Debounced customer search
  const searchCustomers = useCallback(async (query: string) => {
    if (query.length < 1) {
      setCustomerOptions([]);
      return;
    }
    setSearchingCustomer(true);
    try {
      const res = await apiClient.get('/customers', { params: { search: query, limit: 10 } });
      const data = res.data?.data || res.data?.items || [];
      setCustomerOptions(Array.isArray(data) ? data : []);
    } catch {
      setCustomerOptions([]);
    } finally {
      setSearchingCustomer(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (customerSearch) searchCustomers(customerSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [customerSearch, searchCustomers]);

  const selectCustomer = (customer: CustomerOption) => {
    setSelectedCustomer(customer);
    setValue('customerId', customer.id);
    setShowCustomerDropdown(false);
    setCustomerSearch('');
  };

  const isPending = isEditMode ? updateQuotation.isPending : createQuotation.isPending;

  const onSubmit = (data: CreateQuotationForm) => {
    // Clean up empty productUrl
    const cleanData = {
      ...data,
      items: data.items.map((item) => ({
        ...item,
        productUrl: item.productUrl || undefined,
        note: item.note || undefined,
      })),
      shippingRoute: data.shippingRoute || undefined,
      note: data.note || undefined,
    };

    if (isEditMode && editId) {
      updateQuotation.mutate(
        { id: editId, data: cleanData },
        {
          onSuccess: () => {
            router.push(`/bao-gia/${editId}`);
          },
          onError: (err: any) => {
            toast.error(err.response?.data?.message || 'Lỗi cập nhật báo giá');
          },
        },
      );
    } else {
      createQuotation.mutate(cleanData, {
        onSuccess: () => {
          toast.success('Tạo báo giá thành công');
          router.push('/bao-gia');
        },
        onError: (err: any) => {
          toast.error(err.response?.data?.message || 'Lỗi tạo báo giá');
        },
      });
    }
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link href="/bao-gia" className="inline-flex h-9 w-9 items-center justify-center rounded-md border hover:bg-accent">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <PageHeader title={isEditMode ? 'Sửa báo giá' : 'Tạo báo giá mới'} className="pb-0" />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Thông tin chung */}
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <h3 className="text-lg font-semibold">Thông tin chung</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Customer Picker */}
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium">Khách hàng *</label>
              {selectedCustomer ? (
                <div className="flex items-center gap-3 rounded-md border bg-accent/30 p-3">
                  <div className="flex-1">
                    <p className="font-medium">{selectedCustomer.fullName}</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedCustomer.code}
                      {selectedCustomer.companyName && ` — ${selectedCustomer.companyName}`}
                      {selectedCustomer.phone && ` — ${selectedCustomer.phone}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSelectedCustomer(null); setValue('customerId', ''); }}
                    className="text-xs text-destructive hover:underline"
                  >
                    Đổi
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      value={customerSearch}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value);
                        setShowCustomerDropdown(true);
                      }}
                      onFocus={() => customerSearch && setShowCustomerDropdown(true)}
                      placeholder="Tìm theo tên, mã, SĐT khách hàng..."
                      className="flex h-10 w-full rounded-md border bg-background pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    {searchingCustomer && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
                  </div>
                  {showCustomerDropdown && customerOptions.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md max-h-60 overflow-y-auto">
                      {customerOptions.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => selectCustomer(c)}
                          className="flex w-full items-start gap-3 px-3 py-2 text-left text-sm hover:bg-accent"
                        >
                          <div>
                            <p className="font-medium">{c.fullName}</p>
                            <p className="text-xs text-muted-foreground">
                              {c.code}
                              {c.companyName && ` — ${c.companyName}`}
                              {c.tier && ` (${c.tier})`}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {showCustomerDropdown && customerSearch && !searchingCustomer && customerOptions.length === 0 && (
                    <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover p-3 text-sm text-muted-foreground shadow-md">
                      Không tìm thấy khách hàng
                    </div>
                  )}
                </div>
              )}
              <input type="hidden" {...register('customerId')} />
              {errors.customerId && <p className="text-xs text-destructive">{errors.customerId.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Loại dịch vụ *</label>
              <select
                {...register('serviceType')}
                className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {Object.entries(SERVICE_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Chi nhánh *</label>
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
              <label className="text-sm font-medium">Tuyến vận chuyển</label>
              <select
                {...register('shippingRoute')}
                className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Chọn tuyến</option>
                {Object.entries(SHIPPING_ROUTE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Giảm giá (%)</label>
              <input
                {...register('discountPercent')}
                type="number"
                min={0}
                max={100}
                step="0.1"
                placeholder="0"
                className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {watchDiscount > 0 && (
                <p className="text-xs text-amber-600">
                  {watchDiscount <= 3 ? 'Cần Leader + Kế toán duyệt' : watchDiscount <= 5 ? 'Cần GĐ Kinh doanh duyệt' : 'Cần Ban Giám đốc duyệt'}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Hiệu lực (ngày)</label>
              <input
                {...register('validityDays')}
                type="number"
                min={1}
                placeholder="30"
                className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Ghi chú</label>
            <textarea
              {...register('note')}
              rows={2}
              placeholder="Ghi chú cho báo giá..."
              className="flex w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Hàng mục */}
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <h3 className="text-lg font-semibold">Hàng mục báo giá</h3>
          {fields.map((field, index) => (
            <div key={field.id} className="rounded-md border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Hàng mục #{index + 1}</span>
                {fields.length > 1 && (
                  <button type="button" onClick={() => remove(index)} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-medium">Tên sản phẩm *</label>
                  <input
                    {...register(`items.${index}.productName`)}
                    placeholder="Tên sản phẩm / dịch vụ"
                    className="flex h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  {errors.items?.[index]?.productName && (
                    <p className="text-xs text-destructive">{errors.items[index]?.productName?.message}</p>
                  )}
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-medium">Link sản phẩm</label>
                  <div className="flex gap-2">
                    <input
                      {...register(`items.${index}.productUrl`)}
                      placeholder="https://item.taobao.com/..."
                      className="flex h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    {watchItems?.[index]?.productUrl && (
                      <a href={watchItems[index].productUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border hover:bg-accent">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Số lượng *</label>
                  <input type="number" min={1} {...register(`items.${index}.quantity`)} className="flex h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Đơn giá (VNĐ) *</label>
                  <input type="number" min={0} {...register(`items.${index}.unitPrice`)} className="flex h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Thành tiền:</span>
                <span className="font-medium">{formatCurrency((watchItems?.[index]?.quantity || 0) * (watchItems?.[index]?.unitPrice || 0))}</span>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => append({ productName: '', productUrl: '', quantity: 1, unitPrice: 0, note: '' })}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent"
          >
            <Plus className="h-4 w-4" /> Thêm hàng mục
          </button>

          {/* Tổng hợp giá */}
          <div className="border-t pt-4 space-y-2 text-sm max-w-xs ml-auto">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tạm tính</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {watchDiscount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Giảm giá ({watchDiscount}%)</span>
                <span className="text-destructive">-{formatCurrency(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Thuế (10%)</span>
              <span>{formatCurrency(taxAmount)}</span>
            </div>
            <div className="flex justify-between font-semibold text-base border-t pt-2">
              <span>Tổng cộng</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Link href="/bao-gia" className="rounded-md border px-4 py-2 text-sm hover:bg-accent">
            Hủy
          </Link>
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEditMode ? 'Lưu thay đổi' : 'Tạo báo giá'}
          </button>
        </div>
      </form>
    </div>
  );
}
