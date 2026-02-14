'use client';

import { DollarSign, Receipt, TrendingUp, FileText } from 'lucide-react';
import { StatCard } from '@/components/shared/stat-card';
import { useDashboardOverview } from '@/lib/hooks/use-dashboard';
import { formatCurrency } from '@/lib/utils/format';

export function FinanceDashboard() {
  const { data } = useDashboardOverview();

  const finance = data?.finance;

  return (
    <div className="space-y-6">
      {/* Finance Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Công nợ phải thu"
          value={formatCurrency(finance?.totalReceivable ?? 0)}
          icon={DollarSign}
          description={`Quá hạn: ${formatCurrency(finance?.overdueReceivable ?? 0)}`}
        />
        <StatCard
          title="Công nợ phải trả"
          value={formatCurrency(finance?.totalPayable ?? 0)}
          icon={Receipt}
          description={`Quá hạn: ${formatCurrency(finance?.overduePayable ?? 0)}`}
        />
        <StatCard
          title="Dòng tiền hôm nay"
          value={formatCurrency((finance?.cashInToday ?? 0) - (finance?.cashOutToday ?? 0))}
          icon={TrendingUp}
          description={`Thu: ${formatCurrency(finance?.cashInToday ?? 0)} | Chi: ${formatCurrency(finance?.cashOutToday ?? 0)}`}
        />
        <StatCard
          title="Phiếu chờ duyệt"
          value={finance?.pendingVouchers ?? 0}
          icon={FileText}
        />
      </div>

      {/* Exchange rate */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4">Tỷ giá hiện tại</h3>
        <div className="flex items-center gap-8">
          <div>
            <p className="text-sm text-muted-foreground">CNY/VND</p>
            <p className="text-2xl font-bold">{finance?.exchangeRateCNY ?? '---'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
