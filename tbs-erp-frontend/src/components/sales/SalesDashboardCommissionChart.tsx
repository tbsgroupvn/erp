'use client';

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

interface CommissionItem {
  name: string;
  value: number;
  color: string;
}

interface Props {
  commissionSummary: CommissionItem[];
  formatCurrency: (amount: number) => string;
}

export default function SalesDashboardCommissionChart({ commissionSummary, formatCurrency }: Props) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie
          data={commissionSummary}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={90}
          paddingAngle={5}
          dataKey="value"
          label={(entry) => `${formatCurrency(entry.value)}`}
          labelLine={false}
        >
          {commissionSummary.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip formatter={(value: number) => formatCurrency(value)} />
      </PieChart>
    </ResponsiveContainer>
  );
}
