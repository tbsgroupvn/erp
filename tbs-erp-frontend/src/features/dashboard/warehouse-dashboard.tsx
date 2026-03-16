'use client';

import { useWarehouseStats } from '@/lib/hooks/use-dashboard';
import { StatCard, type StatCardVariant } from '@/components/shared/stat-card';
import {
  Package,
  BoxSelect,
  Layers,
  Ship,
  FileCheck,
  Warehouse,
  Truck,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const VARIANT_ROTATION: StatCardVariant[] = ['blue', 'cyan', 'violet', 'emerald', 'amber', 'rose'];

const STAGE_CONFIG = [
  { key: 'warehouseCN', label: 'Kho TQ', icon: Package, color: 'bg-blue-500', href: '/kho-trung-quoc' },
  { key: 'packing', label: 'Đóng gói', icon: BoxSelect, color: 'bg-cyan-500', href: '/kho-trung-quoc' },
  { key: 'consolidation', label: 'Gom hàng', icon: Layers, color: 'bg-indigo-500', href: '/container' },
  { key: 'inTransit', label: 'Vận chuyển', icon: Ship, color: 'bg-violet-500', href: '/container' },
  { key: 'atCustoms', label: 'Thông quan', icon: FileCheck, color: 'bg-amber-500', href: '/thong-quan' },
  { key: 'warehouseVN', label: 'Kho VN', icon: Warehouse, color: 'bg-emerald-500', href: '/kho-viet-nam' },
  { key: 'pendingDelivery', label: 'Chờ giao', icon: Truck, color: 'bg-orange-500', href: '/giao-hang' },
  { key: 'delivering', label: 'Đang giao', icon: ArrowRight, color: 'bg-rose-500', href: '/giao-hang' },
] as const;

export function WarehouseDashboard() {
  const { data: wh, isLoading } = useWarehouseStats();

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Pipeline kho hàng</h2>

      {/* Pipeline visualization */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
        {STAGE_CONFIG.map((stage, index) => {
          const count = wh ? (wh[stage.key as keyof typeof wh] as number ?? 0) : 0;
          return (
            <StatCard
              key={stage.key}
              title={stage.label}
              value={isLoading ? '...' : count}
              icon={stage.icon}
              variant={VARIANT_ROTATION[index % VARIANT_ROTATION.length]}
              href={stage.href}
            />
          );
        })}
      </div>

      {/* Summary */}
      <div className="section-card">
        <div className="section-card-header">
          <h3 className="text-sm font-semibold text-foreground/80">Tổng quan</h3>
        </div>
        <div className="px-6 pb-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex justify-between py-2 border-b hover:bg-muted/30 transition-colors">
              <span className="text-muted-foreground">Tổng kiện trong pipeline</span>
              <span className="font-medium">{wh?.pipeline?.total ?? 0}</span>
            </div>
            <div className="flex justify-between py-2 border-b hover:bg-muted/30 transition-colors">
              <span className="text-muted-foreground">Chờ giao hàng</span>
              <span className="font-medium">{wh?.pendingDelivery ?? 0}</span>
            </div>
            <div className="flex justify-between py-2 border-b hover:bg-muted/30 transition-colors">
              <span className="text-muted-foreground">Đang vận chuyển</span>
              <span className="font-medium">{wh?.inTransit ?? 0}</span>
            </div>
            <div className="flex justify-between py-2 border-b hover:bg-muted/30 transition-colors">
              <span className="text-muted-foreground">Đang giao</span>
              <span className="font-medium">{wh?.delivering ?? 0}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
