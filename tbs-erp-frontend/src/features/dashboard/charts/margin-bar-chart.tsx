'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { formatCurrency } from '@/lib/utils/format';

function formatCompact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} ty`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} tr`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)} k`;
  return n.toString();
}

interface MarginDataPoint {
  route: string;
  revenue: number;
  cost: number;
  margin: number;
}

interface MarginBarChartProps {
  data: MarginDataPoint[];
}

export function MarginBarChart({ data }: MarginBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="route" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={(v: number) => formatCompact(v)} tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(value: number, name: string) =>
            name === 'margin' ? `${value.toFixed(1)}%` : formatCurrency(value)
          }
        />
        <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="revenue" name="Doanh thu" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        <Bar dataKey="cost" name="Chi phi" fill="#f87171" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
