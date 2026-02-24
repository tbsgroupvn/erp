'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PackageOpen, ArrowRightLeft, CheckCircle, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  useVnPackages as usePackagesVN,
  useReceiveFromContainer,
} from '@/lib/hooks/use-warehouse-vn';
import { useSortPackagesVN } from '@/lib/hooks/use-warehouse';
import { apiClient } from '@/lib/api/client';
import { formatDate } from '@/lib/utils/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ColumnDef } from '@tanstack/react-table';
import type { Package, BaseResponse } from '@/lib/types';

// ---------------------------------------------------------------------------
// Status labels & colors
// ---------------------------------------------------------------------------

const VN_STATUS_LABELS: Record<string, string> = {
  RECEIVED: 'Đã nhận',
  SORTED: 'Đã phân loại',
  READY: 'Sẵn sàng giao',
  DELIVERED: 'Đã giao',
};

const VN_STATUS_COLORS: Record<string, string> = {
  RECEIVED: 'bg-blue-100 text-blue-700',
  SORTED: 'bg-cyan-100 text-cyan-700',
  READY: 'bg-amber-100 text-amber-700',
  DELIVERED: 'bg-green-100 text-green-700',
};

// ---------------------------------------------------------------------------
// Status filter options
// ---------------------------------------------------------------------------

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'RECEIVED', label: 'Đã nhận' },
  { value: 'SORTED', label: 'Đã phân loại' },
  { value: 'READY', label: 'Sẵn sàng giao' },
  { value: 'DELIVERED', label: 'Đã giao' },
] as const;

// ---------------------------------------------------------------------------
// Receive from container form schema
// ---------------------------------------------------------------------------

const receiveFromContainerSchema = z.object({
  containerId: z.string().min(1, 'Mã container không được để trống'),
  packageIdsRaw: z.string().min(1, 'Danh sách mã kiện không được để trống'),
  notes: z.string().optional(),
});

type ReceiveFromContainerForm = z.infer<typeof receiveFromContainerSchema>;

// ---------------------------------------------------------------------------
// Barcode Scan Input Component
// ---------------------------------------------------------------------------

function BarcodeScanInput() {
  const [scanValue, setScanValue] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<Package | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleScan = useCallback(async (trackingNumber: string) => {
    const trimmed = trackingNumber.trim();
    if (!trimmed) return;
    setIsScanning(true);
    setScanResult(null);
    try {
      const response = await apiClient.get<BaseResponse<Package>>(
        `/warehouse-cn/scan/${encodeURIComponent(trimmed)}`,
      );
      const pkg = response.data.data;
      setScanResult(pkg);
      toast.success(`Tim thay kien hang: ${pkg.code}`, {
        description: `Don hang: ${pkg.orderId} | Trong luong: ${pkg.actualWeight?.toFixed(2) ?? '---'} kg | Trang thai VN: ${VN_STATUS_LABELS[pkg.warehouseVNStatus ?? ''] || pkg.warehouseVNStatus || '---'}`,
        duration: 6000,
      });
    } catch {
      toast.error('Khong tim thay kien hang', {
        description: `Ma van don: ${trimmed}`,
      });
    } finally {
      setIsScanning(false);
      setScanValue('');
      inputRef.current?.focus();
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleScan(scanValue);
      }
    },
    [scanValue, handleScan],
  );

  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-3">
          <Search className="h-5 w-5 text-muted-foreground shrink-0" />
          <div className="relative flex-1 max-w-md">
            <Input
              ref={inputRef}
              value={scanValue}
              onChange={(e) => setScanValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Quet ma van don (Enter de tra cuu)"
              className="pr-10"
              disabled={isScanning}
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
            />
            {isScanning && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleScan(scanValue)}
            disabled={isScanning || !scanValue.trim()}
          >
            Tra cuu
          </Button>
        </div>
        {scanResult && (
          <div className="mt-3 rounded-md border bg-muted/30 p-3">
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
              <div>
                <span className="text-muted-foreground">Ma kien:</span>{' '}
                <span className="font-medium">{scanResult.code}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Don hang:</span>{' '}
                <span className="font-medium">{scanResult.orderId}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Trong luong:</span>{' '}
                <span className="font-medium">{scanResult.actualWeight?.toFixed(2) ?? '---'} kg</span>
              </div>
              <div>
                <span className="text-muted-foreground">Trang thai:</span>{' '}
                <StatusBadge
                  label={VN_STATUS_LABELS[scanResult.warehouseVNStatus ?? ''] || scanResult.warehouseVNStatus || '---'}
                  colorClass={VN_STATUS_COLORS[scanResult.warehouseVNStatus ?? ''] || 'bg-gray-100 text-gray-700'}
                />
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function KhoVietNamPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showReceiveForm, setShowReceiveForm] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Build query params — status is supported by the underlying API
  const queryParams = useMemo(() => {
    const params: Record<string, unknown> = { page, limit: 20 };
    if (statusFilter) {
      params.status = statusFilter;
    }
    return params;
  }, [page, statusFilter]);

  const { data, isLoading } = usePackagesVN(queryParams);
  const receiveFromContainer = useReceiveFromContainer();
  const sortPackagesVN = useSortPackagesVN();

  const packages: Package[] = useMemo(() => data?.data ?? [], [data]);

  // ---------------------------------------------------------------------------
  // Receive form
  // ---------------------------------------------------------------------------

  const receiveForm = useForm<ReceiveFromContainerForm>({
    resolver: zodResolver(receiveFromContainerSchema),
    defaultValues: {
      containerId: '',
      packageIdsRaw: '',
      notes: '',
    },
  });

  const handleReceiveSubmit = useCallback(
    (values: ReceiveFromContainerForm) => {
      const packageIds = values.packageIdsRaw
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);

      receiveFromContainer.mutate(
        {
          containerId: values.containerId,
          packageIds,
          notes: values.notes || undefined,
        },
        {
          onSuccess: () => {
            receiveForm.reset();
            setShowReceiveForm(false);
          },
        },
      );
    },
    [receiveFromContainer, receiveForm],
  );

  // ---------------------------------------------------------------------------
  // Row selection helpers
  // ---------------------------------------------------------------------------

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === packages.length && packages.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(packages.map((p) => p.id)));
    }
  }, [packages, selectedIds.size]);

  const toggleSelectRow = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Determine what statuses the selected packages have
  const selectedPackages = useMemo(
    () => packages.filter((p) => selectedIds.has(p.id)),
    [packages, selectedIds],
  );

  const allSelectedAreReceived =
    selectedPackages.length > 0 &&
    selectedPackages.every((p) => p.warehouseVNStatus === 'RECEIVED');

  const allSelectedAreSorted =
    selectedPackages.length > 0 &&
    selectedPackages.every((p) => p.warehouseVNStatus === 'SORTED');

  // ---------------------------------------------------------------------------
  // Batch actions
  // ---------------------------------------------------------------------------

  const handleBatchSort = useCallback(() => {
    sortPackagesVN.mutate(
      { ids: Array.from(selectedIds), status: 'SORTED' },
      { onSuccess: () => setSelectedIds(new Set()) },
    );
  }, [sortPackagesVN, selectedIds]);

  const handleBatchReady = useCallback(() => {
    sortPackagesVN.mutate(
      { ids: Array.from(selectedIds), status: 'READY' },
      { onSuccess: () => setSelectedIds(new Set()) },
    );
  }, [sortPackagesVN, selectedIds]);

  // ---------------------------------------------------------------------------
  // Per-row actions
  // ---------------------------------------------------------------------------

  const handleRowSort = useCallback(
    (id: string) => {
      sortPackagesVN.mutate({ ids: [id], status: 'SORTED' });
    },
    [sortPackagesVN],
  );

  const handleRowReady = useCallback(
    (id: string) => {
      sortPackagesVN.mutate({ ids: [id], status: 'READY' });
    },
    [sortPackagesVN],
  );

  // ---------------------------------------------------------------------------
  // Table columns
  // ---------------------------------------------------------------------------

  const columns: ColumnDef<Package>[] = useMemo(
    () => [
      // Checkbox column
      {
        id: 'select',
        header: () => (
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300"
            checked={packages.length > 0 && selectedIds.size === packages.length}
            onChange={toggleSelectAll}
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300"
            checked={selectedIds.has(row.original.id)}
            onChange={() => toggleSelectRow(row.original.id)}
          />
        ),
        enableSorting: false,
      },
      // Package code — clickable link to detail page
      {
        accessorKey: 'code',
        header: 'Mã kiện',
        cell: ({ row }) => (
          <Link
            href={`/kho-viet-nam/${row.original.id}`}
            className="font-medium text-primary hover:underline"
          >
            {row.original.code}
          </Link>
        ),
      },
      {
        accessorKey: 'orderId',
        header: 'Đơn hàng',
      },
      {
        accessorKey: 'warehouseVNStatus',
        header: 'Trạng thái',
        cell: ({ row }) => {
          const status = row.original.warehouseVNStatus || '';
          return (
            <StatusBadge
              label={VN_STATUS_LABELS[status] || status || '---'}
              colorClass={VN_STATUS_COLORS[status] || 'bg-gray-100 text-gray-700'}
            />
          );
        },
      },
      {
        accessorKey: 'actualWeight',
        header: 'Cân nặng (kg)',
        cell: ({ row }) => (
          <span>{row.original.actualWeight?.toFixed(2) ?? '---'}</span>
        ),
      },
      {
        accessorKey: 'chargeableWeight',
        header: 'TL tính phí (kg)',
        cell: ({ row }) => (
          <span>{row.original.chargeableWeight?.toFixed(2) ?? '---'}</span>
        ),
      },
      {
        accessorKey: 'containerId',
        header: 'Container',
        cell: ({ row }) => <span>{row.original.containerId || '---'}</span>,
      },
      {
        accessorKey: 'receivedVNAt',
        header: 'Ngày nhận VN',
        cell: ({ row }) => (
          <span>
            {row.original.receivedVNAt
              ? formatDate(row.original.receivedVNAt)
              : '---'}
          </span>
        ),
      },
      // Per-row actions column
      {
        id: 'actions',
        header: 'Thao tác',
        cell: ({ row }) => {
          const status = row.original.warehouseVNStatus;
          return (
            <div className="flex items-center gap-1">
              {status === 'RECEIVED' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRowSort(row.original.id)}
                  disabled={sortPackagesVN.isPending}
                >
                  <ArrowRightLeft className="mr-1 h-3.5 w-3.5" />
                  Phân loại
                </Button>
              )}
              {status === 'SORTED' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRowReady(row.original.id)}
                  disabled={sortPackagesVN.isPending}
                >
                  <CheckCircle className="mr-1 h-3.5 w-3.5" />
                  Sẵn sàng
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [
      packages.length,
      selectedIds,
      toggleSelectAll,
      toggleSelectRow,
      handleRowSort,
      handleRowReady,
      sortPackagesVN.isPending,
    ],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Header with receive button */}
      <PageHeader
        title="Kho Việt Nam"
        description="Quản lý kiện hàng tại kho VN và giao hàng"
      >
        <Button
          variant={showReceiveForm ? 'secondary' : 'default'}
          onClick={() => setShowReceiveForm((v) => !v)}
        >
          <PackageOpen className="mr-2 h-4 w-4" />
          Nhận từ container
        </Button>
      </PageHeader>

      {/* Barcode scan input */}
      <BarcodeScanInput />

      {/* Receive from container inline form */}
      {showReceiveForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Nhận kiện từ container
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={receiveForm.handleSubmit(handleReceiveSubmit)}
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
            >
              {/* Container ID */}
              <div className="space-y-2">
                <Label htmlFor="containerId">Mã container *</Label>
                <Input
                  id="containerId"
                  placeholder="VD: CNT-2024-001"
                  {...receiveForm.register('containerId')}
                />
                {receiveForm.formState.errors.containerId && (
                  <p className="text-xs text-destructive">
                    {receiveForm.formState.errors.containerId.message}
                  </p>
                )}
              </div>

              {/* Package IDs */}
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="packageIdsRaw">
                  Danh sách mã kiện * (phân tách bằng dấu phẩy)
                </Label>
                <Input
                  id="packageIdsRaw"
                  placeholder="VD: PKG001, PKG002, PKG003"
                  {...receiveForm.register('packageIdsRaw')}
                />
                {receiveForm.formState.errors.packageIdsRaw && (
                  <p className="text-xs text-destructive">
                    {receiveForm.formState.errors.packageIdsRaw.message}
                  </p>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Ghi chú</Label>
                <Input
                  id="notes"
                  placeholder="Ghi chú (không bắt buộc)"
                  {...receiveForm.register('notes')}
                />
              </div>

              {/* Submit */}
              <div className="flex items-end sm:col-span-2 lg:col-span-4">
                <Button
                  type="submit"
                  disabled={receiveFromContainer.isPending}
                >
                  {receiveFromContainer.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Nhận hàng
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="ml-2"
                  onClick={() => {
                    receiveForm.reset();
                    setShowReceiveForm(false);
                  }}
                >
                  Hủy
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Status filter + batch actions toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Status filter dropdown */}
        <div className="flex items-center gap-2">
          <Label htmlFor="statusFilter" className="whitespace-nowrap">
            Trạng thái:
          </Label>
          <select
            id="statusFilter"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
              setSelectedIds(new Set());
            }}
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Batch action buttons — visible when rows are selected */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 border-l pl-3">
            <span className="text-sm text-muted-foreground">
              Đã chọn {selectedIds.size} kiện
            </span>

            <Button
              size="sm"
              variant="outline"
              disabled={!allSelectedAreReceived || sortPackagesVN.isPending}
              onClick={handleBatchSort}
            >
              {sortPackagesVN.isPending && (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              )}
              Phân loại → Đã phân loại
            </Button>

            <Button
              size="sm"
              variant="outline"
              disabled={!allSelectedAreSorted || sortPackagesVN.isPending}
              onClick={handleBatchReady}
            >
              {sortPackagesVN.isPending && (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              )}
              Sẵn sàng giao
            </Button>
          </div>
        )}
      </div>

      {/* Data table */}
      <DataTable
        columns={columns}
        data={packages}
        pageCount={data?.meta?.totalPages}
        page={page}
        onPageChange={(p) => {
          setPage(p);
          setSelectedIds(new Set());
        }}
        isLoading={isLoading}
      />
    </div>
  );
}
