'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { useCustomerTrend } from '@/lib/hooks/use-customers';
import { formatCurrency } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { TrendingUp } from 'lucide-react';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CustomerTrendChartProps {
  customerId: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function compactVnd(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}tỷ`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}tr`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CustomerTrendChart({ customerId, className }: CustomerTrendChartProps) {
  const { data, isLoading } = useCustomerTrend(customerId);

  if (isLoading) {
    return <Skeleton className={cn('h-[300px] rounded-xl', className)} />;
  }

  if (!data || data.months.length === 0) {
    return (
      <div
        className={cn(
          'h-[300px] rounded-xl border bg-muted/30 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground',
          className,
        )}
      >
        <TrendingUp className="h-8 w-8 opacity-30" />
        <p>Chưa có dữ liệu xu hướng</p>
      </div>
    );
  }

  const chartData = data.months.map((m) => ({
    label: m.label,
    'Đơn hàng': m.orderCount,
    'Doanh thu': m.revenue,
    'TB/đơn': m.avgOrderValue,
  }));

  // Summary stats
  const totalRevenue = data.months.reduce((s, m) => s + m.revenue, 0);
  const totalOrders = data.months.reduce((s, m) => s + m.orderCount, 0);
  const avgPerOrder =
    totalOrders > 0 ? totalRevenue / totalOrders : 0;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Summary badges */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-blue-50 p-3 text-center">
          <p className="text-lg font-bold text-blue-700">{totalOrders}</p>
          <p className="text-xs text-muted-foreground">Tổng đơn (12 tháng)</p>
        </div>
        <div className="rounded-lg border bg-emerald-50 p-3 text-center">
          <p className="text-lg font-bold text-emerald-700">{compactVnd(totalRevenue)}</p>
          <p className="text-xs text-muted-foreground">Tổng doanh thu</p>
        </div>
        <div className="rounded-lg border bg-violet-50 p-3 text-center">
          <p className="text-lg font-bold text-violet-700">{compactVnd(avgPerOrder)}</p>
          <p className="text-xs text-muted-foreground">Trung bình/đơn</p>
        </div>
      </div>

      {/* Revenue + order count chart */}
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="grad-revenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.01} />
              </linearGradient>
              <linearGradient id="grad-avg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="currentColor"
              className="text-muted/50"
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              yAxisId="revenue"
              tickFormatter={compactVnd}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              width={48}
            />
            <YAxis
              yAxisId="orders"
              orientation="right"
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              width={32}
            />
            <Tooltip
              formatter={(value: number, name: string) =>
                name === 'Đơn hàng'
                  ? [`${value} đơn`, name]
                  : [formatCurrency(value), name]
              }
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: '1px solid hsl(var(--border))',
                background: 'hsl(var(--background))',
              }}
            />
            <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />

            <Area
              yAxisId="revenue"
              type="monotone"
              dataKey="Doanh thu"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#grad-revenue)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: '#10b981' }}
            />
            <Area
              yAxisId="revenue"
              type="monotone"
              dataKey="TB/đơn"
              stroke="#8b5cf6"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              fill="url(#grad-avg)"
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0, fill: '#8b5cf6' }}
            />
            <Area
              yAxisId="orders"
              type="monotone"
              dataKey="Đơn hàng"
              stroke="#3b82f6"
              strokeWidth={1.5}
              fill="transparent"
              dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }}
              activeDot={{ r: 4, strokeWidth: 0, fill: '#3b82f6' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
