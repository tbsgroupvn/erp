'use client';

import {
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const PIE_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#ec4899', '#6366f1',
];

interface PieDataPoint {
  name: string;
  value: number;
}

interface OrderStatusPieChartProps {
  data: PieDataPoint[];
}

export function OrderStatusPieChart({ data }: OrderStatusPieChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={80}
          dataKey="value"
          paddingAngle={2}
        >
          {data.map((_, idx) => (
            <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Legend verticalAlign="bottom" height={36} iconSize={8} wrapperStyle={{ fontSize: 10 }} />
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}
