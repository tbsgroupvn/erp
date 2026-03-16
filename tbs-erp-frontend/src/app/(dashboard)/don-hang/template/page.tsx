'use client';

import { useState } from 'react';
import { Plus, Edit, Trash2, Copy, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  useOrderTemplates,
  useDeleteOrderTemplate,
} from '@/lib/hooks/use-order-templates';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { CardSkeleton } from '@/components/shared/skeleton';
import {
  SERVICE_TYPE_LABELS,
  CLEARANCE_TYPE_LABELS,
  BRANCH_LABELS,
} from '@/lib/utils/constants';
import type { OrderTemplate, ServiceType, ClearanceType, Branch } from '@/lib/types';
import { formatDateTime } from '@/lib/utils/format';

export default function OrderTemplatesPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  // Debounce search to avoid excessive API calls
  const debouncedSearchTerm = useDebouncedValue(searchTerm, 500);
  const { data, isLoading } = useOrderTemplates({ search: debouncedSearchTerm });
  const deleteTemplate = useDeleteOrderTemplate();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const templates = data?.data || [];

  const handleDelete = (id: string, templateName: string) => {
    if (confirm(`Bạn có chắc muốn xóa template "${templateName}"?\n\nHành động này không thể hoàn tác.`)) {
      setDeletingId(id);
      deleteTemplate.mutate(id, {
        onSuccess: () => {
          setDeletingId(null);
        },
        onError: (error: Error) => {
          setDeletingId(null);
          console.error('Delete template error:', error);
        },
      });
    }
  };

  const handleUseTemplate = (template: OrderTemplate) => {
    try {
      // Validate template has data
      if (!template.subOrders || template.subOrders.length === 0) {
        toast.error('Template không hợp lệ: Thiếu đơn con');
        return;
      }

      // Store template data in sessionStorage
      sessionStorage.setItem(
        'orderTemplateData',
        JSON.stringify({
          branch: template.branch,
          subOrders: template.subOrders.map((so) => ({
            serviceType: so.serviceType,
            clearanceType: so.clearanceType,
            shippingRoute: so.shippingRoute,
            note: so.note,
            items: so.items.map((item) => ({
              productName: item.productName,
              productUrl: item.productUrl,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              note: item.note,
            })),
          })),
        })
      );
      router.push(`/don-hang/tao-moi?template=${template.id}`);
    } catch (error) {
      console.error('Failed to use template:', error);
      toast.error('Không thể áp dụng template. Vui lòng thử lại.');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <PageHeader
          title="Quản lý Template Đơn Hàng"
          description="Lưu và quản lý các mẫu đơn hàng thường dùng"
        />
        <Link
          href="/don-hang/template/tao-moi"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Tạo template mới
        </Link>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Tìm kiếm template theo tên..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex h-10 w-full max-w-md rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Templates Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : templates.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <div
              key={template.id}
              className="rounded-lg border bg-card p-4 hover:border-primary/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-base mb-1">
                    {template.name}
                  </h3>
                  {template.description && (
                    <p className="text-xs text-muted-foreground mb-2">
                      {template.description}
                    </p>
                  )}
                  {template.branch && (
                    <StatusBadge
                      label={BRANCH_LABELS[template.branch as Branch]}
                      colorClass="bg-blue-100 text-blue-700"
                    />
                  )}
                </div>
              </div>

              {/* Sub-orders summary */}
              <div className="mb-3 space-y-1 text-xs">
                <p className="text-muted-foreground">
                  {template.subOrders.length} đơn con •{' '}
                  {template.subOrders.reduce(
                    (sum, so) => sum + so.items.length,
                    0
                  )}{' '}
                  sản phẩm
                </p>
                {template.subOrders.map((so, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 text-muted-foreground"
                  >
                    <span className="font-medium text-foreground">
                      {String.fromCharCode(65 + idx)}:
                    </span>
                    <span>
                      {SERVICE_TYPE_LABELS[so.serviceType as ServiceType]}
                    </span>
                    <span>•</span>
                    <span>
                      {
                        CLEARANCE_TYPE_LABELS[
                          so.clearanceType as ClearanceType
                        ]
                      }
                    </span>
                  </div>
                ))}
              </div>

              {/* Meta */}
              <p className="text-xs text-muted-foreground mb-3">
                Tạo {formatDateTime(template.createdAt)}
                {template.createdBy && ` bởi ${template.createdBy.fullName}`}
              </p>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleUseTemplate(template)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Dùng template
                </button>
                <Link
                  href={`/don-hang/template/${template.id}`}
                  className="inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent"
                >
                  <Edit className="h-3.5 w-3.5" />
                </Link>
                <button
                  type="button"
                  onClick={() => handleDelete(template.id, template.name)}
                  disabled={deletingId === template.id}
                  className="inline-flex items-center justify-center rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  title="Xóa template"
                >
                  {deletingId === template.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 border rounded-lg">
          <p className="text-muted-foreground mb-4">
            {searchTerm
              ? 'Không tìm thấy template nào'
              : 'Chưa có template nào'}
          </p>
          <Link
            href="/don-hang/template/tao-moi"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Tạo template đầu tiên
          </Link>
        </div>
      )}
    </div>
  );
}
