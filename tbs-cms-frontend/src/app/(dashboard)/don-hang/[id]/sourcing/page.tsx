'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeft,
  Plus,
  Package,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronRight,
  X,
  Loader2,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { LoadingOverlay } from '@/components/shared/loading-overlay';
import { DataTable } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  useSupplierOrdersByOrder,
  useCreateSupplierOrder,
  useChangeSupplierOrderStatus,
} from '@/lib/hooks/use-supplier-orders';
import { formatDate } from '@/lib/utils/format';
import type { ColumnDef } from '@tanstack/react-table';
import type { SupplierOrder, SupplierOrderStatus } from '@/lib/types/supplier-order.types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SO_STATUS_LABELS: Record<SupplierOrderStatus, string> = {
  DRAFT: 'Nháp',
  QUOTED: 'Đã báo giá',
  ORDERED: 'Đã đặt hàng',
  CONFIRMED: 'NCC xác nhận',
  PARTIALLY_SHIPPED: 'Gửi một phần',
  SHIPPED_CN: 'Đã gửi hàng',
  RECEIVED_CN: 'Đã nhận kho TQ',
  RETURN_IN_PROGRESS: 'Đang trả hàng',
  REFUNDED: 'Đã hoàn tiền',
  CANCELLED: 'Đã hủy',
  ISSUE: 'Có vấn đề',
};

const SO_STATUS_COLORS: Record<SupplierOrderStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  QUOTED: 'bg-blue-100 text-blue-700',
  ORDERED: 'bg-indigo-100 text-indigo-700',
  CONFIRMED: 'bg-purple-100 text-purple-700',
  PARTIALLY_SHIPPED: 'bg-yellow-100 text-yellow-700',
  SHIPPED_CN: 'bg-orange-100 text-orange-700',
  RECEIVED_CN: 'bg-green-100 text-green-700',
  RETURN_IN_PROGRESS: 'bg-orange-100 text-orange-700',
  REFUNDED: 'bg-teal-100 text-teal-700',
  CANCELLED: 'bg-red-100 text-red-700',
  ISSUE: 'bg-red-100 text-red-700',
};

const STATUS_FLOW: Partial<Record<SupplierOrderStatus, SupplierOrderStatus[]>> = {
  DRAFT: ['QUOTED', 'ORDERED', 'CANCELLED'],
  QUOTED: ['ORDERED', 'CANCELLED'],
  ORDERED: ['CONFIRMED', 'CANCELLED', 'ISSUE'],
  CONFIRMED: ['PARTIALLY_SHIPPED', 'SHIPPED_CN', 'CANCELLED', 'ISSUE'],
  PARTIALLY_SHIPPED: ['SHIPPED_CN', 'RECEIVED_CN', 'ISSUE'],
  SHIPPED_CN: ['RECEIVED_CN', 'ISSUE'],
  RECEIVED_CN: ['RETURN_IN_PROGRESS', 'ISSUE'],
  RETURN_IN_PROGRESS: ['REFUNDED', 'ISSUE'],
  ISSUE: ['ORDERED', 'CONFIRMED', 'RETURN_IN_PROGRESS', 'CANCELLED'],
};

const ALL_STATUSES: SupplierOrderStatus[] = [
  'DRAFT',
  'QUOTED',
  'ORDERED',
  'CONFIRMED',
  'PARTIALLY_SHIPPED',
  'SHIPPED_CN',
  'RECEIVED_CN',
  'RETURN_IN_PROGRESS',
  'REFUNDED',
  'CANCELLED',
  'ISSUE',
];

// ---------------------------------------------------------------------------
// Zod Schema — Create Supplier Order
// ---------------------------------------------------------------------------

const createSOSchema = z.object({
  supplierName: z.string().min(1, 'Tên NCC là bắt buộc'),
  supplierPlatform: z.string().optional(),
  quotedPriceCNY: z
    .number({ invalid_type_error: 'Nhập số' })
    .positive('Phải lớn hơn 0')
    .optional()
    .or(z.literal(undefined)),
  quantityOrdered: z
    .number({ invalid_type_error: 'Nhập số' })
    .int('Phải là số nguyên')
    .positive('Phải lớn hơn 0'),
  note: z.string().optional(),
});

type CreateSOFormData = z.infer<typeof createSOSchema>;

// ---------------------------------------------------------------------------
// Inline Form: Create Supplier Order
// ---------------------------------------------------------------------------

function CreateSupplierOrderForm({
  orderId,
  onClose,
}: {
  orderId: string;
  onClose: () => void;
}) {
  const createMutation = useCreateSupplierOrder();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateSOFormData>({
    resolver: zodResolver(createSOSchema),
  });

  const onSubmit = (data: CreateSOFormData) => {
    createMutation.mutate(
      {
        orderId,
        supplierName: data.supplierName,
        supplierPlatform: data.supplierPlatform || undefined,
        quotedPriceCNY: data.quotedPriceCNY ?? undefined,
        quantityOrdered: data.quantityOrdered,
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
          <CardTitle className="text-lg">Tạo đơn NCC mới</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="supplierName">Tên NCC *</Label>
              <Input
                id="supplierName"
                placeholder="Nhập tên nhà cung cấp"
                {...register('supplierName')}
              />
              {errors.supplierName && (
                <p className="text-xs text-destructive">
                  {errors.supplierName.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplierPlatform">Nền tảng</Label>
              <Input
                id="supplierPlatform"
                placeholder="VD: 1688, Taobao, Pinduoduo..."
                {...register('supplierPlatform')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quotedPriceCNY">Giá báo (CNY)</Label>
              <Input
                id="quotedPriceCNY"
                type="number"
                step="0.01"
                placeholder="0.00"
                {...register('quotedPriceCNY', { valueAsNumber: true })}
              />
              {errors.quotedPriceCNY && (
                <p className="text-xs text-destructive">
                  {errors.quotedPriceCNY.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantityOrdered">Số lượng đặt *</Label>
              <Input
                id="quantityOrdered"
                type="number"
                step="1"
                placeholder="0"
                {...register('quantityOrdered', { valueAsNumber: true })}
              />
              {errors.quantityOrdered && (
                <p className="text-xs text-destructive">
                  {errors.quantityOrdered.message}
                </p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="note">Ghi chú</Label>
            <Input
              id="note"
              placeholder="Ghi chú thêm"
              {...register('note')}
            />
          </div>
          <div className="flex items-center gap-2 pt-2">
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Tạo đơn NCC
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Hủy
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

function SupplierOrderRowActions({ so }: { so: SupplierOrder }) {
  const changeStatusMutation = useChangeSupplierOrderStatus();
  const [changingTo, setChangingTo] = useState<SupplierOrderStatus | null>(null);
  const [statusNote, setStatusNote] = useState('');

  const currentStatus = so.status;
  const nextStatuses = STATUS_FLOW[currentStatus] ?? [];

  const handleConfirmStatusChange = () => {
    if (!changingTo) return;
    changeStatusMutation.mutate(
      {
        id: so.id,
        status: changingTo,
        note: statusNote.trim() || undefined,
      },
      {
        onSuccess: () => {
          setChangingTo(null);
          setStatusNote('');
        },
      },
    );
  };

  if (nextStatuses.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-1 flex-wrap">
        {nextStatuses.map((nextStatus) => (
          <button
            key={nextStatus}
            type="button"
            onClick={() => setChangingTo(nextStatus)}
            disabled={changeStatusMutation.isPending}
            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium hover:bg-accent disabled:opacity-50"
          >
            <ChevronRight className="h-3 w-3" />
            {SO_STATUS_LABELS[nextStatus]}
          </button>
        ))}
      </div>

      {changingTo && (
        <div className="mt-2 rounded-md border border-blue-200 bg-blue-50 p-3 space-y-2">
          <p className="text-xs font-medium text-blue-800">
            Chuyển sang{' '}
            <span className="font-bold">{SO_STATUS_LABELS[changingTo]}</span>?
          </p>
          <Input
            value={statusNote}
            onChange={(e) => setStatusNote(e.target.value)}
            placeholder="Ghi chú (tùy chọn)"
            className="h-8 text-xs bg-white"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleConfirmStatusChange}
              disabled={changeStatusMutation.isPending}
              className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {changeStatusMutation.isPending ? 'Đang xử lý...' : 'Xác nhận'}
            </button>
            <button
              type="button"
              onClick={() => {
                setChangingTo(null);
                setStatusNote('');
              }}
              className="rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-accent"
            >
              Hủy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function SourcingPage() {
  const params = useParams();
  const id = params.id as string;
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data: supplierOrders, isLoading, isError } = useSupplierOrdersByOrder(id);

  // Compute summary stats
  const stats = useMemo(() => {
    const orders = supplierOrders ?? [];
    const total = orders.length;
    const received = orders.filter((so) => so.status === 'RECEIVED_CN').length;
    const pending = orders.filter(
      (so) =>
        so.status !== 'RECEIVED_CN' &&
        so.status !== 'CANCELLED' &&
        so.status !== 'ISSUE',
    ).length;
    const issues = orders.filter((so) => so.status === 'ISSUE').length;
    return { total, received, pending, issues };
  }, [supplierOrders]);

  // Apply client-side status filter
  const filteredOrders = useMemo(() => {
    const orders = supplierOrders ?? [];
    if (!statusFilter) return orders;
    return orders.filter((so) => so.status === statusFilter);
  }, [supplierOrders, statusFilter]);

  // Table columns
  const columns: ColumnDef<SupplierOrder>[] = [
    {
      accessorKey: 'code',
      header: 'Mã SO',
      cell: ({ row }) => (
        <span className="font-medium text-primary">{row.original.code}</span>
      ),
    },
    {
      id: 'supplier',
      header: 'NCC',
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.supplierName}</p>
          {row.original.supplierPlatform && (
            <p className="text-xs text-muted-foreground">
              {row.original.supplierPlatform}
            </p>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Trạng thái',
      cell: ({ row }) => {
        const status = row.original.status;
        return (
          <StatusBadge
            label={SO_STATUS_LABELS[status] || status}
            colorClass={SO_STATUS_COLORS[status] || 'bg-gray-100 text-gray-700'}
          />
        );
      },
    },
    {
      id: 'price',
      header: 'Giá (CNY)',
      cell: ({ row }) => (
        <div className="text-sm">
          <span className="text-muted-foreground">Báo: </span>
          <span>{row.original.quotedPriceCNY?.toFixed(2) ?? '---'}</span>
          {row.original.actualPriceCNY != null && (
            <>
              <br />
              <span className="text-muted-foreground">TT: </span>
              <span className="font-medium">{row.original.actualPriceCNY.toFixed(2)}</span>
            </>
          )}
        </div>
      ),
    },
    {
      id: 'quantity',
      header: 'Số lượng',
      cell: ({ row }) => (
        <span>
          {row.original.quantityReceived}/{row.original.quantityOrdered}
        </span>
      ),
    },
    {
      accessorKey: 'trackingNumberCN',
      header: 'Mã vận đơn TQ',
      cell: ({ row }) => (
        <span className="font-mono text-xs">
          {row.original.trackingNumberCN || '---'}
        </span>
      ),
    },
    {
      accessorKey: 'orderedAt',
      header: 'Ngày đặt',
      cell: ({ row }) => (
        <span>
          {row.original.orderedAt
            ? formatDate(row.original.orderedAt, 'dd/MM/yyyy')
            : '---'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Thao tác',
      cell: ({ row }) => <SupplierOrderRowActions so={row.original} />,
    },
  ];

  if (isLoading) return <LoadingOverlay className="h-[60vh]" />;

  if (isError) {
    return (
      <div className="text-center py-20">
        <p className="text-destructive font-medium">Lỗi tải dữ liệu</p>
        <p className="text-sm text-muted-foreground mt-1">
          Không thể tải danh sách đơn NCC. Vui lòng thử lại.
        </p>
        <Link
          href={`/don-hang/${id}`}
          className="text-primary hover:underline mt-2 inline-block"
        >
          Quay lại đơn hàng
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/don-hang/${id}`}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <PageHeader
          title="Sourcing - Đơn NCC"
          description={`Quản lý đơn nhà cung cấp cho đơn hàng`}
          className="flex-1 border-0 pb-0 mb-0"
        >
          <Button onClick={() => setShowCreateForm((prev) => !prev)}>
            <Plus className="mr-2 h-4 w-4" />
            Tạo đơn NCC
          </Button>
        </PageHeader>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <CreateSupplierOrderForm
          orderId={id}
          onClose={() => setShowCreateForm(false)}
        />
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Tổng đơn NCC"
          value={stats.total}
          icon={Package}
          description="Tất cả đơn nhà cung cấp"
        />
        <StatCard
          title="Đã nhận"
          value={stats.received}
          icon={CheckCircle2}
          description="Đã nhận tại kho TQ"
        />
        <StatCard
          title="Đang chờ"
          value={stats.pending}
          icon={Clock}
          description="Đang xử lý"
        />
        <StatCard
          title="Có vấn đề"
          value={stats.issues}
          icon={AlertTriangle}
          description="Cần xử lý"
        />
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-2">
        <Label htmlFor="so-status-filter" className="whitespace-nowrap">
          Lọc trạng thái:
        </Label>
        <select
          id="so-status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <option value="">Tất cả</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {SO_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {/* Data table */}
      <DataTable
        columns={columns}
        data={filteredOrders}
        isLoading={isLoading}
      />
    </div>
  );
}
