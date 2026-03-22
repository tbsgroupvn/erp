'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Loader2, Search, X } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import { CustomerPicker } from '@/components/shared/customer-picker';
import type { CustomerPickerValue } from '@/components/shared/customer-picker';
import { useCreateComplaint } from '@/lib/hooks/use-complaints';
import { useMasterOrders } from '@/lib/hooks/use-orders';
import { ComplaintType, ComplaintSeverity } from '@/lib/types';
import type { Customer, MasterOrder } from '@/lib/types';
import { COMPLAINT_TYPE_LABELS, COMPLAINT_SEVERITY_LABELS } from '@/lib/utils/constants';

const createComplaintSchema = z.object({
  customerId: z.string().min(1, 'Chọn khách hàng'),
  orderId: z.string().optional(),
  type: z.nativeEnum(ComplaintType),
  severity: z.nativeEnum(ComplaintSeverity),
  description: z.string().min(1, 'Nhập mô tả'),
});

type CreateComplaintForm = z.infer<typeof createComplaintSchema>;

export default function TaoMoiKhieuNaiPage() {
  const router = useRouter();
  const createComplaint = useCreateComplaint();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateComplaintForm>({
    resolver: zodResolver(createComplaintSchema),
    defaultValues: {
      customerId: '',
      orderId: '',
      type: ComplaintType.OTHER,
      severity: ComplaintSeverity.MEDIUM,
      description: '',
    },
  });

  // Customer state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Order picker
  const [orderSearch, setOrderSearch] = useState('');
  const [debouncedOrderSearch, setDebouncedOrderSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<MasterOrder | null>(null);
  const [showOrderDropdown, setShowOrderDropdown] = useState(false);
  const orderDropdownRef = useRef<HTMLDivElement>(null);

  const customerId = watch('customerId');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedOrderSearch(orderSearch), 300);
    return () => clearTimeout(timer);
  }, [orderSearch]);

  const { data: ordersData, isLoading: isLoadingOrders } = useMasterOrders(
    customerId
      ? {
          customerId,
          search: debouncedOrderSearch || undefined,
          limit: 10,
        }
      : { limit: 0 }
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (orderDropdownRef.current && !orderDropdownRef.current.contains(event.target as Node)) {
        setShowOrderDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCustomerChange = useCallback(
    (customer: CustomerPickerValue | null) => {
      if (customer) {
        setSelectedCustomer(customer as unknown as Customer);
        setValue('customerId', customer.id, { shouldValidate: true });
      } else {
        setSelectedCustomer(null);
        setValue('customerId', '', { shouldValidate: true });
      }
      // Clear order selection when customer changes
      setSelectedOrder(null);
      setValue('orderId', '');
    },
    [setValue],
  );

  const handleSelectOrder = useCallback(
    (order: MasterOrder) => {
      setSelectedOrder(order);
      setValue('orderId', order.id);
      setOrderSearch('');
      setShowOrderDropdown(false);
    },
    [setValue]
  );

  const onSubmit = (data: CreateComplaintForm) => {
    createComplaint.mutate(data, {
      onSuccess: () => {
        toast.success('Tạo khiếu nại thành công');
        router.push('/khieu-nai');
      },
      onError: (err: any) => {
        toast.error(err.response?.data?.message || 'Lỗi tạo khiếu nại');
      },
    });
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link href="/khieu-nai" className="inline-flex h-9 w-9 items-center justify-center rounded-md border hover:bg-accent">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <PageHeader title="Tạo khiếu nại mới" className="pb-0" />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Customer Picker */}
            <CustomerPicker
              value={selectedCustomer?.id ?? null}
              onChange={handleCustomerChange}
              error={errors.customerId?.message as string}
              selectedCustomer={
                selectedCustomer
                  ? {
                      id: selectedCustomer.id,
                      code: selectedCustomer.code,
                      fullName: selectedCustomer.fullName,
                      companyName: selectedCustomer.companyName,
                      phone: selectedCustomer.phone,
                    }
                  : null
              }
              label="Kh\u00e1ch h\u00e0ng *"
              placeholder="T\u00ecm kh\u00e1ch h\u00e0ng..."
            />

            {/* Order Picker */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Đơn hàng (tùy chọn)</p>
              <div className="relative" ref={orderDropdownRef}>
                {selectedOrder ? (
                  <div className="flex h-10 w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-sm">
                    <span>{selectedOrder.code}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOrder(null);
                        setValue('orderId', '');
                        setShowOrderDropdown(true);
                      }}
                      className="ml-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder={selectedCustomer ? 'Tìm đơn hàng...' : 'Chọn khách hàng trước'}
                      value={orderSearch}
                      onChange={(e) => {
                        setOrderSearch(e.target.value);
                        setShowOrderDropdown(true);
                      }}
                      onFocus={() => selectedCustomer && setShowOrderDropdown(true)}
                      disabled={!selectedCustomer}
                      className="flex h-10 w-full rounded-md border bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </>
                )}
                <input type="hidden" {...register('orderId')} />
                {showOrderDropdown && !selectedOrder && selectedCustomer && (
                  <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-60 overflow-auto">
                    {isLoadingOrders ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : ordersData?.data && ordersData.data.length > 0 ? (
                      <ul className="py-1">
                        {ordersData.data.map((order) => (
                          <li key={order.id}>
                            <button
                              type="button"
                              onClick={() => handleSelectOrder(order)}
                              className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-accent"
                            >
                              <div>
                                <div className="font-medium">{order.code}</div>
                                <div className="text-xs text-muted-foreground">
                                  {order.branch} - {order.overallStatus}
                                </div>
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="py-4 text-center text-sm text-muted-foreground">
                        {orderSearch ? 'Không tìm thấy' : 'Nhập để tìm'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Loại khiếu nại *</p>
              <select
                {...register('type')}
                className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {Object.entries(COMPLAINT_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Mức độ *</p>
              <select
                {...register('severity')}
                className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {Object.entries(COMPLAINT_SEVERITY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2 space-y-2">
              <p className="text-sm font-medium">Mô tả *</p>
              <textarea
                {...register('description')}
                rows={4}
                placeholder="Mô tả chi tiết khiếu nại..."
                className="flex w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {errors.description && (
                <p className="text-xs text-destructive">{errors.description.message}</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Link href="/khieu-nai" className="rounded-md border px-4 py-2 text-sm hover:bg-accent">
              Hủy
            </Link>
            <button
              type="submit"
              disabled={createComplaint.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {createComplaint.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Tạo khiếu nại
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
