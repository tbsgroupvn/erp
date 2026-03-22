'use client';

import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import { formatCurrency } from '@/lib/utils/format';

// ---------------------------------------------------------------------------
// Aging Distribution Bar Chart
// ---------------------------------------------------------------------------

interface BucketDataItem {
  name: string;
  value: number;
  count: number;
  color: string;
}

interface AgingDistributionChartProps {
  data: BucketDataItem[];
}

export function AgingDistributionChart({ data }: AgingDistributionChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
        <YAxis />
        <Tooltip
          formatter={(value, name) => {
            if (name === 'value') {
              return formatCurrency(value as number);
            }
            return value;
          }}
          labelStyle={{ color: '#000' }}
        />
        <Legend />
        <Bar dataKey="value" name="Gia tri">
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------
// Aging Trend Line Chart
// ---------------------------------------------------------------------------

interface TrendDataItem {
  date: string;
  [key: string]: string | number;
}

interface AgingTrendChartProps {
  data: TrendDataItem[];
  currentColor: string;
  overdueColor: string;
  currentKey?: string;
  overdueKey?: string;
}

export function AgingTrendChart({
  data,
  currentColor,
  overdueColor,
  currentKey = 'Chua den han',
  overdueKey = 'Qua han',
}: AgingTrendChartProps) {
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
