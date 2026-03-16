'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Loader2,
  CheckCheck,
  XCircle,
  Percent,
  Receipt,
  ReceiptText,
  Ban,
  Clock,
  Shield,
  Container,
  Warehouse,
  CalendarOff,
  Timer,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
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
// Type icon / color helpers
// ---------------------------------------------------------------------------

/** Map approval type to a background + text color class for the icon container */
function getTypeColor(type: string): string {
  const colors: Record<string, string> = {
    DISCOUNT: 'bg-amber-100 text-amber-700',
    PAYMENT_VOUCHER: 'bg-emerald-100 text-emerald-700',
    RECEIPT_VOUCHER: 'bg-blue-100 text-blue-700',
    ORDER_CANCEL: 'bg-red-100 text-red-700',
    CREDIT_EXTENSION: 'bg-purple-100 text-purple-700',
    DEPOSIT_EXEMPTION: 'bg-cyan-100 text-cyan-700',
    CONTAINER_PLAN: 'bg-indigo-100 text-indigo-700',
    WAREHOUSE_RELEASE: 'bg-orange-100 text-orange-700',
    LEAVE_REQUEST: 'bg-pink-100 text-pink-700',
    OVERTIME_REQUEST: 'bg-teal-100 text-teal-700',
  };
  return colors[type] ?? 'bg-muted text-muted-foreground';
}

/** Map approval type to an icon element */
function getTypeIcon(type: string): React.ReactNode {
  const iconClass = 'h-5 w-5';
  const icons: Record<string, React.ReactNode> = {
    DISCOUNT: <Percent className={iconClass} />,
    PAYMENT_VOUCHER: <Receipt className={iconClass} />,
    RECEIPT_VOUCHER: <ReceiptText className={iconClass} />,
    ORDER_CANCEL: <Ban className={iconClass} />,
    CREDIT_EXTENSION: <Clock className={iconClass} />,
    DEPOSIT_EXEMPTION: <Shield className={iconClass} />,
    CONTAINER_PLAN: <Container className={iconClass} />,
    WAREHOUSE_RELEASE: <Warehouse className={iconClass} />,
    LEAVE_REQUEST: <CalendarOff className={iconClass} />,
    OVERTIME_REQUEST: <Timer className={iconClass} />,
  };
  return icons[type] ?? <FileText className={iconClass} />;
}

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

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-start gap-4 rounded-xl border bg-card p-4 animate-pulse">
            <div className="h-10 w-10 shrink-0 rounded-lg bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-48 rounded bg-muted" />
              <div className="h-3 w-32 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 py-16">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
          <CheckCheck className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  // ── Card list ─────────────────────────────────────────────────────────────
  return (
    <>
      {/* Select-all bar — only when actions are enabled */}
      {showActions && data.length > 0 && (
        <div className="flex items-center gap-3 mb-3 px-1">
          <Checkbox
            checked={allSelected ? true : someSelected ? 'indeterminate' : false}
            onCheckedChange={toggleAll}
            aria-label="Chọn tất cả"
          />
          <span className="text-xs text-muted-foreground">
            {allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
          </span>
        </div>
      )}

      <div className="space-y-3">
        {data.map((approval) => {
          const currentStep = approval.steps?.find(
            (s) => s.stepNumber === approval.currentStep,
          );
          const isSelected = selectedIds.has(approval.id);

          return (
            <div
              key={approval.id}
              className={cn(
                'group relative flex items-start gap-4 rounded-xl border bg-card p-4 transition-all hover:shadow-md',
                isSelected
                  ? 'ring-2 ring-primary/30 bg-primary/5'
                  : 'hover:border-primary/20',
              )}
            >
              {/* Checkbox — only when showActions */}
              {showActions && (
                <div className="pt-1">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleOne(approval.id)}
                    aria-label={`Chọn yêu cầu ${approval.referenceCode || approval.id}`}
                  />
                </div>
              )}

              {/* Type icon / color indicator */}
              <div
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                  getTypeColor(approval.type),
                )}
              >
                {getTypeIcon(approval.type)}
              </div>

              {/* Main content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/phe-duyet/${approval.id}`}
                      className="text-sm font-semibold text-foreground hover:text-primary transition-colors"
                    >
                      {APPROVAL_TYPE_LABELS[approval.type as ApprovalType] || approval.type}
                      {approval.isUrgent && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                          Khẩn
                        </span>
                      )}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {approval.referenceCode || approval.referenceId}
                    </p>
                  </div>
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
                </div>

                <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                  <span>
                    Bước {approval.currentStep}/{approval.totalSteps}
                    {currentStep &&
                      ` — ${USER_ROLE_LABELS[currentStep.approverRole] || currentStep.approverRole}`}
                  </span>
                  <span>{formatDateTime(approval.createdAt)}</span>
                </div>
              </div>

              {/* Approve / Reject buttons — only when showActions */}
              {showActions && (
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => onApprove?.(approval.id)}
                    disabled={isPending || isBatchPending}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 ring-1 ring-green-200 hover:bg-green-100 disabled:opacity-50 transition-colors"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    Duyệt
                  </button>
                  <button
                    onClick={() => onReject?.(approval.id)}
                    disabled={isPending || isBatchPending}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 ring-1 ring-red-200 hover:bg-red-100 disabled:opacity-50 transition-colors"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Từ chối
                  </button>
                </div>
              )}
            </div>
          );
        })}
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
