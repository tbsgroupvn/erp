'use client';

import { useState, useCallback } from 'react';
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
  UNIDENTIFIED: 'Chua xac dinh',
  CLAIMED: 'Da nhan vo',
  DISPOSED: 'Da xu ly',
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
      toast.success('Nhan vo kien hang thanh cong');
    },
    onError: () => {
      toast.error('Khong the nhan vo kien hang');
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

  const handleSubmit = (e: React.FormEvent) => {
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
            <CardTitle className="text-lg">Nhan vo kien hang</CardTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Ma kien: <span className="font-medium">{orphanPackage.code}</span>
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="claim-customer">Ma khach hang *</Label>
              <Input
                id="claim-customer"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                placeholder="Nhap ma khach hang"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="claim-order">Ma don hang *</Label>
              <Input
                id="claim-order"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                placeholder="Nhap ma don hang"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="claim-note">Ghi chu</Label>
              <Input
                id="claim-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ghi chu them"
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
                Xac nhan nhan vo
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Huy
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
      header: 'Ma kien',
      cell: ({ row }) => <span className="font-medium">{row.original.code}</span>,
    },
    {
      accessorKey: 'trackingNumber',
      header: 'Ma van don',
      cell: ({ row }) => <span>{row.original.trackingNumber || '---'}</span>,
    },
    {
      accessorKey: 'description',
      header: 'Mo ta',
      cell: ({ row }) => (
        <span className="max-w-[200px] truncate block">
          {row.original.description || '---'}
        </span>
      ),
    },
    {
      accessorKey: 'weight',
      header: 'Trong luong (kg)',
      cell: ({ row }) => <span>{row.original.weight?.toFixed(2) ?? '---'}</span>,
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
      header: 'Trang thai',
      cell: ({ row }) => (
        <StatusBadge
          label={ORPHAN_STATUS_LABELS[row.original.status] || row.original.status}
          colorClass={ORPHAN_STATUS_COLORS[row.original.status] || 'bg-gray-100 text-gray-700'}
        />
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Ngay tao',
      cell: ({ row }) => <span>{formatDate(row.original.createdAt)}</span>,
    },
    {
      id: 'actions',
      header: 'Thao tac',
      cell: ({ row }) => {
        if (row.original.status !== 'UNIDENTIFIED') return null;
        return (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setClaimingPackage(row.original)}
          >
            <UserPlus className="mr-1 h-3.5 w-3.5" />
            Nhan vo
          </Button>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Kien hang that lac"
        description="Quan ly kien hang vo chu / that lac tai kho"
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Label htmlFor="orphan-status-filter" className="whitespace-nowrap text-sm">
            Trang thai:
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
            <option value="">Tat ca</option>
            <option value="UNIDENTIFIED">Chua xac dinh</option>
            <option value="CLAIMED">Da nhan vo</option>
            <option value="DISPOSED">Da xu ly</option>
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
            <option value="">Tat ca</option>
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
              placeholder="Tim kiem ma kien, ma van don..."
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
