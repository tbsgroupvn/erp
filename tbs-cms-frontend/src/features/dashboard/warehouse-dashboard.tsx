'use client';

import { useDashboardOverview } from '@/lib/hooks/use-dashboard';
import { cn } from '@/lib/utils/cn';
import {
  Package,
  Ruler,
  Box,
  Container,
  Ship,
  Warehouse,
  Truck,
} from 'lucide-react';

const STAGE_CONFIG = [
  { key: 'packagesCNPending', label: 'Nhận tại kho TQ', icon: Package, color: 'bg-blue-500' },
  { key: 'packagesCNToday', label: 'Đo/cân hôm nay', icon: Ruler, color: 'bg-cyan-500' },
  { key: 'containersInTransit', label: 'Đang vận chuyển', icon: Ship, color: 'bg-indigo-500' },
  { key: 'containersAtCustoms', label: 'Thông quan', icon: Container, color: 'bg-violet-500' },
  { key: 'packagesVNPending', label: 'Kho VN chờ xử lý', icon: Warehouse, color: 'bg-emerald-500' },
  { key: 'deliveriesPending', label: 'Chờ giao hàng', icon: Truck, color: 'bg-orange-500' },
] as const;

export function WarehouseDashboard() {
  const { data, isLoading } = useDashboardOverview();

  const wh = data?.warehouse;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Pipeline kho hàng</h2>

      {/* Funnel visualization */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {STAGE_CONFIG.map((stage) => {
          const Icon = stage.icon;
          const count = wh ? (wh as any)[stage.key] ?? 0 : 0;
          return (
            <div
              key={stage.key}
              className="rounded-lg border bg-card p-4 text-center"
            >
              <div
                className={cn(
                  'mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full text-white',
                  stage.color,
                )}
              >
                <Icon className="h-6 w-6" />
              </div>
              <p className="text-2xl font-bold">{isLoading ? '...' : count}</p>
              <p className="mt-1 text-xs text-muted-foreground">{stage.label}</p>
            </div>
          );
        })}
      </div>

      {/* Arrow connections */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4">Tổng quan hôm nay</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex justify-between py-2 border-b">
            <span className="text-muted-foreground">Kiện nhận kho TQ hôm nay</span>
            <span className="font-medium">{wh?.packagesCNToday ?? 0}</span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span className="text-muted-foreground">Kiện nhận kho VN hôm nay</span>
            <span className="font-medium">{wh?.packagesVNToday ?? 0}</span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span className="text-muted-foreground">Container đang vận chuyển</span>
            <span className="font-medium">{wh?.containersInTransit ?? 0}</span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span className="text-muted-foreground">Đơn giao hôm nay</span>
            <span className="font-medium">{wh?.deliveriesToday ?? 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
