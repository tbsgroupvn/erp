'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Plus, Trash2, Loader2, Search, X, AlertCircle, Save, Check, BookTemplate } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { useCreateMasterOrder } from '@/lib/hooks/use-orders';
import { useCustomers, useCustomer } from '@/lib/hooks/use-customers';
import { useDraft } from '@/lib/hooks/use-draft';
import { useOrderTemplates } from '@/lib/hooks/use-order-templates';
import { ServiceType, ShippingRoute, Branch, ClearanceType } from '@/lib/types';
import type { Customer } from '@/lib/types';
import {
  SERVICE_TYPE_LABELS,
  SERVICE_TYPE_DESCRIPTIONS,
  SHIPPING_ROUTE_LABELS,
  BRANCH_LABELS,
  CLEARANCE_TYPE_LABELS,
} from '@/lib/utils/constants';
import { formatCurrency } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

const orderItemSchema = z.object({
  productName: z.string().min(1, 'Tên sản phẩm bắt buộc'),
  productUrl: z.string().optional(),
  quantity: z.coerce.number().min(1, 'Số lượng >= 1'),
  unitPrice: z.coerce.number().min(0, 'Đơn giá >= 0'),
  note: z.string().optional(),
});

const subOrderSchema = z.object({
  serviceType: z.nativeEnum(ServiceType),
  clearanceType: z.nativeEnum(ClearanceType),
  shippingRoute: z.union([z.nativeEnum(ShippingRoute), z.literal('')]).optional().transform((v) => v || undefined),
  note: z.string().optional(),
  items: z.array(orderItemSchema).min(1, 'Cần ít nhất 1 sản phẩm'),
});

const createMasterOrderSchema = z.object({
  customerId: z.string().min(1, 'Chọn khách hàng'),
  branch: z.nativeEnum(Branch),
  note: z.string().optional(),
  subOrders: z.array(subOrderSchema).min(1, 'Cần ít nhất 1 đơn con'),
});

type CreateMasterOrderForm = z.infer<typeof createMasterOrderSchema>;

export default function TaoMoiDonHangPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-[40vh]"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
      <TaoMoiDonHangContent />
    </Suspense>
  );
}

function TaoMoiDonHangContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedCustomerId = searchParams.get('customerId');
  const cloneOrderId = searchParams.get('clone');
  const templateId = searchParams.get('template');
  const createMasterOrder = useCreateMasterOrder();
  const [step, setStep] = useState(0);
  const [activeSubOrder, setActiveSubOrder] = useState(0);
  const [showDraftDialog, setShowDraftDialog] = useState(false);
  const [quickMode, setQuickMode] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);

  // Fetch templates
  const { data: templatesData } = useOrderTemplates({ limit: 50 });

  // Customer picker state
  const [customerSearch, setCustomerSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load preselected customer from query param
  const { data: preselectedCustomer } = useCustomer(preselectedCustomerId ?? '', {
    enabled: !!preselectedCustomerId && !selectedCustomer,
  });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(customerSearch), 300);
    return () => clearTimeout(timer);
  }, [customerSearch]);

  const { data: customersData, isLoading: isLoadingCustomers } = useCustomers(
    debouncedSearch ? { search: debouncedSearch, limit: 10 } : { limit: 10 },
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Draft management
  const draft = useDraft<CreateMasterOrderForm>({
    key: 'create-order',
    autoSaveInterval: 30000, // 30 seconds
    enabled: !cloneOrderId && !templateId, // Disable draft when cloning or using template
    onQuotaExceeded: () => {
      toast.error(
        'Bộ nhớ trình duyệt đầy. Một số nháp cũ đã được xóa tự động. Vui lòng thử lại.',
        { duration: 5000 }
      );
    },
  });

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    watch,
    setValue,
    trigger,
    reset,
  } = useForm<CreateMasterOrderForm>({
    resolver: zodResolver(createMasterOrderSchema),
    defaultValues: {
      customerId: '',
      branch: Branch.HN,
      note: '',
      subOrders: [
        {
          serviceType: ServiceType.VCT,
          clearanceType: ClearanceType.TIEU_NGACH,
          note: '',
          items: [{ productName: '', quantity: 1, unitPrice: 0 }],
        },
      ],
    },
  });

  const { fields: subOrderFields, append: appendSubOrder, remove: removeSubOrder } = useFieldArray({
    control,
    name: 'subOrders',
  });

  // Check for existing draft on mount
  useEffect(() => {
    if (draft.hasDraft && !cloneOrderId && !preselectedCustomerId) {
      setShowDraftDialog(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Load cloned order data
  useEffect(() => {
    // SSR safety check
    if (typeof window === 'undefined' || !cloneOrderId) return;

    try {
      const cloneData = sessionStorage.getItem('cloneOrderData');
      if (cloneData) {
        const parsed = JSON.parse(cloneData);
        // Basic validation - ensure it has expected structure
        if (parsed && typeof parsed === 'object') {
          reset(parsed);
          sessionStorage.removeItem('cloneOrderData');
          toast.success('Đã sao chép dữ liệu từ đơn hàng cũ');
        } else {
          throw new Error('Invalid clone data structure');
        }
      }
    } catch (error) {
      console.error('Failed to load clone data:', error);
      toast.error('Không thể sao chép đơn hàng. Dữ liệu không hợp lệ.');
      // Cleanup corrupted data
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('cloneOrderData');
      }
    }
  }, [cloneOrderId, reset]);

  // Load template data
  useEffect(() => {
    // SSR safety check
    if (typeof window === 'undefined' || !templateId) return;

    try {
      const templateData = sessionStorage.getItem('orderTemplateData');
      if (templateData) {
        const parsed = JSON.parse(templateData);
        // Validate structure
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.subOrders)) {
          reset({
            customerId: '',
            branch: parsed.branch || Branch.HN,
            note: '',
            subOrders: parsed.subOrders || [],
          });
          sessionStorage.removeItem('orderTemplateData');
          toast.success('Đã áp dụng template');
        } else {
          throw new Error('Invalid template data structure');
        }
      }
    } catch (error) {
      console.error('Failed to load template data:', error);
      toast.error('Không thể áp dụng template. Dữ liệu không hợp lệ.');
      // Cleanup corrupted data
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('orderTemplateData');
      }
    }
  }, [templateId, reset]);

  // Load draft if user confirms
  const handleLoadDraft = useCallback(() => {
    const draftData = draft.loadDraft();
    if (draftData) {
      reset(draftData);
      // Restore customer selection if exists
      if (draftData.customerId) {
        // The customer will be loaded via the preselected logic
      }
      setShowDraftDialog(false);
      toast.success('Đã khôi phục nháp');
    }
  }, [draft, reset]);

  // Discard draft
  const handleDiscardDraft = useCallback(() => {
    draft.clearDraft();
    setShowDraftDialog(false);
  }, [draft]);

  // Auto-save draft every 30 seconds
  useEffect(() => {
    // Don't auto-save when cloning or using template
    if (cloneOrderId || templateId) return;

    const cleanup = draft.enableAutoSave(() => {
      const formData = watch();
      // Only save if there's meaningful data
      if (formData.customerId || formData.subOrders.some(so =>
        so.items.some(item => item.productName)
      )) {
        return formData;
      }
      return null; // Skip saving if form is empty
    });

    return cleanup;
  }, [draft, watch, cloneOrderId, templateId]);

  // Warn user before navigating away with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const formData = watch();
      // Check if there's meaningful unsaved data
      const hasData = formData.customerId || formData.subOrders.some(so =>
        so.items.some(item => item.productName)
      );

      if (hasData) {
        e.preventDefault();
        e.returnValue = ''; // Modern browsers show generic message
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [watch]);

  // Auto-fill customer from query param
  useEffect(() => {
    if (preselectedCustomer && !selectedCustomer) {
      setSelectedCustomer(preselectedCustomer as Customer);
      setValue('customerId', preselectedCustomer.id, { shouldValidate: true });
    }
  }, [preselectedCustomer, selectedCustomer, setValue]);

  const handleSelectCustomer = useCallback(
    (customer: Customer) => {
      setSelectedCustomer(customer);
      setValue('customerId', customer.id, { shouldValidate: true });
      setCustomerSearch('');
      setShowDropdown(false);
    },
    [setValue],
  );

  const handleApplyTemplate = useCallback(
    (template: any) => {
      const currentCustomerId = watch('customerId');
      const currentCustomer = selectedCustomer;

      setValue('subOrders', template.subOrders);
      if (template.branch) {
        setValue('branch', template.branch);
      }

      // Restore customer if it was set
      if (currentCustomerId) {
        setValue('customerId', currentCustomerId);
      }

      setShowTemplateSelector(false);
      toast.success(`Đã áp dụng template "${template.name}"`);
    },
    [setValue, watch, selectedCustomer]
  );

  const onSubmit = (data: CreateMasterOrderForm) => {
    createMasterOrder.mutate(data, {
      onSuccess: () => {
        // Clear draft and form after successful submission
        draft.clearDraft();
        reset(); // Reset form to default values
        setSelectedCustomer(null); // Clear selected customer
        toast.success('Tạo đơn hàng thành công');
        router.push('/don-hang');
      },
      onError: (err: any) => {
        toast.error(err.response?.data?.message || 'Lỗi tạo đơn hàng');
      },
    });
  };

  const watchedSubOrders = watch('subOrders');
  const watchedBranch = watch('branch');
  const watchedNote = watch('note');

  const stepLabels = ['Thông tin chung', 'Đơn con', 'Xác nhận'];

  return (
    <div>
      <div className="flex items-center gap-2 sm:gap-4 mb-4 sm:mb-6">
        <Link href={preselectedCustomerId ? `/khach-hang/${preselectedCustomerId}` : '/don-hang'} className="inline-flex h-10 w-10 sm:h-9 sm:w-9 items-center justify-center rounded-md border hover:bg-accent touch-manipulation">
          <ArrowLeft className="h-5 w-5 sm:h-4 sm:w-4" />
        </Link>
        <PageHeader title="Tạo đơn hàng mới" className="pb-0 text-lg sm:text-2xl" />
      </div>

      {/* Draft restore dialog */}
      {showDraftDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-lg border shadow-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">Phát hiện nháp đơn hàng</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Bạn có một đơn hàng đã lưu nháp. Bạn có muốn tiếp tục nhập đơn này không?
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleLoadDraft}
                className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Tiếp tục nhập
              </button>
              <button
                type="button"
                onClick={handleDiscardDraft}
                className="flex-1 rounded-md border px-4 py-2 text-sm hover:bg-accent"
              >
                Bắt đầu mới
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Draft save indicator */}
      {!cloneOrderId && draft.lastSaved && (
        <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
          <Check className="h-4 w-4 text-green-600" />
          <span>
            Đã lưu nháp lúc {new Date(draft.lastSaved).toLocaleTimeString('vi-VN')}
          </span>
          <button
            type="button"
            onClick={() => draft.clearDraft()}
            className="ml-2 text-xs text-destructive hover:underline"
          >
            Xóa nháp
          </button>
        </div>
      )}

      {/* Quick mode toggle and template selector */}
      <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
        <label className="flex items-center gap-2 cursor-pointer touch-manipulation">
          <input
            type="checkbox"
            checked={quickMode}
            onChange={(e) => setQuickMode(e.target.checked)}
            className="h-5 w-5 sm:h-4 sm:w-4 rounded"
          />
          <span className="text-sm font-medium">Chế độ nhập nhanh</span>
        </label>
        {templatesData?.data && templatesData.data.length > 0 && (
          <button
            type="button"
            onClick={() => setShowTemplateSelector(true)}
            className="inline-flex items-center gap-2 rounded-md border px-4 py-2 sm:px-3 sm:py-1.5 text-sm hover:bg-accent touch-manipulation min-h-[44px] sm:min-h-0"
          >
            <BookTemplate className="h-4 w-4" />
            Chọn template
          </button>
        )}
        <Link
          href="/don-hang/template"
          className="text-xs text-primary hover:underline touch-manipulation min-h-[44px] flex items-center"
        >
          Quản lý templates
        </Link>
      </div>

      {/* Template selector dialog */}
      {showTemplateSelector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-lg border shadow-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Chọn Template</h3>
              <button
                type="button"
                onClick={() => setShowTemplateSelector(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              {templatesData?.data?.map((template) => (
                <div
                  key={template.id}
                  className="rounded-md border p-3 hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium mb-1">{template.name}</h4>
                      {template.description && (
                        <p className="text-xs text-muted-foreground mb-2">
                          {template.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {template.subOrders.length} đơn con •{' '}
                        {template.subOrders.reduce(
                          (sum, so) => sum + so.items.length,
                          0
                        )}{' '}
                        sản phẩm
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleApplyTemplate(template)}
                      className="ml-4 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      Áp dụng
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step Indicator */}
      <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-4 mb-6 sm:mb-8 overflow-x-auto pb-2">
        {stepLabels.map((s, i) => (
          <div key={s} className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <div className={`flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-full text-sm font-medium ${i <= step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              {i + 1}
            </div>
            <span className={`text-xs sm:text-sm whitespace-nowrap ${i <= step ? 'font-medium' : 'text-muted-foreground'}`}>{s}</span>
            {i < stepLabels.length - 1 && <div className="h-px w-4 sm:w-8 bg-border" />}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} onKeyDown={(e) => { if (e.key === 'Enter' && step < 2) e.preventDefault(); }} className="space-y-6">
        {/* Step 1: General Info */}
        {step === 0 && (
          <div className="rounded-lg border bg-card p-6 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Customer Picker */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Khách hàng *</label>
                <div className="relative" ref={dropdownRef}>
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
                          setShowDropdown(true);
                        }}
                        className="ml-2 text-xs text-muted-foreground hover:text-foreground"
                      >
                        Thay đổi
                      </button>
                    </div>
                  ) : (
                    <>
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Tìm khách hàng theo tên, mã, SĐT..."
                        value={customerSearch}
                        onChange={(e) => { setCustomerSearch(e.target.value); setShowDropdown(true); }}
                        onFocus={() => setShowDropdown(true)}
                        className="flex h-10 w-full rounded-md border bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </>
                  )}
                  <input type="hidden" {...register('customerId')} />
                  {showDropdown && !selectedCustomer && (
                    <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg">
                      {isLoadingCustomers ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          <span className="ml-2 text-sm text-muted-foreground">Đang tìm...</span>
                        </div>
                      ) : customersData?.data && customersData.data.length > 0 ? (
                        <ul className="max-h-60 overflow-auto py-1">
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
                                    {customer.code}
                                    {customer.phone && ` - ${customer.phone}`}
                                    {customer.companyName && ` - ${customer.companyName}`}
                                  </div>
                                </div>
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="py-4 text-center text-sm text-muted-foreground">
                          {customerSearch ? 'Không tìm thấy khách hàng' : 'Nhập để tìm khách hàng'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {errors.customerId && <p className="text-xs text-destructive">{errors.customerId.message}</p>}
              </div>

              {/* Branch */}
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
            </div>

            {/* Credit Limit Warning */}
            {selectedCustomer && (
              <div className={cn(
                'rounded-md border p-4 space-y-2',
                (() => {
                  const usagePercent = selectedCustomer.creditLimit > 0
                    ? (selectedCustomer.currentDebt / selectedCustomer.creditLimit) * 100
                    : 0;
                  if (usagePercent >= 100) return 'bg-red-50 border-red-200';
                  if (usagePercent >= 80) return 'bg-orange-50 border-orange-200';
                  return 'bg-blue-50 border-blue-200';
                })()
              )}>
                <div className="flex items-start gap-2">
                  <AlertCircle className={cn('h-5 w-5 mt-0.5', (() => {
                    const usagePercent = selectedCustomer.creditLimit > 0
                      ? (selectedCustomer.currentDebt / selectedCustomer.creditLimit) * 100
                      : 0;
                    if (usagePercent >= 100) return 'text-red-600';
                    if (usagePercent >= 80) return 'text-orange-600';
                    return 'text-blue-600';
                  })())} />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Thông tin tín dụng</p>
                    <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Công nợ hiện tại</p>
                        <p className="font-semibold">{formatCurrency(selectedCustomer.currentDebt)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Hạn mức tín dụng</p>
                        <p className="font-semibold">{formatCurrency(selectedCustomer.creditLimit)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">% Sử dụng</p>
                        <p className={cn('font-semibold', (() => {
                          const usagePercent = selectedCustomer.creditLimit > 0
                            ? (selectedCustomer.currentDebt / selectedCustomer.creditLimit) * 100
                            : 0;
                          if (usagePercent >= 100) return 'text-red-600';
                          if (usagePercent >= 80) return 'text-orange-600';
                          return '';
                        })())}>
                          {selectedCustomer.creditLimit > 0
                            ? `${((selectedCustomer.currentDebt / selectedCustomer.creditLimit) * 100).toFixed(1)}%`
                            : '0%'}
                        </p>
                      </div>
                    </div>
                    {selectedCustomer.creditLimit > 0 && (selectedCustomer.currentDebt / selectedCustomer.creditLimit) * 100 >= 80 && (
                      <p className={cn('mt-2 text-xs', (() => {
                        const usagePercent = (selectedCustomer.currentDebt / selectedCustomer.creditLimit) * 100;
                        if (usagePercent >= 100) return 'text-red-600 font-medium';
                        return 'text-orange-600';
                      })())}>
                        {(selectedCustomer.currentDebt / selectedCustomer.creditLimit) * 100 >= 100
                          ? '⚠️ Khách hàng đã vượt hạn mức tín dụng!'
                          : '⚠️ Khách hàng sắp đạt hạn mức tín dụng!'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">Ghi chú đơn tổng</label>
              <textarea
                {...register('note')}
                rows={2}
                placeholder="Ghi chú cho đơn tổng..."
                className="flex w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex justify-end">
              <button type="button" onClick={async () => { const valid = await trigger(['customerId', 'branch']); if (valid) setStep(1); }} className="rounded-md bg-primary px-6 py-3 sm:px-4 sm:py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 touch-manipulation min-h-[44px]">
                Tiếp tục
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Sub Orders */}
        {step === 1 && (
          <div className="space-y-4">
            {/* Sub Order Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto">
              {subOrderFields.map((field, idx) => (
                <button
                  key={field.id}
                  type="button"
                  onClick={() => setActiveSubOrder(idx)}
                  className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-3 py-1.5 text-sm border transition-colors ${
                    activeSubOrder === idx
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'hover:bg-accent border-border'
                  }`}
                >
                  Đơn con {String.fromCharCode(65 + idx)}
                  {subOrderFields.length > 1 && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        removeSubOrder(idx);
                        if (activeSubOrder >= idx && activeSubOrder > 0) {
                          setActiveSubOrder(activeSubOrder - 1);
                        }
                      }}
                      className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-destructive/20"
                    >
                      <X className="h-3 w-3" />
                    </span>
                  )}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  appendSubOrder({
                    serviceType: ServiceType.VCT,
                    clearanceType: ClearanceType.TIEU_NGACH,
                    note: '',
                    items: [{ productName: '', quantity: 1, unitPrice: 0 }],
                  });
                  setActiveSubOrder(subOrderFields.length);
                }}
                className="inline-flex items-center gap-1 rounded-md border border-dashed px-3 py-1.5 text-sm hover:bg-accent"
              >
                <Plus className="h-3 w-3" /> Thêm đơn con
              </button>
            </div>

            {/* Active Sub Order Form */}
            {subOrderFields.map((field, idx) => (
              <div key={field.id} className={idx === activeSubOrder ? '' : 'hidden'}>
                <div className="rounded-lg border bg-card p-6 space-y-4">
                  <h3 className="text-base font-semibold">Đơn con {String.fromCharCode(65 + idx)}</h3>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {/* Service Type */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Loại dịch vụ *</label>
                      <select
                        {...register(`subOrders.${idx}.serviceType`)}
                        className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        {Object.entries(SERVICE_TYPE_LABELS).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Clearance Type */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Loại thông quan *</label>
                      <div className="flex gap-4 pt-2">
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="radio"
                            value={ClearanceType.CHINH_NGACH}
                            {...register(`subOrders.${idx}.clearanceType`)}
                            className="h-4 w-4"
                          />
                          <span className="inline-flex items-center rounded-md bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                            Chính ngạch
                          </span>
                        </label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="radio"
                            value={ClearanceType.TIEU_NGACH}
                            {...register(`subOrders.${idx}.clearanceType`)}
                            className="h-4 w-4"
                          />
                          <span className="inline-flex items-center rounded-md bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                            Tiểu ngạch
                          </span>
                        </label>
                      </div>
                    </div>

                    {/* Shipping Route */}
                    {!quickMode && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Tuyến vận chuyển</label>
                        <select
                          {...register(`subOrders.${idx}.shippingRoute`)}
                          className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          <option value="">Chọn tuyến</option>
                          {Object.entries(SHIPPING_ROUTE_LABELS).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Items */}
                  <SubOrderItems control={control} register={register} errors={errors} subOrderIndex={idx} quickMode={quickMode} />

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Ghi chú đơn con</label>
                    <textarea
                      {...register(`subOrders.${idx}.note`)}
                      rows={2}
                      placeholder="Ghi chú..."
                      className="flex w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>
              </div>
            ))}

            <div className="flex justify-between gap-3">
              <button type="button" onClick={() => setStep(0)} className="rounded-md border px-6 py-3 sm:px-4 sm:py-2 text-sm hover:bg-accent touch-manipulation min-h-[44px]">
                Quay lại
              </button>
              <button type="button" onClick={async () => { const valid = await trigger('subOrders'); if (valid) setStep(2); }} className="rounded-md bg-primary px-6 py-3 sm:px-4 sm:py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 touch-manipulation min-h-[44px]">
                Tiếp tục
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Confirmation */}
        {step === 2 && (
          <div className="rounded-lg border bg-card p-6 space-y-4">
            <h3 className="text-lg font-semibold">Xác nhận đơn hàng</h3>
            <p className="text-sm text-muted-foreground">Kiểm tra lại thông tin trước khi tạo đơn hàng.</p>

            {/* Master order info */}
            <div className="text-sm space-y-2 rounded-md border p-4">
              <p>
                <span className="text-muted-foreground">Khách hàng:</span>{' '}
                {selectedCustomer ? `${selectedCustomer.fullName} (${selectedCustomer.code})` : watch('customerId')}
              </p>
              <p>
                <span className="text-muted-foreground">Chi nhánh:</span> {BRANCH_LABELS[watchedBranch]}
              </p>
              {watchedNote && (
                <p><span className="text-muted-foreground">Ghi chú:</span> {watchedNote}</p>
              )}
              <p>
                <span className="text-muted-foreground">Số đơn con:</span> {watchedSubOrders?.length ?? 0}
              </p>
            </div>

            {/* Sub orders summary */}
            {watchedSubOrders?.map((so, idx) => {
              const soTotal = so.items?.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0) ?? 0;
              return (
                <div key={idx} className="rounded-md border p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold">Đơn con {String.fromCharCode(65 + idx)}</h4>
                    <StatusBadge
                      label={CLEARANCE_TYPE_LABELS[so.clearanceType as ClearanceType]}
                      colorClass={so.clearanceType === ClearanceType.CHINH_NGACH ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}
                    />
                  </div>
                  <div className="text-sm space-y-1">
                    <p><span className="text-muted-foreground">Dịch vụ:</span> {SERVICE_TYPE_LABELS[so.serviceType as ServiceType]}</p>
                    {so.shippingRoute && (
                      <p><span className="text-muted-foreground">Tuyến:</span> {SHIPPING_ROUTE_LABELS[so.shippingRoute as ShippingRoute]}</p>
                    )}
                    <p><span className="text-muted-foreground">Số sản phẩm:</span> {so.items?.length ?? 0}</p>
                    <p><span className="text-muted-foreground">Tổng tiền:</span> <span className="font-semibold">{soTotal.toLocaleString('vi-VN')} (CNY)</span></p>
                  </div>
                  {so.items && so.items.length > 0 && (
                    <table className="w-full text-sm mt-2">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="px-2 py-1 text-left font-medium">Sản phẩm</th>
                          <th className="px-2 py-1 text-right font-medium">SL</th>
                          <th className="px-2 py-1 text-right font-medium">Đơn giá</th>
                          <th className="px-2 py-1 text-right font-medium">Thành tiền</th>
                        </tr>
                      </thead>
                      <tbody>
                        {so.items.map((item, i) => (
                          <tr key={i} className="border-b last:border-0">
                            <td className="px-2 py-1">{item.productName || '(chưa đặt tên)'}</td>
                            <td className="px-2 py-1 text-right">{item.quantity}</td>
                            <td className="px-2 py-1 text-right">{Number(item.unitPrice).toLocaleString('vi-VN')}</td>
                            <td className="px-2 py-1 text-right font-medium">{((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)).toLocaleString('vi-VN')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}

            <div className="flex flex-col sm:flex-row justify-between gap-3">
              <button type="button" onClick={() => setStep(1)} className="rounded-md border px-6 py-3 sm:px-4 sm:py-2 text-sm hover:bg-accent touch-manipulation min-h-[44px]">
                Quay lại
              </button>
              <button
                type="submit"
                disabled={createMasterOrder.isPending}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-8 py-3 sm:px-6 sm:py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 touch-manipulation min-h-[44px]"
              >
                {createMasterOrder.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Tạo đơn hàng
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

/** Sub-component for managing items within a sub order */
function SubOrderItems({
  control,
  register,
  errors,
  subOrderIndex,
  quickMode = false,
}: {
  control: any;
  register: any;
  errors: any;
  subOrderIndex: number;
  quickMode?: boolean;
}) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `subOrders.${subOrderIndex}.items`,
  });

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium">Hàng hóa</label>
      {fields.map((field, itemIdx) => (
        <div key={field.id} className="grid grid-cols-1 gap-3 sm:grid-cols-5 items-end border-b pb-3">
          <div className="sm:col-span-2 space-y-1">
            <label className="text-xs font-medium">Sản phẩm *</label>
            <input
              {...register(`subOrders.${subOrderIndex}.items.${itemIdx}.productName`)}
              placeholder="Tên sản phẩm"
              className="flex h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {errors.subOrders?.[subOrderIndex]?.items?.[itemIdx]?.productName && (
              <p className="text-xs text-destructive">{errors.subOrders[subOrderIndex].items[itemIdx].productName.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Số lượng</label>
            <input
              type="number"
              {...register(`subOrders.${subOrderIndex}.items.${itemIdx}.quantity`)}
              className="flex h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Đơn giá</label>
            <input
              type="number"
              {...register(`subOrders.${subOrderIndex}.items.${itemIdx}.unitPrice`)}
              className="flex h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <button
              type="button"
              onClick={() => fields.length > 1 && remove(itemIdx)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
      {errors.subOrders?.[subOrderIndex]?.items?.message && (
        <p className="text-xs text-destructive">{errors.subOrders[subOrderIndex].items.message}</p>
      )}
      <button
        type="button"
        onClick={() => append({ productName: '', quantity: 1, unitPrice: 0 })}
        className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent"
      >
        <Plus className="h-4 w-4" /> Thêm sản phẩm
      </button>
    </div>
  );
}
