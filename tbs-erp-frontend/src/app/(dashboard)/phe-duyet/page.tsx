'use client';

import * as React from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
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
import { InfoTooltip } from '@/components/shared/info-tooltip';

// Ủy quyền imports
import { useState } from 'react';
import {
  ClipboardCheck,
  UserCog,
  Clock,
  Send,
  CheckCircle2,
  Eye,
  List,
  Plus,
  X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useDelegations,
  useCreateDelegation,
  useDeactivateDelegation,
} from '@/lib/hooks/use-approval-flows';
import { formatDate } from '@/lib/utils/format';

// ---------------------------------------------------------------------------
// Outer section tabs
// ---------------------------------------------------------------------------

const SECTION_TABS = [
  { key: 'default', label: 'Phê duyệt', icon: ClipboardCheck },
  { key: 'uy-quyen', label: 'Ủy quyền', icon: UserCog },
] as const;

type SectionKey = (typeof SECTION_TABS)[number]['key'];

// ---------------------------------------------------------------------------
// Approval section (original page content)
// ---------------------------------------------------------------------------

const APPROVAL_TABS = [
  { key: 'pending', label: 'Chờ tôi duyệt', icon: Clock },
  { key: 'submitted', label: 'Tôi đã gửi', icon: Send },
  { key: 'processed', label: 'Đã xử lý', icon: CheckCircle2 },
  { key: 'cc', label: 'Theo dõi', icon: Eye },
  { key: 'all', label: 'Tất cả', icon: List },
] as const;

type TabKey = (typeof APPROVAL_TABS)[number]['key'];

function ApprovalSection() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
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
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const badgeCounts: Partial<Record<TabKey, number>> = {
    pending: counts.data?.pendingForMe,
    submitted: counts.data?.mySubmitted,
    cc: counts.data?.ccForMe,
  };

  const getTabData = (): { data: Approval[]; isLoading: boolean } => {
    switch (activeTab) {
      case 'pending': {
        const pending = pendingQuery.data;
        return { data: pending?.data ?? [], isLoading: pendingQuery.isLoading };
      }
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
      {/* Approval inner tabs — Lark-style horizontal pills */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {APPROVAL_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          const count = badgeCounts[tab.key];

          return (
            <button
              key={tab.key}
              onClick={() => setTab(tab.key)}
              className={cn(
                'inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-all',
                isActive
                  ? 'bg-primary/10 text-primary ring-1 ring-primary/20'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {count != null && count > 0 && (
                <span
                  className={cn(
                    'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted-foreground/20 text-muted-foreground',
                  )}
                >
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </button>
          );
        })}
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

// ---------------------------------------------------------------------------
// Delegation (Ủy quyền) section
// ---------------------------------------------------------------------------

function UyQuyenSection() {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    delegateUserId: '',
    startDate: '',
    endDate: '',
    approvalTypes: '',
    reason: '',
  });
  const { data: delegations, isLoading } = useDelegations();
  const createDelegation = useCreateDelegation();
  const deactivateDelegation = useDeactivateDelegation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createDelegation.mutateAsync({
        toUserId: formData.delegateUserId,
        startDate: formData.startDate,
        endDate: formData.endDate,
        approvalTypes: formData.approvalTypes
          ? formData.approvalTypes.split(',').map((t) => t.trim())
          : undefined,
        reason: formData.reason,
      });
      setFormData({ delegateUserId: '', startDate: '', endDate: '', approvalTypes: '', reason: '' });
      setShowForm(false);
    } catch (error) {
      console.error('Failed to create delegation:', error);
    }
  };

  const handleDeactivate = async (delegationId: string) => {
    if (confirm('Bạn có chắc chắn muốn hủy ủy quyền này?')) {
      try {
        await deactivateDelegation.mutateAsync(delegationId);
      } catch (error) {
        console.error('Failed to deactivate delegation:', error);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">
            Quản lý ủy quyền phê duyệt khi vắng mặt
          </p>
          <InfoTooltip tipKey="approval-flow" />
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? (
            <>
              <X className="mr-2 h-4 w-4" />
              Đóng
            </>
          ) : (
            <>
              <Plus className="mr-2 h-4 w-4" />
              Tạo ủy quyền
            </>
          )}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2">
              <UserCog className="h-5 w-5" />
              Tạo ủy quyền mới
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="delegateUserId">
                    Người nhận ủy quyền <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="delegateUserId"
                    value={formData.delegateUserId}
                    onChange={(e) => setFormData({ ...formData, delegateUserId: e.target.value })}
                    required
                    placeholder="Nhập ID người dùng"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reason">
                    Lý do <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="reason"
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    required
                    placeholder="Nhập lý do ủy quyền"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="startDate">
                    Ngày bắt đầu <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">
                    Ngày kết thúc <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="approvalTypes">
                    Loại phê duyệt{' '}
                    <span className="text-muted-foreground">(tùy chọn)</span>
                  </Label>
                  <Input
                    id="approvalTypes"
                    value={formData.approvalTypes}
                    onChange={(e) => setFormData({ ...formData, approvalTypes: e.target.value })}
                    placeholder="Để trống cho tất cả hoặc nhập các loại cách nhau bởi dấu phẩy"
                  />
                  <p className="text-sm text-muted-foreground">
                    Ví dụ: purchase_order, expense, leave_request
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Hủy
                </Button>
                <Button type="submit" disabled={createDelegation.isPending}>
                  {createDelegation.isPending ? 'Đang tạo...' : 'Tạo ủy quyền'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Danh sách ủy quyền</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Đang tải...</div>
          ) : !delegations || delegations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Chưa có ủy quyền nào</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Người nhận</th>
                    <th className="text-left py-3 px-4 font-medium">Ngày bắt đầu</th>
                    <th className="text-left py-3 px-4 font-medium">Ngày kết thúc</th>
                    <th className="text-left py-3 px-4 font-medium">Lý do</th>
                    <th className="text-left py-3 px-4 font-medium">Trạng thái</th>
                    <th className="text-center py-3 px-4 font-medium">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {delegations.map((delegation) => (
                    <tr key={delegation.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4">{delegation.toUserId}</td>
                      <td className="py-3 px-4">{formatDate(delegation.startDate)}</td>
                      <td className="py-3 px-4">{formatDate(delegation.endDate)}</td>
                      <td className="py-3 px-4">{delegation.reason}</td>
                      <td className="py-3 px-4">
                        {delegation.isActive ? (
                          <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-green-100 text-green-700">
                            Đang hoạt động
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700">
                            Đã hủy
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {delegation.isActive && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeactivate(delegation.id)}
                            disabled={deactivateDelegation.isPending}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Hủy
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inner component (reads searchParams — must be inside Suspense)
// ---------------------------------------------------------------------------

function PheDuyetInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Use `section` param for the outer tab so it doesn't conflict with
  // the inner `tab` param used by the approval sub-tabs.
  const activeSection = (searchParams.get('section') as SectionKey) || 'default';

  const setSection = (section: SectionKey) => {
    const params = new URLSearchParams(searchParams.toString());
    // Clear inner `tab` when switching sections
    params.delete('tab');
    if (section === 'default') params.delete('section');
    else params.set('section', section);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <div>
      <PageHeader
        title="Phê duyệt"
        description="Trung tâm phê duyệt yêu cầu"
        infoKey="phe-duyet"
      />

      {/* Outer section tabs — Lark-style pill buttons */}
      <div className="flex gap-2 mb-6">
        {SECTION_TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setSection(t.key)}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all',
                activeSection === t.key
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Section content */}
      {activeSection === 'default' ? <ApprovalSection /> : <UyQuyenSection />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page export
// ---------------------------------------------------------------------------

export default function PheDuyetPage() {
  return (
    <React.Suspense>
      <PheDuyetInner />
    </React.Suspense>
  );
}
