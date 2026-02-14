'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Clock,
  AlertTriangle,
  User,
  MessageSquare,
  History,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { ApprovalTimeline } from '../_components/approval-timeline';
import { ApprovalActionBar } from '../_components/approval-action-bar';
import {
  useApproval,
  useApprovalComments,
  useApprovalActionLog,
  useAddApprovalComment,
} from '@/lib/hooks/use-approvals';
import {
  APPROVAL_TYPE_LABELS,
  APPROVAL_STATUS_LABELS,
  APPROVAL_STATUS_COLORS,
  USER_ROLE_LABELS,
} from '@/lib/utils/constants';
import { formatDateTime } from '@/lib/utils/format';
import { useAuthStore } from '@/lib/stores/auth-store';
import type { ApprovalType, ApprovalStatus, ApprovalAction } from '@/lib/types';

const ACTION_LABELS: Record<string, string> = {
  SUBMIT: 'Gửi yêu cầu',
  APPROVE: 'Phê duyệt',
  REJECT: 'Từ chối',
  DELEGATE: 'Chuyển tiếp',
  ADD_APPROVER: 'Thêm người duyệt',
  WITHDRAW: 'Rút lại',
  RETURN: 'Trả lại',
  AUTO_APPROVE: 'Tự động duyệt',
  AUTO_ESCALATE: 'Tự động leo thang',
  COMMENT: 'Bình luận',
};

export default function ApprovalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const user = useAuthStore((s) => s.user);

  const { data: approval, isLoading } = useApproval(id);
  const { data: comments } = useApprovalComments(id);
  const { data: actionLog } = useApprovalActionLog(id);
  const addComment = useAddApprovalComment();

  const [newComment, setNewComment] = React.useState('');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!approval) {
    return (
      <div className="rounded-lg border bg-card p-12 text-center">
        <p className="text-sm text-muted-foreground">Không tìm thấy yêu cầu phê duyệt</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/phe-duyet')}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Quay lại
        </Button>
      </div>
    );
  }

  const isMyPending =
    approval.status === 'PENDING' &&
    approval.steps?.some(
      (s) =>
        s.stepNumber === approval.currentStep &&
        s.status === 'PENDING' &&
        (s.assignedUserId === user?.id ||
          s.approverRole === user?.role),
    );

  const isMySubmission = approval.requestedBy === user?.id;

  const currentStep = approval.steps?.find(
    (s) => s.stepNumber === approval.currentStep,
  );

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    addComment.mutate(
      { id, content: newComment },
      { onSuccess: () => setNewComment('') },
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 pb-2">
        <Button variant="ghost" size="icon" onClick={() => router.push('/phe-duyet')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader
          title={
            APPROVAL_TYPE_LABELS[approval.type as ApprovalType] || approval.type
          }
          className="pb-0"
        />
      </div>

      {/* Meta info */}
      <div className="flex flex-wrap items-center gap-3 pb-6">
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
        {approval.isUrgent && (
          <span className="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
            <AlertTriangle className="h-3 w-3" />
            Khẩn
          </span>
        )}
        <span className="text-sm text-muted-foreground">
          Mã: {approval.referenceCode || approval.referenceId}
        </span>
        <span className="text-sm text-muted-foreground">
          Tạo lúc: {formatDateTime(approval.createdAt)}
        </span>
        {approval.deadline && (
          <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            Hạn: {formatDateTime(approval.deadline)}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column: Timeline + Action bar */}
        <div className="lg:col-span-2 space-y-6">
          {/* Action Bar */}
          {(isMyPending || isMySubmission) && (
            <ApprovalActionBar
              approvalId={id}
              isMyPending={!!isMyPending}
              isMySubmission={isMySubmission}
              currentStepId={currentStep?.id}
            />
          )}

          {/* Timeline */}
          <div className="rounded-lg border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold">Tiến trình phê duyệt</h3>
            {approval.steps && approval.steps.length > 0 ? (
              <ApprovalTimeline
                steps={approval.steps}
                currentStep={approval.currentStep}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Chưa có bước phê duyệt</p>
            )}
          </div>

          {/* Request Data */}
          {approval.requestData && (
            <div className="rounded-lg border bg-card p-4">
              <h3 className="mb-3 text-sm font-semibold">Dữ liệu yêu cầu</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {Object.entries(approval.requestData as Record<string, unknown>).map(
                      ([key, value]) => (
                        <tr key={key} className="border-b last:border-b-0">
                          <td className="py-2 pr-4 font-medium text-muted-foreground w-1/3">
                            {key}
                          </td>
                          <td className="py-2">
                            {typeof value === 'object'
                              ? JSON.stringify(value)
                              : String(value ?? '')}
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right column: CC, Comments, Action Log */}
        <div className="space-y-6">
          {/* CC List */}
          {approval.ccUsers && approval.ccUsers.length > 0 && (
            <div className="rounded-lg border bg-card p-4">
              <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
                <User className="h-4 w-4" />
                Người theo dõi
              </h3>
              <div className="space-y-1.5">
                {approval.ccUsers.map((cc) => (
                  <div
                    key={cc.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span>{cc.userId}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(cc.notifiedAt)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comments */}
          <div className="rounded-lg border bg-card p-4">
            <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
              <MessageSquare className="h-4 w-4" />
              Bình luận ({comments?.length ?? 0})
            </h3>
            <div className="space-y-3 mb-3 max-h-60 overflow-y-auto">
              {comments && comments.length > 0 ? (
                comments.map((c: { id: string; userId: string; content: string; createdAt: string }) => (
                  <div key={c.id} className="rounded-md bg-muted/50 p-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium">{c.userId}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(c.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm">{c.content}</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">Chưa có bình luận</p>
              )}
            </div>
            <div className="flex gap-2">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Thêm bình luận..."
                className="flex-1 rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                rows={2}
              />
              <Button
                onClick={handleAddComment}
                disabled={!newComment.trim() || addComment.isPending}
                size="sm"
                className="self-end"
              >
                Gửi
              </Button>
            </div>
          </div>

          {/* Action Log */}
          <div className="rounded-lg border bg-card p-4">
            <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
              <History className="h-4 w-4" />
              Nhật ký ({actionLog?.length ?? 0})
            </h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {actionLog && actionLog.length > 0 ? (
                actionLog.map((log: { id: string; userId: string; action: string; comment?: string | null; createdAt: string }) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-2 text-xs border-b last:border-b-0 pb-2"
                  >
                    <div className="flex-1">
                      <span className="font-medium">{log.userId}</span>
                      <span className="text-muted-foreground">
                        {' '}
                        {ACTION_LABELS[log.action] || log.action}
                      </span>
                      {log.comment && (
                        <p className="mt-0.5 text-muted-foreground italic">
                          &quot;{log.comment}&quot;
                        </p>
                      )}
                    </div>
                    <span className="text-muted-foreground whitespace-nowrap">
                      {formatDateTime(log.createdAt)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">Chưa có nhật ký</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
