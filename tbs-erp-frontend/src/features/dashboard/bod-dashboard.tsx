'use client';

import { useState, useCallback, useEffect, type ReactNode } from 'react';
import {
  ShoppingCart,
  DollarSign,
  Users,
  CheckCircle,
  Package,
  Ship,
  Truck,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
  Wallet,
  Clock,
  ArrowRight,
  Shield,
  Route,
  RefreshCw,
  Calendar,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

// Lazy-load chart components — recharts is a large bundle (~500 kB) and uses
// browser-only APIs (ResizeObserver, SVG), so ssr: false is required.
const RevenueLineChart = dynamic(
  () => import('./charts/revenue-line-chart').then((m) => m.RevenueLineChart),
  { ssr: false, loading: () => <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Dang tai bieu do...</div> },
);

const OrderStatusPieChart = dynamic(
  () => import('./charts/order-status-pie-chart').then((m) => m.OrderStatusPieChart),
  { ssr: false, loading: () => <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Dang tai bieu do...</div> },
);

const MarginBarChart = dynamic(
  () => import('./charts/margin-bar-chart').then((m) => m.MarginBarChart),
  { ssr: false, loading: () => <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Dang tai bieu do...</div> },
);

const CashFlowBarChart = dynamic(
  () => import('./charts/cashflow-bar-chart').then((m) => m.CashFlowBarChart),
  { ssr: false, loading: () => <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Dang tai bieu do...</div> },
);
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  useDashboardOverview,
  useOrderStats,
  useFinanceStats,
  useWarehouseStats,
  useHRStats,
  useSalesPipeline,
  useAnalytics,
  useSlaTracking,
  useMarginByRoute,
  useCashFlowForecast,
} from '@/lib/hooks/use-dashboard';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils/cn';
import { ORDER_STATUS_LABELS } from '@/lib/utils/constants';
import { formatCurrency } from '@/lib/utils/format';
import type { DashboardQueryParams, OrderStatus } from '@/lib/types';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// localStorage key for persisting date range preference
// ---------------------------------------------------------------------------
const RANGE_KEY = 'bod_dashboard_range';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PERIOD_OPTIONS = [
  { value: 'today',   label: 'Hôm nay'   },
  { value: 'week',    label: '7 ngày'    },
  { value: 'month',   label: '30 ngày'   },
  { value: 'current_month', label: 'Tháng này' },
  { value: 'quarter', label: 'Quý này'   },
  { value: 'custom',  label: 'Tùy chọn' },
] as const;

const PIE_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#ec4899', '#6366f1',
];

const PIPELINE_STAGES = [
  { key: 'warehouseCN', label: 'Kho TQ', color: 'bg-blue-500', href: '/kho-trung-quoc' },
  { key: 'packing', label: 'Đóng gói', color: 'bg-cyan-500', href: '/kho-trung-quoc' },
  { key: 'consolidation', label: 'Gom hàng', color: 'bg-indigo-500', href: '/container' },
  { key: 'inTransit', label: 'Vận chuyển', color: 'bg-violet-500', href: '/container' },
  { key: 'atCustoms', label: 'Thông quan', color: 'bg-amber-500', href: '/thong-quan' },
  { key: 'warehouseVN', label: 'Kho VN', color: 'bg-emerald-500', href: '/kho-viet-nam' },
  { key: 'pendingDelivery', label: 'Chờ giao', color: 'bg-orange-500', href: '/giao-hang' },
  { key: 'delivering', label: 'Đang giao', color: 'bg-rose-500', href: '/giao-hang' },
] as const;

function getDateRange(period: string, customFrom?: string, customTo?: string): DashboardQueryParams {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  switch (period) {
    case 'today': return { dateFrom: today, dateTo: today };
    case 'week': {
      const d = new Date(now); d.setDate(d.getDate() - 7);
      return { dateFrom: d.toISOString().split('T')[0], dateTo: today };
    }
    case 'month': {
      const d = new Date(now); d.setDate(d.getDate() - 30);
      return { dateFrom: d.toISOString().split('T')[0], dateTo: today };
    }
    case 'current_month': {
      return { dateFrom: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, dateTo: today };
    }
    case 'quarter': {
      const d = new Date(now); d.setMonth(d.getMonth() - 3);
      return { dateFrom: d.toISOString().split('T')[0], dateTo: today };
    }
    case 'custom': {
      if (customFrom && customTo) return { dateFrom: customFrom, dateTo: customTo };
      return {};
    }
    default: return {};
  }
}

function formatCompact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} tỷ`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} tr`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)} k`;
  return n.toString();
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({ title, href, children }: { title: string; href?: string; children: ReactNode }) {
  return (
    <div className="section-card">
      <div className="section-card-header flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground/80">{title}</h3>
        {href && (
          <Link href={href} className="text-xs text-primary hover:underline flex items-center gap-1">
            Chi tiết <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      <div className="p-4 sm:p-6">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function BodDashboard() {
  // Restore last selected range from localStorage
  const [period, setPeriod] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(RANGE_KEY) ?? 'month';
    }
    return 'month';
  });
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const dateRange = getDateRange(period, customFrom, customTo);

  // Persist selection
  const handlePeriodChange = useCallback((val: string) => {
    setPeriod(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem(RANGE_KEY, val);
    }
  }, []);

  // Manual refresh
  const qc = useQueryClient();
  const handleRefresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['dashboard'] });
    setLastRefresh(new Date());
  }, [qc]);

  // Auto-update timestamp every minute
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  // All data queries — auto-refresh every 60s + WS invalidation
  const { data: overview } = useDashboardOverview(dateRange);
  const { data: orderStats } = useOrderStats(dateRange);
  const { data: finance } = useFinanceStats(dateRange);
  const { data: warehouse } = useWarehouseStats(dateRange);
  const { data: hr } = useHRStats(dateRange);
  const { data: pipeline } = useSalesPipeline();
  const { data: analytics } = useAnalytics({ metric: 'revenue', period: '12m' });
  const { data: sla } = useSlaTracking();
  const { data: margins } = useMarginByRoute(dateRange);
  const { data: cashFlow } = useCashFlowForecast({ days: 30 });

  return (
    <div className="space-y-6">
      {/* Period Filter + Refresh */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-lg border bg-background p-1 w-fit">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handlePeriodChange(opt.value)}
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

        {/* Custom date inputs */}
        {period === 'custom' && (
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-8 rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <span className="text-muted-foreground text-sm">-</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-8 rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        )}

        {/* Manual refresh + timestamp */}
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-muted-foreground">
            Cập nhật lúc {lastRefresh.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <button
            type="button"
            onClick={handleRefresh}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Làm mới
          </button>
        </div>
      </div>

      {/* ========== ROW 1: KPI Cards ========== */}
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
          title="Doanh thu"
          value={formatCurrency(overview?.totalRevenue ?? 0)}
          icon={DollarSign}
          variant="emerald"
          description={analytics?.summary
            ? `YoY: ${analytics.summary.overallYoyChangePercent != null ? `${analytics.summary.overallYoyChangePercent > 0 ? '+' : ''}${analytics.summary.overallYoyChangePercent.toFixed(1)}%` : '---'}`
            : undefined
          }
          href="/bao-cao/doanh-so"
        />
        <StatCard
          title="Công nợ phải thu"
          value={formatCurrency(finance?.accountsReceivable?.totalOutstanding ?? 0)}
          icon={Wallet}
          variant="amber"
          description={`Quá hạn: ${formatCurrency(finance?.accountsReceivable?.overdueAmount ?? 0)}`}
          href="/tai-chinh/cong-no-phai-thu"
        />
        <StatCard
          title="Khách hàng mới"
          value={overview?.newCustomers ?? 0}
          icon={Users}
          variant="violet"
          href="/khach-hang"
        />
      </div>

      {/* ========== ROW 2: Sales Pipeline + SLA ========== */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Sales Pipeline */}
        <div className="lg:col-span-2">
          <Section title="Sales Pipeline" href="/don-hang">
            {pipeline ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {[
                    { label: 'Tư vấn', value: pipeline.pipeline.consulting, color: 'text-blue-600', href: '/don-hang?status=CONSULTING' },
                    { label: 'Báo giá', value: pipeline.pipeline.quotation, color: 'text-cyan-600', href: '/bao-gia' },
                    { label: 'Chờ cọc', value: pipeline.pipeline.pendingDeposit, color: 'text-amber-600', href: '/don-hang?status=PENDING_DEPOSIT' },
                    { label: 'Mua hàng', value: pipeline.pipeline.sourcing, color: 'text-indigo-600', href: '/don-hang?status=SOURCING' },
                    { label: 'Kho TQ', value: pipeline.pipeline.warehouseCN, color: 'text-violet-600', href: '/kho-trung-quoc' },
                    { label: 'Vận chuyển', value: pipeline.pipeline.inTransit, color: 'text-emerald-600', href: '/container' },
                    { label: 'Kho VN', value: pipeline.pipeline.warehouseVN, color: 'text-orange-600', href: '/kho-viet-nam' },
                    { label: 'Đang giao', value: pipeline.pipeline.delivering, color: 'text-rose-600', href: '/giao-hang' },
                    { label: 'Quyết toán', value: pipeline.pipeline.settlement, color: 'text-teal-600', href: '/don-hang?status=SETTLEMENT' },
                    { label: 'Hoàn thành', value: pipeline.pipeline.completed, color: 'text-green-600', href: '/don-hang?status=COMPLETED' },
                  ].map((s) => (
                    <Link
                      key={s.label}
                      href={s.href}
                      className="text-center p-3 rounded-lg bg-muted/50 hover:bg-muted hover:shadow-sm transition-all group"
                    >
                      <p className={cn('text-2xl font-bold group-hover:scale-110 transition-transform', s.color)}>{s.value}</p>
                      <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                    </Link>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-3 border-t text-sm">
                  <span className="text-muted-foreground">
                    Tổng đơn đang xử lý: <strong className="text-foreground">{pipeline.pipeline.totalActive}</strong>
                  </span>
                  <span className="text-muted-foreground">
                    Chờ cọc: <strong className="text-amber-600">{formatCurrency(pipeline.pendingDeposits.totalDepositRequired)}</strong>
                    {' '}({pipeline.pendingDeposits.count} đơn)
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Đang tải...</p>
            )}
          </Section>
        </div>

        {/* SLA Tracking */}
        <Section title="SLA & Tuân thủ" href="/don-hang">
          {sla ? (
            <div className="space-y-4">
              <div className="text-center">
                <p className={cn(
                  'text-4xl font-bold',
                  sla.complianceRate >= 95 ? 'text-green-600' :
                  sla.complianceRate >= 85 ? 'text-amber-600' : 'text-red-600'
                )}>
                  {sla.complianceRate.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">Tỉ lệ tuân thủ SLA</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-lg font-bold">{sla.totalActiveOrders}</p>
                  <p className="text-xs text-muted-foreground">Đơn đang xử lý</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-red-50">
                  <p className="text-lg font-bold text-red-600">{sla.slaBreaches}</p>
                  <p className="text-xs text-muted-foreground">Vi phạm SLA</p>
                </div>
              </div>
              {sla.breachedOrders.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t">
                  <p className="text-xs font-medium text-red-600">Đơn vi phạm:</p>
                  {sla.breachedOrders.slice(0, 5).map((o) => (
                    <div key={o.id} className="flex items-center justify-between text-xs">
                      <Link href={`/don-hang/${o.id}`} className="text-primary hover:underline font-medium">
                        {o.code}
                      </Link>
                      <span className="text-muted-foreground">{o.daysSinceUpdate} ngày</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Đang tải...</p>
          )}
        </Section>
      </div>

      {/* ========== ROW 3: Finance Overview ========== */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* AR / AP */}
        <Section title="Tài chính - Công nợ" href="/tai-chinh/cong-no-phai-thu">
          {finance ? (
            <div className="grid grid-cols-2 gap-6">
              {/* AR */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium">Phải thu (AR)</span>
                </div>
                <p className="text-xl font-bold">{formatCurrency(finance.accountsReceivable.totalOutstanding)}</p>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Quá hạn:</span>
                    <span className="font-medium text-red-600">{formatCurrency(finance.accountsReceivable.overdueAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Số hóa đơn mở:</span>
                    <span className="font-medium text-foreground">{finance.accountsReceivable.openCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Quá hạn:</span>
                    <span className="font-medium text-red-600">{finance.accountsReceivable.overdueCount}</span>
                  </div>
                </div>
              </div>
              {/* AP */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-rose-600" />
                  <span className="text-sm font-medium">Phải trả (AP)</span>
                </div>
                <p className="text-xl font-bold">{formatCurrency(finance.accountsPayable.totalOutstanding)}</p>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Quá hạn:</span>
                    <span className="font-medium text-red-600">{formatCurrency(finance.accountsPayable.overdueAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Số hóa đơn mở:</span>
                    <span className="font-medium text-foreground">{finance.accountsPayable.openCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Quá hạn:</span>
                    <span className="font-medium text-red-600">{finance.accountsPayable.overdueCount}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Đang tải...</p>
          )}
          {/* Cash Flow Summary */}
          {finance && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-medium">Dòng tiền tháng</span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-2 rounded-lg bg-green-50">
                  <p className="text-sm font-bold text-green-700">{formatCompact(finance.cashFlow.monthlyInflow)}</p>
                  <p className="text-xs text-muted-foreground">Thu ({finance.cashFlow.inflowCount})</p>
                </div>
                <div className="p-2 rounded-lg bg-red-50">
                  <p className="text-sm font-bold text-red-700">{formatCompact(finance.cashFlow.monthlyOutflow)}</p>
                  <p className="text-xs text-muted-foreground">Chi ({finance.cashFlow.outflowCount})</p>
                </div>
                <div className={cn('p-2 rounded-lg', finance.cashFlow.netFlow >= 0 ? 'bg-blue-50' : 'bg-orange-50')}>
                  <p className={cn('text-sm font-bold', finance.cashFlow.netFlow >= 0 ? 'text-blue-700' : 'text-orange-700')}>
                    {formatCompact(finance.cashFlow.netFlow)}
                  </p>
                  <p className="text-xs text-muted-foreground">Ròng</p>
                </div>
              </div>
              {finance.pendingVouchers > 0 && (
                <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {finance.pendingVouchers} phiếu thu/chi chờ duyệt
                </p>
              )}
            </div>
          )}
        </Section>

        {/* Revenue Analytics Chart */}
        <Section title="Xu huong doanh thu 12 thang">
          <div className="h-[280px]">
            {analytics && analytics.data.length > 0 ? (
              <RevenueLineChart
                data={analytics.data.map((d) => ({
                  month: `T${d.month}/${String(d.year).slice(-2)}`,
                  current: d.value,
                  lastYear: d.previousYearValue ?? 0,
                  ma3: d.movingAverage3m ?? undefined,
                }))}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                Dang tai bieu do...
              </div>
            )}
          </div>
        </Section>
      </div>

      {/* ========== ROW 4: Warehouse Pipeline + Order Stats ========== */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Warehouse Pipeline */}
        <div className="lg:col-span-2">
          <Section title="Pipeline Kho hàng" href="/kho-trung-quoc">
            {warehouse ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 overflow-x-auto pb-2">
                  {PIPELINE_STAGES.map((stage, i) => {
                    const count = warehouse[stage.key as keyof typeof warehouse] as number ?? 0;
                    return (
                      <div key={stage.key} className="flex items-center gap-2 shrink-0">
                        {i > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                        <Link href={stage.href} className="text-center min-w-[72px] p-2 rounded-lg bg-muted/50 hover:bg-muted hover:shadow-sm transition-all group">
                          <div className={cn('h-1.5 rounded-full mx-auto mb-1.5 w-8', stage.color)} />
                          <p className="text-lg font-bold group-hover:scale-110 transition-transform">{count}</p>
                          <p className="text-[10px] text-muted-foreground leading-tight">{stage.label}</p>
                        </Link>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between text-sm pt-2 border-t">
                  <span className="text-muted-foreground">
                    Tổng kiện trong pipeline: <strong className="text-foreground">{warehouse.pipeline?.total ?? 0}</strong>
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Đang tải...</p>
            )}
          </Section>
        </div>

        {/* Order Status Distribution */}
        <Section title="Phân bố trạng thái đơn">
          {orderStats && orderStats.byStatus.length > 0 ? (
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={orderStats.byStatus
                      .filter((s) => s.count > 0)
                      .map((s) => ({
                        name: ORDER_STATUS_LABELS[s.status as OrderStatus] || s.status,
                        value: s.count,
                      }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="value"
                    paddingAngle={2}
                  >
                    {orderStats.byStatus.filter((s) => s.count > 0).map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend verticalAlign="bottom" height={36} iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">
              Đang tải...
            </div>
          )}
          {orderStats && (
            <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t mt-2">
              <span>Đơn đang xử lý: <strong className="text-foreground">{orderStats.activeOrders}</strong></span>
              <span>Chờ cọc: <strong className="text-amber-600">{orderStats.pendingDeposit}</strong></span>
            </div>
          )}
        </Section>
      </div>

      {/* ========== ROW 5: Margin by Route + Cash Flow Forecast ========== */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Margin by Route */}
        <Section title="Biên lợi nhuận theo tuyến" href="/bao-cao/tai-chinh">
          {margins && margins.routes.length > 0 ? (
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={margins.routes.map((r) => ({
                  route: r.route,
                  revenue: r.revenue,
                  cost: r.cost,
                  margin: r.marginPercent,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="route" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => formatCompact(v)} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value: number, name: string) =>
                    name === 'margin'
                      ? `${value.toFixed(1)}%`
                      : formatCurrency(value)
                  } />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="revenue" name="Doanh thu" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="cost" name="Chi phí" fill="#f87171" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">
              Đang tải...
            </div>
          )}
          {margins && margins.routes.length > 0 && (
            <div className="grid grid-cols-3 gap-2 pt-3 border-t mt-2">
              {margins.routes.map((r) => (
                <div key={r.route} className="text-center p-2 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">{r.route}</p>
                  <p className={cn(
                    'text-sm font-bold',
                    r.marginPercent >= 20 ? 'text-green-600' :
                    r.marginPercent >= 10 ? 'text-amber-600' : 'text-red-600'
                  )}>
                    {r.marginPercent.toFixed(1)}%
                  </p>
                  <p className="text-[10px] text-muted-foreground">{r.orderCount} đơn</p>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Cash Flow Forecast */}
        <Section title="Dự báo dòng tiền 30 ngày" href="/tai-chinh/phieu-thu-chi">
          {cashFlow && cashFlow.weeks.length > 0 ? (
            <>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cashFlow.weeks.map((w) => ({
                    week: w.weekStart.slice(5),
                    inflow: w.inflow,
                    outflow: -w.outflow,
                    net: w.netPosition,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => formatCompact(Math.abs(v))} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value: number) => formatCurrency(Math.abs(value))} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="inflow" name="Thu" fill="#22c55e" radius={[4, 4, 0, 0]} stackId="flow" />
                    <Bar dataKey="outflow" name="Chi" fill="#ef4444" radius={[0, 0, 4, 4]} stackId="flow" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center pt-3 border-t mt-2">
                <div className="p-2 rounded-lg bg-green-50">
                  <p className="text-sm font-bold text-green-700">{formatCompact(cashFlow.summary.totalInflow)}</p>
                  <p className="text-xs text-muted-foreground">Tổng thu</p>
                </div>
                <div className="p-2 rounded-lg bg-red-50">
                  <p className="text-sm font-bold text-red-700">{formatCompact(cashFlow.summary.totalOutflow)}</p>
                  <p className="text-xs text-muted-foreground">Tổng chi</p>
                </div>
                <div className={cn('p-2 rounded-lg', cashFlow.summary.netPosition >= 0 ? 'bg-blue-50' : 'bg-orange-50')}>
                  <p className={cn('text-sm font-bold', cashFlow.summary.netPosition >= 0 ? 'text-blue-700' : 'text-orange-700')}>
                    {formatCompact(cashFlow.summary.netPosition)}
                  </p>
                  <p className="text-xs text-muted-foreground">Ròng</p>
                </div>
              </div>
            </>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">
              Đang tải...
            </div>
          )}
        </Section>
      </div>

      {/* ========== ROW 6: HR + Overdue AR ========== */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* HR Stats */}
        <Section title="Nhân sự" href="/nhan-su">
          {hr ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-lg bg-blue-50">
                  <Users className="h-5 w-5 text-blue-600 mx-auto mb-1" />
                  <p className="text-xl font-bold">{hr.totalEmployees}</p>
                  <p className="text-xs text-muted-foreground">Tổng NV</p>
                </div>
                <div className="p-3 rounded-lg bg-green-50">
                  <p className="text-xl font-bold text-green-700">+{hr.newHires}</p>
                  <p className="text-xs text-muted-foreground">Mới tuyển</p>
                </div>
                <div className="p-3 rounded-lg bg-red-50">
                  <p className="text-xl font-bold text-red-700">-{hr.resigned}</p>
                  <p className="text-xs text-muted-foreground">Nghỉ việc</p>
                </div>
              </div>
              {hr.byDepartment.length > 0 && (
                <div className="space-y-1.5 pt-3 border-t">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Theo phòng ban:</p>
                  {hr.byDepartment.map((dept) => (
                    <div key={dept.department} className="flex items-center justify-between text-sm">
                      <span>{dept.department}</span>
                      <span className="font-medium">{dept.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Đang tải...</p>
          )}
        </Section>

        {/* Overdue AR + Pipeline Alerts */}
        <Section title="Cảnh báo quan trọng">
          <div className="space-y-4">
            {/* Overdue AR from pipeline */}
            {pipeline && pipeline.overdueAR.count > 0 && (
              <div className="flex items-start gap-3 p-3 rounded-lg border border-red-200 bg-red-50/50">
                <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800">Công nợ quá hạn</p>
                  <p className="text-xs text-red-600 mt-0.5">
                    {pipeline.overdueAR.count} khách hàng - Tổng: {formatCurrency(pipeline.overdueAR.totalOutstanding)}
                  </p>
                </div>
              </div>
            )}

            {/* VN arrivals needing notification */}
            {pipeline && pipeline.vnArrivalsNeedingNotification > 0 && (
              <div className="flex items-start gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50/50">
                <Package className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800">Hàng đến kho VN</p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    {pipeline.vnArrivalsNeedingNotification} kiện cần thông báo khách
                  </p>
                </div>
              </div>
            )}

            {/* SLA breaches */}
            {sla && sla.slaBreaches > 0 && (
              <div className="flex items-start gap-3 p-3 rounded-lg border border-orange-200 bg-orange-50/50">
                <Shield className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-orange-800">Vi phạm SLA</p>
                  <p className="text-xs text-orange-600 mt-0.5">
                    {sla.slaBreaches} đơn hàng vượt thời gian xử lý cho phép
                  </p>
                </div>
              </div>
            )}

            {/* Pending deposits */}
            {pipeline && pipeline.pendingDeposits.count > 0 && (
              <div className="flex items-start gap-3 p-3 rounded-lg border border-blue-200 bg-blue-50/50">
                <Wallet className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-800">Chờ đặt cọc</p>
                  <p className="text-xs text-blue-600 mt-0.5">
                    {pipeline.pendingDeposits.count} đơn - Tổng cọc: {formatCurrency(pipeline.pendingDeposits.totalDepositRequired)}
                  </p>
                </div>
              </div>
            )}

            {/* Pending vouchers */}
            {finance && finance.pendingVouchers > 0 && (
              <div className="flex items-start gap-3 p-3 rounded-lg border border-violet-200 bg-violet-50/50">
                <Clock className="h-5 w-5 text-violet-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-violet-800">Phiếu chờ duyệt</p>
                  <p className="text-xs text-violet-600 mt-0.5">
                    {finance.pendingVouchers} phiếu thu/chi cần phê duyệt
                  </p>
                </div>
              </div>
            )}

            {/* No alerts */}
            {(!pipeline || (pipeline.overdueAR.count === 0 && pipeline.vnArrivalsNeedingNotification === 0 && pipeline.pendingDeposits.count === 0)) &&
             (!sla || sla.slaBreaches === 0) &&
             (!finance || finance.pendingVouchers === 0) && (
              <div className="flex items-center gap-3 p-3 text-sm">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="text-muted-foreground">Không có cảnh báo nào</span>
              </div>
            )}
          </div>
        </Section>
      </div>

      {/* ========== ROW 7: Order by Service Type ========== */}
      {orderStats && orderStats.byServiceType.length > 0 && (
        <Section title="Đơn hàng theo loại dịch vụ" href="/don-hang">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {orderStats.byServiceType.map((item) => (
              <div key={item.serviceType} className="text-center p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                <p className="text-xl font-bold">{item.count}</p>
                <p className="text-xs text-muted-foreground mt-1">{item.serviceType}</p>
                <p className="text-[10px] text-muted-foreground">{formatCompact(item.totalAmount)}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

    </div>
  );
}
