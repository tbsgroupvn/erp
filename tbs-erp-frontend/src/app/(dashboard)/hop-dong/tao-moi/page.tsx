'use client';

export const dynamic = 'force-dynamic';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Loader2, Search, X } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import { useCreateContract } from '@/lib/hooks/use-contracts';
import { apiClient } from '@/lib/api/client';
import { ContractType, Currency } from '@/lib/types';
import { CONTRACT_TYPE_LABELS } from '@/lib/utils/constants';
import { useAuthStore } from '@/lib/stores/auth-store';
import { formatCurrency } from '@/lib/utils/format';

// Transform empty string to undefined for optional fields
const emptyToUndefined = z.literal('').transform(() => undefined);
const optionalString = z.string().min(1).or(emptyToUndefined).optional();
const optionalNumber = z.union([
  z.coerce.number().min(0, 'Không được âm'),
  z.literal('').transform(() => undefined),
  z.literal(0).transform(() => undefined),
]).optional();

// --- Schema ---
const createContractSchema = z
  .object({
    customerId: z.string().min(1, 'Vui lòng chọn khách hàng'),
    saleId: z.string().min(1, 'Không xác định được người tạo'),
    type: z.nativeEnum(ContractType),
    parentId: optionalString,
    title: z.string().min(2, 'Tiêu đề tối thiểu 2 ký tự'),
    effectiveDate: z.string().min(1, 'Vui lòng chọn ngày hiệu lực'),
    expiryDate: optionalString,
    totalValue: z.coerce.number().min(0, 'Giá trị không được âm').optional(),
    depositRequired: z.coerce.number().min(0, 'Đặt cọc không được âm').optional(),
    currency: z.nativeEnum(Currency).optional(),
    terms: optionalString,
    note: optionalString,
  })
  .refine(
    (data) => {
      if (data.expiryDate && data.effectiveDate) {
        return new Date(data.expiryDate) > new Date(data.effectiveDate);
      }
      return true;
    },
    { message: 'Ngày hết hạn phải sau ngày hiệu lực', path: ['expiryDate'] },
  )
  .refine(
    (data) => {
      if (data.depositRequired && data.totalValue) {
        return data.depositRequired <= data.totalValue;
      }
      return true;
    },
    { message: 'Đặt cọc không được vượt quá giá trị hợp đồng', path: ['depositRequired'] },
  );

type CreateContractForm = z.infer<typeof createContractSchema>;

interface CustomerOption {
  id: string;
  code: string;
  fullName: string;
  companyName?: string;
}

interface ParentContractOption {
  id: string;
  code: string;
  title: string;
  status: string;
}

export default function TaoHopDongPage() {
  const router = useRouter();
  const createContract = useCreateContract();
  const user = useAuthStore((s) => s.user);

  // Customer search
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerOptions, setCustomerOptions] = useState<CustomerOption[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const customerDebounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Parent contract search (for APPENDIX)
  const [parentOptions, setParentOptions] = useState<ParentContractOption[]>([]);
  const [selectedParent, setSelectedParent] = useState<ParentContractOption | null>(null);
  const [parentSearch, setParentSearch] = useState('');
  const [searchingParent, setSearchingParent] = useState(false);
  const parentDebounceRef = useRef<ReturnType<typeof setTimeout>>();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateContractForm>({
    resolver: zodResolver(createContractSchema),
    defaultValues: {
      saleId: user?.id ?? '',
      type: ContractType.MASTER,
      currency: Currency.VND,
      effectiveDate: new Date().toISOString().split('T')[0],
    },
  });

  const contractType = watch('type');
  const totalValue = watch('totalValue');
  const depositRequired = watch('depositRequired');

  // Update saleId when user loads
  useEffect(() => {
    if (user?.id) {
      setValue('saleId', user.id);
    }
  }, [user?.id, setValue]);

  // --- Customer search with debounce ---
  const searchCustomers = useCallback((query: string) => {
    if (customerDebounceRef.current) clearTimeout(customerDebounceRef.current);
    if (query.length < 2) {
      setCustomerOptions([]);
      return;
    }
    customerDebounceRef.current = setTimeout(async () => {
      setSearchingCustomer(true);
      try {
        const res = await apiClient.get('/customers', {
          params: { search: query, limit: 10 },
        });
        const customers = res.data?.data ?? [];
        setCustomerOptions(
          customers.map((c: any) => ({
            id: c.id,
            code: c.code,
            fullName: c.fullName,
            companyName: c.companyName,
          })),
        );
      } catch {
        setCustomerOptions([]);
      } finally {
        setSearchingCustomer(false);
      }
    }, 300);
  }, []);

  // --- Parent contract search with debounce ---
  const searchParentContracts = useCallback(
    (query: string) => {
      if (parentDebounceRef.current) clearTimeout(parentDebounceRef.current);
      if (!selectedCustomer) return;
      parentDebounceRef.current = setTimeout(async () => {
        setSearchingParent(true);
        try {
          const res = await apiClient.get('/contracts', {
            params: {
              search: query || undefined,
              type: 'MASTER',
              customerId: selectedCustomer.id,
              limit: 10,
            },
          });
          const contracts = res.data?.data ?? [];
          setParentOptions(
            contracts.map((c: any) => ({
              id: c.id,
              code: c.code,
              title: c.title,
              status: c.status,
            })),
          );
        } catch {
          setParentOptions([]);
        } finally {
          setSearchingParent(false);
        }
      }, 300);
    },
    [selectedCustomer],
  );

  // Auto-load parent contracts when customer changes and type is APPENDIX
  useEffect(() => {
    if (contractType === ContractType.APPENDIX && selectedCustomer) {
      searchParentContracts('');
    }
  }, [contractType, selectedCustomer, searchParentContracts]);

  const selectCustomer = (customer: CustomerOption) => {
    setSelectedCustomer(customer);
    setValue('customerId', customer.id);
    setCustomerSearch('');
    setCustomerOptions([]);
    // Reset parent when customer changes
    setSelectedParent(null);
    setValue('parentId', undefined);
    setParentOptions([]);
  };

  const clearCustomer = () => {
    setSelectedCustomer(null);
    setValue('customerId', '');
    setSelectedParent(null);
    setValue('parentId', undefined);
    setParentOptions([]);
  };

  const selectParent = (parent: ParentContractOption) => {
    setSelectedParent(parent);
    setValue('parentId', parent.id);
    setParentSearch('');
    setParentOptions([]);
  };

  const onSubmit = (data: CreateContractForm) => {
    // Clean up undefined/empty optional fields before sending to API
    const payload: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== '' && value !== null) {
        payload[key] = value;
      }
    }
    // Always include required fields even if they look empty
    payload.customerId = data.customerId;
    payload.saleId = data.saleId;
    payload.type = data.type;
    payload.title = data.title;
    payload.effectiveDate = data.effectiveDate;

    createContract.mutate(payload as any, {
      onSuccess: (result: any) => {
        router.push(`/hop-dong/${result.id}`);
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.message;
        if (msg) toast.error(msg);
      },
    });
  };

  return (
    <div>
      <PageHeader title="Tạo hợp đồng" description="Tạo hợp đồng hoặc phụ lục mới">
        <Link
          href="/hop-dong"
          className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại
        </Link>
      </PageHeader>

      <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6 mt-6">
        {/* Contract Type */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Loại hợp đồng <span className="text-destructive">*</span>
          </label>
          <select
            {...register('type')}
            className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {Object.values(ContractType).map((t) => (
              <option key={t} value={t}>
                {CONTRACT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          {errors.type && <p className="text-xs text-destructive">{errors.type.message}</p>}
        </div>

        {/* Customer Search */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Khách hàng <span className="text-destructive">*</span>
          </label>
          {selectedCustomer ? (
            <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2.5">
              <span className="inline-flex items-center rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                {selectedCustomer.code}
              </span>
              <span className="text-sm font-medium">{selectedCustomer.fullName}</span>
              {selectedCustomer.companyName && (
                <span className="text-xs text-muted-foreground">({selectedCustomer.companyName})</span>
              )}
              <button
                type="button"
                onClick={clearCustomer}
                className="ml-auto rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  searchCustomers(e.target.value);
                }}
                placeholder="Tìm khách hàng (mã, tên, công ty)..."
                className="flex h-10 w-full rounded-md border bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {searchingCustomer && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
              {customerOptions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md max-h-48 overflow-y-auto">
                  {customerOptions.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectCustomer(c)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
                    >
                      <span className="inline-flex items-center rounded bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
                        {c.code}
                      </span>
                      <span>{c.fullName}</span>
                      {c.companyName && (
                        <span className="text-xs text-muted-foreground">({c.companyName})</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {errors.customerId && <p className="text-xs text-destructive">{errors.customerId.message}</p>}
        </div>

        {/* Parent Contract (only for APPENDIX) */}
        {contractType === ContractType.APPENDIX && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Hợp đồng chính (Master)</label>
            {!selectedCustomer ? (
              <p className="text-xs text-muted-foreground italic">Vui lòng chọn khách hàng trước</p>
            ) : selectedParent ? (
              <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2.5">
                <span className="inline-flex items-center rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                  {selectedParent.code}
                </span>
                <span className="text-sm">{selectedParent.title}</span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedParent(null);
                    setValue('parentId', undefined);
                  }}
                  className="ml-auto rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={parentSearch}
                  onChange={(e) => {
                    setParentSearch(e.target.value);
                    searchParentContracts(e.target.value);
                  }}
                  placeholder="Tìm hợp đồng chính..."
                  className="flex h-10 w-full rounded-md border bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {searchingParent && (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                )}
                {parentOptions.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md max-h-48 overflow-y-auto">
                    {parentOptions.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => selectParent(c)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
                      >
                        <span className="inline-flex items-center rounded bg-blue-100 px-1.5 py-0.5 text-xs font-semibold text-blue-700">
                          {c.code}
                        </span>
                        <span className="flex-1 truncate">{c.title}</span>
                        <span className="text-xs text-muted-foreground">{c.status}</span>
                      </button>
                    ))}
                  </div>
                )}
                {parentOptions.length === 0 && !searchingParent && parentSearch === '' && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Không tìm thấy HĐ Master cho khách hàng này. Phụ lục sẽ được tạo độc lập.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Title */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Tiêu đề hợp đồng <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            {...register('title')}
            placeholder="VD: Hợp đồng vận chuyển hàng hóa TQ-VN"
            className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Ngày hiệu lực <span className="text-destructive">*</span>
            </label>
            <input
              type="date"
              {...register('effectiveDate')}
              className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {errors.effectiveDate && (
              <p className="text-xs text-destructive">{errors.effectiveDate.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Ngày hết hạn</label>
            <input
              type="date"
              {...register('expiryDate')}
              className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {errors.expiryDate && (
              <p className="text-xs text-destructive">{errors.expiryDate.message}</p>
            )}
          </div>
        </div>

        {/* Financial */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Giá trị hợp đồng</label>
            <div className="relative">
              <input
                type="number"
                {...register('totalValue')}
                placeholder="0"
                className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring pr-14"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                VND
              </span>
            </div>
            {totalValue != null && totalValue > 0 && (
              <p className="text-xs text-muted-foreground">{formatCurrency(totalValue)}</p>
            )}
            {errors.totalValue && (
              <p className="text-xs text-destructive">{errors.totalValue.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Đặt cọc yêu cầu</label>
            <div className="relative">
              <input
                type="number"
                {...register('depositRequired')}
                placeholder="0"
                className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring pr-14"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                VND
              </span>
            </div>
            {depositRequired != null && depositRequired > 0 && (
              <p className="text-xs text-muted-foreground">{formatCurrency(depositRequired)}</p>
            )}
            {errors.depositRequired && (
              <p className="text-xs text-destructive">{errors.depositRequired.message}</p>
            )}
          </div>
        </div>

        {/* Terms */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Điều khoản</label>
          <textarea
            {...register('terms')}
            rows={4}
            placeholder="Nhập điều khoản hợp đồng..."
            className="flex w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y min-h-[100px]"
          />
        </div>

        {/* Note */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Ghi chú</label>
          <textarea
            {...register('note')}
            rows={2}
            placeholder="Ghi chú thêm..."
            className="flex w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
          />
        </div>

        {/* Error summary */}
        {Object.keys(errors).length > 0 && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3">
            <p className="text-sm font-medium text-destructive">
              Vui lòng kiểm tra lại {Object.keys(errors).length} lỗi ở trên
            </p>
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-3 pt-4 border-t">
          <button
            type="submit"
            disabled={createContract.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {createContract.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Tạo hợp đồng
          </button>
          <Link href="/hop-dong" className="rounded-md border px-6 py-2.5 text-sm hover:bg-accent">
            Hủy
          </Link>
        </div>
      </form>
    </div>
  );
}
