'use client';

export const dynamic = 'force-dynamic';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Loader2, Search } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import { useCreateContract } from '@/lib/hooks/use-contracts';
import { apiClient } from '@/lib/api/client';
import { ContractType, Currency } from '@/lib/types';
import { CONTRACT_TYPE_LABELS } from '@/lib/utils/constants';
import { useAuthStore } from '@/lib/stores/auth-store';

// --- Schema ---
const createContractSchema = z.object({
  customerId: z.string().min(1, 'Vui lòng chọn khách hàng'),
  saleId: z.string().min(1),
  type: z.nativeEnum(ContractType),
  parentId: z.string().optional(),
  title: z.string().min(2, 'Tiêu đề tối thiểu 2 ký tự'),
  effectiveDate: z.string().min(1, 'Vui lòng chọn ngày hiệu lực'),
  expiryDate: z.string().optional(),
  totalValue: z.coerce.number().min(0).optional(),
  depositRequired: z.coerce.number().min(0).optional(),
  currency: z.nativeEnum(Currency).optional(),
  terms: z.string().optional(),
  note: z.string().optional(),
});

type CreateContractForm = z.infer<typeof createContractSchema>;

interface CustomerOption {
  id: string;
  code: string;
  fullName: string;
  companyName?: string;
}

export default function TaoHopDongPage() {
  const router = useRouter();
  const createContract = useCreateContract();
  const user = useAuthStore((s) => s.user);

  const [customerSearch, setCustomerSearch] = useState('');
  const [customerOptions, setCustomerOptions] = useState<CustomerOption[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);
  const [searchingCustomer, setSearchingCustomer] = useState(false);

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

  const searchCustomers = useCallback(
    async (query: string) => {
      if (query.length < 2) {
        setCustomerOptions([]);
        return;
      }
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
    },
    [],
  );

  const selectCustomer = (customer: CustomerOption) => {
    setSelectedCustomer(customer);
    setValue('customerId', customer.id);
    setCustomerSearch('');
    setCustomerOptions([]);
  };

  const onSubmit = (data: CreateContractForm) => {
    createContract.mutate(data, {
      onSuccess: (result: any) => {
        toast.success('Tạo hợp đồng thành công');
        router.push(`/hop-dong/${result.id}`);
      },
    });
  };

  return (
    <div>
      <PageHeader title="Tạo hợp đồng" description="Tạo hợp đồng hoặc phụ lục mới">
        <Link href="/hop-dong" className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm hover:bg-accent">
          <ArrowLeft className="h-4 w-4" />
          Quay lại
        </Link>
      </PageHeader>

      <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
        {/* Contract Type */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Loại hợp đồng *</label>
          <select
            {...register('type')}
            className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {Object.values(ContractType).map((t) => (
              <option key={t} value={t}>{CONTRACT_TYPE_LABELS[t]}</option>
            ))}
          </select>
          {errors.type && <p className="text-xs text-destructive">{errors.type.message}</p>}
        </div>

        {/* Customer Search */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Khách hàng *</label>
          {selectedCustomer ? (
            <div className="flex items-center gap-2 rounded-md border p-2">
              <span className="text-sm font-medium">{selectedCustomer.code}</span>
              <span className="text-sm">{selectedCustomer.fullName}</span>
              {selectedCustomer.companyName && (
                <span className="text-xs text-muted-foreground">({selectedCustomer.companyName})</span>
              )}
              <button
                type="button"
                onClick={() => { setSelectedCustomer(null); setValue('customerId', ''); }}
                className="ml-auto text-xs text-destructive hover:underline"
              >
                Đổi
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={customerSearch}
                onChange={(e) => { setCustomerSearch(e.target.value); searchCustomers(e.target.value); }}
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
                      <span className="font-medium">{c.code}</span>
                      <span>{c.fullName}</span>
                      {c.companyName && <span className="text-xs text-muted-foreground">({c.companyName})</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {errors.customerId && <p className="text-xs text-destructive">{errors.customerId.message}</p>}
        </div>

        {/* Title */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Tiêu đề hợp đồng *</label>
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
            <label className="text-sm font-medium">Ngày hiệu lực *</label>
            <input
              type="date"
              {...register('effectiveDate')}
              className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {errors.effectiveDate && <p className="text-xs text-destructive">{errors.effectiveDate.message}</p>}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Ngày hết hạn</label>
            <input
              type="date"
              {...register('expiryDate')}
              className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Financial */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Giá trị hợp đồng (VND)</label>
            <input
              type="number"
              {...register('totalValue')}
              placeholder="0"
              className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Đặt cọc yêu cầu (VND)</label>
            <input
              type="number"
              {...register('depositRequired')}
              placeholder="0"
              className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Terms */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Điều khoản</label>
          <textarea
            {...register('terms')}
            rows={4}
            placeholder="Nhập điều khoản hợp đồng..."
            className="flex w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Note */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Ghi chú</label>
          <textarea
            {...register('note')}
            rows={2}
            placeholder="Ghi chú thêm..."
            className="flex w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Submit */}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={createContract.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {createContract.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Tạo hợp đồng
          </button>
          <Link
            href="/hop-dong"
            className="rounded-md border px-6 py-2.5 text-sm hover:bg-accent"
          >
            Hủy
          </Link>
        </div>
      </form>
    </div>
  );
}
