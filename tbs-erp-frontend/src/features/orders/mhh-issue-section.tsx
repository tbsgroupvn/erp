'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  Plus,
  ArrowRightCircle,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import {
  useMHHIssuesByOrder,
  useCreateMHHIssue,
  useUpdateMHHIssueStatus,
  useResolveMHHIssue,
} from '@/lib/hooks/use-mhh-issues';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  MHH_ISSUE_TYPE_LABELS,
  MHH_ISSUE_STATUS_LABELS,
  MHH_ISSUE_STATUS_COLORS,
  MHH_ISSUE_RESOLUTION_LABELS,
  COMPLAINT_SEVERITY_LABELS,
  COMPLAINT_SEVERITY_COLORS,
} from '@/lib/utils/constants';
import { formatCurrency, formatDateTime } from '@/lib/utils/format';
import {
  MHHIssueType,
  MHHIssueStatus,
  MHHIssueResolution,
  ComplaintSeverity,
  Currency,
} from '@/lib/types/enums';
import type {
  MHHIssue,
  CreateMHHIssueDto,
  ResolveMHHIssueDto,
} from '@/lib/types';

/** Status transitions for MHH issues — mirrors backend VALID_STATUS_TRANSITIONS */
const ISSUE_TRANSITIONS: Partial<Record<MHHIssueStatus, MHHIssueStatus[]>> = {
  [MHHIssueStatus.OPEN]: [MHHIssueStatus.INVESTIGATING],
  [MHHIssueStatus.INVESTIGATING]: [MHHIssueStatus.WAITING_SUPPLIER, MHHIssueStatus.WAITING_CUSTOMER, MHHIssueStatus.RESOLVED],
  [MHHIssueStatus.WAITING_SUPPLIER]: [MHHIssueStatus.INVESTIGATING, MHHIssueStatus.RESOLVED],
  [MHHIssueStatus.WAITING_CUSTOMER]: [MHHIssueStatus.RESOLVED, MHHIssueStatus.CLOSED],
  [MHHIssueStatus.RESOLVED]: [MHHIssueStatus.CLOSED],
};

interface MHHIssueSectionProps {
  orderId: string;
}

export function MHHIssueSection({ orderId }: MHHIssueSectionProps) {
  const { data: issues, isLoading } = useMHHIssuesByOrder(orderId);
  const createIssue = useCreateMHHIssue();
  const updateStatus = useUpdateMHHIssueStatus();
  const resolveIssue = useResolveMHHIssue();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  // Create form
  const [createForm, setCreateForm] = useState({
    issueType: MHHIssueType.OTHER as MHHIssueType,
    severity: ComplaintSeverity.MEDIUM as ComplaintSeverity,
    description: '',
  });

  // Resolve form
  const [resolveForm, setResolveForm] = useState<ResolveMHHIssueDto>({
    resolution: MHHIssueResolution.ACCEPT,
    resolutionNote: '',
  });

  const handleCreate = () => {
    if (!createForm.description.trim() || createForm.description.length < 10) return;
    createIssue.mutate(
      {
        orderId,
        data: {
          issueType: createForm.issueType,
          severity: createForm.severity,
          description: createForm.description,
        },
      },
      {
        onSuccess: () => {
          setShowCreateForm(false);
          setCreateForm({ issueType: MHHIssueType.OTHER, severity: ComplaintSeverity.MEDIUM, description: '' });
        },
      },
    );
  };

  const handleResolve = (issueId: string) => {
    resolveIssue.mutate(
      { issueId, data: resolveForm, orderId },
      {
        onSuccess: () => {
          setResolvingId(null);
          setResolveForm({ resolution: MHHIssueResolution.ACCEPT, resolutionNote: '' });
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        Đang tải vấn đề MHH...
      </div>
    );
  }

  const openCount = issues?.filter((i: MHHIssue) => i.status !== MHHIssueStatus.CLOSED && i.status !== MHHIssueStatus.RESOLVED).length ?? 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Vấn đề MHH ({issues?.length ?? 0})
          {openCount > 0 && (
            <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-xs font-medium">
              {openCount} mở
            </span>
          )}
        </h4>
        <button
          type="button"
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent"
        >
          <Plus className="h-3.5 w-3.5" />
          Báo vấn đề
        </button>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <div className="rounded-md border bg-muted/30 p-4 space-y-3">
          <p className="text-sm font-medium">Tạo vấn đề MHH mới</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Loại vấn đề *</p>
              <select
                value={createForm.issueType}
                onChange={(e) => setCreateForm((p) => ({ ...p, issueType: e.target.value as MHHIssueType }))}
                className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm"
              >
                {Object.values(MHHIssueType).map((type) => (
                  <option key={type} value={type}>
                    {MHH_ISSUE_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Mức độ</p>
              <select
                value={createForm.severity}
                onChange={(e) => setCreateForm((p) => ({ ...p, severity: e.target.value as ComplaintSeverity }))}
                className="mt-1 w-full rounded-md border px-3 py-1.5 text-sm"
              >
                {Object.values(ComplaintSeverity).map((sev) => (
                  <option key={sev} value={sev}>
                    {COMPLAINT_SEVERITY_LABELS[sev]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Mô tả * (tối thiểu 10 ký tự)</p>
            <textarea
              value={createForm.description}
              onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Mô tả chi tiết vấn đề gặp phải..."
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              rows={3}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={createForm.description.length < 10 || createIssue.isPending}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {createIssue.isPending ? 'Đang tạo...' : 'Tạo vấn đề'}
            </button>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              Hủy
            </button>
          </div>
        </div>
      )}

      {/* Issues list */}
      {issues && issues.length > 0 ? (
        <div className="space-y-2">
          {issues.map((issue: MHHIssue) => {
            const issueStatus = issue.status as MHHIssueStatus;
            const nextStatuses = (ISSUE_TRANSITIONS[issueStatus] ?? []).filter(
              (s) => s !== MHHIssueStatus.RESOLVED, // RESOLVED handled by resolve form
            );
            const canResolve = (ISSUE_TRANSITIONS[issueStatus] ?? []).includes(MHHIssueStatus.RESOLVED);
            const isTerminal = issueStatus === MHHIssueStatus.CLOSED;

            return (
              <div key={issue.id} className="rounded-md border p-4 space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{issue.code}</span>
                    <StatusBadge
                      label={MHH_ISSUE_STATUS_LABELS[issueStatus] || issueStatus}
                      colorClass={MHH_ISSUE_STATUS_COLORS[issueStatus] || 'bg-gray-100 text-gray-700'}
                    />
                    <StatusBadge
                      label={MHH_ISSUE_TYPE_LABELS[issue.issueType as MHHIssueType] || issue.issueType}
                      colorClass="bg-slate-100 text-slate-700"
                    />
                    <StatusBadge
                      label={COMPLAINT_SEVERITY_LABELS[issue.severity as ComplaintSeverity] || issue.severity}
                      colorClass={COMPLAINT_SEVERITY_COLORS[issue.severity as ComplaintSeverity] || 'bg-gray-100 text-gray-700'}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(issue.createdAt)}
                  </span>
                </div>

                {/* Description */}
                <p className="text-sm">{issue.description}</p>

                {/* Resolution info */}
                {issue.resolution && (
                  <div className="rounded-md bg-green-50 border border-green-200 p-3 text-xs space-y-1">
                    <div>
                      <span className="text-muted-foreground">Giải quyết:</span>{' '}
                      <span className="font-medium">{MHH_ISSUE_RESOLUTION_LABELS[issue.resolution as MHHIssueResolution]}</span>
                    </div>
                    {issue.resolutionNote && (
                      <div>
                        <span className="text-muted-foreground">Ghi chú:</span> {issue.resolutionNote}
                      </div>
                    )}
                    {issue.compensationAmount != null && issue.compensationAmount > 0 && (
                      <div>
                        <span className="text-muted-foreground">Bồi thường:</span>{' '}
                        {formatCurrency(issue.compensationAmount, issue.compensationCurrency || ('VND' as Currency))}
                      </div>
                    )}
                    {issue.resolvedAt && (
                      <div>
                        <span className="text-muted-foreground">Ngày giải quyết:</span> {formatDateTime(issue.resolvedAt)}
                      </div>
                    )}
                  </div>
                )}

                {/* Handler & item info */}
                <div className="grid grid-cols-2 gap-x-4 text-xs">
                  {issue.handler && (
                    <div>
                      <span className="text-muted-foreground">Xử lý:</span> {issue.handler.fullName}
                    </div>
                  )}
                  {issue.orderItem && (
                    <div>
                      <span className="text-muted-foreground">Sản phẩm:</span> {issue.orderItem.productName}
                    </div>
                  )}
                </div>

                {/* Actions */}
                {!isTerminal && (nextStatuses.length > 0 || canResolve) && (
                  <div className="flex items-center gap-2 pt-1 border-t">
                    {nextStatuses.map((nextStatus) => (
                      <button
                        key={nextStatus}
                        type="button"
                        onClick={() =>
                          updateStatus.mutate({ issueId: issue.id, status: nextStatus, orderId })
                        }
                        disabled={updateStatus.isPending}
                        className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
                      >
                        <ArrowRightCircle className="h-3 w-3" />
                        {MHH_ISSUE_STATUS_LABELS[nextStatus]}
                      </button>
                    ))}
                    {canResolve && (
                      <button
                        type="button"
                        onClick={() => setResolvingId(resolvingId === issue.id ? null : issue.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-green-200 px-2 py-1 text-xs text-green-700 hover:bg-green-50 ml-auto"
                      >
                        <CheckCircle className="h-3 w-3" />
                        Giải quyết
                      </button>
                    )}
                  </div>
                )}

                {/* Resolve form */}
                {resolvingId === issue.id && (
                  <div className="rounded-md border border-green-200 bg-green-50 p-3 space-y-3">
                    <p className="text-xs font-medium text-green-800">Giải quyết vấn đề</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Hình thức giải quyết *</p>
                        <select
                          value={resolveForm.resolution}
                          onChange={(e) => setResolveForm((p) => ({ ...p, resolution: e.target.value as MHHIssueResolution }))}
                          className="mt-1 w-full rounded-md border px-2 py-1 text-xs bg-white"
                        >
                          {Object.values(MHHIssueResolution).map((res) => (
                            <option key={res} value={res}>
                              {MHH_ISSUE_RESOLUTION_LABELS[res]}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Bồi thường (VND)</p>
                        <input
                          type="number"
                          value={resolveForm.compensationAmount ?? ''}
                          onChange={(e) => setResolveForm((p) => ({
                            ...p,
                            compensationAmount: e.target.value ? Number(e.target.value) : undefined,
                            compensationCurrency: e.target.value ? Currency.VND : undefined,
                          }))}
                          placeholder="0"
                          className="mt-1 w-full rounded-md border px-2 py-1 text-xs bg-white"
                        />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Ghi chú giải quyết</p>
                      <textarea
                        value={resolveForm.resolutionNote ?? ''}
                        onChange={(e) => setResolveForm((p) => ({ ...p, resolutionNote: e.target.value }))}
                        placeholder="Chi tiết cách giải quyết..."
                        className="mt-1 w-full rounded-md border px-2 py-1.5 text-xs bg-white"
                        rows={2}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleResolve(issue.id)}
                        disabled={resolveIssue.isPending}
                        className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        {resolveIssue.isPending ? 'Đang xử lý...' : 'Xác nhận giải quyết'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setResolvingId(null); setResolveForm({ resolution: MHHIssueResolution.ACCEPT, resolutionNote: '' }); }}
                        className="rounded-md border px-3 py-1 text-xs hover:bg-accent"
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">Chưa có vấn đề nào</p>
      )}
    </div>
  );
}
