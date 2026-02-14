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
import { useCreateComplaint } from '@/lib/hooks/use-complaints';
import { useCustomers } from '@/lib/hooks/use-customers';
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

  // Customer picker
  const [customerSearch, setCustomerSearch] = useState('');
  const [debouncedCustomerSearch, setDebouncedCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  // Order picker
  const [orderSearch, setOrderSearch] = useState('');
  const [debouncedOrderSearch, setDebouncedOrderSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<MasterOrder | null>(null);
  const [showOrderDropdown, setShowOrderDropdown] = useState(false);
  const orderDropdownRef = useRef<HTMLDivElement>(null);

  const customerId = watch('customerId');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedCustomerSearch(customerSearch), 300);
    return () => clearTimeout(timer);
  }, [customerSearch]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedOrderSearch(orderSearch), 300);
    return () => clearTimeout(timer);
  }, [orderSearch]);

  const { data: customersData, isLoading: isLoadingCustomers } = useCustomers(
    debouncedCustomerSearch ? { search: debouncedCustomerSearch, limit: 10 } : { limit: 10 }
  );

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
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target as Node)) {
        setShowCustomerDropdown(false);
      }
      if (orderDropdownRef.current && !orderDropdownRef.current.contains(event.target as Node)) {
        setShowOrderDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectCustomer = useCallback(
    (customer: Customer) => {
      setSelectedCustomer(customer);
      setValue('customerId', customer.id, { shouldValidate: true });
      setCustomerSearch('');
      setShowCustomerDropdown(false);
      // Clear order selection when customer changes
      setSelectedOrder(null);
      setValue('orderId', '');
    },
    [setValue]
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
            <div className="space-y-2">
              <label className="text-sm font-medium">Khách hàng *</label>
              <div className="relative" ref={customerDropdownRef}>
                {selectedCustomer ? (
                  <div className="flex h-10 w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-sm">
                    <span>
                      {selectedCustomer.fullName}{' '}
                      <span className="text-muted-foreground">({selectedCustomer.code})</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCustomer(null);
                        setValue('customerId', '', { shouldValidate: true });
                        setSelectedOrder(null);
                        setValue('orderId', '');
                        setShowCustomerDropdown(true);
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
                      placeholder="Tìm khách hàng..."
                      value={customerSearch}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value);
                        setShowCustomerDropdown(true);
                      }}
                      onFocus={() => setShowCustomerDropdown(true)}
                      className="flex h-10 w-full rounded-md border bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </>
                )}
                <input type="hidden" {...register('customerId')} />
                {showCustomerDropdown && !selectedCustomer && (
                  <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-60 overflow-auto">
                    {isLoadingCustomers ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : customersData?.data && customersData.data.length > 0 ? (
                      <ul className="py-1">
                        {customersData.data.map((customer) => (
                          <li key={customer.id}>
                            <button
                              type="button"
                              onClick={() => handleSelectCustomer(customer)}
                              className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-accent"
                            >
                              <div>
                                <div className="font-medium">{customer.fullName}</div>
                                <div className="text-xs text-muted-foreground">
                                  {customer.code} - {customer.phone}
                                </div>
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="py-4 text-center text-sm text-muted-foreground">
                        {customerSearch ? 'Không tìm thấy' : 'Nhập để tìm'}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {errors.customerId && (
                <p className="text-xs text-destructive">{errors.customerId.message}</p>
              )}
            </div>

            {/* Order Picker */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Đơn hàng (tùy chọn)</label>
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
              <label className="text-sm font-medium">Loại khiếu nại *</label>
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
              <label className="text-sm font-medium">Mức độ *</label>
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
              <label className="text-sm font-medium">Mô tả *</label>
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
