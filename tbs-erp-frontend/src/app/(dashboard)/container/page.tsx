'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, X, ArrowRight, Package } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  useContainers,
  useCreateContainer,
  useUpdateContainerStatus,
} from '@/lib/hooks/use-containers';
import { useAddPackagesToContainer } from '@/lib/hooks/use-warehouse';
import { formatDate } from '@/lib/utils/format';
import { SHIPPING_ROUTE_LABELS } from '@/lib/utils/constants';
import { ShippingRoute } from '@/lib/types';
import type { Container, ContainerQueryParams, CreateContainerDto } from '@/lib/types';
import type { ColumnDef } from '@tanstack/react-table';

// ---------------------------------------------------------------------------
// Status labels & colors
// ---------------------------------------------------------------------------

const CONTAINER_STATUS_LABELS: Record<string, string> = {
  PLANNING: 'Kế hoạch',
  LOADING: 'Đang xếp',
  IN_TRANSIT: 'Vận chuyển',
  ON_HOLD_BORDER: 'Giữ biên giới',
  ARRIVED: 'Đã đến',
  CUSTOMS: 'Thông quan',
  COMPLETED: 'Hoàn thành',
};

const CONTAINER_STATUS_COLORS: Record<string, string> = {
  PLANNING: 'bg-slate-100 text-slate-700',
  LOADING: 'bg-blue-100 text-blue-700',
  IN_TRANSIT: 'bg-indigo-100 text-indigo-700',
  ON_HOLD_BORDER: 'bg-red-100 text-red-700',
  ARRIVED: 'bg-emerald-100 text-emerald-700',
  CUSTOMS: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-green-100 text-green-700',
};

// ---------------------------------------------------------------------------
// Status flow
// ---------------------------------------------------------------------------

const STATUS_FLOW: Container['status'][] = [
  'PLANNING',
  'LOADING',
  'IN_TRANSIT',
  'ARRIVED',
  'CUSTOMS',
  'COMPLETED',
];

/** Map of valid next statuses from each status (supports branching for ON_HOLD_BORDER) */
const STATUS_TRANSITIONS: Partial<Record<Container['status'], Container['status'][]>> = {
  PLANNING: ['LOADING'],
  LOADING: ['IN_TRANSIT'],
  IN_TRANSIT: ['ARRIVED', 'ON_HOLD_BORDER'],
  ON_HOLD_BORDER: ['ARRIVED'],
  ARRIVED: ['CUSTOMS'],
  CUSTOMS: ['COMPLETED'],
};

function getNextStatus(current: Container['status']): Container['status'] | null {
  const idx = STATUS_FLOW.indexOf(current);
  if (idx === -1 || idx >= STATUS_FLOW.length - 1) return null;
  return STATUS_FLOW[idx + 1];
}

function getAvailableTransitions(current: Container['status']): Container['status'][] {
  return STATUS_TRANSITIONS[current] ?? [];
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const createContainerSchema = z.object({
  shippingRoute: z.nativeEnum(ShippingRoute, {
    required_error: 'Vui lòng chọn tuyến vận chuyển',
  }),
  origin: z.string().optional(),
  destination: z.string().optional(),
  carrier: z.string().optional(),
  bookingRef: z.string().optional(),
  vesselName: z.string().optional(),
  maxCapacity: z.union([z.coerce.number().positive('Sức chứa phải > 0'), z.literal('')]).optional(),
  estimatedDepartureAt: z.string().optional(),
  estimatedArrivalAt: z.string().optional(),
});

type CreateContainerFormData = z.infer<typeof createContainerSchema>;

const addPackagesSchema = z.object({
  packageIds: z.string().min(1, 'Vui lòng nhập mã kiện hàng'),
});

type AddPackagesFormData = z.infer<typeof addPackagesSchema>;

// ---------------------------------------------------------------------------
// Row actions component
// ---------------------------------------------------------------------------

function ContainerRowActions({ container }: { container: Container }) {
  const [showAddPackages, setShowAddPackages] = useState(false);
  const updateStatus = useUpdateContainerStatus();
  const addPackages = useAddPackagesToContainer();

  const availableTransitions = getAvailableTransitions(container.status);
  const canAddPackages = container.status === 'PLANNING' || container.status === 'LOADING';

  const addPackagesForm = useForm<AddPackagesFormData>({
    resolver: zodResolver(addPackagesSchema),
    defaultValues: { packageIds: '' },
  });

  const onAddPackages = (data: AddPackagesFormData) => {
    const ids = data.packageIds
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    if (ids.length === 0) return;

    addPackages.mutate(
      { id: container.id, packageIds: ids },
      {
        onSuccess: () => {
          setShowAddPackages(false);
          addPackagesForm.reset();
        },
      },
    );
  };

  const onUpdateStatus = (nextStatus: Container['status']) => {
    updateStatus.mutate({ id: container.id, status: nextStatus });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {availableTransitions.map((nextStatus) => (
          <Button
            key={nextStatus}
            variant={nextStatus === 'ON_HOLD_BORDER' ? 'destructive' : 'outline'}
            size="sm"
            onClick={() => onUpdateStatus(nextStatus)}
            disabled={updateStatus.isPending}
          >
            <ArrowRight className="mr-1 h-3 w-3" />
            {CONTAINER_STATUS_LABELS[nextStatus]}
          </Button>
        ))}
        {canAddPackages && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddPackages((prev) => !prev)}
          >
            <Package className="mr-1 h-3 w-3" />
            Thêm kiện
          </Button>
        )}
      </div>

      {showAddPackages && (
        <form
          onSubmit={addPackagesForm.handleSubmit(onAddPackages)}
          className="flex items-end gap-2 rounded-md border bg-muted/30 p-2"
        >
          <div className="flex-1">
            <Label htmlFor={`pkg-${container.id}`} className="text-xs">
              Mã kiện (phân cách bởi dấu phẩy)
            </Label>
            <Input
              id={`pkg-${container.id}`}
              placeholder="PKG001, PKG002, ..."
              {...addPackagesForm.register('packageIds')}
              className="h-8 text-xs"
            />
            {addPackagesForm.formState.errors.packageIds && (
              <p className="mt-0.5 text-xs text-destructive">
                {addPackagesForm.formState.errors.packageIds.message}
              </p>
            )}
          </div>
          <Button type="submit" size="sm" disabled={addPackages.isPending}>
            Thêm
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowAddPackages(false);
              addPackagesForm.reset();
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        </form>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function ContainerPage() {
  const [page, setPage] = useState(1);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<Container['status'] | ''>('');
  const [routeFilter, setRouteFilter] = useState<ShippingRoute | ''>('');

  // Build query params
  const queryParams: ContainerQueryParams = { page, limit: 20 };
  if (statusFilter) queryParams.status = statusFilter;
  if (routeFilter) queryParams.shippingRoute = routeFilter;

  const { data, isLoading } = useContainers(queryParams);
  const createContainer = useCreateContainer();

  const form = useForm<CreateContainerFormData>({
    resolver: zodResolver(createContainerSchema),
    defaultValues: {
      shippingRoute: ShippingRoute.SEA,
      origin: '',
      destination: '',
      carrier: '',
      bookingRef: '',
      vesselName: '',
      maxCapacity: '' as unknown as undefined,
      estimatedDepartureAt: '',
      estimatedArrivalAt: '',
    },
  });

  const onSubmitCreate = (formData: CreateContainerFormData) => {
    const payload: CreateContainerDto = {
      shippingRoute: formData.shippingRoute,
      origin: formData.origin || undefined,
      destination: formData.destination || undefined,
      carrier: formData.carrier || undefined,
      bookingRef: formData.bookingRef || undefined,
      vesselName: formData.vesselName || undefined,
      maxCapacity: typeof formData.maxCapacity === 'number' ? formData.maxCapacity : undefined,
      estimatedDepartureAt: formData.estimatedDepartureAt || undefined,
      estimatedArrivalAt: formData.estimatedArrivalAt || undefined,
    };

    createContainer.mutate(payload, {
      onSuccess: () => {
        setShowCreateForm(false);
        form.reset();
      },
    });
  };

  // ---------------------------------------------------------------------------
  // Columns (defined inside component so row actions have access to hooks)
  // ---------------------------------------------------------------------------

  const columns: ColumnDef<Container>[] = [
    {
      accessorKey: 'code',
      header: 'Mã container',
      cell: ({ row }) => <span className="font-medium">{row.original.code}</span>,
    },
    {
      accessorKey: 'shippingRoute',
      header: 'Tuyến',
      cell: ({ row }) => (
        <span>
          {SHIPPING_ROUTE_LABELS[row.original.shippingRoute as ShippingRoute] ||
            row.original.shippingRoute}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Trạng thái',
      cell: ({ row }) => (
        <StatusBadge
          label={CONTAINER_STATUS_LABELS[row.original.status] || row.original.status}
          colorClass={CONTAINER_STATUS_COLORS[row.original.status] || 'bg-gray-100 text-gray-700'}
        />
      ),
    },
    {
      accessorKey: 'totalPackages',
      header: 'Số kiện',
    },
    {
      accessorKey: 'totalWeight',
      header: 'Trọng lượng (kg)',
      cell: ({ row }) => <span>{row.original.totalWeight?.toFixed(1) ?? '---'}</span>,
    },
    {
      accessorKey: 'estimatedArrivalAt',
      header: 'Dự kiến đến',
      cell: ({ row }) => (
        <span>
          {row.original.estimatedArrivalAt
            ? formatDate(row.original.estimatedArrivalAt)
            : '---'}
        </span>
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
      cell: ({ row }) => <ContainerRowActions container={row.original} />,
    },
  ];

  return (
    <div>
      <PageHeader title="Container" description="Quản lý container vận chuyển">
        <Button
          onClick={() => setShowCreateForm((prev) => !prev)}
          variant={showCreateForm ? 'outline' : 'default'}
        >
          {showCreateForm ? (
            <>
              <X className="mr-2 h-4 w-4" />
              Đóng
            </>
          ) : (
            <>
              <Plus className="mr-2 h-4 w-4" />
              Tạo container
            </>
          )}
        </Button>
      </PageHeader>

      {/* ------------------------------------------------------------------ */}
      {/* Create Container Form                                              */}
      {/* ------------------------------------------------------------------ */}
      {showCreateForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Tạo container mới</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmitCreate)} className="space-y-4">
              {/* Row 1: shippingRoute, origin, destination */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="shippingRoute">
                    Tuyến vận chuyển <span className="text-destructive">*</span>
                  </Label>
                  <select
                    id="shippingRoute"
                    {...form.register('shippingRoute')}
                    className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {Object.values(ShippingRoute).map((route) => (
                      <option key={route} value={route}>
                        {SHIPPING_ROUTE_LABELS[route]}
                      </option>
                    ))}
                  </select>
                  {form.formState.errors.shippingRoute && (
                    <p className="mt-1 text-xs text-destructive">
                      {form.formState.errors.shippingRoute.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="origin">Nơi xuất phát</Label>
                  <Input
                    id="origin"
                    placeholder="VD: Quảng Châu"
                    {...form.register('origin')}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="destination">Nơi đến</Label>
                  <Input
                    id="destination"
                    placeholder="VD: Hải Phòng"
                    {...form.register('destination')}
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Row 2: carrier, bookingRef, vesselName */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="carrier">Hãng vận chuyển</Label>
                  <Input
                    id="carrier"
                    placeholder="VD: COSCO"
                    {...form.register('carrier')}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="bookingRef">Mã booking</Label>
                  <Input
                    id="bookingRef"
                    placeholder="Mã đặt chỗ"
                    {...form.register('bookingRef')}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="vesselName">Tên tàu/xe</Label>
                  <Input
                    id="vesselName"
                    placeholder="Tên phương tiện"
                    {...form.register('vesselName')}
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Row 3: maxCapacity, estimatedDepartureAt, estimatedArrivalAt */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="maxCapacity">Sức chứa tối đa (kg)</Label>
                  <Input
                    id="maxCapacity"
                    type="number"
                    placeholder="VD: 20000"
                    {...form.register('maxCapacity')}
                    className="mt-1"
                  />
                  {form.formState.errors.maxCapacity && (
                    <p className="mt-1 text-xs text-destructive">
                      {form.formState.errors.maxCapacity.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="estimatedDepartureAt">Ngày khởi hành dự kiến</Label>
                  <Input
                    id="estimatedDepartureAt"
                    type="date"
                    {...form.register('estimatedDepartureAt')}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="estimatedArrivalAt">Ngày đến dự kiến</Label>
                  <Input
                    id="estimatedArrivalAt"
                    type="date"
                    {...form.register('estimatedArrivalAt')}
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2">
                <Button type="submit" disabled={createContainer.isPending}>
                  {createContainer.isPending ? 'Đang tạo...' : 'Tạo container'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCreateForm(false);
                    form.reset();
                  }}
                >
                  Hủy
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Filters                                                            */}
      {/* ------------------------------------------------------------------ */}
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Label htmlFor="statusFilter" className="whitespace-nowrap text-sm">
            Trạng thái:
          </Label>
          <select
            id="statusFilter"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as Container['status'] | '');
              setPage(1);
            }}
            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="">Tất cả</option>
            {[...STATUS_FLOW.slice(0, 3), 'ON_HOLD_BORDER' as Container['status'], ...STATUS_FLOW.slice(3)].map((status) => (
              <option key={status} value={status}>
                {CONTAINER_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="routeFilter" className="whitespace-nowrap text-sm">
            Tuyến:
          </Label>
          <select
            id="routeFilter"
            value={routeFilter}
            onChange={(e) => {
              setRouteFilter(e.target.value as ShippingRoute | '');
              setPage(1);
            }}
            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="">Tất cả</option>
            {Object.values(ShippingRoute).map((route) => (
              <option key={route} value={route}>
                {SHIPPING_ROUTE_LABELS[route]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Data Table                                                         */}
      {/* ------------------------------------------------------------------ */}
      <DataTable
        columns={columns}
        data={data?.data ?? []}
        pageCount={data?.meta?.totalPages}
        page={page}
        onPageChange={setPage}
        isLoading={isLoading}
      />
    </div>
  );
}
