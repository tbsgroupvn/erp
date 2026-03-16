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

interface CashFlowDataPoint {
  week: string;
  inflow: number;
  outflow: number;
  net: number;
}

interface CashFlowBarChartProps {
  data: CashFlowDataPoint[];
}

export function CashFlowBarChart({ data }: CashFlowBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="week" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={(v: number) => formatCompact(Math.abs(v))} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(value: number) => formatCurrency(Math.abs(value))} />
        <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="inflow" name="Thu" fill="#22c55e" radius={[4, 4, 0, 0]} stackId="flow" />
        <Bar dataKey="outflow" name="Chi" fill="#ef4444" radius={[0, 0, 4, 4]} stackId="flow" />
      </BarChart>
    </ResponsiveContainer>
  );
}
