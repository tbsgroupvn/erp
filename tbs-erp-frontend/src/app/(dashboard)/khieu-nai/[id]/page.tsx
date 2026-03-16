'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, UserPlus, PlayCircle, AlertTriangle } from 'lucide-react';
import { StatusBadge } from '@/components/shared/status-badge';
import { LoadingOverlay } from '@/components/shared/loading-overlay';
import { useComplaint, useResolveComplaint, useAssignComplaintHandler } from '@/lib/hooks/use-complaints';
import { useEmployees } from '@/lib/hooks/use-employees';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { complaintsApi } from '@/lib/api/complaints.api';
import {
  COMPLAINT_TYPE_LABELS,
  COMPLAINT_SEVERITY_LABELS,
  COMPLAINT_SEVERITY_COLORS,
  COMPLAINT_STATUS_LABELS,
  COMPLAINT_STATUS_COLORS,
  RESOLUTION_TYPE_LABELS,
} from '@/lib/utils/constants';
import { formatDate } from '@/lib/utils/format';
import type { ComplaintType, ComplaintSeverity, ComplaintStatus } from '@/lib/types';
import { ResolutionType, ComplaintStatus as ComplaintStatusEnum } from '@/lib/types';
import { toast } from 'sonner';

export default function ComplaintDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const qc = useQueryClient();
  const { data: complaint, isLoading } = useComplaint(id);
  const resolveComplaint = useResolveComplaint();
  const assignHandler = useAssignComplaintHandler();
  const { data: employeesData } = useEmployees({ departmentCode: 'CSKH', limit: 100 });
  const [resolutionType, setResolutionType] = useState<ResolutionType>(ResolutionType.NONE);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolutionAmount, setResolutionAmount] = useState(0);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [selectedHandlerId, setSelectedHandlerId] = useState('');

  const updateStatus = useMutation({
    mutationFn: (status: ComplaintStatus) => complaintsApi.update(id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['complaints', 'detail', id] });
      toast.success('Đã cập nhật trạng thái');
    },
    onError: () => toast.error('Không thể cập nhật trạng thái'),
  });

  const escalate = useMutation({
    mutationFn: (level: string) => complaintsApi.escalate(id, level),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['complaints', 'detail', id] });
      toast.success('Đã leo thang khiếu nại');
    },
    onError: () => toast.error('Không thể leo thang'),
  });

  const cskhEmployees = employeesData?.data ?? [];

  if (isLoading) return <LoadingOverlay className="h-[60vh]" />;
  if (!complaint) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Không tìm thấy khiếu nại</p>
        <Link href="/khieu-nai" className="text-primary hover:underline mt-2 inline-block">
          Quay lại danh sách
        </Link>
      </div>
    );
  }

  const c = complaint as any;
  const status = c.status as ComplaintStatus;
  const severity = c.severity as ComplaintSeverity;
  const type = c.type as ComplaintType;
  const canResolve = status === 'OPEN' || status === 'INVESTIGATING' || status === 'PENDING_RESOLUTION';

  const handleResolve = () => {
    resolveComplaint.mutate({
      id,
      data: { resolutionType, resolutionNotes, resolutionAmount },
    }, {
      onSuccess: () => toast.success('Đã giải quyết khiếu nại'),
      onError: () => toast.error('Không thể giải quyết khiếu nại'),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/khieu-nai" className="inline-flex h-9 w-9 items-center justify-center rounded-md border hover:bg-accent">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{c.code}</h1>
            <StatusBadge
              label={COMPLAINT_STATUS_LABELS[status] || status}
              colorClass={COMPLAINT_STATUS_COLORS[status] || 'bg-gray-100 text-gray-700'}
            />
            <StatusBadge
              label={COMPLAINT_SEVERITY_LABELS[severity] || severity}
              colorClass={COMPLAINT_SEVERITY_COLORS[severity] || 'bg-gray-100 text-gray-700'}
            />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Tạo lúc {formatDate(c.createdAt)}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      {status !== 'RESOLVED' && status !== 'CLOSED' && (
        <div className="rounded-lg border bg-card p-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Nhận xử lý (OPEN → INVESTIGATING) */}
            {status === 'OPEN' && (
              <button
                type="button"
                onClick={() => updateStatus.mutate('INVESTIGATING' as ComplaintStatus)}
                disabled={updateStatus.isPending}
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <PlayCircle className="h-4 w-4" />
                Nhận xử lý
              </button>
            )}

            {/* Gán người xử lý */}
            {(status === 'OPEN' || status === 'INVESTIGATING') && !showAssignForm && (
              <button
                type="button"
                onClick={() => setShowAssignForm(true)}
                className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                <UserPlus className="h-4 w-4" />
                Gán người xử lý
              </button>
            )}

            {/* Assign Form */}
            {showAssignForm && (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={selectedHandlerId}
                  onChange={(e) => setSelectedHandlerId(e.target.value)}
                  className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Chọn người xử lý</option>
                  {cskhEmployees.map((emp: any) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName} ({emp.code})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedHandlerId) return;
                    assignHandler.mutate(
                      { id, handlerId: selectedHandlerId },
                      {
                        onSuccess: () => {
                          setShowAssignForm(false);
                          setSelectedHandlerId('');
                        },
                      }
                    );
                  }}
                  disabled={!selectedHandlerId || assignHandler.isPending}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {assignHandler.isPending ? 'Đang gán...' : 'Gán'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAssignForm(false);
                    setSelectedHandlerId('');
                  }}
                  className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent"
                >
                  Hủy
                </button>
              </div>
            )}

            {/* Leo thang */}
            {(status === 'INVESTIGATING' || status === 'PENDING_RESOLUTION') && (
              <button
                type="button"
                onClick={() => {
                  if (confirm('Xác nhận leo thang khiếu nại lên cấp quản lý?')) {
                    escalate.mutate('MANAGER');
                  }
                }}
                disabled={escalate.isPending}
                className="inline-flex items-center gap-2 rounded-md border border-orange-200 px-4 py-2 text-sm font-medium text-orange-600 hover:bg-orange-50 disabled:opacity-50"
              >
                <AlertTriangle className="h-4 w-4" />
                Leo thang
              </button>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Thông tin khiếu nại</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Loại</dt>
              <dd>{COMPLAINT_TYPE_LABELS[type] || type}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground mb-1">Mô tả</dt>
              <dd className="whitespace-pre-wrap">{c.description}</dd>
            </div>
            {c.handler && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Người xử lý</dt>
                <dd>{c.handler.fullName}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Khách hàng</h3>
          {c.customer ? (
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Mã KH</dt>
                <dd>
                  <Link href={`/khach-hang/${c.customer.id}`} className="text-primary hover:underline">
                    {c.customer.code}
                  </Link>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Tên</dt>
                <dd>{c.customer.fullName}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">Không có thông tin</p>
          )}
          {c.order && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Đơn hàng liên quan</span>
                <Link href={`/don-hang/${c.order.id}`} className="text-primary hover:underline">
                  {c.order.code}
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {c.attachments && c.attachments.length > 0 && (
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Tài liệu đính kèm</h3>
          <div className="flex flex-wrap gap-2">
            {c.attachments.map((url: string, i: number) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                Tệp {i + 1}
              </a>
            ))}
          </div>
        </div>
      )}

      {c.resolutionType && (
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Kết quả giải quyết</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Hình thức</dt>
              <dd>{RESOLUTION_TYPE_LABELS[c.resolutionType as ResolutionType] || c.resolutionType}</dd>
            </div>
            {c.resolutionAmount > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Số tiền</dt>
                <dd className="font-medium">{c.resolutionAmount?.toLocaleString('vi-VN')}</dd>
              </div>
            )}
            {c.resolutionNotes && (
              <div>
                <dt className="text-muted-foreground mb-1">Ghi chú</dt>
                <dd>{c.resolutionNotes}</dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {canResolve && (
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Giải quyết khiếu nại</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm font-medium">Hình thức giải quyết</p>
                <select
                  value={resolutionType}
                  onChange={(e) => setResolutionType(e.target.value as ResolutionType)}
                  className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {Object.entries(RESOLUTION_TYPE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Số tiền bồi thường</p>
                <input
                  type="number"
                  value={resolutionAmount}
                  onChange={(e) => setResolutionAmount(Number(e.target.value))}
                  className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Ghi chú giải quyết</p>
              <textarea
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                rows={3}
                placeholder="Nhập ghi chú..."
                className="flex w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleResolve}
                disabled={resolveComplaint.isPending || !resolutionNotes.trim()}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {resolveComplaint.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Giải quyết
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
