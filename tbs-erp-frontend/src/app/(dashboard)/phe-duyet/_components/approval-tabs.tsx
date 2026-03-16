'use client';

import * as React from 'react';
import Link from 'next/link';
import { Loader2, CheckCheck, XCircle } from 'lucide-react';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  APPROVAL_TYPE_LABELS,
  APPROVAL_STATUS_LABELS,
  APPROVAL_STATUS_COLORS,
  USER_ROLE_LABELS,
} from '@/lib/utils/constants';
import { formatDateTime } from '@/lib/utils/format';
import type { Approval, ApprovalType, ApprovalStatus } from '@/lib/types';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useBatchApprove, useBatchReject } from '@/lib/hooks/use-approval-flows';

// ---------------------------------------------------------------------------
// Batch confirmation dialog
// ---------------------------------------------------------------------------

type BatchAction = 'approve' | 'reject';

interface BatchConfirmDialogProps {
  open: boolean;
  action: BatchAction;
  count: number;
  isPending: boolean;
  onConfirm: (comment: string) => void;
  onCancel: () => void;
}

function BatchConfirmDialog({
  open,
  action,
  count,
  isPending,
  onConfirm,
  onCancel,
}: BatchConfirmDialogProps) {
  const [comment, setComment] = React.useState('');

  // Reset comment whenever dialog opens
  React.useEffect(() => {
    if (open) setComment('');
  }, [open]);

  const isApprove = action === 'approve';

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isApprove ? 'Xác nhận duyệt hàng loạt' : 'Xác nhận từ chối hàng loạt'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Bạn sắp{' '}
            <span className={isApprove ? 'font-semibold text-green-700' : 'font-semibold text-red-700'}>
              {isApprove ? 'phê duyệt' : 'từ chối'}
            </span>{' '}
            <span className="font-semibold">{count}</span> yêu cầu đã chọn.
            Hành động này không thể hoàn tác.
          </p>

          <div className="space-y-2">
            <Label htmlFor="batch-comment">
              Ghi chú{isApprove ? ' (tùy chọn)' : ' (tùy chọn)'}
            </Label>
            <Textarea
              id="batch-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={
                isApprove
                  ? 'Nhập ghi chú phê duyệt...'
                  : 'Nhập lý do từ chối...'
              }
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isPending}>
            Hủy
          </Button>
          <Button
            variant={isApprove ? 'default' : 'destructive'}
            onClick={() => onConfirm(comment)}
            disabled={isPending}
            className={isApprove ? 'bg-green-600 hover:bg-green-700' : ''}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Đang xử lý...
              </>
            ) : isApprove ? (
              <>
                <CheckCheck className="mr-2 h-4 w-4" />
                Duyệt {count} yêu cầu
              </>
            ) : (
              <>
                <XCircle className="mr-2 h-4 w-4" />
                Từ chối {count} yêu cầu
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Floating batch action bar
// ---------------------------------------------------------------------------

interface BatchActionBarProps {
  selectedCount: number;
  onApproveAll: () => void;
  onRejectAll: () => void;
  onClear: () => void;
  disabled: boolean;
}

function BatchActionBar({
  selectedCount,
  onApproveAll,
  onRejectAll,
  onClear,
  disabled,
}: BatchActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-full border bg-background px-5 py-3 shadow-xl ring-1 ring-black/5">
        <span className="text-sm font-medium text-foreground">
          Đã chọn{' '}
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
            {selectedCount}
          </span>{' '}
          yêu cầu
        </span>

        <div className="h-4 w-px bg-border" />

        <Button
          size="sm"
          onClick={onApproveAll}
          disabled={disabled}
          className="h-8 rounded-full bg-green-600 px-4 text-xs font-medium text-white hover:bg-green-700"
        >
          <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
          Duyệt tất cả
        </Button>

        <Button
          size="sm"
          variant="destructive"
          onClick={onRejectAll}
          disabled={disabled}
          className="h-8 rounded-full px-4 text-xs font-medium"
        >
          <XCircle className="mr-1.5 h-3.5 w-3.5" />
          Từ chối tất cả
        </Button>

        <button
          onClick={onClear}
          disabled={disabled}
          className="ml-1 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          aria-label="Bỏ chọn tất cả"
        >
          <span className="text-xs font-medium">Bỏ chọn</span>
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main ApprovalTable component
// ---------------------------------------------------------------------------

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
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [dialogState, setDialogState] = React.useState<{
    open: boolean;
    action: BatchAction;
  }>({ open: false, action: 'approve' });

  const batchApprove = useBatchApprove();
  const batchReject = useBatchReject();
  const isBatchPending = batchApprove.isPending || batchReject.isPending;

  // Reset selections whenever data changes (e.g. after a batch action)
  React.useEffect(() => {
    setSelectedIds(new Set());
  }, [data]);

  const allIds = React.useMemo(() => data.map((a) => a.id), [data]);
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));
  const someSelected = !allSelected && allIds.some((id) => selectedIds.has(id));

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const openDialog = (action: BatchAction) => {
    setDialogState({ open: true, action });
  };

  const closeDialog = () => {
    setDialogState((prev) => ({ ...prev, open: false }));
  };

  const handleBatchConfirm = async (comment: string) => {
    const approvalIds = Array.from(selectedIds);
    if (dialogState.action === 'approve') {
      await batchApprove.mutateAsync({ approvalIds, comment: comment || undefined });
    } else {
      await batchReject.mutateAsync({ approvalIds, comment: comment || undefined });
    }
    closeDialog();
    setSelectedIds(new Set());
  };

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
    <>
      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {showActions && (
                  <th className="w-10 px-4 py-3">
                    <Checkbox
                      checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                      onCheckedChange={toggleAll}
                      aria-label="Chọn tất cả"
                    />
                  </th>
                )}
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
                const isSelected = selectedIds.has(approval.id);

                return (
                  <tr
                    key={approval.id}
                    className={`border-b last:border-b-0 transition-colors hover:bg-muted/30 ${
                      isSelected ? 'bg-primary/5' : ''
                    }`}
                  >
                    {showActions && (
                      <td className="w-10 px-4 py-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleOne(approval.id)}
                          aria-label={`Chọn yêu cầu ${approval.referenceCode || approval.id}`}
                        />
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <Link
                        href={`/phe-duyet/${approval.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {APPROVAL_TYPE_LABELS[approval.type as ApprovalType] || approval.type}
                      </Link>
                      {approval.isUrgent && (
                        <span className="ml-2 inline-block rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
                          Khẩn
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
                            disabled={isPending || isBatchPending}
                            className="rounded-md bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            Duyệt
                          </button>
                          <button
                            onClick={() => onReject?.(approval.id)}
                            disabled={isPending || isBatchPending}
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

      {/* Floating batch action bar — only visible when items are selected */}
      {showActions && (
        <BatchActionBar
          selectedCount={selectedIds.size}
          onApproveAll={() => openDialog('approve')}
          onRejectAll={() => openDialog('reject')}
          onClear={() => setSelectedIds(new Set())}
          disabled={isBatchPending}
        />
      )}

      {/* Confirmation dialog */}
      <BatchConfirmDialog
        open={dialogState.open}
        action={dialogState.action}
        count={selectedIds.size}
        isPending={isBatchPending}
        onConfirm={handleBatchConfirm}
        onCancel={closeDialog}
      />
    </>
  );
}
