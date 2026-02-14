'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import { LoadingOverlay } from '@/components/shared/loading-overlay';
import {
  useOrderTemplate,
  useUpdateOrderTemplate,
} from '@/lib/hooks/use-order-templates';
import { ServiceType, ClearanceType, ShippingRoute, Branch } from '@/lib/types';
import {
  SERVICE_TYPE_LABELS,
  CLEARANCE_TYPE_LABELS,
  SHIPPING_ROUTE_LABELS,
  BRANCH_LABELS,
} from '@/lib/utils/constants';

// Validation schema
const updateTemplateSchema = z.object({
  name: z.string().min(1, 'Tên template là bắt buộc').max(200, 'Tên tối đa 200 ký tự'),
  description: z.string().optional(),
  branch: z.nativeEnum(Branch).optional(),
  subOrders: z
    .array(
      z.object({
        serviceType: z.nativeEnum(ServiceType),
        clearanceType: z.nativeEnum(ClearanceType),
        shippingRoute: z.nativeEnum(ShippingRoute).optional(),
        note: z.string().optional(),
        items: z
          .array(
            z.object({
              productName: z.string().min(1, 'Tên sản phẩm là bắt buộc'),
              productUrl: z.string().optional(),
              quantity: z.number().min(1, 'Số lượng tối thiểu là 1'),
              unitPrice: z.number().min(0, 'Đơn giá không được âm'),
              note: z.string().optional(),
            })
          )
          .min(1, 'Cần ít nhất 1 sản phẩm'),
      })
    )
    .min(1, 'Cần ít nhất 1 đơn con'),
});

type UpdateTemplateForm = z.infer<typeof updateTemplateSchema>;

export default function EditTemplatePage() {
  const params = useParams();
  const router = useRouter();
  const templateId = params.id as string;

  const { data: template, isLoading } = useOrderTemplate(templateId);
  const updateTemplate = useUpdateOrderTemplate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    reset,
  } = useForm<UpdateTemplateForm>({
    resolver: zodResolver(updateTemplateSchema),
    defaultValues: {
      name: '',
      description: '',
      branch: Branch.HN,
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
  } = useFieldArray({
    control,
    name: 'subOrders',
  });

  // Load template data into form when loaded
  useEffect(() => {
    if (template) {
      reset({
        name: template.name,
        description: template.description || '',
        branch: template.branch || undefined,
        subOrders: template.subOrders.map((so) => ({
          serviceType: so.serviceType,
          clearanceType: so.clearanceType,
          shippingRoute: so.shippingRoute || undefined,
          note: so.note || '',
          items: so.items.map((item) => ({
            productName: item.productName,
            productUrl: item.productUrl || '',
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            note: item.note || '',
          })),
        })),
      });
    }
  }, [template, reset]);

  const onSubmit = async (data: UpdateTemplateForm) => {
    setIsSubmitting(true);
    try {
      await updateTemplate.mutateAsync({ id: templateId, data });
      toast.success('Cập nhật template thành công');
      router.push('/don-hang/template');
    } catch (error: any) {
      console.error('Update template error:', error);
      toast.error(error?.message || 'Không thể cập nhật template');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <LoadingOverlay />;
  }

  if (!template) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Không tìm thấy template</p>
        <Link
          href="/don-hang/template"
          className="text-primary hover:underline mt-4 inline-block"
        >
          Quay lại danh sách
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Link
        href="/don-hang/template"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Quay lại danh sách template
      </Link>

      <PageHeader
        title="Chỉnh sửa Template"
        description={`Cập nhật mẫu đơn hàng: ${template.name}`}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Info */}
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold">Thông tin cơ bản</h2>

          <div>
            <label className="block text-sm font-medium mb-1">
              Tên template <span className="text-red-500">*</span>
            </label>
            <input
              {...register('name')}
              type="text"
              placeholder="VD: Combo mỹ phẩm 10 món"
              className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {errors.name && (
              <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Mô tả</label>
            <textarea
              {...register('description')}
              rows={2}
              placeholder="Mô tả ngắn về template này"
              className="flex w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Chi nhánh mặc định</label>
            <select
              {...register('branch')}
              className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Không chọn</option>
              {Object.entries(BRANCH_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Sub Orders */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Đơn con</h2>
            <button
              type="button"
              onClick={() =>
                appendSubOrder({
                  serviceType: ServiceType.VCT,
                  clearanceType: ClearanceType.TIEU_NGACH,
                  note: '',
                  items: [{ productName: '', quantity: 1, unitPrice: 0 }],
                })
              }
              className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
            >
              <Plus className="h-4 w-4" />
              Thêm đơn con
            </button>
          </div>

          {subOrderFields.map((subOrder, subOrderIndex) => (
            <div key={subOrder.id} className="rounded-lg border bg-card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">
                  Đơn con {String.fromCharCode(65 + subOrderIndex)}
                </h3>
                {subOrderFields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSubOrder(subOrderIndex)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Loại dịch vụ <span className="text-red-500">*</span>
                  </label>
                  <select
                    {...register(`subOrders.${subOrderIndex}.serviceType`)}
                    className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {Object.entries(SERVICE_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Loại thông quan <span className="text-red-500">*</span>
                  </label>
                  <select
                    {...register(`subOrders.${subOrderIndex}.clearanceType`)}
                    className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {Object.entries(CLEARANCE_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Tuyến vận chuyển</label>
                  <select
                    {...register(`subOrders.${subOrderIndex}.shippingRoute`)}
                    className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Không chọn</option>
                    {Object.entries(SHIPPING_ROUTE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Ghi chú</label>
                <input
                  {...register(`subOrders.${subOrderIndex}.note`)}
                  type="text"
                  placeholder="Ghi chú cho đơn con"
                  className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {/* Items */}
              <SubOrderItems
                control={control}
                register={register}
                subOrderIndex={subOrderIndex}
                errors={errors}
              />
            </div>
          ))}
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-4 pt-4">
          <Link
            href="/don-hang/template"
            className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Hủy
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSubmitting ? 'Đang lưu...' : 'Cập nhật template'}
          </button>
        </div>
      </form>
    </div>
  );
}

// Sub-component for items management (same as create page)
function SubOrderItems({
  control,
  register,
  subOrderIndex,
  errors,
}: {
  control: any;
  register: any;
  subOrderIndex: number;
  errors: any;
}) {
  const {
    fields: itemFields,
    append: appendItem,
    remove: removeItem,
  } = useFieldArray({
    control,
    name: `subOrders.${subOrderIndex}.items`,
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">
          Sản phẩm <span className="text-red-500">*</span>
        </label>
        <button
          type="button"
          onClick={() =>
            appendItem({ productName: '', quantity: 1, unitPrice: 0 })
          }
          className="text-sm text-primary hover:underline"
        >
          + Thêm sản phẩm
        </button>
      </div>

      {itemFields.map((item, itemIndex) => (
        <div
          key={item.id}
          className="grid grid-cols-12 gap-2 items-start bg-muted/50 p-3 rounded-md"
        >
          <div className="col-span-12 md:col-span-4">
            <input
              {...register(
                `subOrders.${subOrderIndex}.items.${itemIndex}.productName`
              )}
              type="text"
              placeholder="Tên sản phẩm *"
              className="flex h-9 w-full rounded-md border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {errors?.subOrders?.[subOrderIndex]?.items?.[itemIndex]
              ?.productName && (
              <p className="text-xs text-red-500 mt-1">
                {
                  errors.subOrders[subOrderIndex].items[itemIndex].productName
                    .message
                }
              </p>
            )}
          </div>

          <div className="col-span-12 md:col-span-3">
            <input
              {...register(
                `subOrders.${subOrderIndex}.items.${itemIndex}.productUrl`
              )}
              type="text"
              placeholder="Link sản phẩm"
              className="flex h-9 w-full rounded-md border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="col-span-4 md:col-span-2">
            <input
              {...register(
                `subOrders.${subOrderIndex}.items.${itemIndex}.quantity`,
                {
                  valueAsNumber: true,
                }
              )}
              type="number"
              placeholder="SL"
              min="1"
              className="flex h-9 w-full rounded-md border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="col-span-7 md:col-span-2">
            <input
              {...register(
                `subOrders.${subOrderIndex}.items.${itemIndex}.unitPrice`,
                {
                  valueAsNumber: true,
                }
              )}
              type="number"
              placeholder="Đơn giá"
              min="0"
              step="0.01"
              className="flex h-9 w-full rounded-md border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="col-span-1 flex items-center justify-center">
            {itemFields.length > 1 && (
              <button
                type="button"
                onClick={() => removeItem(itemIndex)}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
