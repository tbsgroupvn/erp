'use client';

import { ShoppingCart, DollarSign, Users, AlertTriangle, TrendingUp, Target } from 'lucide-react';
import { StatCard } from '@/components/shared/stat-card';
import { Skeleton, CardSkeleton, ListSkeleton } from '@/components/shared/skeleton';
import { useDashboardOverview } from '@/lib/hooks/use-dashboard';
import { useCustomers } from '@/lib/hooks/use-customers';
import { useMasterOrders } from '@/lib/hooks/use-orders';
import { useMonthlyCommissionReport } from '@/lib/hooks/use-commission';
import { CustomerTier } from '@/lib/types';
import { formatCurrency, formatDateTime } from '@/lib/utils/format';
import { MASTER_ORDER_STATUS_LABELS, MASTER_ORDER_STATUS_COLORS } from '@/lib/utils/constants';
import { StatusBadge } from '@/components/shared/status-badge';
import type { MasterOrderStatus } from '@/lib/types';
import Link from 'next/link';

export function SalesDashboard() {
  const { data, isLoading } = useDashboardOverview();
  const { data: newCustomersData } = useCustomers({ tier: CustomerTier.NEW, limit: 1 });
  const { data: recentOrdersData, isLoading: isLoadingOrders } = useMasterOrders({
    limit: 5,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  // Get current month commission data
  const currentPeriod = new Date().toISOString().slice(0, 7); // YYYY-MM format
  const { data: commissionData } = useMonthlyCommissionReport(currentPeriod);

  const stats = data?.orders;
  const finance = data?.finance;
  const recentOrders = recentOrdersData?.data || [];

  // Calculate KPI metrics
  const monthlyRevenue = stats?.revenueThisMonth ?? 0;
  const unpaidCommission = commissionData?.pendingCommission ?? 0;

  // Monthly target - prioritize backend value, fallback to env var, or undefined
  // Backend should eventually provide this via stats.monthlyTarget or user settings
  const monthlyTarget =
    (stats as any)?.monthlyTarget ?? // Check if backend returns target
    (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_DEFAULT_MONTHLY_TARGET
      ? parseFloat(process.env.NEXT_PUBLIC_DEFAULT_MONTHLY_TARGET)
      : undefined);

  const targetCompletion =
    monthlyTarget && monthlyTarget > 0 ? (monthlyRevenue / monthlyTarget) * 100 : undefined;

  // Show loading skeletons while initial data is loading
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <div>
          <Skeleton className="h-6 w-48 mb-4" />
          <ListSkeleton items={5} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* My Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Đơn hàng của tôi"
          value={stats?.totalOrders ?? 0}
          icon={ShoppingCart}
          description={`${stats?.newOrdersToday ?? 0} đơn mới hôm nay`}
        />
        <StatCard
          title="Doanh số tháng này"
          value={formatCurrency(monthlyRevenue)}
          icon={DollarSign}
          description={
            stats?.revenueGrowth
              ? `${stats.revenueGrowth > 0 ? '+' : ''}${stats.revenueGrowth.toFixed(1)}% so với tháng trước`
              : undefined
          }
        />
        <StatCard
          title="Hoa hồng chưa trả"
          value={formatCurrency(unpaidCommission)}
          icon={TrendingUp}
          description={commissionData ? `${commissionData.totalOrders} đơn hàng` : undefined}
          className="border-green-200"
        />
        {/* Only show target card if monthlyTarget is configured */}
        {monthlyTarget && targetCompletion !== undefined && (
          <StatCard
            title="Target tháng"
            value={`${targetCompletion.toFixed(1)}%`}
            icon={Target}
            description={`${formatCurrency(monthlyRevenue)} / ${formatCurrency(monthlyTarget)}`}
            className={
              targetCompletion >= 100
                ? 'border-green-300 bg-green-50'
                : targetCompletion >= 80
                ? 'border-yellow-200'
                : ''
            }
          />
        )}
      </div>

      {/* KPI Detail Cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <h4 className="text-sm font-medium text-muted-foreground mb-2">
            Chi tiết hoa hồng
          </h4>
          {commissionData ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Chờ duyệt:</span>
                <span className="font-medium text-yellow-600">
                  {formatCurrency(commissionData.pendingCommission)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Đã duyệt:</span>
                <span className="font-medium text-green-600">
                  {formatCurrency(commissionData.approvedCommission)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Đã trả:</span>
                <span className="font-medium">
                  {formatCurrency(commissionData.paidCommission)}
                </span>
              </div>
              <div className="pt-2 border-t">
                <div className="flex justify-between font-semibold">
                  <span>Tổng hoa hồng:</span>
                  <span>{formatCurrency(commissionData.totalCommission)}</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Đang tải...</p>
          )}
        </div>

        {/* Only show target progress if monthlyTarget is configured */}
        {monthlyTarget && targetCompletion !== undefined ? (
          <div className="rounded-lg border bg-card p-4">
            <h4 className="text-sm font-medium text-muted-foreground mb-2">
              Tiến độ target
            </h4>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Hoàn thành</span>
                  <span className="font-medium">{targetCompletion.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      targetCompletion >= 100
                        ? 'bg-green-500'
                        : targetCompletion >= 80
                        ? 'bg-yellow-500'
                        : 'bg-blue-500'
                    }`}
                    style={{ width: `${Math.min(targetCompletion, 100)}%` }}
                  />
                </div>
              </div>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Còn thiếu:</span>
                  <span className="font-medium">
                    {formatCurrency(Math.max(0, monthlyTarget - monthlyRevenue))}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="rounded-lg border bg-card p-4">
          <h4 className="text-sm font-medium text-muted-foreground mb-2">
            Thống kê khách hàng
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Khách hàng mới:</span>
              <span className="font-medium">{newCustomersData?.meta?.total ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Công nợ quá hạn:</span>
              <span className={`font-medium ${finance?.overdueReceivable ? 'text-red-600' : ''}`}>
                {formatCurrency(finance?.overdueReceivable ?? 0)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* My Recent Orders */}
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
              <th className="pb-2 font-medium">Thời gian</th>
              <th className="pb-2 font-medium text-right">Số đơn con</th>
            </tr>
          </thead>
          <tbody>
            {isLoadingOrders ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-muted-foreground">
                  Đang tải...
                </td>
              </tr>
            ) : recentOrders.length > 0 ? (
              recentOrders.map((order) => (
                <tr key={order.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="py-3">
                    <Link href={`/don-hang/${order.id}`} className="text-primary hover:underline font-medium">
                      {order.code}
                    </Link>
                  </td>
                  <td className="py-3">
                    {order.customer ? (
                      <Link href={`/khach-hang/${order.customer.id}`} className="hover:underline">
                        {order.customer.fullName}
                      </Link>
                    ) : (
                      '---'
                    )}
                  </td>
                  <td className="py-3">
                    <StatusBadge
                      label={MASTER_ORDER_STATUS_LABELS[order.overallStatus as MasterOrderStatus] || order.overallStatus}
                      colorClass={MASTER_ORDER_STATUS_COLORS[order.overallStatus as MasterOrderStatus] || 'bg-gray-100 text-gray-700'}
                    />
                  </td>
                  <td className="py-3 text-muted-foreground">
                    {formatDateTime(order.createdAt)}
                  </td>
                  <td className="py-3 text-right">
                    {order.subOrders?.length || 0}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="py-8 text-center text-muted-foreground">
                  Chưa có đơn hàng nào
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pending Approvals */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Đang chờ phê duyệt</h3>
          <Link href="/phe-duyet" className="text-sm text-primary hover:underline">
            Xem tất cả
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">Không có yêu cầu chờ duyệt</p>
      </div>
    </div>
  );
}
