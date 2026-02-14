'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PackagePlus, Ruler, ChevronRight, X, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  usePackagesCN,
  useReceivePackageCN,
  useMeasurePackageCN,
  useUpdateCNStatus,
} from '@/lib/hooks/use-warehouse';
import { formatDate } from '@/lib/utils/format';
import type { ColumnDef } from '@tanstack/react-table';
import type { Package } from '@/lib/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CN_STATUS_LABELS: Record<string, string> = {
  RECEIVED: '\u0110\u00e3 nh\u1eadn',
  CHECKED: '\u0110\u00e3 ki\u1ec3m',
  PACKED: '\u0110\u00e3 \u0111\u00f3ng',
  SHIPPED: '\u0110\u00e3 g\u1eedi',
};

const CN_STATUS_COLORS: Record<string, string> = {
  RECEIVED: 'bg-blue-100 text-blue-700',
  CHECKED: 'bg-cyan-100 text-cyan-700',
  PACKED: 'bg-emerald-100 text-emerald-700',
  SHIPPED: 'bg-green-100 text-green-700',
};

const STATUS_FLOW: Record<string, string> = {
  RECEIVED: 'CHECKED',
  CHECKED: 'PACKED',
  PACKED: 'SHIPPED',
};

const NEXT_STATUS_LABELS: Record<string, string> = {
  CHECKED: 'X\u00e1c nh\u1eadn ki\u1ec3m',
  PACKED: '\u0110\u00f3ng g\u00f3i',
  SHIPPED: 'G\u1eedi h\u00e0ng',
};

const ALL_STATUSES = ['RECEIVED', 'CHECKED', 'PACKED', 'SHIPPED'] as const;

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const receivePackageSchema = z.object({
  orderId: z.string().min(1, 'M\u00e3 \u0111\u01a1n h\u00e0ng l\u00e0 b\u1eaft bu\u1ed9c'),
  trackingNumberCN: z.string().optional(),
  description: z.string().optional(),
  note: z.string().optional(),
});

type ReceivePackageFormData = z.infer<typeof receivePackageSchema>;

const measurePackageSchema = z.object({
  actualWeight: z
    .number({ invalid_type_error: 'Nh\u1eadp s\u1ed1' })
    .positive('Ph\u1ea3i l\u1edbn h\u01a1n 0'),
  length: z
    .number({ invalid_type_error: 'Nh\u1eadp s\u1ed1' })
    .positive('Ph\u1ea3i l\u1edbn h\u01a1n 0'),
  width: z
    .number({ invalid_type_error: 'Nh\u1eadp s\u1ed1' })
    .positive('Ph\u1ea3i l\u1edbn h\u01a1n 0'),
  height: z
    .number({ invalid_type_error: 'Nh\u1eadp s\u1ed1' })
    .positive('Ph\u1ea3i l\u1edbn h\u01a1n 0'),
  note: z.string().optional(),
});

type MeasurePackageFormData = z.infer<typeof measurePackageSchema>;

// ---------------------------------------------------------------------------
// Inline Form: Receive Package
// ---------------------------------------------------------------------------

function ReceivePackageForm({ onClose }: { onClose: () => void }) {
  const receiveMutation = useReceivePackageCN();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ReceivePackageFormData>({
    resolver: zodResolver(receivePackageSchema),
  });

  const onSubmit = (data: ReceivePackageFormData) => {
    receiveMutation.mutate(
      {
        orderId: data.orderId,
        trackingNumberCN: data.trackingNumberCN || undefined,
        description: data.description || undefined,
        note: data.note || undefined,
      },
      {
        onSuccess: () => {
          onClose();
        },
      },
    );
  };

  return (
    <Card className="mb-6">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Nh\u1eadn ki\u1ec7n h\u00e0ng m\u1edbi</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="orderId">M\u00e3 \u0111\u01a1n h\u00e0ng *</Label>
              <Input
                id="orderId"
                placeholder="Nh\u1eadp m\u00e3 \u0111\u01a1n h\u00e0ng"
                {...register('orderId')}
              />
              {errors.orderId && (
                <p className="text-xs text-destructive">
                  {errors.orderId.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="trackingNumberCN">Tracking TQ</Label>
              <Input
                id="trackingNumberCN"
                placeholder="M\u00e3 v\u1eadn \u0111\u01a1n Trung Qu\u1ed1c"
                {...register('trackingNumberCN')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">M\u00f4 t\u1ea3</Label>
              <Input
                id="description"
                placeholder="M\u00f4 t\u1ea3 ki\u1ec7n h\u00e0ng"
                {...register('description')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="note">Ghi ch\u00fa</Label>
              <Input
                id="note"
                placeholder="Ghi ch\u00fa th\u00eam"
                {...register('note')}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <Button type="submit" disabled={receiveMutation.isPending}>
              {receiveMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Nh\u1eadn ki\u1ec7n
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              H\u1ee7y
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Inline Form: Measure Package
// ---------------------------------------------------------------------------

function MeasurePackageForm({
  packageId,
  onClose,
}: {
  packageId: string;
  onClose: () => void;
}) {
  const measureMutation = useMeasurePackageCN();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<MeasurePackageFormData>({
    resolver: zodResolver(measurePackageSchema),
  });

  const onSubmit = (formData: MeasurePackageFormData) => {
    measureMutation.mutate(
      {
        id: packageId,
        data: {
          actualWeight: formData.actualWeight,
          length: formData.length,
          width: formData.width,
          height: formData.height,
          note: formData.note || undefined,
        },
      },
      {
        onSuccess: () => {
          onClose();
        },
      },
    );
  };

  return (
    <Card className="mt-2 mb-2">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">C\u00e2n / \u0110o ki\u1ec7n h\u00e0ng</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor={`weight-${packageId}`}>C\u00e2n n\u1eb7ng (kg) *</Label>
              <Input
                id={`weight-${packageId}`}
                type="number"
                step="0.01"
                placeholder="0.00"
                {...register('actualWeight', { valueAsNumber: true })}
              />
              {errors.actualWeight && (
                <p className="text-xs text-destructive">
                  {errors.actualWeight.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor={`length-${packageId}`}>D\u00e0i (cm) *</Label>
              <Input
                id={`length-${packageId}`}
                type="number"
                step="0.1"
                placeholder="0.0"
                {...register('length', { valueAsNumber: true })}
              />
              {errors.length && (
                <p className="text-xs text-destructive">
                  {errors.length.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor={`width-${packageId}`}>R\u1ed9ng (cm) *</Label>
              <Input
                id={`width-${packageId}`}
                type="number"
                step="0.1"
                placeholder="0.0"
                {...register('width', { valueAsNumber: true })}
              />
              {errors.width && (
                <p className="text-xs text-destructive">
                  {errors.width.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor={`height-${packageId}`}>Cao (cm) *</Label>
              <Input
                id={`height-${packageId}`}
                type="number"
                step="0.1"
                placeholder="0.0"
                {...register('height', { valueAsNumber: true })}
              />
              {errors.height && (
                <p className="text-xs text-destructive">
                  {errors.height.message}
                </p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`measure-note-${packageId}`}>Ghi ch\u00fa</Label>
            <Input
              id={`measure-note-${packageId}`}
              placeholder="Ghi ch\u00fa th\u00eam"
              {...register('note')}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={measureMutation.isPending}>
              {measureMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              L\u01b0u k\u00edch th\u01b0\u1edbc
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              H\u1ee7y
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Row Actions Component
// ---------------------------------------------------------------------------

function PackageRowActions({ pkg }: { pkg: Package }) {
  const [showMeasureForm, setShowMeasureForm] = useState(false);
  const updateStatusMutation = useUpdateCNStatus();

  const currentStatus = pkg.warehouseCNStatus ?? '';
  const nextStatus = STATUS_FLOW[currentStatus] as
    | 'RECEIVED'
    | 'CHECKED'
    | 'PACKED'
    | 'SHIPPED'
    | undefined;
  const canMeasure =
    currentStatus === 'RECEIVED' || currentStatus === 'CHECKED';

  const handleStatusAdvance = () => {
    if (!nextStatus) return;
    updateStatusMutation.mutate({ id: pkg.id, status: nextStatus });
  };

  return (
    <div>
      <div className="flex items-center gap-1">
        {canMeasure && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowMeasureForm((prev) => !prev)}
            title="C\u00e2n / \u0110o"
          >
            <Ruler className="mr-1 h-4 w-4" />
            C\u00e2n/\u0110o
          </Button>
        )}
        {nextStatus && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleStatusAdvance}
            disabled={updateStatusMutation.isPending}
          >
            {updateStatusMutation.isPending && (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            )}
            <ChevronRight className="mr-1 h-3 w-3" />
            {NEXT_STATUS_LABELS[nextStatus]}
          </Button>
        )}
      </div>
      {showMeasureForm && (
        <MeasurePackageForm
          packageId={pkg.id}
          onClose={() => setShowMeasureForm(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function KhoTrungQuocPage() {
  const [page, setPage] = useState(1);
  const [showReceiveForm, setShowReceiveForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const queryParams: Record<string, unknown> = { page, limit: 20 };
  if (statusFilter) {
    queryParams.status = statusFilter;
  }

  const { data, isLoading } = usePackagesCN(queryParams);

  const packageCNColumns: ColumnDef<Package>[] = [
    {
      accessorKey: 'code',
      header: 'M\u00e3 ki\u1ec7n',
      cell: ({ row }) => (
        <Link
          href={`/kho-trung-quoc/${row.original.id}`}
          className="font-medium text-primary underline-offset-4 hover:underline"
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
      accessorKey: 'trackingNumberCN',
      header: 'Tracking TQ',
      cell: ({ row }) => (
        <span>{row.original.trackingNumberCN || '---'}</span>
      ),
    },
    {
      accessorKey: 'warehouseCNStatus',
      header: 'Tr\u1ea1ng th\u00e1i',
      cell: ({ row }) => {
        const status = row.original.warehouseCNStatus || '';
        return (
          <StatusBadge
            label={CN_STATUS_LABELS[status] || status || '---'}
            colorClass={
              CN_STATUS_COLORS[status] || 'bg-gray-100 text-gray-700'
            }
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
      accessorKey: 'receivedCNAt',
      header: 'Ng\u00e0y nh\u1eadn',
      cell: ({ row }) => (
        <span>
          {row.original.receivedCNAt
            ? formatDate(row.original.receivedCNAt)
            : '---'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Thao t\u00e1c',
      cell: ({ row }) => <PackageRowActions pkg={row.original} />,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Kho Trung Qu\u1ed1c"
        description="Qu\u1ea3n l\u00fd ki\u1ec7n h\u00e0ng t\u1ea1i kho TQ"
      >
        <Button onClick={() => setShowReceiveForm((prev) => !prev)}>
          <PackagePlus className="mr-2 h-4 w-4" />
          Nh\u1eadn ki\u1ec7n
        </Button>
      </PageHeader>

      {showReceiveForm && (
        <ReceivePackageForm onClose={() => setShowReceiveForm(false)} />
      )}

      {/* Status filter */}
      <div className="mb-4 flex items-center gap-2">
        <Label htmlFor="status-filter" className="whitespace-nowrap">
          L\u1ecdc tr\u1ea1ng th\u00e1i:
        </Label>
        <select
          id="status-filter"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <option value="">T\u1ea5t c\u1ea3</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {CN_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      <DataTable
        columns={packageCNColumns}
        data={data?.data ?? []}
        pageCount={data?.meta?.totalPages}
        page={page}
        onPageChange={setPage}
        isLoading={isLoading}
      />
    </div>
  );
}
