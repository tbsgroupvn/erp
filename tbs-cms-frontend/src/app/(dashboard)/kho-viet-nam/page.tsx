'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PackageOpen, ArrowRightLeft, CheckCircle, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  usePackagesVN,
  useReceiveFromContainer,
  useSortPackagesVN,
} from '@/lib/hooks/use-warehouse';
import { formatDate } from '@/lib/utils/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ColumnDef } from '@tanstack/react-table';
import type { Package } from '@/lib/types';

// ---------------------------------------------------------------------------
// Status labels & colors
// ---------------------------------------------------------------------------

const VN_STATUS_LABELS: Record<string, string> = {
  RECEIVED: '\u0110\u00e3 nh\u1eadn',
  SORTED: '\u0110\u00e3 ph\u00e2n lo\u1ea1i',
  READY: 'S\u1eb5n s\u00e0ng giao',
  DELIVERED: '\u0110\u00e3 giao',
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
  { value: '', label: 'T\u1ea5t c\u1ea3 tr\u1ea1ng th\u00e1i' },
  { value: 'RECEIVED', label: '\u0110\u00e3 nh\u1eadn' },
  { value: 'SORTED', label: '\u0110\u00e3 ph\u00e2n lo\u1ea1i' },
  { value: 'READY', label: 'S\u1eb5n s\u00e0ng giao' },
  { value: 'DELIVERED', label: '\u0110\u00e3 giao' },
] as const;

// ---------------------------------------------------------------------------
// Receive from container form schema
// ---------------------------------------------------------------------------

const receiveFromContainerSchema = z.object({
  containerId: z.string().min(1, 'M\u00e3 container kh\u00f4ng \u0111\u01b0\u1ee3c \u0111\u1ec3 tr\u1ed1ng'),
  packageIdsRaw: z.string().min(1, 'Danh s\u00e1ch m\u00e3 ki\u1ec7n kh\u00f4ng \u0111\u01b0\u1ee3c \u0111\u1ec3 tr\u1ed1ng'),
  notes: z.string().optional(),
});

type ReceiveFromContainerForm = z.infer<typeof receiveFromContainerSchema>;

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
        header: 'M\u00e3 ki\u1ec7n',
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
        header: '\u0110\u01a1n h\u00e0ng',
      },
      {
        accessorKey: 'warehouseVNStatus',
        header: 'Tr\u1ea1ng th\u00e1i',
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
        header: 'C\u00e2n n\u1eb7ng (kg)',
        cell: ({ row }) => (
          <span>{row.original.actualWeight?.toFixed(2) ?? '---'}</span>
        ),
      },
      {
        accessorKey: 'chargeableWeight',
        header: 'TL t\u00ednh ph\u00ed (kg)',
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
        header: 'Ng\u00e0y nh\u1eadn VN',
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
        header: 'Thao t\u00e1c',
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
                  Ph\u00e2n lo\u1ea1i
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
                  S\u1eb5n s\u00e0ng
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
        title="Kho Vi\u1ec7t Nam"
        description="Qu\u1ea3n l\u00fd ki\u1ec7n h\u00e0ng t\u1ea1i kho VN v\u00e0 giao h\u00e0ng"
      >
        <Button
          variant={showReceiveForm ? 'secondary' : 'default'}
          onClick={() => setShowReceiveForm((v) => !v)}
        >
          <PackageOpen className="mr-2 h-4 w-4" />
          Nh\u1eadn t\u1eeb container
        </Button>
      </PageHeader>

      {/* Receive from container inline form */}
      {showReceiveForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Nh\u1eadn ki\u1ec7n t\u1eeb container
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={receiveForm.handleSubmit(handleReceiveSubmit)}
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
            >
              {/* Container ID */}
              <div className="space-y-2">
                <Label htmlFor="containerId">M\u00e3 container *</Label>
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
                  Danh s\u00e1ch m\u00e3 ki\u1ec7n * (ph\u00e2n t\u00e1ch b\u1eb1ng d\u1ea5u ph\u1ea9y)
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
                <Label htmlFor="notes">Ghi ch\u00fa</Label>
                <Input
                  id="notes"
                  placeholder="Ghi ch\u00fa (kh\u00f4ng b\u1eaft bu\u1ed9c)"
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
                  Nh\u1eadn h\u00e0ng
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
                  H\u1ee7y
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
            Tr\u1ea1ng th\u00e1i:
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
              \u0110\u00e3 ch\u1ecdn {selectedIds.size} ki\u1ec7n
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
              Ph\u00e2n lo\u1ea1i \u2192 \u0110\u00e3 ph\u00e2n lo\u1ea1i
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
              S\u1eb5n s\u00e0ng giao
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
