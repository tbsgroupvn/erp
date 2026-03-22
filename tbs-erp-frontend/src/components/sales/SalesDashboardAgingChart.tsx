'use client';

import {
  BarChart,
  Bar,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';

interface AgingBucket {
  range: string;
  count: number;
  amount: number;
  color: string;
}

interface Props {
  agingBuckets: AgingBucket[];
  formatCurrency: (amount: number) => string;
}

export default function SalesDashboardAgingChart({ agingBuckets, formatCurrency }: Props) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={agingBuckets}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="range" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip
          formatter={(value: number) => formatCurrency(value)}
          contentStyle={{ fontSize: 12 }}
        />
        <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
          {agingBuckets.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
