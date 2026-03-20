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
// Section wrapper — clean card with minimal header
// ---------------------------------------------------------------------------

function Section({ title, href, children }: { title: string; href?: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/50">
        <h3 className="text-sm font-semibold text-foreground font-heading">{title}</h3>
        {href && (
          <Link
            href={href}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Chi tiết <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Metric row — compact label/value pair used inside section bodies
// ---------------------------------------------------------------------------

function MetricRow({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string | number;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm border-b border-border/30 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('font-semibold tabular-nums', valueClass ?? 'text-foreground')}>
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Alert item — used in the alerts section
// ---------------------------------------------------------------------------

function AlertItem({
  icon: Icon,
  iconClass,
  borderClass,
  bgClass,
  title,
  titleClass,
  description,
  descClass,
}: {
  icon: typeof AlertTriangle;
  iconClass: string;
  borderClass: string;
  bgClass: string;
  title: string;
  titleClass: string;
  description: string;
  descClass: string;
}) {
  return (
    <div className={cn('flex items-start gap-3 p-3 rounded-lg border', borderClass, bgClass)}>
      <Icon className={cn('h-4 w-4 shrink-0 mt-0.5', iconClass)} />
      <div className="min-w-0">
        <p className={cn('text-xs font-semibold', titleClass)}>{title}</p>
        <p className={cn('text-xs mt-0.5 leading-snug', descClass)}>{description}</p>
      </div>
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
    <div className="space-y-5">

      {/* ========== TOOLBAR: Period Filter + Refresh ========== */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Period pill group */}
        <div className="flex gap-0.5 rounded-lg border border-border/60 bg-muted/40 p-1 w-fit">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handlePeriodChange(opt.value)}
              className={cn(
                'px-3 py-1 rounded-md text-xs font-medium transition-all duration-150',
                period === opt.value
                  ? 'bg-card text-foreground shadow-sm border border-border/60'
                  : 'text-muted-foreground hover:text-foreground hover:bg-card/60',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Custom date inputs */}
        {period === 'custom' && (
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-7 rounded-md border border-border/60 bg-card px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <span className="text-muted-foreground text-xs">-</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-7 rounded-md border border-border/60 bg-card px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        )}

        {/* Manual refresh + timestamp */}
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {lastRefresh.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border/60 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
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
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Sales Pipeline */}
        <div className="lg:col-span-2">
          <Section title="Sales Pipeline" href="/don-hang">
            {pipeline ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                  {[
                    { label: 'Tư vấn', value: pipeline.pipeline.consulting, color: 'text-blue-600 dark:text-blue-400', dot: 'bg-blue-500', href: '/don-hang?status=CONSULTING' },
                    { label: 'Báo giá', value: pipeline.pipeline.quotation, color: 'text-cyan-600 dark:text-cyan-400', dot: 'bg-cyan-500', href: '/bao-gia' },
                    { label: 'Chờ cọc', value: pipeline.pipeline.pendingDeposit, color: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500', href: '/don-hang?status=PENDING_DEPOSIT' },
                    { label: 'Mua hàng', value: pipeline.pipeline.sourcing, color: 'text-indigo-600 dark:text-indigo-400', dot: 'bg-indigo-500', href: '/don-hang?status=SOURCING' },
                    { label: 'Kho TQ', value: pipeline.pipeline.warehouseCN, color: 'text-violet-600 dark:text-violet-400', dot: 'bg-violet-500', href: '/kho-trung-quoc' },
                    { label: 'Vận chuyển', value: pipeline.pipeline.inTransit, color: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500', href: '/container' },
                    { label: 'Kho VN', value: pipeline.pipeline.warehouseVN, color: 'text-orange-600 dark:text-orange-400', dot: 'bg-orange-500', href: '/kho-viet-nam' },
                    { label: 'Đang giao', value: pipeline.pipeline.delivering, color: 'text-rose-600 dark:text-rose-400', dot: 'bg-rose-500', href: '/giao-hang' },
                    { label: 'Quyết toán', value: pipeline.pipeline.settlement, color: 'text-teal-600 dark:text-teal-400', dot: 'bg-teal-500', href: '/don-hang?status=SETTLEMENT' },
                    { label: 'Hoàn thành', value: pipeline.pipeline.completed, color: 'text-green-600 dark:text-green-400', dot: 'bg-green-500', href: '/don-hang?status=COMPLETED' },
                  ].map((s) => (
                    <Link
                      key={s.label}
                      href={s.href}
                      className="group flex flex-col items-center gap-1.5 p-3 rounded-lg border border-border/40 bg-muted/30 hover:bg-muted/70 hover:border-border/70 transition-all"
                    >
                      <div className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />
                      <p className={cn('text-xl font-bold tabular-nums font-heading leading-none', s.color)}>{s.value}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight text-center">{s.label}</p>
                    </Link>
                  ))}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border/50 text-xs text-muted-foreground">
                  <span>
                    Đang xử lý: <strong className="text-foreground font-semibold">{pipeline.pipeline.totalActive}</strong>
                  </span>
                  <span>
                    Chờ cọc: <strong className="text-amber-600 dark:text-amber-400 font-semibold">{formatCurrency(pipeline.pendingDeposits.totalDepositRequired)}</strong>
                    <span className="ml-1 text-muted-foreground">({pipeline.pendingDeposits.count} đơn)</span>
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
              {/* Compliance rate — hero metric */}
              <div className="flex items-end justify-between">
                <div>
                  <p className={cn(
                    'text-4xl font-bold font-heading tabular-nums leading-none',
                    sla.complianceRate >= 95 ? 'text-emerald-600 dark:text-emerald-400' :
                    sla.complianceRate >= 85 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
                  )}>
                    {sla.complianceRate.toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Tỉ lệ tuân thủ SLA</p>
                </div>
                <div className={cn(
                  'h-12 w-12 rounded-full flex items-center justify-center text-white text-xs font-bold',
                  sla.complianceRate >= 95 ? 'bg-emerald-500' :
                  sla.complianceRate >= 85 ? 'bg-amber-500' : 'bg-red-500'
                )}>
                  <Shield className="h-5 w-5" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-lg border border-border/40 bg-muted/30 text-center">
                  <p className="text-lg font-bold font-heading tabular-nums">{sla.totalActiveOrders}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Đơn đang xử lý</p>
                </div>
                <div className="p-3 rounded-lg border border-red-200/60 bg-red-50/50 dark:bg-red-950/20 text-center">
                  <p className="text-lg font-bold font-heading tabular-nums text-red-600 dark:text-red-400">{sla.slaBreaches}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Vi phạm SLA</p>
                </div>
              </div>

              {sla.breachedOrders.length > 0 && (
                <div className="space-y-1 pt-3 border-t border-border/50">
                  <p className="text-[10px] font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider mb-2">Đơn vi phạm:</p>
                  {sla.breachedOrders.slice(0, 5).map((o) => (
                    <div key={o.id} className="flex items-center justify-between text-xs py-1">
                      <Link href={`/don-hang/${o.id}`} className="text-primary hover:underline font-medium">
                        {o.code}
                      </Link>
                      <span className="text-muted-foreground tabular-nums">{o.daysSinceUpdate} ngày</span>
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
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* AR / AP */}
        <Section title="Tài chính - Công nợ" href="/tai-chinh/cong-no-phai-thu">
          {finance ? (
            <>
              <div className="grid grid-cols-2 gap-5">
                {/* AR */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                    <span className="text-xs font-semibold text-foreground">Phải thu (AR)</span>
                  </div>
                  <p className="text-xl font-bold font-heading tabular-nums mb-3">
                    {formatCurrency(finance.accountsReceivable.totalOutstanding)}
                  </p>
                  <div className="space-y-0.5">
                    <MetricRow
                      label="Quá hạn"
                      value={formatCurrency(finance.accountsReceivable.overdueAmount)}
                      valueClass="text-red-600 dark:text-red-400"
                    />
                    <MetricRow
                      label="Hóa đơn mở"
                      value={finance.accountsReceivable.openCount}
                    />
                    <MetricRow
                      label="Quá hạn (HĐ)"
                      value={finance.accountsReceivable.overdueCount}
                      valueClass="text-red-600 dark:text-red-400"
                    />
                  </div>
                </div>
                {/* AP */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="h-2 w-2 rounded-full bg-rose-500" />
                    <span className="text-xs font-semibold text-foreground">Phải trả (AP)</span>
                  </div>
                  <p className="text-xl font-bold font-heading tabular-nums mb-3">
                    {formatCurrency(finance.accountsPayable.totalOutstanding)}
                  </p>
                  <div className="space-y-0.5">
                    <MetricRow
                      label="Quá hạn"
                      value={formatCurrency(finance.accountsPayable.overdueAmount)}
                      valueClass="text-red-600 dark:text-red-400"
                    />
                    <MetricRow
                      label="Hóa đơn mở"
                      value={finance.accountsPayable.openCount}
                    />
                    <MetricRow
                      label="Quá hạn (HĐ)"
                      value={finance.accountsPayable.overdueCount}
                      valueClass="text-red-600 dark:text-red-400"
                    />
                  </div>
                </div>
              </div>

              {/* Cash Flow Summary */}
              <div className="mt-4 pt-4 border-t border-border/50">
                <div className="flex items-center gap-1.5 mb-3">
                  <Activity className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-xs font-semibold text-foreground">Dòng tiền tháng</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2.5 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/50 text-center">
                    <p className="text-sm font-bold font-heading tabular-nums text-emerald-700 dark:text-emerald-400">
                      {formatCompact(finance.cashFlow.monthlyInflow)}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Thu ({finance.cashFlow.inflowCount})</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-red-50/80 dark:bg-red-950/30 border border-red-200/50 text-center">
                    <p className="text-sm font-bold font-heading tabular-nums text-red-700 dark:text-red-400">
                      {formatCompact(finance.cashFlow.monthlyOutflow)}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Chi ({finance.cashFlow.outflowCount})</p>
                  </div>
                  <div className={cn(
                    'p-2.5 rounded-lg border text-center',
                    finance.cashFlow.netFlow >= 0
                      ? 'bg-blue-50/80 dark:bg-blue-950/30 border-blue-200/50'
                      : 'bg-orange-50/80 dark:bg-orange-950/30 border-orange-200/50'
                  )}>
                    <p className={cn(
                      'text-sm font-bold font-heading tabular-nums',
                      finance.cashFlow.netFlow >= 0 ? 'text-blue-700 dark:text-blue-400' : 'text-orange-700 dark:text-orange-400'
                    )}>
                      {formatCompact(finance.cashFlow.netFlow)}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Ròng</p>
                  </div>
                </div>
                {finance.pendingVouchers > 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2.5 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {finance.pendingVouchers} phiếu thu/chi chờ duyệt
                  </p>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Đang tải...</p>
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
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Warehouse Pipeline */}
        <div className="lg:col-span-2">
          <Section title="Pipeline Kho hàng" href="/kho-trung-quoc">
            {warehouse ? (
              <div className="space-y-4">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                  {PIPELINE_STAGES.map((stage, i) => {
                    const count = warehouse[stage.key as keyof typeof warehouse] as number ?? 0;
                    return (
                      <div key={stage.key} className="flex items-center gap-1.5 shrink-0">
                        {i > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />}
                        <Link
                          href={stage.href}
                          className="group flex flex-col items-center gap-1 min-w-[68px] p-2.5 rounded-lg border border-border/40 bg-muted/30 hover:bg-muted/70 hover:border-border/70 transition-all text-center"
                        >
                          <div className={cn('h-1 rounded-full w-6', stage.color)} />
                          <p className="text-lg font-bold font-heading tabular-nums leading-tight">{count}</p>
                          <p className="text-[10px] text-muted-foreground leading-tight">{stage.label}</p>
                        </Link>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-border/50">
                  <span>
                    Tổng kiện: <strong className="text-foreground font-semibold">{warehouse.pipeline?.total ?? 0}</strong>
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
              <OrderStatusPieChart
                data={orderStats.byStatus
                  .filter((s) => s.count > 0)
                  .map((s) => ({
                    name: ORDER_STATUS_LABELS[s.status as OrderStatus] || s.status,
                    value: s.count,
                  }))}
              />
            </div>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">
              Đang tải...
            </div>
          )}
          {orderStats && (
            <div className="flex justify-between text-xs text-muted-foreground pt-3 border-t border-border/50 mt-2">
              <span>Đang xử lý: <strong className="text-foreground font-semibold">{orderStats.activeOrders}</strong></span>
              <span>Chờ cọc: <strong className="text-amber-600 dark:text-amber-400 font-semibold">{orderStats.pendingDeposit}</strong></span>
            </div>
          )}
        </Section>
      </div>

      {/* ========== ROW 5: Margin by Route + Cash Flow Forecast ========== */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Margin by Route */}
        <Section title="Biên lợi nhuận theo tuyến" href="/bao-cao/tai-chinh">
          {margins && margins.routes.length > 0 ? (
            <>
              <div className="h-[250px]">
                <MarginBarChart
                  data={margins.routes.map((r) => ({
                    route: r.route,
                    revenue: r.revenue,
                    cost: r.cost,
                    margin: r.marginPercent,
                  }))}
                />
              </div>
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border/50 mt-2">
                {margins.routes.map((r) => (
                  <div key={r.route} className="text-center p-2 rounded-lg border border-border/40 bg-muted/30">
                    <p className="text-[10px] text-muted-foreground mb-0.5">{r.route}</p>
                    <p className={cn(
                      'text-sm font-bold font-heading tabular-nums',
                      r.marginPercent >= 20 ? 'text-emerald-600 dark:text-emerald-400' :
                      r.marginPercent >= 10 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
                    )}>
                      {r.marginPercent.toFixed(1)}%
                    </p>
                    <p className="text-[10px] text-muted-foreground">{r.orderCount} đơn</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">
              Đang tải...
            </div>
          )}
        </Section>

        {/* Cash Flow Forecast */}
        <Section title="Dự báo dòng tiền 30 ngày" href="/tai-chinh/phieu-thu-chi">
          {cashFlow && cashFlow.weeks.length > 0 ? (
            <>
              <div className="h-[250px]">
                <CashFlowBarChart
                  data={cashFlow.weeks.map((w) => ({
                    week: w.weekStart.slice(5),
                    inflow: w.inflow,
                    outflow: -w.outflow,
                    net: w.netPosition,
                  }))}
                />
              </div>
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border/50 mt-2">
                <div className="p-2.5 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/50 text-center">
                  <p className="text-sm font-bold font-heading tabular-nums text-emerald-700 dark:text-emerald-400">
                    {formatCompact(cashFlow.summary.totalInflow)}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Tổng thu</p>
                </div>
                <div className="p-2.5 rounded-lg bg-red-50/80 dark:bg-red-950/30 border border-red-200/50 text-center">
                  <p className="text-sm font-bold font-heading tabular-nums text-red-700 dark:text-red-400">
                    {formatCompact(cashFlow.summary.totalOutflow)}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Tổng chi</p>
                </div>
                <div className={cn(
                  'p-2.5 rounded-lg border text-center',
                  cashFlow.summary.netPosition >= 0
                    ? 'bg-blue-50/80 dark:bg-blue-950/30 border-blue-200/50'
                    : 'bg-orange-50/80 dark:bg-orange-950/30 border-orange-200/50'
                )}>
                  <p className={cn(
                    'text-sm font-bold font-heading tabular-nums',
                    cashFlow.summary.netPosition >= 0 ? 'text-blue-700 dark:text-blue-400' : 'text-orange-700 dark:text-orange-400'
                  )}>
                    {formatCompact(cashFlow.summary.netPosition)}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Ròng</p>
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

      {/* ========== ROW 6: HR + Alerts ========== */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* HR Stats */}
        <Section title="Nhân sự" href="/nhan-su">
          {hr ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2.5">
                <div className="p-3 rounded-lg border border-blue-200/60 bg-blue-50/60 dark:bg-blue-950/20 text-center">
                  <p className="text-xl font-bold font-heading tabular-nums text-blue-700 dark:text-blue-400">{hr.totalEmployees}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Tổng NV</p>
                </div>
                <div className="p-3 rounded-lg border border-emerald-200/60 bg-emerald-50/60 dark:bg-emerald-950/20 text-center">
                  <p className="text-xl font-bold font-heading tabular-nums text-emerald-700 dark:text-emerald-400">+{hr.newHires}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Mới tuyển</p>
                </div>
                <div className="p-3 rounded-lg border border-red-200/60 bg-red-50/60 dark:bg-red-950/20 text-center">
                  <p className="text-xl font-bold font-heading tabular-nums text-red-700 dark:text-red-400">-{hr.resigned}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Nghỉ việc</p>
                </div>
              </div>
              {hr.byDepartment.length > 0 && (
                <div className="pt-3 border-t border-border/50">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Theo phòng ban</p>
                  <div className="space-y-0.5">
                    {hr.byDepartment.map((dept) => (
                      <MetricRow key={dept.department} label={dept.department} value={dept.count} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Đang tải...</p>
          )}
        </Section>

        {/* Alerts */}
        <Section title="Cảnh báo quan trọng">
          <div className="space-y-2.5">
            {pipeline && pipeline.overdueAR.count > 0 && (
              <AlertItem
                icon={AlertTriangle}
                iconClass="text-red-500"
                borderClass="border-red-200/60"
                bgClass="bg-red-50/50 dark:bg-red-950/20"
                title="Công nợ quá hạn"
                titleClass="text-red-800 dark:text-red-300"
                description={`${pipeline.overdueAR.count} khách hàng — Tổng: ${formatCurrency(pipeline.overdueAR.totalOutstanding)}`}
                descClass="text-red-600 dark:text-red-400"
              />
            )}

            {pipeline && pipeline.vnArrivalsNeedingNotification > 0 && (
              <AlertItem
                icon={Package}
                iconClass="text-amber-500"
                borderClass="border-amber-200/60"
                bgClass="bg-amber-50/50 dark:bg-amber-950/20"
                title="Hàng đến kho VN"
                titleClass="text-amber-800 dark:text-amber-300"
                description={`${pipeline.vnArrivalsNeedingNotification} kiện cần thông báo khách`}
                descClass="text-amber-600 dark:text-amber-400"
              />
            )}

            {sla && sla.slaBreaches > 0 && (
              <AlertItem
                icon={Shield}
                iconClass="text-orange-500"
                borderClass="border-orange-200/60"
                bgClass="bg-orange-50/50 dark:bg-orange-950/20"
                title="Vi phạm SLA"
                titleClass="text-orange-800 dark:text-orange-300"
                description={`${sla.slaBreaches} đơn hàng vượt thời gian xử lý cho phép`}
                descClass="text-orange-600 dark:text-orange-400"
              />
            )}

            {pipeline && pipeline.pendingDeposits.count > 0 && (
              <AlertItem
                icon={Wallet}
                iconClass="text-blue-500"
                borderClass="border-blue-200/60"
                bgClass="bg-blue-50/50 dark:bg-blue-950/20"
                title="Chờ đặt cọc"
                titleClass="text-blue-800 dark:text-blue-300"
                description={`${pipeline.pendingDeposits.count} đơn — Tổng cọc: ${formatCurrency(pipeline.pendingDeposits.totalDepositRequired)}`}
                descClass="text-blue-600 dark:text-blue-400"
              />
            )}

            {finance && finance.pendingVouchers > 0 && (
              <AlertItem
                icon={Clock}
                iconClass="text-violet-500"
                borderClass="border-violet-200/60"
                bgClass="bg-violet-50/50 dark:bg-violet-950/20"
                title="Phiếu chờ duyệt"
                titleClass="text-violet-800 dark:text-violet-300"
                description={`${finance.pendingVouchers} phiếu thu/chi cần phê duyệt`}
                descClass="text-violet-600 dark:text-violet-400"
              />
            )}

            {(!pipeline || (pipeline.overdueAR.count === 0 && pipeline.vnArrivalsNeedingNotification === 0 && pipeline.pendingDeposits.count === 0)) &&
             (!sla || sla.slaBreaches === 0) &&
             (!finance || finance.pendingVouchers === 0) && (
              <div className="flex items-center gap-2.5 p-3 rounded-lg border border-emerald-200/60 bg-emerald-50/40 dark:bg-emerald-950/20">
                <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="text-xs text-muted-foreground">Không có cảnh báo nào</span>
              </div>
            )}
          </div>
        </Section>
      </div>

      {/* ========== ROW 7: Order by Service Type ========== */}
      {orderStats && orderStats.byServiceType.length > 0 && (
        <Section title="Đơn hàng theo loại dịch vụ" href="/don-hang">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {orderStats.byServiceType.map((item) => (
              <div
                key={item.serviceType}
                className="text-center p-3 rounded-lg border border-border/40 bg-muted/30 hover:bg-muted/60 transition-colors"
              >
                <p className="text-xl font-bold font-heading tabular-nums">{item.count}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-tight">{item.serviceType}</p>
                <p className="text-[10px] text-muted-foreground/70 mt-0.5 tabular-nums">{formatCompact(item.totalAmount)}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

    </div>
  );
}
