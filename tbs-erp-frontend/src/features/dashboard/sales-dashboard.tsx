'use client';

import { ShoppingCart, DollarSign, Users, TrendingUp, Target } from 'lucide-react';
import { StatCard } from '@/components/shared/stat-card';
import {
  useDashboardOverview,
  useFinanceStats,
  useSalesPipeline,
} from '@/lib/hooks/use-dashboard';
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
  const { data: overview, isLoading } = useDashboardOverview();
  const { data: finance } = useFinanceStats();
  const { data: pipeline } = useSalesPipeline();
  const { data: newCustomersData } = useCustomers({ tier: CustomerTier.NEW, limit: 1 });
  const { data: recentOrdersData, isLoading: isLoadingOrders } = useMasterOrders({
    limit: 5,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  const currentPeriod = new Date().toISOString().slice(0, 7);
  const { data: commissionData } = useMonthlyCommissionReport(currentPeriod);

  const recentOrders = recentOrdersData?.data || [];
  const monthlyRevenue = overview?.totalRevenue ?? 0;
  const unpaidCommission = commissionData?.pendingCommission ?? 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* My Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Tổng đơn hàng"
          value={overview?.totalOrders ?? 0}
          icon={ShoppingCart}
          variant="blue"
          description={`${overview?.completedOrders ?? 0} đơn hoàn thành`}
          href="/don-hang"
        />
        <StatCard
          title="Doanh số"
          value={formatCurrency(monthlyRevenue)}
          icon={DollarSign}
          variant="emerald"
          href="/bao-cao/doanh-so"
        />
        <StatCard
          title="Hoa hồng chưa trả"
          value={formatCurrency(unpaidCommission)}
          icon={TrendingUp}
          variant="amber"
          description={commissionData ? `${commissionData.totalOrders} đơn hàng` : undefined}
        />
        <StatCard
          title="Khách hàng mới"
          value={overview?.newCustomers ?? 0}
          icon={Users}
          variant="violet"
          href="/khach-hang"
        />
      </div>

      {/* Pipeline Summary */}
      {pipeline && (
        <div className="section-card">
          <div className="section-card-header">
            <h4 className="text-sm font-semibold text-foreground/80">Pipeline bán hàng</h4>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              {[
                { label: 'Tư vấn', value: pipeline.pipeline.consulting, href: '/don-hang?status=CONSULTING' },
                { label: 'Báo giá', value: pipeline.pipeline.quotation, href: '/bao-gia' },
                { label: 'Chờ cọc', value: pipeline.pipeline.pendingDeposit, href: '/don-hang?status=PENDING_DEPOSIT' },
                { label: 'Đang xử lý', value: pipeline.pipeline.totalActive, href: '/don-hang' },
                { label: 'Hoàn thành', value: pipeline.pipeline.completed, href: '/don-hang?status=COMPLETED' },
              ].map((s) => (
                <Link key={s.label} href={s.href} className="text-center p-2 rounded-lg bg-muted/50 hover:bg-muted hover:shadow-sm transition-all group">
                  <p className="text-xl font-bold group-hover:scale-110 transition-transform">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* KPI Detail Cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="section-card">
          <div className="section-card-header">
            <h4 className="text-sm font-semibold text-foreground/80">Chi tiết hoa hồng</h4>
          </div>
          <div className="p-4">
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
        </div>

        <div className="section-card">
          <div className="section-card-header">
            <h4 className="text-sm font-semibold text-foreground/80">Thống kê khách hàng</h4>
          </div>
          <div className="p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Khách hàng mới:</span>
              <span className="font-medium">{newCustomersData?.meta?.total ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Công nợ quá hạn:</span>
              <span className={`font-medium ${(finance?.accountsReceivable?.overdueAmount ?? 0) > 0 ? 'text-red-600' : ''}`}>
                {formatCurrency(finance?.accountsReceivable?.overdueAmount ?? 0)}
              </span>
            </div>
          </div>
        </div>

        {pipeline && pipeline.overdueAR.count > 0 && (
          <div className="section-card border-red-200">
            <div className="section-card-header">
              <h4 className="text-sm font-semibold text-red-700">Công nợ quá hạn</h4>
            </div>
            <div className="p-4 text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Số KH quá hạn:</span>
                <span className="font-medium text-red-600">{pipeline.overdueAR.count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tổng nợ quá hạn:</span>
                <span className="font-medium text-red-600">{formatCurrency(pipeline.overdueAR.totalOutstanding)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* My Recent Orders */}
      <div className="section-card">
        <div className="section-card-header flex items-center justify-between">
          <h3 className="text-lg font-semibold">Đơn hàng gần đây</h3>
          <Link href="/don-hang" className="text-sm text-primary hover:underline">
            Xem tất cả
          </Link>
        </div>
        <div className="px-6 pb-4">
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
                  <tr key={order.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
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
      </div>

      {/* Pending Approvals */}
      <div className="section-card">
        <div className="section-card-header flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground/80">Đang chờ phê duyệt</h3>
          <Link href="/phe-duyet" className="text-sm text-primary hover:underline">
            Xem tất cả
          </Link>
        </div>
        <p className="text-sm text-muted-foreground p-4">Không có yêu cầu chờ duyệt</p>
      </div>
    </div>
  );
}
