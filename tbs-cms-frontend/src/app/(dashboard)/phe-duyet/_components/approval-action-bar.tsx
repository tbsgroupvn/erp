'use client';

import * as React from 'react';
import {
  CheckCircle,
  XCircle,
  ArrowRightLeft,
  RotateCcw,
  Undo2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  useApproveApproval,
  useRejectApproval,
  useDelegateApproval,
  useReturnApproval,
  useWithdrawApproval,
} from '@/lib/hooks/use-approvals';

interface ApprovalActionBarProps {
  approvalId: string;
  isMyPending: boolean;
  isMySubmission: boolean;
  currentStepId?: string;
}

export function ApprovalActionBar({
  approvalId,
  isMyPending,
  isMySubmission,
  currentStepId,
}: ApprovalActionBarProps) {
  const [comment, setComment] = React.useState('');
  const [showRejectForm, setShowRejectForm] = React.useState(false);
  const [showReturnForm, setShowReturnForm] = React.useState(false);

  const approveApproval = useApproveApproval();
  const rejectApproval = useRejectApproval();
  const returnApproval = useReturnApproval();
  const withdrawApproval = useWithdrawApproval();

  const isPending =
    approveApproval.isPending ||
    rejectApproval.isPending ||
    returnApproval.isPending ||
    withdrawApproval.isPending;

  const handleApprove = () => {
    approveApproval.mutate({ id: approvalId, comment: comment || undefined });
    setComment('');
  };

  const handleReject = () => {
    if (!comment.trim()) return;
    rejectApproval.mutate({ id: approvalId, comment });
    setComment('');
    setShowRejectForm(false);
  };

  const handleReturn = () => {
    if (!comment.trim()) return;
    returnApproval.mutate({ id: approvalId, comment });
    setComment('');
    setShowReturnForm(false);
  };

  const handleWithdraw = () => {
    withdrawApproval.mutate({ id: approvalId });
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      {/* Comment input */}
      {(isMyPending || showRejectForm || showReturnForm) && (
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={
            showRejectForm
              ? 'Lý do từ chối (bắt buộc)...'
              : showReturnForm
                ? 'Lý do trả lại (bắt buộc)...'
                : 'Ghi chú (không bắt buộc)...'
          }
          className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          rows={2}
        />
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {isMyPending && !showRejectForm && !showReturnForm && (
          <>
            <Button
              onClick={handleApprove}
              disabled={isPending}
              className="bg-green-600 hover:bg-green-700"
              size="sm"
            >
              <CheckCircle className="mr-1.5 h-4 w-4" />
              Duyệt
            </Button>
            <Button
              onClick={() => setShowRejectForm(true)}
              disabled={isPending}
              variant="destructive"
              size="sm"
            >
              <XCircle className="mr-1.5 h-4 w-4" />
              Từ chối
            </Button>
            <Button
              onClick={() => setShowReturnForm(true)}
              disabled={isPending}
              variant="outline"
              size="sm"
            >
              <RotateCcw className="mr-1.5 h-4 w-4" />
              Trả lại
            </Button>
          </>
        )}

        {showRejectForm && (
          <>
            <Button
              onClick={handleReject}
              disabled={isPending || !comment.trim()}
              variant="destructive"
              size="sm"
            >
              Xác nhận từ chối
            </Button>
            <Button
              onClick={() => {
                setShowRejectForm(false);
                setComment('');
              }}
              variant="ghost"
              size="sm"
            >
              Hủy
            </Button>
          </>
        )}

        {showReturnForm && (
          <>
            <Button
              onClick={handleReturn}
              disabled={isPending || !comment.trim()}
              variant="outline"
              size="sm"
            >
              Xác nhận trả lại
            </Button>
            <Button
              onClick={() => {
                setShowReturnForm(false);
                setComment('');
              }}
              variant="ghost"
              size="sm"
            >
              Hủy
            </Button>
          </>
        )}

        {isMySubmission && (
          <Button
            onClick={handleWithdraw}
            disabled={isPending}
            variant="outline"
            size="sm"
          >
            <Undo2 className="mr-1.5 h-4 w-4" />
            Rút lại
          </Button>
        )}
      </div>
    </div>
  );
}
