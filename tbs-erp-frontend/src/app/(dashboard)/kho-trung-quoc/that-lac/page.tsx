'use client';

import { useState, useCallback, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search, UserPlus, X, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/api/client';
import { formatDate } from '@/lib/utils/format';
import type { ColumnDef } from '@tanstack/react-table';
import type { BaseResponse, PaginatedResponse } from '@/lib/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrphanPackage {
  id: string;
  code: string;
  trackingNumber: string | null;
  description: string | null;
  weight: number | null;
  warehouse: 'CN' | 'VN';
  status: 'UNIDENTIFIED' | 'CLAIMED' | 'DISPOSED';
  claimedByCustomerId: string | null;
  claimedByOrderId: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Status labels & colors
// ---------------------------------------------------------------------------

const ORPHAN_STATUS_LABELS: Record<string, string> = {
  UNIDENTIFIED: 'Chưa xác định',
  CLAIMED: 'Đã nhận vô',
  DISPOSED: 'Đã xử lý',
};

const ORPHAN_STATUS_COLORS: Record<string, string> = {
  UNIDENTIFIED: 'bg-yellow-100 text-yellow-700',
  CLAIMED: 'bg-green-100 text-green-700',
  DISPOSED: 'bg-gray-100 text-gray-500',
};

const WAREHOUSE_LABELS: Record<string, string> = {
  CN: 'Kho TQ',
  VN: 'Kho VN',
};

// ---------------------------------------------------------------------------
// API hooks
// ---------------------------------------------------------------------------

function useOrphanPackages(params: Record<string, unknown>) {
  return useQuery({
    queryKey: ['orphan-packages', params],
    queryFn: () =>
      apiClient
        .get<PaginatedResponse<OrphanPackage>>('/warehouse-cn/orphan-packages', { params })
        .then((r) => r.data),
  });
}

function useClaimOrphanPackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      orphanPackageId: string;
      customerId: string;
      orderId: string;
      note?: string;
    }) =>
      apiClient
        .post<BaseResponse<OrphanPackage>>(
          `/warehouse-cn/orphan-packages/${encodeURIComponent(data.orphanPackageId)}/claim`,
          {
            customerId: data.customerId,
            orderId: data.orderId,
            note: data.note,
          },
        )
        .then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orphan-packages'] });
      toast.success('Nhận vô kiện hàng thành công');
    },
    onError: () => {
      toast.error('Không thể nhận vô kiện hàng');
    },
  });
}

// ---------------------------------------------------------------------------
// Claim Dialog
// ---------------------------------------------------------------------------

function ClaimDialog({
  orphanPackage,
  onClose,
}: {
  orphanPackage: OrphanPackage;
  onClose: () => void;
}) {
  const [customerId, setCustomerId] = useState('');
  const [orderId, setOrderId] = useState('');
  const [note, setNote] = useState('');
  const claimMutation = useClaimOrphanPackage();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!customerId.trim() || !orderId.trim()) return;
    claimMutation.mutate(
      {
        orphanPackageId: orphanPackage.id,
        customerId: customerId.trim(),
        orderId: orderId.trim(),
        note: note.trim() || undefined,
      },
      {
        onSuccess: () => onClose(),
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-md mx-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Nhận vô kiện hàng</CardTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Mã kiện: <span className="font-medium">{orphanPackage.code}</span>
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="claim-customer">Mã khách hàng *</Label>
              <Input
                id="claim-customer"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                placeholder="Nhập mã khách hàng"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="claim-order">Mã đơn hàng *</Label>
              <Input
                id="claim-order"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                placeholder="Nhập mã đơn hàng"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="claim-note">Ghi chú</Label>
              <Input
                id="claim-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ghi chú thêm"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                type="submit"
                disabled={claimMutation.isPending || !customerId.trim() || !orderId.trim()}
              >
                {claimMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Xác nhận nhận vô
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Hủy
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function OrphanPackagesPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [warehouseFilter, setWarehouseFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [claimingPackage, setClaimingPackage] = useState<OrphanPackage | null>(null);

  const queryParams: Record<string, unknown> = { page, limit: 20 };
  if (statusFilter) queryParams.status = statusFilter;
  if (warehouseFilter) queryParams.warehouse = warehouseFilter;
  if (searchQuery) queryParams.search = searchQuery;

  const { data, isLoading } = useOrphanPackages(queryParams);

  const columns: ColumnDef<OrphanPackage>[] = [
    {
      accessorKey: 'code',
      header: 'Mã kiện',
      cell: ({ row }) => <span className="font-medium">{row.original.code}</span>,
    },
    {
      accessorKey: 'trackingNumber',
      header: 'Mã vận đơn',
      cell: ({ row }) => <span>{row.original.trackingNumber || '---'}</span>,
    },
    {
      accessorKey: 'description',
      header: 'Mô tả',
      cell: ({ row }) => (
        <span className="max-w-[200px] truncate block">
          {row.original.description || '---'}
        </span>
      ),
    },
    {
      accessorKey: 'weight',
      header: 'Trọng lượng (kg)',
      cell: ({ row }) => <span>{row.original.weight != null ? Number(row.original.weight).toFixed(2) : '---'}</span>,
    },
    {
      accessorKey: 'warehouse',
      header: 'Kho',
      cell: ({ row }) => (
        <StatusBadge
          label={WAREHOUSE_LABELS[row.original.warehouse] || row.original.warehouse}
          colorClass={row.original.warehouse === 'CN' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}
        />
      ),
    },
    {
      accessorKey: 'status',
      header: 'Trạng thái',
      cell: ({ row }) => (
        <StatusBadge
          label={ORPHAN_STATUS_LABELS[row.original.status] || row.original.status}
          colorClass={ORPHAN_STATUS_COLORS[row.original.status] || 'bg-gray-100 text-gray-700'}
        />
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Ngày tạo',
      cell: ({ row }) => <span>{formatDate(row.original.createdAt)}</span>,
    },
    {
      id: 'actions',
      header: 'Thao tác',
      cell: ({ row }) => {
        if (row.original.status !== 'UNIDENTIFIED') return null;
        return (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setClaimingPackage(row.original)}
          >
            <UserPlus className="mr-1 h-3.5 w-3.5" />
            Nhận vô
          </Button>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Kiện hàng thất lạc"
        description="Quản lý kiện hàng vô chủ / thất lạc tại kho"
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Label htmlFor="orphan-status-filter" className="whitespace-nowrap text-sm">
            Trạng thái:
          </Label>
          <select
            id="orphan-status-filter"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Tất cả</option>
            <option value="UNIDENTIFIED">Chưa xác định</option>
            <option value="CLAIMED">Đã nhận vô</option>
            <option value="DISPOSED">Đã xử lý</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="orphan-warehouse-filter" className="whitespace-nowrap text-sm">
            Kho:
          </Label>
          <select
            id="orphan-warehouse-filter"
            value={warehouseFilter}
            onChange={(e) => {
              setWarehouseFilter(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Tất cả</option>
            <option value="CN">Kho TQ</option>
            <option value="VN">Kho VN</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Tìm kiếm mã kiện, mã vận đơn..."
              className="pl-9 h-9 w-64"
            />
          </div>
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

      {/* Claim Dialog */}
      {claimingPackage && (
        <ClaimDialog
          orphanPackage={claimingPackage}
          onClose={() => setClaimingPackage(null)}
        />
      )}
    </div>
  );
}
