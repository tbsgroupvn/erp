'use client';

import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { formatCurrency } from '@/lib/utils/format';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BucketItem {
  name: string;
  value: number;
  color: string;
}

interface TrendItem {
  date: string;
  [key: string]: string | number;
}

// ---------------------------------------------------------------------------
// Aging Bar Chart
// ---------------------------------------------------------------------------

interface AgingBarChartProps {
  data: BucketItem[];
}

export function AgingBarChart({ data }: AgingBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="name"
          angle={-45}
          textAnchor="end"
          height={80}
        />
        <YAxis />
        <Tooltip
          formatter={(value) => formatCurrency(value as number)}
          labelStyle={{ color: '#000' }}
        />
        <Bar dataKey="value">
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------
// Aging Pie Chart
// ---------------------------------------------------------------------------

interface AgingPieChartProps {
  data: BucketItem[];
}

export function AgingPieChart({ data }: AgingPieChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          dataKey="value"
          label={({ name, percent }) =>
            `${name}: ${(percent * 100).toFixed(0)}%`
          }
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => formatCurrency(value as number)} />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------
// Aging Trend Line Chart
// ---------------------------------------------------------------------------

interface AgingTrendLineChartProps {
  data: TrendItem[];
  currentColor: string;
  overdueColor: string;
  currentKey?: string;
  overdueKey?: string;
}

export function AgingTrendLineChart({
  data,
  currentColor,
  overdueColor,
  currentKey = 'Chua den han',
  overdueKey = 'Qua han',
}: AgingTrendLineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip formatter={(value) => formatCurrency(value as number)} />
        <Legend />
        <Line
          type="monotone"
          dataKey={currentKey}
          stroke={currentColor}
          strokeWidth={2}
        />
        <Line
          type="monotone"
          dataKey={overdueKey}
          stroke={overdueColor}
          strokeWidth={2}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
