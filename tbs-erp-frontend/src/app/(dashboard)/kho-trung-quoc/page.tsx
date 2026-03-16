'use client';

import { useState, useRef, useCallback, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PackagePlus, Ruler, ChevronRight, X, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
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
import dynamic from 'next/dynamic';
import { apiClient } from '@/lib/api/client';
import { formatDate } from '@/lib/utils/format';
import type { ColumnDef } from '@tanstack/react-table';
import type { Package, BaseResponse } from '@/lib/types';

const BarcodeScanner = dynamic(
  () => import('@/features/warehouse/barcode-scanner').then((m) => ({ default: m.BarcodeScanner })),
  { ssr: false, loading: () => <div className="h-10" /> },
);
const PackingListOCR = dynamic(
  () => import('@/features/warehouse/packing-list-ocr').then((m) => ({ default: m.PackingListOCR })),
  { ssr: false, loading: () => <div className="h-10" /> },
);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CN_STATUS_LABELS: Record<string, string> = {
  RECEIVED: 'Đã nhận',
  CHECKED: 'Đã kiểm',
  PACKED: 'Đã đóng',
  SHIPPED: 'Đã gửi',
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
  CHECKED: 'Xác nhận kiểm',
  PACKED: 'Đóng gói',
  SHIPPED: 'Gửi hàng',
};

const ALL_STATUSES = ['RECEIVED', 'CHECKED', 'PACKED', 'SHIPPED'] as const;

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const receivePackageSchema = z.object({
  orderId: z.string().min(1, 'Mã đơn hàng là bắt buộc'),
  trackingNumberCN: z.string().optional(),
  description: z.string().optional(),
  note: z.string().optional(),
});

type ReceivePackageFormData = z.infer<typeof receivePackageSchema>;

const measurePackageSchema = z.object({
  actualWeight: z
    .number({ invalid_type_error: 'Nhập số' })
    .positive('Phải lớn hơn 0'),
  length: z
    .number({ invalid_type_error: 'Nhập số' })
    .positive('Phải lớn hơn 0'),
  width: z
    .number({ invalid_type_error: 'Nhập số' })
    .positive('Phải lớn hơn 0'),
  height: z
    .number({ invalid_type_error: 'Nhập số' })
    .positive('Phải lớn hơn 0'),
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
          <CardTitle className="text-lg">Nhận kiện hàng mới</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="orderId">Mã đơn hàng *</Label>
              <Input
                id="orderId"
                placeholder="Nhập mã đơn hàng"
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
                placeholder="Mã vận đơn Trung Quốc"
                {...register('trackingNumberCN')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Mô tả</Label>
              <Input
                id="description"
                placeholder="Mô tả kiện hàng"
                {...register('description')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="note">Ghi chú</Label>
              <Input
                id="note"
                placeholder="Ghi chú thêm"
                {...register('note')}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <Button type="submit" disabled={receiveMutation.isPending}>
              {receiveMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Nhận kiện
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
          <CardTitle className="text-base">Cân / Đo kiện hàng</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor={`weight-${packageId}`}>Cân nặng (kg) *</Label>
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
              <Label htmlFor={`length-${packageId}`}>Dài (cm) *</Label>
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
              <Label htmlFor={`width-${packageId}`}>Rộng (cm) *</Label>
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
            <Label htmlFor={`measure-note-${packageId}`}>Ghi chú</Label>
            <Input
              id={`measure-note-${packageId}`}
              placeholder="Ghi chú thêm"
              {...register('note')}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={measureMutation.isPending}>
              {measureMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Lưu kích thước
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
            title="Cân / Đo"
          >
            <Ruler className="mr-1 h-4 w-4" />
            Cân/Đo
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
// Barcode Scan Input Component
// ---------------------------------------------------------------------------

function BarcodeScanInput() {
  const [scanValue, setScanValue] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<Package | null>(null);
  const lastKeypressTime = useRef<number>(0);
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
      toast.success(`Tìm thấy kiện hàng: ${pkg.code}`, {
        description: `Đơn hàng: ${pkg.orderId} | Trọng lượng: ${pkg.actualWeight != null ? Number(pkg.actualWeight).toFixed(2) : '---'} kg | Trạng thái: ${CN_STATUS_LABELS[pkg.warehouseCNStatus ?? ''] || pkg.warehouseCNStatus || '---'}`,
        duration: 6000,
      });
    } catch {
      toast.error('Không tìm thấy kiện hàng', {
        description: `Mã vận đơn: ${trimmed}`,
      });
    } finally {
      setIsScanning(false);
      setScanValue('');
      inputRef.current?.focus();
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      const now = Date.now();
      if (e.key === 'Enter') {
        e.preventDefault();
        handleScan(scanValue);
      }
      lastKeypressTime.current = now;
    },
    [scanValue, handleScan],
  );

  return (
    <div className="mb-4">
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
                placeholder="Quét mã vận đơn (Enter để tra cứu)"
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
              Tra cứu
            </Button>
          </div>
          {scanResult && (
            <div className="mt-3 rounded-md border bg-muted/30 p-3">
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
                <div>
                  <span className="text-muted-foreground">Mã kiện:</span>{' '}
                  <span className="font-medium">{scanResult.code}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Đơn hàng:</span>{' '}
                  <span className="font-medium">{scanResult.orderId}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Trọng lượng:</span>{' '}
                  <span className="font-medium">{scanResult.actualWeight != null ? Number(scanResult.actualWeight).toFixed(2) : '---'} kg</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Trạng thái:</span>{' '}
                  <StatusBadge
                    label={CN_STATUS_LABELS[scanResult.warehouseCNStatus ?? ''] || scanResult.warehouseCNStatus || '---'}
                    colorClass={CN_STATUS_COLORS[scanResult.warehouseCNStatus ?? ''] || 'bg-gray-100 text-gray-700'}
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
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
      header: 'Mã kiện',
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
      header: 'Đơn hàng',
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
      header: 'Trạng thái',
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
      header: 'Cân nặng (kg)',
      cell: ({ row }) => (
        <span>{row.original.actualWeight != null ? Number(row.original.actualWeight).toFixed(2) : '---'}</span>
      ),
    },
    {
      accessorKey: 'chargeableWeight',
      header: 'TL tính phí (kg)',
      cell: ({ row }) => (
        <span>{row.original.chargeableWeight != null ? Number(row.original.chargeableWeight).toFixed(2) : '---'}</span>
      ),
    },
    {
      accessorKey: 'receivedCNAt',
      header: 'Ngày nhận',
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
      header: 'Thao tác',
      cell: ({ row }) => <PackageRowActions pkg={row.original} />,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Kho Trung Quốc"
        description="Quản lý kiện hàng tại kho TQ"
        infoKey="kho-trung-quoc"
      >
        <Button onClick={() => setShowReceiveForm((prev) => !prev)}>
          <PackagePlus className="mr-2 h-4 w-4" />
          Nhận kiện
        </Button>
      </PageHeader>

      {/* Camera barcode scanner + OCR + text scan */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <BarcodeScanner />
        <PackingListOCR />
      </div>

      {/* Barcode scan input (keyboard/scanner gun) */}
      <BarcodeScanInput />

      {showReceiveForm && (
        <ReceivePackageForm onClose={() => setShowReceiveForm(false)} />
      )}

      {/* Status filter */}
      <div className="mb-4 flex items-center gap-2">
        <Label htmlFor="status-filter" className="whitespace-nowrap">
          Lọc trạng thái:
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
          <option value="">Tất cả</option>
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
