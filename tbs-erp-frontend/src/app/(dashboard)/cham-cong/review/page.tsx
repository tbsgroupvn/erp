'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Check,
  Ban,
  X,
  Loader2,
  Eye,
  Clock,
  MapPin,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/api/client';
import { formatDate, formatDateTime } from '@/lib/utils/format';
import type { ColumnDef } from '@tanstack/react-table';
import type { BaseResponse, PaginatedResponse } from '@/lib/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ManualCheckIn {
  id: string;
  employeeId: string;
  employee?: {
    id: string;
    fullName: string;
    code: string;
    department?: string;
  };
  selfieUrl: string;
  latitude: number;
  longitude: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  checkInDate: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Status labels & colors
// ---------------------------------------------------------------------------

const REVIEW_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Cho duyet',
  APPROVED: 'Da duyet',
  REJECTED: 'Tu choi',
};

const REVIEW_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
};

// ---------------------------------------------------------------------------
// API hooks
// ---------------------------------------------------------------------------

function useManualCheckIns(params: Record<string, unknown>) {
  return useQuery({
    queryKey: ['manual-check-ins', params],
    queryFn: () =>
      apiClient
        .get<PaginatedResponse<ManualCheckIn>>('/attendance/manual-check-ins', { params })
        .then((r) => r.data),
  });
}

function useApproveCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      apiClient
        .patch<BaseResponse<ManualCheckIn>>(
          `/attendance/manual-check-ins/${encodeURIComponent(id)}/approve`,
          { note },
        )
        .then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['manual-check-ins'] });
      toast.success('Da duyet cham cong');
    },
    onError: () => {
      toast.error('Khong the duyet cham cong');
    },
  });
}

function useRejectCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      apiClient
        .patch<BaseResponse<ManualCheckIn>>(
          `/attendance/manual-check-ins/${encodeURIComponent(id)}/reject`,
          { note },
        )
        .then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['manual-check-ins'] });
      toast.success('Da tu choi cham cong');
    },
    onError: () => {
      toast.error('Khong the tu choi cham cong');
    },
  });
}

// ---------------------------------------------------------------------------
// Selfie Preview Dialog
// ---------------------------------------------------------------------------

function SelfieDialog({
  imageUrl,
  onClose,
}: {
  imageUrl: string;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Selfie preview"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
      tabIndex={-1}
    >
      <div
        role="presentation"
        className="relative max-w-2xl max-h-[80vh] mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          variant="ghost"
          size="icon"
          className="absolute -top-10 right-0 text-white hover:bg-white/20"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </Button>
        <img
          src={imageUrl}
          alt="Selfie check-in"
          className="rounded-lg max-h-[80vh] object-contain"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function AttendanceReviewPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('PENDING');
  const [viewingSelfie, setViewingSelfie] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  const approveMutation = useApproveCheckIn();
  const rejectMutation = useRejectCheckIn();

  const queryParams: Record<string, unknown> = { page, limit: 20 };
  if (statusFilter) queryParams.status = statusFilter;

  const { data, isLoading } = useManualCheckIns(queryParams);

  const handleApprove = useCallback(
    (id: string) => {
      approveMutation.mutate({ id });
    },
    [approveMutation],
  );

  const handleReject = useCallback(
    (id: string) => {
      if (!rejectNote.trim()) {
        toast.error('Vui long nhap ly do tu choi');
        return;
      }
      rejectMutation.mutate(
        { id, note: rejectNote.trim() },
        {
          onSuccess: () => {
            setRejectingId(null);
            setRejectNote('');
          },
        },
      );
    },
    [rejectNote, rejectMutation],
  );

  const columns: ColumnDef<ManualCheckIn>[] = [
    {
      accessorKey: 'employee',
      header: 'Nhan vien',
      cell: ({ row }) => (
        <div>
          <p className="font-medium">
            {row.original.employee?.fullName || row.original.employeeId}
          </p>
          {row.original.employee?.code && (
            <p className="text-xs text-muted-foreground">{row.original.employee.code}</p>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'checkInDate',
      header: 'Ngay cham cong',
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{formatDate(row.original.checkInDate, 'dd/MM/yyyy')}</span>
        </div>
      ),
    },
    {
      accessorKey: 'reason',
      header: 'Ly do',
      cell: ({ row }) => (
        <span className="max-w-[200px] truncate block">{row.original.reason}</span>
      ),
    },
    {
      accessorKey: 'selfieUrl',
      header: 'Selfie',
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => setViewingSelfie(row.original.selfieUrl)}
          className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
        >
          <Eye className="h-3.5 w-3.5" />
          Xem anh
        </button>
      ),
    },
    {
      accessorKey: 'location',
      header: 'Vi tri',
      cell: ({ row }) => (
        <div className="flex items-center gap-1 text-xs">
          <MapPin className="h-3 w-3 text-muted-foreground" />
          <span>
            {row.original.latitude.toFixed(4)}, {row.original.longitude.toFixed(4)}
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Trang thai',
      cell: ({ row }) => (
        <StatusBadge
          label={REVIEW_STATUS_LABELS[row.original.status] || row.original.status}
          colorClass={REVIEW_STATUS_COLORS[row.original.status] || 'bg-gray-100 text-gray-700'}
        />
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Gui luc',
      cell: ({ row }) => (
        <span className="text-xs">{formatDateTime(row.original.createdAt)}</span>
      ),
    },
    {
      id: 'actions',
      header: 'Thao tac',
      cell: ({ row }) => {
        if (row.original.status !== 'PENDING') {
          if (row.original.reviewNote) {
            return (
              <span className="text-xs text-muted-foreground">
                {row.original.reviewNote}
              </span>
            );
          }
          return null;
        }

        if (rejectingId === row.original.id) {
          return (
            <div className="flex items-center gap-1">
              <Input
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="Ly do tu choi"
                className="h-7 text-xs w-28"
              />
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600 h-7 px-2"
                onClick={() => handleReject(row.original.id)}
                disabled={rejectMutation.isPending}
              >
                {rejectMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  'OK'
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-1"
                onClick={() => {
                  setRejectingId(null);
                  setRejectNote('');
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          );
        }

        return (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="text-green-600 hover:text-green-700 hover:bg-green-50 h-7"
              onClick={() => handleApprove(row.original.id)}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Check className="mr-1 h-3.5 w-3.5" />
              )}
              Duyet
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:text-red-700 hover:bg-red-50 h-7"
              onClick={() => setRejectingId(row.original.id)}
            >
              <Ban className="mr-1 h-3.5 w-3.5" />
              Tu choi
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Duyet cham cong thu cong"
        description="Xem va duyet yeu cau cham cong thu cong cua nhan vien"
      />

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Label htmlFor="review-status-filter" className="whitespace-nowrap text-sm">
            Trang thai:
          </Label>
          <select
            id="review-status-filter"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Tat ca</option>
            <option value="PENDING">Cho duyet</option>
            <option value="APPROVED">Da duyet</option>
            <option value="REJECTED">Tu choi</option>
          </select>
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={data?.data ?? []}
        pageCount={data?.meta?.totalPages}
        page={page}
        onPageChange={setPage}
        isLoading={isLoading}
      />

      {/* Selfie preview dialog */}
      {viewingSelfie && (
        <SelfieDialog
          imageUrl={viewingSelfie}
          onClose={() => setViewingSelfie(null)}
        />
      )}
    </div>
  );
}
