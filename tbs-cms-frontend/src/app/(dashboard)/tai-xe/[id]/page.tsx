'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { StatusBadge } from '@/components/shared/status-badge';
import { LoadingOverlay } from '@/components/shared/loading-overlay';
import { useDriver, useDriverPerformance, useDriverDeliveries } from '@/lib/hooks/use-drivers';
import {
  DRIVER_STATUS_LABELS,
  DRIVER_STATUS_COLORS,
  BRANCH_LABELS,
} from '@/lib/utils/constants';
import { formatDate, formatPercent } from '@/lib/utils/format';
import type { DriverStatus, Branch } from '@/lib/types';

export default function DriverDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: driver, isLoading } = useDriver(id);
  const { data: performance } = useDriverPerformance(id);
  const { data: deliveriesData } = useDriverDeliveries(id);

  if (isLoading) return <LoadingOverlay className="h-[60vh]" />;
  if (!driver) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Không tìm thấy tài xế</p>
        <Link href="/tai-xe" className="text-primary hover:underline mt-2 inline-block">
          Quay lại danh sách
        </Link>
      </div>
    );
  }

  const d = driver as any;
  const status = d.status as DriverStatus;
  const perf = performance as any;
  const deliveries = (deliveriesData as any)?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/tai-xe" className="inline-flex h-9 w-9 items-center justify-center rounded-md border hover:bg-accent">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{d.fullName}</h1>
            <StatusBadge
              label={DRIVER_STATUS_LABELS[status] || status}
              colorClass={DRIVER_STATUS_COLORS[status] || 'bg-gray-100 text-gray-700'}
            />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            SĐT: {d.phone}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Personal Info */}
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Thông tin cá nhân</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Họ tên</dt>
              <dd>{d.fullName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Số điện thoại</dt>
              <dd>{d.phone}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Chi nhánh</dt>
              <dd>{BRANCH_LABELS[d.branch as Branch] || d.branch}</dd>
            </div>
          </dl>
        </div>

        {/* License Info */}
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Thông tin GPLX</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Số GPLX</dt>
              <dd>{d.licenseNumber || '---'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Loại GPLX</dt>
              <dd>{d.licenseType || '---'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Hết hạn</dt>
              <dd>{d.licenseExpiry ? formatDate(d.licenseExpiry, 'dd/MM/yyyy') : '---'}</dd>
            </div>
          </dl>
        </div>

        {/* Vehicle Assignment */}
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Xe được gán</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Mã xe</dt>
              <dd>{d.vehicleId || 'Chưa gán'}</dd>
            </div>
          </dl>
        </div>

        {/* Performance Stats */}
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Hiệu suất</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-md bg-muted/50 p-4 text-center">
              <p className="text-2xl font-bold">{perf?.totalDeliveries ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-1">Tổng giao hàng</p>
            </div>
            <div className="rounded-md bg-muted/50 p-4 text-center">
              <p className="text-2xl font-bold">{perf ? formatPercent(perf.onTimeRate) : '---'}</p>
              <p className="text-xs text-muted-foreground mt-1">Đúng hẹn</p>
            </div>
          </div>
        </div>
      </div>

      {/* Delivery History */}
      {deliveries.length > 0 && (
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Lịch sử giao hàng</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Mã giao hàng</th>
                <th className="pb-2 font-medium">Trạng thái</th>
                <th className="pb-2 font-medium">Ngày</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((delivery: any) => (
                <tr key={delivery.id} className="border-b">
                  <td className="py-2">{delivery.code || delivery.id}</td>
                  <td className="py-2">{delivery.status}</td>
                  <td className="py-2">{formatDate(delivery.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
