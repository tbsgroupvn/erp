'use client';

import { useState } from 'react';
import { ShoppingCart, DollarSign, Users, CheckCircle } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { useDashboardOverview } from '@/lib/hooks/use-dashboard';
import { useMasterOrders } from '@/lib/hooks/use-orders';
import { cn } from '@/lib/utils/cn';
import { ORDER_STATUS_LABELS, MASTER_ORDER_STATUS_LABELS, MASTER_ORDER_STATUS_COLORS, BRANCH_LABELS } from '@/lib/utils/constants';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import type { OrderStatus, MasterOrderStatus } from '@/lib/types';
import Link from 'next/link';

const PERIOD_OPTIONS = [
  { value: 'today', label: 'Hôm nay' },
  { value: 'week', label: 'Tuần' },
  { value: 'month', label: 'Tháng' },
  { value: 'quarter', label: 'Quý' },
  { value: 'year', label: 'Năm' },
] as const;

const PIE_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#ec4899', '#6366f1',
];

export function BodDashboard() {
  const [period, setPeriod] = useState<string>('month');
  const { data, isLoading } = useDashboardOverview({ dateFrom: period });
  const { data: recentOrdersData } = useMasterOrders({ limit: 5 });

  const stats = data?.orders;
  const finance = data?.finance;
  const recentOrders = recentOrdersData?.data ?? [];

  return (
    <div className="space-y-6">
      {/* Period Filter */}
      <div className="flex gap-1 rounded-lg border p-1 w-fit">
        {PERIOD_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setPeriod(opt.value)}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm transition-colors',
              period === opt.value
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-accent',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Tổng đơn hàng"
          value={stats?.totalOrders ?? 0}
          icon={ShoppingCart}
          description={`${stats?.newOrdersToday ?? 0} đơn mới hôm nay`}
        />
        <StatCard
          title="Doanh thu"
          value={formatCurrency(stats?.revenueThisMonth ?? 0)}
          icon={DollarSign}
          trend={stats ? { value: stats.revenueGrowth, label: 'so với tháng trước' } : undefined}
        />
        <StatCard
          title="Công nợ phải thu"
          value={formatCurrency(finance?.totalReceivable ?? 0)}
          icon={Users}
          description={`Quá hạn: ${formatCurrency(finance?.overdueReceivable ?? 0)}`}
        />
        <StatCard
          title="Đơn hoàn thành"
          value={`${((stats?.completionRate ?? 0) * 100).toFixed(1)}%`}
          icon={CheckCircle}
          description={`Trung bình ${stats?.averageProcessingDays ?? 0} ngày xử lý`}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Biểu đồ doanh thu</h3>
          <div className="h-[300px] flex items-center justify-center">
            {stats ? (
              <div className="text-center space-y-3">
                <p className="text-3xl font-bold">{formatCurrency(stats.revenueThisMonth)}</p>
                <p className="text-sm text-muted-foreground">Doanh thu tháng này</p>
                {stats.revenueGrowth !== 0 && (
                  <p className={cn('text-sm font-medium', stats.revenueGrowth > 0 ? 'text-green-600' : 'text-red-600')}>
                    {stats.revenueGrowth > 0 ? '+' : ''}{stats.revenueGrowth.toFixed(1)}% so với tháng trước
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-2">Tháng trước: {formatCurrency(stats.revenueLastMonth)}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Đang tải...</p>
            )}
          </div>
        </div>

        {/* Orders by Status Donut */}
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Đơn hàng theo trạng thái</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={
                    stats?.ordersByStatus
                      ? Object.entries(stats.ordersByStatus)
                          .filter(([, v]) => v > 0)
                          .map(([key, value]) => ({
                            name: ORDER_STATUS_LABELS[key as OrderStatus] || key,
                            value,
                          }))
                      : []
                  }
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  dataKey="value"
                  paddingAngle={2}
                >
                  {(stats?.ordersByStatus
                    ? Object.entries(stats.ordersByStatus).filter(([, v]) => v > 0)
                    : []
                  ).map((_, index) => (
                    <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11 }}
                />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Orders Table */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Đơn hàng gần đây</h3>
          <Link href="/don-hang" className="text-sm text-primary hover:underline">
            Xem tất cả
          </Link>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-2 font-medium">Mã đơn</th>
              <th className="pb-2 font-medium">Khách hàng</th>
              <th className="pb-2 font-medium">Trạng thái</th>
              <th className="pb-2 font-medium text-right">Tổng tiền</th>
              <th className="pb-2 font-medium text-right">Ngày tạo</th>
            </tr>
          </thead>
          <tbody>
            {recentOrders.length > 0 ? (
              recentOrders.map((order) => {
                const status = order.overallStatus as MasterOrderStatus;
                return (
                  <tr key={order.id} className="border-b last:border-0">
                    <td className="py-2.5">
                      <Link href={`/don-hang/${order.id}`} className="text-primary hover:underline">
                        {order.code}
                      </Link>
                    </td>
                    <td className="py-2.5">{order.customer?.fullName ?? '---'}</td>
                    <td className="py-2.5">
                      <StatusBadge
                        label={MASTER_ORDER_STATUS_LABELS[status] || status}
                        colorClass={MASTER_ORDER_STATUS_COLORS[status] || 'bg-gray-100 text-gray-700'}
                      />
                    </td>
                    <td className="py-2.5 text-right">{order.branch ? BRANCH_LABELS[order.branch] : '---'}</td>
                    <td className="py-2.5 text-right text-muted-foreground">{formatDate(order.createdAt)}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="py-8 text-center text-muted-foreground">
                  {isLoading ? 'Đang tải...' : 'Chưa có đơn hàng'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
