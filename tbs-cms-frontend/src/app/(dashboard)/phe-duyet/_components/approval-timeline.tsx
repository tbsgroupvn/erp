'use client';

import { CheckCircle2, XCircle, Clock, ArrowRight, MessageSquare } from 'lucide-react';
import { USER_ROLE_LABELS, APPROVAL_STATUS_LABELS } from '@/lib/utils/constants';
import { formatDateTime } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import type { ApprovalStep, ApprovalStatus } from '@/lib/types';

interface ApprovalTimelineProps {
  steps: ApprovalStep[];
  currentStep: number;
}

function getStepIcon(status: ApprovalStatus, isCurrent: boolean) {
  switch (status) {
    case 'APPROVED':
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    case 'REJECTED':
      return <XCircle className="h-5 w-5 text-red-500" />;
    case 'CANCELLED':
      return <XCircle className="h-5 w-5 text-gray-400" />;
    default:
      return (
        <Clock
          className={cn(
            'h-5 w-5',
            isCurrent ? 'text-yellow-500' : 'text-gray-300',
          )}
        />
      );
  }
}

export function ApprovalTimeline({ steps, currentStep }: ApprovalTimelineProps) {
  return (
    <div className="space-y-1">
      {steps.map((step, index) => {
        const isCurrent = step.stepNumber === currentStep && step.status === 'PENDING';
        const isLast = index === steps.length - 1;

        return (
          <div key={step.id} className="flex gap-3">
            {/* Icon + Line */}
            <div className="flex flex-col items-center">
              <div className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full border-2',
                step.status === 'APPROVED' && 'border-green-200 bg-green-50',
                step.status === 'REJECTED' && 'border-red-200 bg-red-50',
                isCurrent && 'border-yellow-300 bg-yellow-50 ring-2 ring-yellow-200',
                step.status === 'PENDING' && !isCurrent && 'border-gray-200 bg-gray-50',
                step.status === 'CANCELLED' && 'border-gray-200 bg-gray-50',
              )}>
                {getStepIcon(step.status as ApprovalStatus, isCurrent)}
              </div>
              {!isLast && (
                <div className="w-0.5 flex-1 min-h-[24px] bg-gray-200" />
              )}
            </div>

            {/* Content */}
            <div className={cn('flex-1 pb-4', isLast && 'pb-0')}>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  Bước {step.stepNumber}
                </span>
                <span className="text-sm text-muted-foreground">
                  {USER_ROLE_LABELS[step.approverRole] || step.approverRole}
                </span>
                {step.isOverdue && (
                  <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700">
                    Quá hạn
                  </span>
                )}
                {step.delegatedFromUserId && (
                  <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">
                    Được ủy quyền
                  </span>
                )}
              </div>

              {step.decidedAt && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {APPROVAL_STATUS_LABELS[step.status as ApprovalStatus]} lúc{' '}
                  {formatDateTime(step.decidedAt)}
                </p>
              )}

              {step.deadlineAt && step.status === 'PENDING' && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Hạn xử lý: {formatDateTime(step.deadlineAt)}
                </p>
              )}

              {step.comment && (
                <div className="mt-1 flex items-start gap-1.5 rounded-md bg-muted/50 p-2">
                  <MessageSquare className="mt-0.5 h-3 w-3 text-muted-foreground shrink-0" />
                  <p className="text-xs text-muted-foreground">{step.comment}</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
