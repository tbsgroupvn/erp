'use client';

import { useState, type ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeft, AlertTriangle, Clock, Ship, Anchor, CheckCircle2,
  Package, DollarSign, FileText, Scale, ArrowRight, ExternalLink,
  Truck, Info, RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  useContainer,
  useContainerTimeline,
  useContainerCostBreakdown,
  useContainerWeightReconciliation,
  useContainerCustomsSplitStatus,
  useUpdateContainerStatus,
  useRecordDeliveryOrder,
  useUpdateFreeTime,
} from '@/lib/hooks/use-containers';
import { formatDate, formatCurrency } from '@/lib/utils/format';
import { SHIPPING_ROUTE_LABELS } from '@/lib/utils/constants';
import type { Container, RecordDeliveryOrderDto, UpdateFreeTimeDto } from '@/lib/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<string, string> = {
  PLANNING: 'Kế hoạch',
  LOADING: 'Đang xếp hàng',
  IN_TRANSIT: 'Đang vận chuyển',
  ON_HOLD_BORDER: 'Giữ tại biên giới',
  ARRIVED: 'Đã đến cảng',
  CUSTOMS: 'Đang thông quan',
  CUSTOMS_HOLD: 'Bị giữ hải quan',
  COMPLETED: 'Hoàn thành',
};

const STATUS_COLORS: Record<string, string> = {
  PLANNING: 'bg-slate-100 text-slate-700 border-slate-200',
  LOADING: 'bg-blue-100 text-blue-700 border-blue-200',
  IN_TRANSIT: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  ON_HOLD_BORDER: 'bg-red-100 text-red-700 border-red-200',
  ARRIVED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  CUSTOMS: 'bg-amber-100 text-amber-700 border-amber-200',
  CUSTOMS_HOLD: 'bg-orange-100 text-orange-700 border-orange-200',
  COMPLETED: 'bg-green-100 text-green-700 border-green-200',
};

const STATUS_TRANSITIONS: Partial<Record<Container['status'], Container['status'][]>> = {
  PLANNING: ['LOADING'],
  LOADING: ['IN_TRANSIT'],
  IN_TRANSIT: ['ARRIVED', 'ON_HOLD_BORDER'],
  ON_HOLD_BORDER: ['ARRIVED'],
  ARRIVED: ['CUSTOMS'],
  CUSTOMS: ['COMPLETED', 'CUSTOMS_HOLD'],
  CUSTOMS_HOLD: ['COMPLETED'],
};

const COST_TYPE_LABELS: Record<string, string> = {
  FREIGHT: 'Cước vận chuyển',
  CUSTOMS_DUTY: 'Thuế nhập khẩu',
  CUSTOMS_SERVICE_FEE: 'Phí dịch vụ HQ',
  HANDLING: 'Phí bốc xếp',
  TRANSPORT_CN: 'Vận chuyển nội địa TQ',
  TRANSPORT_VN: 'Vận chuyển nội địa VN',
  INSURANCE: 'Phí bảo hiểm',
  PORT_THC: 'THC tại cảng',
  DO_FEE: 'Phí lệnh giao hàng (D/O)',
  STORAGE_FEE: 'Phí lưu bãi / lưu cont',
  OTHER: 'Chi phí khác',
};

const TRACKING_EVENT_LABELS: Record<string, string> = {
  PICKED_UP: 'Đã lấy hàng',
  IN_WAREHOUSE_CN: 'Nhập kho TQ',
  PACKED: 'Đã đóng gói',
  LOADED_CONTAINER: 'Xếp lên container',
  DEPARTED_CN: 'Xuất phát từ TQ',
  IN_TRANSIT: 'Đang vận chuyển',
  ARRIVED_PORT: 'Đến cảng VN',
  CUSTOMS_CLEARANCE: 'Thông quan',
  CUSTOMS_SPLIT: 'Tách lô hải quan',
  CUSTOMS_HOLD_RESOLVED: 'Giải phóng giữ HQ',
  CUSTOMS_RELEASED: 'Đã thông quan',
  DELIVERY_ORDER_RECEIVED: 'Nhận lệnh giao hàng (D/O)',
  FREE_TIME_UPDATED: 'Cập nhật free time',
  IN_WAREHOUSE_VN: 'Nhập kho VN',
  OUT_FOR_DELIVERY: 'Xuất giao hàng',
  DELIVERED: 'Đã giao',
};

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const doSchema = z.object({
  doNumber: z.string().min(2, 'Số D/O tối thiểu 2 ký tự'),
  doReceivedAt: z.string().optional(),
  doExpiryAt: z.string().optional(),
  doIssuedBy: z.string().optional(),
});

const freeTimeSchema = z.object({
  freeTimeExpiry: z.string().min(1, 'Vui lòng chọn ngày hết free time'),
  demurrageNote: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 border-b border-border/40 last:border-0">
      <span className="text-sm text-muted-foreground shrink-0 min-w-[140px]">{label}</span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  );
}

function AlertBanner({
  type,
  message,
}: {
  type: 'warning' | 'danger' | 'info';
  message: string;
}) {
  const colors = {
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    danger: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  };
  return (
    <div className={`flex items-center gap-2 rounded-md border px-4 py-2 text-sm ${colors[type]}`}>
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Timeline tab
// ---------------------------------------------------------------------------

function TimelineTab({ containerId }: { containerId: string }) {
  const { data: timeline, isLoading } = useContainerTimeline(containerId);

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!timeline) return <p className="text-muted-foreground text-sm">Không có dữ liệu</p>;

  return (
    <div className="space-y-6">
      {/* Milestones */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Lộ trình container
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-0 overflow-x-auto pb-2">
            {timeline.milestones.map((m, i) => (
              <div key={m.status} className="flex items-center">
                <div className="flex flex-col items-center min-w-[100px] text-center">
                  <div
                    className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                      m.isDone
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'bg-muted border-muted-foreground/30 text-muted-foreground'
                    }`}
                  >
                    {m.isDone ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                  </div>
                  <span className={`mt-1.5 text-xs font-medium ${m.isDone ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {m.label}
                  </span>
                  {m.actualDate && (
                    <span className="text-[10px] text-green-600 mt-0.5">
                      {formatDate(m.actualDate as string)}
                    </span>
                  )}
                  {!m.actualDate && m.estimatedDate && (
                    <span className="text-[10px] text-muted-foreground mt-0.5">
                      DK: {formatDate(m.estimatedDate as string)}
                    </span>
                  )}
                </div>
                {i < timeline.milestones.length - 1 && (
                  <div className={`h-0.5 w-8 shrink-0 ${m.isDone ? 'bg-green-400' : 'bg-muted-foreground/20'}`} />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* D/O & Free time */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-500" />
              Lệnh giao hàng (D/O)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {timeline.doInfo ? (
              <div className="space-y-1">
                <InfoRow label="Số D/O" value={timeline.doInfo.doNumber} />
                <InfoRow label="Ngày nhận" value={timeline.doInfo.doReceivedAt ? formatDate(timeline.doInfo.doReceivedAt) : null} />
                <InfoRow
                  label="Hết hạn"
                  value={
                    timeline.doInfo.doExpiryAt ? (
                      <span className={timeline.doInfo.isExpired ? 'text-red-600 font-semibold' : timeline.doInfo.daysUntilExpiry !== null && timeline.doInfo.daysUntilExpiry <= 3 ? 'text-amber-600 font-semibold' : ''}>
                        {formatDate(timeline.doInfo.doExpiryAt)}
                        {timeline.doInfo.daysUntilExpiry !== null && (
                          <span className="ml-1 text-xs">
                            ({timeline.doInfo.isExpired ? 'Đã hết hạn' : `còn ${timeline.doInfo.daysUntilExpiry} ngày`})
                          </span>
                        )}
                      </span>
                    ) : null
                  }
                />
                <InfoRow label="Đại lý phát hành" value={timeline.doInfo.doIssuedBy} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">Chưa nhận D/O</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              Miễn phí lưu cont (Free Time)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {timeline.freeTimeInfo ? (
              <div className="space-y-1">
                <InfoRow
                  label="Ngày hết free time"
                  value={
                    <span className={timeline.freeTimeInfo.isExpired ? 'text-red-600 font-semibold' : timeline.freeTimeInfo.daysUntilExpiry <= 3 ? 'text-amber-600 font-semibold' : ''}>
                      {formatDate(timeline.freeTimeInfo.freeTimeExpiry)}
                      <span className="ml-1 text-xs">
                        ({timeline.freeTimeInfo.isExpired
                          ? `Quá hạn ${Math.abs(timeline.freeTimeInfo.daysUntilExpiry)} ngày`
                          : `còn ${timeline.freeTimeInfo.daysUntilExpiry} ngày`})
                      </span>
                    </span>
                  }
                />
                {timeline.freeTimeInfo.demurrageNote && (
                  <p className="text-xs text-muted-foreground mt-2">{timeline.freeTimeInfo.demurrageNote}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">Chưa cập nhật free time</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tracking events */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Lịch sử tracking ({timeline.trackingEvents.length} sự kiện)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {timeline.trackingEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có sự kiện nào</p>
          ) : (
            <div className="relative space-y-0">
              {[...timeline.trackingEvents].reverse().map((event, i) => (
                <div key={event.id} className="flex gap-3 pb-4 last:pb-0">
                  <div className="flex flex-col items-center">
                    <div className="h-2 w-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                    {i < timeline.trackingEvents.length - 1 && (
                      <div className="w-px flex-1 bg-border mt-1" />
                    )}
                  </div>
                  <div className="flex-1 pb-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                        {TRACKING_EVENT_LABELS[event.eventType] ?? event.eventType}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(event.eventTimestamp)}
                      </span>
                      {event.location && (
                        <span className="text-xs text-muted-foreground">• {event.location}</span>
                      )}
                    </div>
                    {event.description && (
                      <p className="text-sm mt-0.5 text-foreground/80">{event.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Packages tab
// ---------------------------------------------------------------------------

function PackagesTab({ containerId, container }: { containerId: string; container: Container }) {
  const { data: reconciliation, isLoading } = useContainerWeightReconciliation(containerId);

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!reconciliation) return <p className="text-sm text-muted-foreground">Không có dữ liệu</p>;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Tổng kiện</p>
            <p className="text-2xl font-bold">{reconciliation.totalPackages}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Đã cân tại VN</p>
            <p className="text-2xl font-bold text-green-600">{reconciliation.scannedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">TL khai báo TQ (kg)</p>
            <p className="text-2xl font-bold">{reconciliation.totalCNWeight.toFixed(1)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Chênh lệch TQ/VN (kg)</p>
            <p className={`text-2xl font-bold ${Math.abs(reconciliation.weightDiff) > 1 ? 'text-amber-600' : 'text-green-600'}`}>
              {reconciliation.weightDiff >= 0 ? '+' : ''}{reconciliation.weightDiff.toFixed(1)}
            </p>
          </CardContent>
        </Card>
      </div>

      {reconciliation.packagesWithSignificantDiff > 0 && (
        <AlertBanner
          type="warning"
          message={`${reconciliation.packagesWithSignificantDiff} kiện hàng có chênh lệch trọng lượng đáng kể (>0.5 kg) giữa TQ và VN. Cần kiểm tra lại phí dịch vụ.`}
        />
      )}

      {/* Package table */}
      <Card>
        <CardContent className="pt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium pr-3">Mã kiện</th>
                  <th className="pb-2 font-medium pr-3">Đơn hàng</th>
                  <th className="pb-2 font-medium pr-3">Khách hàng</th>
                  <th className="pb-2 font-medium text-right pr-3">TL tính phí TQ (kg)</th>
                  <th className="pb-2 font-medium text-right pr-3">TL thực tế VN (kg)</th>
                  <th className="pb-2 font-medium text-right">Chênh lệch</th>
                </tr>
              </thead>
              <tbody>
                {reconciliation.packages.map((pkg) => (
                  <tr key={pkg.packageId} className={`border-b last:border-0 ${pkg.hasSignificantDiff ? 'bg-amber-50/50' : ''}`}>
                    <td className="py-2 pr-3 font-mono text-xs font-medium">{pkg.packageCode}</td>
                    <td className="py-2 pr-3 text-xs">{pkg.orderCode ?? '-'}</td>
                    <td className="py-2 pr-3 text-xs">{pkg.customerName ?? '-'}</td>
                    <td className="py-2 pr-3 text-right text-xs">{pkg.cnChargeableWeight.toFixed(2)}</td>
                    <td className="py-2 pr-3 text-right text-xs">
                      {pkg.vnWeight !== null ? pkg.vnWeight.toFixed(2) : <span className="text-muted-foreground">Chưa cân</span>}
                    </td>
                    <td className="py-2 text-right text-xs">
                      {pkg.diff !== null ? (
                        <span className={pkg.hasSignificantDiff ? 'text-amber-600 font-semibold' : 'text-muted-foreground'}>
                          {pkg.diff >= 0 ? '+' : ''}{pkg.diff.toFixed(2)}
                          {pkg.diffPct !== null && ` (${pkg.diffPct}%)`}
                        </span>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Customs split info */}
      {(container.status === 'CUSTOMS_HOLD' || container.heldPackageCount > 0) && (
        <CustomsSplitCard containerId={containerId} />
      )}
    </div>
  );
}

function CustomsSplitCard({ containerId }: { containerId: string }) {
  const { data: split, isLoading } = useContainerCustomsSplitStatus(containerId);

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (!split) return null;

  return (
    <Card className="border-orange-200 bg-orange-50/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 text-orange-700">
          <AlertTriangle className="h-4 w-4" />
          Kiện hàng bị giữ hải quan ({split.heldPackages.length} kiện)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 text-center mb-3">
          <div>
            <p className="text-2xl font-bold text-green-600">{split.clearedPackages.length}</p>
            <p className="text-xs text-muted-foreground">Đã thông quan</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-orange-600">{split.heldPackages.length}</p>
            <p className="text-xs text-muted-foreground">Đang bị giữ</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-red-600">{split.confiscatedPackages.length}</p>
            <p className="text-xs text-muted-foreground">Bị tịch thu</p>
          </div>
        </div>
        {split.reason && (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">Lý do giữ:</span> {split.reason}
          </p>
        )}
        {split.holdAt && (
          <p className="text-xs text-muted-foreground mt-1">
            <span className="font-medium">Từ ngày:</span> {formatDate(split.holdAt)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Costs tab
// ---------------------------------------------------------------------------

function CostsTab({ containerId }: { containerId: string }) {
  const { data: costs, isLoading } = useContainerCostBreakdown(containerId);

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!costs) return <p className="text-sm text-muted-foreground">Không có dữ liệu</p>;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Tổng chi phí</p>
            <p className="text-xl font-bold">{formatCurrency(costs.grandTotalVND)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Chi phí / kg</p>
            <p className="text-xl font-bold">
              {costs.costPerKg !== null ? formatCurrency(costs.costPerKg) : 'N/A'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Số dòng chi phí</p>
            <p className="text-xl font-bold">{costs.itemCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Cost groups */}
      {Object.keys(costs.costGroups).length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Chưa có chi phí nào được ghi nhận cho container này.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {Object.entries(costs.costGroups).map(([type, group]) => (
            <Card key={type}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{COST_TYPE_LABELS[type] ?? type}</CardTitle>
                  <span className="text-sm font-bold">{formatCurrency(group.totalVND)}</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <div key={item.id} className="flex items-start justify-between text-xs py-1 border-b border-border/30 last:border-0">
                      <div>
                        <p className="text-foreground/80">{item.description ?? '—'}</p>
                        {item.invoiceRef && (
                          <p className="text-muted-foreground">Ref: {item.invoiceRef}</p>
                        )}
                        {item.note && <p className="text-muted-foreground">{item.note}</p>}
                      </div>
                      <div className="text-right ml-4 shrink-0">
                        <p className="font-medium">{formatCurrency(Number(item.amount))}</p>
                        <p className="text-muted-foreground">{formatDate(item.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Actions tab (D/O & free time forms)
// ---------------------------------------------------------------------------

function ActionsTab({ containerId, container }: { containerId: string; container: Container }) {
  const recordDO = useRecordDeliveryOrder();
  const updateFreeTime = useUpdateFreeTime();

  const doForm = useForm<RecordDeliveryOrderDto>({
    resolver: zodResolver(doSchema),
    defaultValues: {
      doNumber: container.doNumber ?? '',
      doReceivedAt: '',
      doExpiryAt: '',
      doIssuedBy: container.doIssuedBy ?? '',
    },
  });

  const freeTimeForm = useForm<UpdateFreeTimeDto>({
    resolver: zodResolver(freeTimeSchema),
    defaultValues: {
      freeTimeExpiry: '',
      demurrageNote: container.demurrageNote ?? '',
    },
  });

  const onSubmitDO = (data: RecordDeliveryOrderDto) => {
    recordDO.mutate({ id: containerId, data }, { onSuccess: () => doForm.reset() });
  };

  const onSubmitFreeTime = (data: UpdateFreeTimeDto) => {
    updateFreeTime.mutate({ id: containerId, data });
  };

  const canRecordDO = ['ARRIVED', 'CUSTOMS', 'CUSTOMS_HOLD', 'COMPLETED'].includes(container.status);

  return (
    <div className="space-y-6">
      {/* D/O form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-500" />
            Ghi nhận lệnh giao hàng (D/O)
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Điền sau khi nhận D/O từ đại lý tàu và đã thanh toán đủ cước + phụ phí.
          </p>
        </CardHeader>
        <CardContent>
          {!canRecordDO && (
            <AlertBanner
              type="info"
              message={`D/O chỉ áp dụng khi container đã đến cảng. Trạng thái hiện tại: ${STATUS_LABELS[container.status]}`}
            />
          )}
          <form onSubmit={doForm.handleSubmit(onSubmitDO)} className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="doNumber">Số D/O <span className="text-destructive">*</span></Label>
                <Input
                  id="doNumber"
                  placeholder="VD: DO-EG-2026-001234"
                  {...doForm.register('doNumber')}
                  className="mt-1"
                  disabled={!canRecordDO}
                />
                {doForm.formState.errors.doNumber && (
                  <p className="mt-1 text-xs text-destructive">{doForm.formState.errors.doNumber.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="doIssuedBy">Đại lý tàu phát hành</Label>
                <Input
                  id="doIssuedBy"
                  placeholder="VD: Evergreen Agency Vietnam"
                  {...doForm.register('doIssuedBy')}
                  className="mt-1"
                  disabled={!canRecordDO}
                />
              </div>
              <div>
                <Label htmlFor="doReceivedAt">Ngày nhận D/O</Label>
                <Input
                  id="doReceivedAt"
                  type="date"
                  {...doForm.register('doReceivedAt')}
                  className="mt-1"
                  disabled={!canRecordDO}
                />
              </div>
              <div>
                <Label htmlFor="doExpiryAt">Ngày hết hạn D/O</Label>
                <Input
                  id="doExpiryAt"
                  type="date"
                  {...doForm.register('doExpiryAt')}
                  className="mt-1"
                  disabled={!canRecordDO}
                />
              </div>
            </div>
            <Button type="submit" disabled={!canRecordDO || recordDO.isPending}>
              {recordDO.isPending ? 'Đang lưu...' : 'Lưu thông tin D/O'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Free time form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            Cập nhật hạn miễn phí lưu cont (Free Time)
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Ghi nhận ngày hết free time để theo dõi phí demurrage/detention tại cảng.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={freeTimeForm.handleSubmit(onSubmitFreeTime)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="freeTimeExpiry">
                  Ngày hết free time <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="freeTimeExpiry"
                  type="date"
                  {...freeTimeForm.register('freeTimeExpiry')}
                  className="mt-1"
                />
                {freeTimeForm.formState.errors.freeTimeExpiry && (
                  <p className="mt-1 text-xs text-destructive">
                    {freeTimeForm.formState.errors.freeTimeExpiry.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="demurrageNote">Ghi chú lưu bãi</Label>
                <Input
                  id="demurrageNote"
                  placeholder="VD: Free time 14 ngày theo HĐ với COSCO"
                  {...freeTimeForm.register('demurrageNote')}
                  className="mt-1"
                />
              </div>
            </div>
            <Button type="submit" disabled={updateFreeTime.isPending}>
              {updateFreeTime.isPending ? 'Đang lưu...' : 'Cập nhật free time'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ContainerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [activeTab, setActiveTab] = useState('overview');

  const { data: container, isLoading } = useContainer(id);
  const updateStatus = useUpdateContainerStatus();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!container) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Container không tồn tại hoặc bạn không có quyền truy cập.</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/container')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Quay lại danh sách
        </Button>
      </div>
    );
  }

  const availableTransitions = STATUS_TRANSITIONS[container.status] ?? [];

  // Compute alerts
  const alerts: { type: 'warning' | 'danger' | 'info'; message: string }[] = [];

  if (container.doExpiryAt) {
    const days = Math.ceil((new Date(container.doExpiryAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days < 0) alerts.push({ type: 'danger', message: `D/O đã hết hạn ${Math.abs(days)} ngày! Cần gia hạn hoặc liên hệ đại lý tàu ngay.` });
    else if (days <= 3) alerts.push({ type: 'warning', message: `D/O còn ${days} ngày hết hạn (${formatDate(container.doExpiryAt)}). Cần kéo hàng sớm.` });
  }

  if (container.freeTimeExpiry) {
    const days = Math.ceil((new Date(container.freeTimeExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days < 0) alerts.push({ type: 'danger', message: `Hết miễn phí lưu cont từ ${formatDate(container.freeTimeExpiry)} (${Math.abs(days)} ngày). Đang phát sinh phí demurrage/detention.` });
    else if (days <= 3) alerts.push({ type: 'warning', message: `Còn ${days} ngày miễn phí lưu cont (hết hạn: ${formatDate(container.freeTimeExpiry)}). Cần kéo hàng sớm.` });
  }

  if (container.status === 'CUSTOMS_HOLD' && container.heldPackageCount > 0) {
    alerts.push({ type: 'warning', message: `${container.heldPackageCount} kiện hàng đang bị giữ tại hải quan. Cần xử lý để hoàn thành thông quan.` });
  }

  if (container.status === 'ON_HOLD_BORDER') {
    alerts.push({ type: 'danger', message: 'Container đang bị giữ tại biên giới. Liên hệ đội XNK để xử lý.' });
  }

  return (
    <div className="space-y-4">
      {/* Back button + header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push('/container')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold font-mono">{container.code}</h1>
            {container.containerNumber && (
              <span className="text-sm text-muted-foreground font-mono">({container.containerNumber})</span>
            )}
            <Badge className={`border ${STATUS_COLORS[container.status]}`}>
              {STATUS_LABELS[container.status]}
            </Badge>
            {container.containerSize && (
              <Badge variant="outline" className="font-mono text-xs">{container.containerSize}</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {SHIPPING_ROUTE_LABELS[container.shippingRoute] || container.shippingRoute}
            {container.portOfLoading && container.portOfDischarge && (
              <span> • {container.portOfLoading} → {container.portOfDischarge}</span>
            )}
          </p>
        </div>
        {/* Status transition buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {availableTransitions.map((nextStatus) => (
            <Button
              key={nextStatus}
              size="sm"
              variant={nextStatus === 'ON_HOLD_BORDER' || nextStatus === 'CUSTOMS_HOLD' ? 'destructive' : 'default'}
              onClick={() => updateStatus.mutate({ id, status: nextStatus })}
              disabled={updateStatus.isPending}
            >
              <ArrowRight className="mr-1 h-3 w-3" />
              {STATUS_LABELS[nextStatus]}
            </Button>
          ))}
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, i) => (
            <AlertBanner key={i} type={alert.type} message={alert.message} />
          ))}
        </div>
      )}

      {/* Key info cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Package className="h-3 w-3" /> Số kiện</p>
            <p className="text-2xl font-bold mt-0.5">{container.totalPackages}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Scale className="h-3 w-3" /> Trọng lượng (kg)</p>
            <p className="text-2xl font-bold mt-0.5">{Number(container.totalWeight).toFixed(1)}</p>
            {container.maxCapacity && (
              <p className="text-xs text-muted-foreground">/ {Number(container.maxCapacity).toFixed(0)} kg
                {container.fillRate && ` (${Number(container.fillRate).toFixed(1)}%)`}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Anchor className="h-3 w-3" /> ETA</p>
            <p className="text-sm font-bold mt-0.5">
              {container.estimatedArrivalAt ? formatDate(container.estimatedArrivalAt) : '—'}
            </p>
            {container.actualArrivalAt && (
              <p className="text-xs text-green-600">TT: {formatDate(container.actualArrivalAt)}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Ship className="h-3 w-3" /> Hãng tàu</p>
            <p className="text-sm font-bold mt-0.5 truncate">{container.carrier ?? '—'}</p>
            {container.vesselName && (
              <p className="text-xs text-muted-foreground truncate">{container.vesselName}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="overview" className="gap-1.5">
            <Info className="h-3.5 w-3.5" /> Tổng quan
          </TabsTrigger>
          <TabsTrigger value="packages" className="gap-1.5">
            <Package className="h-3.5 w-3.5" /> Kiện hàng
          </TabsTrigger>
          <TabsTrigger value="costs" className="gap-1.5">
            <DollarSign className="h-3.5 w-3.5" /> Chi phí
          </TabsTrigger>
          <TabsTrigger value="timeline" className="gap-1.5">
            <Truck className="h-3.5 w-3.5" /> Hành trình
          </TabsTrigger>
          <TabsTrigger value="actions" className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Thao tác
          </TabsTrigger>
        </TabsList>

        {/* ---- OVERVIEW ---- */}
        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Shipping info */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Thông tin vận chuyển
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0">
                <InfoRow label="Mã container (ISO)" value={container.containerNumber} />
                <InfoRow label="Kích thước" value={container.containerSize} />
                <InfoRow label="Số vận đơn (B/L)" value={container.blNumber} />
                <InfoRow label="Số chuyến tàu" value={container.voyageNumber} />
                <InfoRow label="Hãng tàu" value={container.carrier} />
                <InfoRow label="Tên tàu / xe" value={container.vesselName} />
                <InfoRow label="Mã booking" value={container.bookingRef} />
                <InfoRow label="Số chì niêm phong" value={container.sealNumber} />
                <InfoRow label="Cảng xếp hàng" value={container.portOfLoading} />
                <InfoRow label="Cảng dỡ hàng" value={container.portOfDischarge} />
                <InfoRow label="VGM khai báo (kg)" value={container.declaredVgm ? `${Number(container.declaredVgm).toFixed(0)} kg` : null} />
              </CardContent>
            </Card>

            {/* Customs & warehouse info */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Thông tin hải quan & kho
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0">
                <InfoRow label="Cửa khẩu khai báo" value={container.customsOfficeCode} />
                <InfoRow label="Ngày thông quan" value={container.customsClearedAt ? formatDate(container.customsClearedAt) : null} />
                <InfoRow label="Kho xuất phát" value={container.origin} />
                <InfoRow label="Kho đến" value={container.destination} />
                <Separator className="my-2" />
                <InfoRow label="Ngày khởi hành DK" value={container.estimatedDepartureAt ? formatDate(container.estimatedDepartureAt) : null} />
                <InfoRow label="Ngày khởi hành TT" value={container.actualDepartureAt ? formatDate(container.actualDepartureAt) : null} />
                <InfoRow label="Ngày đến DK (ETA)" value={container.estimatedArrivalAt ? formatDate(container.estimatedArrivalAt) : null} />
                <InfoRow label="Ngày đến TT" value={container.actualArrivalAt ? formatDate(container.actualArrivalAt) : null} />
                <Separator className="my-2" />
                <InfoRow
                  label="Lệnh giao hàng (D/O)"
                  value={container.doNumber ? (
                    <span className="font-mono">{container.doNumber}</span>
                  ) : <span className="text-muted-foreground italic text-xs">Chưa có</span>}
                />
                <InfoRow
                  label="Hết free time lưu cont"
                  value={container.freeTimeExpiry ? (
                    (() => {
                      const days = Math.ceil((new Date(container.freeTimeExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                      return (
                        <span className={days < 0 ? 'text-red-600 font-semibold' : days <= 3 ? 'text-amber-600' : ''}>
                          {formatDate(container.freeTimeExpiry)}
                          <span className="ml-1 text-xs font-normal">
                            {days < 0 ? `(quá hạn ${Math.abs(days)} ngày)` : `(còn ${days} ngày)`}
                          </span>
                        </span>
                      );
                    })()
                  ) : <span className="text-muted-foreground italic text-xs">Chưa cập nhật</span>}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ---- PACKAGES ---- */}
        <TabsContent value="packages" className="mt-4">
          <PackagesTab containerId={id} container={container} />
        </TabsContent>

        {/* ---- COSTS ---- */}
        <TabsContent value="costs" className="mt-4">
          <CostsTab containerId={id} />
        </TabsContent>

        {/* ---- TIMELINE ---- */}
        <TabsContent value="timeline" className="mt-4">
          <TimelineTab containerId={id} />
        </TabsContent>

        {/* ---- ACTIONS ---- */}
        <TabsContent value="actions" className="mt-4">
          <ActionsTab containerId={id} container={container} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
