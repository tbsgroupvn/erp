'use client';

import {
  DollarSign,
  Receipt,
  TrendingUp,
  TrendingDown,
  FileText,
  Activity,
  Clock,
} from 'lucide-react';
import { StatCard } from '@/components/shared/stat-card';
import { useFinanceStats, useCashFlowForecast } from '@/lib/hooks/use-dashboard';
import { formatCurrency } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

function formatCompact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} tỷ`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} tr`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)} k`;
  return n.toString();
}

export function FinanceDashboard() {
  const { data: finance } = useFinanceStats();
  const { data: cashFlow } = useCashFlowForecast({ days: 30 });

  return (
    <div className="space-y-6">
      {/* Finance Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Công nợ phải thu"
          value={formatCurrency(finance?.accountsReceivable?.totalOutstanding ?? 0)}
          icon={DollarSign}
          description={`Quá hạn: ${formatCurrency(finance?.accountsReceivable?.overdueAmount ?? 0)}`}
          variant="blue"
          href="/tai-chinh/cong-no-phai-thu"
        />
        <StatCard
          title="Công nợ phải trả"
          value={formatCurrency(finance?.accountsPayable?.totalOutstanding ?? 0)}
          icon={Receipt}
          description={`Quá hạn: ${formatCurrency(finance?.accountsPayable?.overdueAmount ?? 0)}`}
          variant="emerald"
          href="/tai-chinh/hoa-don"
        />
        <StatCard
          title="Dòng tiền ròng"
          value={formatCurrency(finance?.cashFlow?.netFlow ?? 0)}
          icon={finance?.cashFlow?.netFlow && finance.cashFlow.netFlow >= 0 ? TrendingUp : TrendingDown}
          description={`Thu: ${formatCompact(finance?.cashFlow?.monthlyInflow ?? 0)} | Chi: ${formatCompact(finance?.cashFlow?.monthlyOutflow ?? 0)}`}
          variant="amber"
          href="/tai-chinh/phieu-thu-chi"
        />
        <StatCard
          title="Phiếu chờ duyệt"
          value={finance?.pendingVouchers ?? 0}
          icon={FileText}
          variant="rose"
          href="/phe-duyet"
        />
      </div>

      {/* AR/AP Detail */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="section-card">
          <div className="section-card-header">
            <span className="text-sm font-semibold text-foreground/80 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              Chi tiết phải thu (AR)
            </span>
          </div>
          <div className="p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tổng còn lại:</span>
              <span className="font-medium">{formatCurrency(finance?.accountsReceivable?.totalOutstanding ?? 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Số hóa đơn mở:</span>
              <span className="font-medium">{finance?.accountsReceivable?.openCount ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Quá hạn:</span>
              <span className="font-medium text-red-600">{finance?.accountsReceivable?.overdueCount ?? 0} hóa đơn</span>
            </div>
          </div>
        </div>
        <div className="section-card">
          <div className="section-card-header">
            <span className="text-sm font-semibold text-foreground/80 flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-rose-600" />
              Chi tiết phải trả (AP)
            </span>
          </div>
          <div className="p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tổng còn lại:</span>
              <span className="font-medium">{formatCurrency(finance?.accountsPayable?.totalOutstanding ?? 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Số hóa đơn mở:</span>
              <span className="font-medium">{finance?.accountsPayable?.openCount ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Quá hạn:</span>
              <span className="font-medium text-red-600">{finance?.accountsPayable?.overdueCount ?? 0} hóa đơn</span>
            </div>
          </div>
        </div>
      </div>

      {/* Cash Flow Forecast */}
      {cashFlow && cashFlow.weeks.length > 0 && (
        <div className="section-card">
          <div className="section-card-header">
            <span className="text-sm font-semibold text-foreground/80 flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-600" />
              Dự báo dòng tiền 30 ngày
            </span>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 rounded-lg bg-green-50">
                <p className="text-lg font-bold text-green-700">{formatCompact(cashFlow.summary.totalInflow)}</p>
                <p className="text-xs text-muted-foreground">Tổng thu dự kiến</p>
              </div>
              <div className="p-3 rounded-lg bg-red-50">
                <p className="text-lg font-bold text-red-700">{formatCompact(cashFlow.summary.totalOutflow)}</p>
                <p className="text-xs text-muted-foreground">Tổng chi dự kiến</p>
              </div>
              <div className={cn('p-3 rounded-lg', cashFlow.summary.netPosition >= 0 ? 'bg-blue-50' : 'bg-orange-50')}>
                <p className={cn('text-lg font-bold', cashFlow.summary.netPosition >= 0 ? 'text-blue-700' : 'text-orange-700')}>
                  {formatCompact(cashFlow.summary.netPosition)}
                </p>
                <p className="text-xs text-muted-foreground">Dòng tiền ròng</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
