'use client';

export const dynamic = 'force-dynamic';

import { useRouter } from 'next/navigation';
import { Plus, Loader2, Settings, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  useApprovalFlows,
  useDeactivateApprovalFlow,
} from '@/lib/hooks/use-approval-flows';
import { APPROVAL_TYPE_LABELS } from '@/lib/utils/constants';
import { formatDateTime } from '@/lib/utils/format';
import type { ApprovalType } from '@/lib/types';

const CATEGORY_COLORS: Record<string, string> = {
  SALES: 'bg-blue-100 text-blue-700',
  FINANCE: 'bg-emerald-100 text-emerald-700',
  HR: 'bg-purple-100 text-purple-700',
  LOGISTICS: 'bg-orange-100 text-orange-700',
  OTHER: 'bg-gray-100 text-gray-700',
};

const CATEGORY_LABELS: Record<string, string> = {
  SALES: 'Kinh doanh',
  FINANCE: 'Tài chính',
  HR: 'Nhân sự',
  LOGISTICS: 'Vận hành',
  OTHER: 'Khác',
};

export default function QuyTrinhPheDuyetPage() {
  const router = useRouter();
  const { data: flows, isLoading } = useApprovalFlows();
  const deactivate = useDeactivateApprovalFlow();

  return (
    <div>
      <PageHeader
        title="Quy trình phê duyệt"
        description="Quản lý các quy trình phê duyệt"
      >
        <Button
          onClick={() => router.push('./quy-trinh-phe-duyet/tao-moi')}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Tạo quy trình
        </Button>
      </PageHeader>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (!flows || flows.length === 0) && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Settings className="h-12 w-12 mb-4" />
          <p className="text-lg font-medium">Chưa có quy trình nào</p>
          <p className="text-sm mt-1">
            Bấm &quot;Tạo quy trình&quot; để bắt đầu.
          </p>
        </div>
      )}

      {/* Grid of cards */}
      {!isLoading && flows && flows.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {flows.map((flow) => {
            const categoryColor =
              CATEGORY_COLORS[flow.category ?? 'OTHER'] ??
              CATEGORY_COLORS.OTHER;
            const categoryLabel =
              CATEGORY_LABELS[flow.category ?? 'OTHER'] ??
              (flow.category || 'Khác');
            const triggerLabel =
              APPROVAL_TYPE_LABELS[flow.triggerType as ApprovalType] ??
              flow.triggerType;

            return (
              <div
                key={flow.id}
                className="rounded-lg border bg-card p-5 flex flex-col gap-3"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold leading-tight">{flow.name}</h3>
                  <StatusBadge
                    label={flow.isActive ? 'Hoạt động' : 'Vô hiệu'}
                    colorClass={
                      flow.isActive
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }
                  />
                </div>

                {/* Description */}
                {flow.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {flow.description}
                  </p>
                )}

                {/* Badges row */}
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge
                    label={categoryLabel}
                    colorClass={categoryColor}
                  />
                  <span className="text-xs text-muted-foreground">
                    {triggerLabel}
                  </span>
                </div>

                {/* Meta */}
                <div className="text-xs text-muted-foreground space-y-1 mt-auto">
                  <div className="flex items-center justify-between">
                    <span>Phiên bản: {flow.version}</span>
                    <span>{formatDateTime(flow.createdAt)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 flex-1"
                    onClick={() =>
                      router.push(`./quy-trinh-phe-duyet/${flow.id}`)
                    }
                  >
                    <Settings className="h-3.5 w-3.5" />
                    Chỉnh sửa
                  </Button>
                  {flow.isActive && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-destructive hover:text-destructive"
                      disabled={deactivate.isPending}
                      onClick={() => deactivate.mutate(flow.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Vô hiệu
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
