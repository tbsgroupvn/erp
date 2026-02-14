'use client';

import * as React from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  APPROVAL_TYPE_LABELS,
  APPROVAL_STATUS_LABELS,
  APPROVAL_STATUS_COLORS,
  USER_ROLE_LABELS,
} from '@/lib/utils/constants';
import { formatDateTime } from '@/lib/utils/format';
import type { Approval, ApprovalType, ApprovalStatus } from '@/lib/types';

interface ApprovalTableProps {
  data: Approval[];
  isLoading: boolean;
  emptyMessage?: string;
  showActions?: boolean;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  isPending?: boolean;
}

export function ApprovalTable({
  data,
  isLoading,
  emptyMessage = 'Không có yêu cầu nào',
  showActions = false,
  onApprove,
  onReject,
  isPending = false,
}: ApprovalTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-12 text-center">
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">Loại</th>
              <th className="px-4 py-3 text-left font-medium">Mã tham chiếu</th>
              <th className="px-4 py-3 text-left font-medium">Bước hiện tại</th>
              <th className="px-4 py-3 text-left font-medium">Trạng thái</th>
              <th className="px-4 py-3 text-left font-medium">Ngày tạo</th>
              {showActions && (
                <th className="px-4 py-3 text-right font-medium">Thao tác</th>
              )}
            </tr>
          </thead>
          <tbody>
            {data.map((approval) => {
              const currentStep = approval.steps?.find(
                (s) => s.stepNumber === approval.currentStep,
              );

              return (
                <tr
                  key={approval.id}
                  className="border-b last:border-b-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/phe-duyet/${approval.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {APPROVAL_TYPE_LABELS[approval.type as ApprovalType] || approval.type}
                    </Link>
                    {approval.isUrgent && (
                      <span className="ml-2 inline-block rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
                        Khan
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {approval.referenceCode || approval.referenceId}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-muted-foreground">
                      {approval.currentStep}/{approval.totalSteps}
                      {currentStep &&
                        ` - ${USER_ROLE_LABELS[currentStep.approverRole] || currentStep.approverRole}`}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      label={
                        APPROVAL_STATUS_LABELS[approval.status as ApprovalStatus] ||
                        approval.status
                      }
                      colorClass={
                        APPROVAL_STATUS_COLORS[approval.status as ApprovalStatus] ||
                        'bg-gray-100 text-gray-700'
                      }
                    />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {formatDateTime(approval.createdAt)}
                  </td>
                  {showActions && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onApprove?.(approval.id)}
                          disabled={isPending}
                          className="rounded-md bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          Duyệt
                        </button>
                        <button
                          onClick={() => onReject?.(approval.id)}
                          disabled={isPending}
                          className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          Từ chối
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
