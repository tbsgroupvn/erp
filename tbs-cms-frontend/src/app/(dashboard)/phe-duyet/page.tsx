'use client';

import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { ApprovalTable } from './_components/approval-tabs';
import {
  usePendingApprovals,
  useSubmittedApprovals,
  useProcessedApprovals,
  useCCApprovals,
  useApprovals,
  useApprovalCounts,
  useApproveApproval,
  useRejectApproval,
} from '@/lib/hooks/use-approvals';
import { cn } from '@/lib/utils/cn';
import type { Approval } from '@/lib/types';

const TABS = [
  { key: 'pending', label: 'Chờ tôi duyệt' },
  { key: 'submitted', label: 'Tôi đã gửi' },
  { key: 'processed', label: 'Đã xử lý' },
  { key: 'cc', label: 'Theo dõi' },
  { key: 'all', label: 'Tất cả' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function PheDuyetPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = (searchParams.get('tab') as TabKey) || 'pending';

  const counts = useApprovalCounts();
  const pendingQuery = usePendingApprovals({ enabled: activeTab === 'pending' });
  const submittedQuery = useSubmittedApprovals(undefined, { enabled: activeTab === 'submitted' });
  const processedQuery = useProcessedApprovals(undefined, { enabled: activeTab === 'processed' });
  const ccQuery = useCCApprovals(undefined, { enabled: activeTab === 'cc' });
  const allQuery = useApprovals(undefined, { enabled: activeTab === 'all' });

  const approveApproval = useApproveApproval();
  const rejectApproval = useRejectApproval();
  const isPending = approveApproval.isPending || rejectApproval.isPending;

  const setTab = (tab: TabKey) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'pending') {
      params.delete('tab');
    } else {
      params.set('tab', tab);
    }
    const qs = params.toString();
    router.push(qs ? `?${qs}` : '/phe-duyet');
  };

  const badgeCounts: Partial<Record<TabKey, number>> = {
    pending: counts.data?.pendingForMe,
    submitted: counts.data?.mySubmitted,
    cc: counts.data?.ccForMe,
  };

  const getTabData = (): { data: Approval[]; isLoading: boolean } => {
    switch (activeTab) {
      case 'pending':
        return { data: pendingQuery.data ?? [], isLoading: pendingQuery.isLoading };
      case 'submitted': {
        const submitted = submittedQuery.data;
        return { data: submitted?.data ?? [], isLoading: submittedQuery.isLoading };
      }
      case 'processed': {
        const processed = processedQuery.data;
        return { data: processed?.data ?? [], isLoading: processedQuery.isLoading };
      }
      case 'cc': {
        const cc = ccQuery.data;
        return { data: cc?.data ?? [], isLoading: ccQuery.isLoading };
      }
      case 'all': {
        const all = allQuery.data;
        return { data: all?.data ?? [], isLoading: allQuery.isLoading };
      }
      default:
        return { data: [], isLoading: false };
    }
  };

  const { data, isLoading } = getTabData();

  const emptyMessages: Record<TabKey, string> = {
    pending: 'Không có yêu cầu chờ duyệt',
    submitted: 'Bạn chưa gửi yêu cầu nào',
    processed: 'Bạn chưa xử lý yêu cầu nào',
    cc: 'Không có yêu cầu theo dõi',
    all: 'Không có yêu cầu nào',
  };

  return (
    <div>
      <PageHeader
        title="Phê duyệt"
        description="Trung tâm phê duyệt yêu cầu"
      />

      {/* Tabs */}
      <div className="border-b mb-6">
        <nav className="-mb-px flex gap-1">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const count = badgeCounts[tab.key];

            return (
              <button
                key={tab.key}
                onClick={() => setTab(tab.key)}
                className={cn(
                  'relative inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground',
                )}
              >
                {tab.label}
                {count != null && count > 0 && (
                  <span
                    className={cn(
                      'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Table */}
      <ApprovalTable
        data={data}
        isLoading={isLoading}
        emptyMessage={emptyMessages[activeTab]}
        showActions={activeTab === 'pending'}
        onApprove={(id) => approveApproval.mutate({ id })}
        onReject={(id) => rejectApproval.mutate({ id, comment: 'Từ chối' })}
        isPending={isPending}
      />
    </div>
  );
}
