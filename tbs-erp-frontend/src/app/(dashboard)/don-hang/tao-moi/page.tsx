'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Loader2, Check, BookTemplate } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import { InfoTooltip } from '@/components/shared/info-tooltip';
import { MHHPriceCalculator } from '@/features/orders/mhh-price-calculator';
import { useCreateMasterOrder } from '@/lib/hooks/use-orders';
import { useCustomer } from '@/lib/hooks/use-customers';
import { useDraft } from '@/lib/hooks/use-draft';
import { useOrderTemplates } from '@/lib/hooks/use-order-templates';
import { ServiceType, ShippingRoute, Branch, ClearanceType } from '@/lib/types';
import type { Customer, OrderTemplate } from '@/lib/types';
import { DraftDialog } from './_components/DraftDialog';
import { TemplateSelectorDialog } from './_components/TemplateSelectorDialog';
import { StepIndicator } from './_components/StepIndicator';
import { GeneralInfoStep } from './_components/GeneralInfoStep';
import { SubOrdersStep } from './_components/SubOrdersStep';
import { ConfirmationStep } from './_components/ConfirmationStep';
import { useAuthStore } from '@/lib/stores/auth-store';
import { AlertCircle } from 'lucide-react';

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

const STEP_LABELS = ['Thông tin chung', 'Đơn con', 'Xác nhận'];

export default function TaoMoiDonHangPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-[40vh]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
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
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const { data: templatesData } = useOrderTemplates({ limit: 50 });

  // Load preselected customer from query param
  const { data: preselectedCustomer } = useCustomer(preselectedCustomerId ?? '', {
    enabled: !!preselectedCustomerId && !selectedCustomer,
  });

  // Draft management
  const draft = useDraft<CreateMasterOrderForm>({
    key: 'create-order',
    autoSaveInterval: 30000,
    enabled: !cloneOrderId && !templateId,
    onQuotaExceeded: () => {
      toast.error(
        'Bộ nhớ trình duyệt đầy. Một số nháp cũ đã được xóa tự động. Vui lòng thử lại.',
        { duration: 5000 },
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

  const {
    fields: subOrderFields,
    append: appendSubOrder,
    remove: removeSubOrder,
  } = useFieldArray({ control, name: 'subOrders' });

  // Check for existing draft on mount
  useEffect(() => {
    if (draft.hasDraft && !cloneOrderId && !preselectedCustomerId) {
      setShowDraftDialog(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load cloned order data
  useEffect(() => {
    if (typeof window === 'undefined' || !cloneOrderId) return;
    try {
      const cloneData = sessionStorage.getItem('cloneOrderData');
      if (cloneData) {
        const parsed = JSON.parse(cloneData);
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
      if (typeof window !== 'undefined') sessionStorage.removeItem('cloneOrderData');
    }
  }, [cloneOrderId, reset]);

  // Load template data
  useEffect(() => {
    if (typeof window === 'undefined' || !templateId) return;
    try {
      const templateData = sessionStorage.getItem('orderTemplateData');
      if (templateData) {
        const parsed = JSON.parse(templateData);
        const templateSchema = createMasterOrderSchema
          .pick({ branch: true, subOrders: true })
          .partial({ branch: true });
        const validated = templateSchema.safeParse(parsed);
        if (validated.success) {
          reset({
            customerId: '',
            branch: validated.data.branch || Branch.HN,
            note: '',
            subOrders: validated.data.subOrders,
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
      if (typeof window !== 'undefined') sessionStorage.removeItem('orderTemplateData');
    }
  }, [templateId, reset]);

  // Load draft if user confirms
  const handleLoadDraft = useCallback(() => {
    const draftData = draft.loadDraft();
    if (draftData) {
      reset(draftData);
      setShowDraftDialog(false);
      toast.success('Đã khôi phục nháp');
    }
  }, [draft, reset]);

  const handleDiscardDraft = useCallback(() => {
    draft.clearDraft();
    setShowDraftDialog(false);
  }, [draft]);

  // Auto-save draft every 30 seconds
  useEffect(() => {
    if (cloneOrderId || templateId) return;
    const cleanup = draft.enableAutoSave(() => {
      const formData = watch();
      if (
        formData.customerId ||
        formData.subOrders.some((so) => so.items.some((item) => item.productName))
      ) {
        return formData;
      }
      return null;
    });
    return cleanup;
  }, [draft, watch, cloneOrderId, templateId]);

  // Warn user before navigating away
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const formData = watch();
      const hasData =
        formData.customerId ||
        formData.subOrders.some((so) => so.items.some((item) => item.productName));
      if (hasData) {
        e.preventDefault();
        e.returnValue = '';
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
    (customer: Customer | null) => {
      setSelectedCustomer(customer);
      if (customer) {
        setValue('customerId', customer.id, { shouldValidate: true });
      }
    },
    [setValue],
  );

  const handleApplyTemplate = useCallback(
    (template: OrderTemplate) => {
      const currentCustomerId = watch('customerId');
      setValue('subOrders', template.subOrders);
      if (template.branch) setValue('branch', template.branch);
      if (currentCustomerId) setValue('customerId', currentCustomerId);
      setShowTemplateSelector(false);
      toast.success(`Đã áp dụng template "${template.name}"`);
    },
    [setValue, watch],
  );

  const onSubmit = (data: CreateMasterOrderForm) => {
    createMasterOrder.mutate(data, {
      onSuccess: () => {
        draft.clearDraft();
        reset();
        setSelectedCustomer(null);
        toast.success('Tạo đơn hàng thành công');
        router.push('/don-hang');
      },
      onError: (err: Error & { response?: { data?: { message?: string } } }) => {
        toast.error(err.response?.data?.message || 'Lỗi tạo đơn hàng');
      },
    });
  };

  const watchedSubOrders = watch('subOrders');
  const watchedBranch = watch('branch');
  const watchedNote = watch('note');
  const watchedCustomerId = watch('customerId');

  const { user } = useAuthStore();
  const hasSaleCode = Boolean(user?.hasSaleCode);

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center gap-2 sm:gap-4 mb-4 sm:mb-6">
        <Link
          href={preselectedCustomerId ? `/khach-hang/${preselectedCustomerId}` : '/don-hang'}
          className="inline-flex h-10 w-10 sm:h-9 sm:w-9 items-center justify-center rounded-md border hover:bg-accent touch-manipulation"
        >
          <ArrowLeft className="h-5 w-5 sm:h-4 sm:w-4" />
        </Link>
        <div className="flex items-center gap-2">
          <PageHeader title="Tạo đơn hàng mới" className="pb-0 text-lg sm:text-2xl" />
          <InfoTooltip tipKey="master-order" />
        </div>
      </div>

      {!hasSaleCode && (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Giới hạn Quyền tạo đơn hàng</h3>
              <p className="mt-1 text-sm text-red-700">
                Tài khoản của bạn chưa được cấp mã Nhân viên Kinh doanh (Mã Sale). Vui lòng liên hệ Quản trị viên để được cấp quyền thực hiện chức năng Tạo đơn.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Draft restore dialog */}
      {showDraftDialog && (
        <DraftDialog onLoad={handleLoadDraft} onDiscard={handleDiscardDraft} />
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
        <p className="flex items-center gap-2 cursor-pointer touch-manipulation">
          <input
            type="checkbox"
            checked={quickMode}
            onChange={(e) => setQuickMode(e.target.checked)}
            className="h-5 w-5 sm:h-4 sm:w-4 rounded"
          />
          <span className="text-sm font-medium">Chế độ nhập nhanh</span>
        </p>
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
      {showTemplateSelector && templatesData?.data && (
        <TemplateSelectorDialog
          templates={templatesData.data}
          onApply={handleApplyTemplate}
          onClose={() => setShowTemplateSelector(false)}
        />
      )}

      {/* Step indicator */}
      <StepIndicator steps={STEP_LABELS} currentStep={step} />

      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- form keyDown prevents accidental step-skip on Enter */}
      <fieldset disabled={!hasSaleCode} className={!hasSaleCode ? 'opacity-60 pointer-events-none select-none' : ''}>
        <form
        onSubmit={handleSubmit(onSubmit)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && step < 2) e.preventDefault();
        }}
        className="space-y-6"
      >
        {/* Step 1: General Info */}
        {step === 0 && (
          <GeneralInfoStep
            register={register}
            errors={errors}
            setValue={setValue}
            selectedCustomer={selectedCustomer}
            onSelectCustomer={handleSelectCustomer}
            onNext={async () => {
              const valid = await trigger(['customerId', 'branch']);
              if (valid) setStep(1);
            }}
          />
        )}

        {/* Step 2: Sub Orders */}
        {step === 1 && (
          <SubOrdersStep
            subOrderFields={subOrderFields}
            activeSubOrder={activeSubOrder}
            setActiveSubOrder={setActiveSubOrder}
            appendSubOrder={appendSubOrder}
            removeSubOrder={removeSubOrder}
            control={control}
            register={register}
            errors={errors}
            watchedSubOrders={watchedSubOrders ?? []}
            quickMode={quickMode}
            selectedCustomer={selectedCustomer}
            onBack={() => setStep(0)}
            onNext={async () => {
              const valid = await trigger('subOrders');
              if (valid) setStep(2);
            }}
          />
        )}

        {/* Step 3: Confirmation */}
        {step === 2 && (
          <ConfirmationStep
            selectedCustomer={selectedCustomer}
            watchedCustomerId={watchedCustomerId}
            watchedBranch={watchedBranch}
            watchedNote={watchedNote}
            watchedSubOrders={watchedSubOrders ?? []}
            isPending={createMasterOrder.isPending}
            onBack={() => setStep(1)}
          />
        )}
        </form>
      </fieldset>
    </div>
  );
}
