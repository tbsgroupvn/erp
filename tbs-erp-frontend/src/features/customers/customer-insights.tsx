'use client';

import type { ElementType, ReactNode } from 'react';
import { TrendingUp, Clock, Calendar, DollarSign, ShoppingBag, BarChart2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCustomerAnalytics } from '@/lib/hooks/use-customers';
import { formatCurrency } from '@/lib/utils/format';
import { formatDate } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

// ---------------------------------------------------------------------------
// Churn risk configuration
// ---------------------------------------------------------------------------

type ChurnRisk = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

const CHURN_RISK_CONFIG: Record<
  ChurnRisk,
  { label: string; badgeClass: string; dotClass: string }
> = {
  LOW: {
    label: 'Thấp',
    badgeClass: 'bg-green-100 text-green-700 border-green-200',
    dotClass: 'bg-green-500',
  },
  MEDIUM: {
    label: 'Trung bình',
    badgeClass: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    dotClass: 'bg-yellow-500',
  },
  HIGH: {
    label: 'Cao',
    badgeClass: 'bg-orange-100 text-orange-700 border-orange-200',
    dotClass: 'bg-orange-500',
  },
  CRITICAL: {
    label: 'Nguy hiểm',
    badgeClass: 'bg-red-100 text-red-700 border-red-200',
    dotClass: 'bg-red-500',
  },
};

const SERVICE_TYPE_LABELS: Record<string, string> = {
  VCT: 'Vận chuyển thương mại',
  MHH: 'Mua hộ hàng',
  UTXNK: 'Ủy thác XNK',
  LCLCN: 'LCL container',
};

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

function InsightsSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="h-5 w-40 rounded bg-muted animate-pulse" />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-24 rounded bg-muted animate-pulse" />
              <div className="h-5 w-16 rounded bg-muted animate-pulse" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Individual metric cell
// ---------------------------------------------------------------------------

interface MetricCellProps {
  icon: ElementType;
  label: string;
  value: ReactNode;
  subtext?: string;
}

function MetricCell({ icon: Icon, label, value, subtext }: MetricCellProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span>{label}</span>
      </div>
      <div className="text-sm font-semibold leading-snug">{value}</div>
      {subtext && <div className="text-xs text-muted-foreground">{subtext}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface CustomerInsightsProps {
  customerId: string;
}

export function CustomerInsights({ customerId }: CustomerInsightsProps) {
  const { data: analytics, isLoading, isError } = useCustomerAnalytics(customerId);

  if (isLoading) {
    return <InsightsSkeleton />;
  }

  if (isError || !analytics) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" />
            Phân tích khách hàng
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Chưa có dữ liệu phân tích cho khách hàng này.</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const risk = analytics.churnRisk as ChurnRisk;
  const riskConfig = CHURN_RISK_CONFIG[risk] ?? CHURN_RISK_CONFIG.LOW;

  const serviceLabel =
    analytics.preferredServiceType
      ? (SERVICE_TYPE_LABELS[analytics.preferredServiceType] ?? analytics.preferredServiceType)
      : '---';

  const nextOrderDisplay = analytics.predictedNextOrderDate
    ? formatDate(analytics.predictedNextOrderDate)
    : '---';

  const daysSinceLabel =
    analytics.daysSinceLastOrder !== null && analytics.daysSinceLastOrder !== undefined
      ? `${analytics.daysSinceLastOrder} ngày`
      : '---';

  const avgIntervalLabel =
    analytics.avgOrderIntervalDays !== null && analytics.avgOrderIntervalDays !== undefined
      ? `${analytics.avgOrderIntervalDays} ngày`
      : '---';

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" />
            Phân tích khách hàng
          </CardTitle>

          {/* Churn risk badge */}
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
              riskConfig.badgeClass,
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', riskConfig.dotClass)} />
            Nguy cơ rời bỏ: {riskConfig.label}
          </span>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
          <MetricCell
            icon={Clock}
            label="Ngày từ đơn cuối"
            value={daysSinceLabel}
          />
          <MetricCell
            icon={BarChart2}
            label="Chu kỳ đặt hàng TB"
            value={avgIntervalLabel}
          />
          <MetricCell
            icon={Calendar}
            label="Dự kiến đặt tiếp"
            value={nextOrderDisplay}
          />
          <MetricCell
            icon={ShoppingBag}
            label="Đơn hàng (12 tháng)"
            value={analytics.totalOrdersLast12Months}
            subtext="đơn"
          />
          <MetricCell
            icon={DollarSign}
            label="CLV tích lũy"
            value={formatCurrency(analytics.clv)}
          />
          <MetricCell
            icon={DollarSign}
            label="Giá trị đơn TB"
            value={formatCurrency(analytics.avgOrderValue)}
          />
          <MetricCell
            icon={TrendingUp}
            label="Dịch vụ ưa dùng"
            value={serviceLabel}
          />
        </div>
      </CardContent>
    </Card>
  );
}
