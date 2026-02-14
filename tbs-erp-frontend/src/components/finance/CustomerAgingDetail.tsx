'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, TrendingUp } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import { useCustomerAging, useCustomerAgingTrend } from '@/lib/hooks/use-ar-aging';
import { formatCurrency } from '@/lib/utils/format';

interface CustomerAgingDetailProps {
  customerId: string;
}

const COLORS = {
  current: '#10B981',
  days1_30: '#3B82F6',
  days31_60: '#F59E0B',
  days61_90: '#EF4444',
  days90Plus: '#991B1B',
};

const RISK_LEVEL_CONFIG = {
  LOW: { label: 'Thấp', variant: 'default' as const, color: 'text-green-600' },
  MEDIUM: { label: 'Trung bình', variant: 'secondary' as const, color: 'text-yellow-600' },
  HIGH: { label: 'Cao', variant: 'destructive' as const, color: 'text-orange-600' },
  CRITICAL: { label: 'Nghiêm trọng', variant: 'destructive' as const, color: 'text-red-600' },
};

export function CustomerAgingDetail({ customerId }: CustomerAgingDetailProps) {
  const { data: aging, isLoading: agingLoading } = useCustomerAging(customerId);
  const { data: trend, isLoading: trendLoading } = useCustomerAgingTrend(customerId, 30);

  if (agingLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!aging) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Không có dữ liệu</AlertTitle>
        <AlertDescription>
          Khách hàng này chưa có công nợ phải thu.
        </AlertDescription>
      </Alert>
    );
  }

  const riskConfig = RISK_LEVEL_CONFIG[aging.riskLevel];

  const bucketData = [
    { name: 'Chưa đến hạn', value: aging.aging.current, count: aging.counts.current, color: COLORS.current },
    { name: '1-30 ngày', value: aging.aging.days1_30, count: aging.counts.days1_30, color: COLORS.days1_30 },
    { name: '31-60 ngày', value: aging.aging.days31_60, count: aging.counts.days31_60, color: COLORS.days31_60 },
    { name: '61-90 ngày', value: aging.aging.days61_90, count: aging.counts.days61_90, color: COLORS.days61_90 },
    { name: '90+ ngày', value: aging.aging.days90Plus, count: aging.counts.days90Plus, color: COLORS.days90Plus },
  ];

  const trendData = trend?.map((t: any) => ({
    date: new Date(t.snapshotDate).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
    }),
    'Chưa đến hạn': t.current,
    'Quá hạn': t.days1_30 + t.days31_60 + t.days61_90 + t.days90Plus,
  })) || [];

  return (
    <div className="space-y-6">
      {/* Risk Alert */}
      {aging.shouldBlock && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Cảnh báo chặn khách hàng</AlertTitle>
          <AlertDescription>
            {aging.blockReason}
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Tổng công nợ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(aging.aging.totalOutstanding)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Công nợ quá hạn</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(aging.aging.totalOverdue)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {aging.maxOverdueDays > 0 ? `Tối đa ${aging.maxOverdueDays} ngày` : 'Không có'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Mức độ rủi ro</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge variant={riskConfig.variant} className="text-base">
                {riskConfig.label}
              </Badge>
              <TrendingUp className={`h-5 w-5 ${riskConfig.color}`} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Aging Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Phân bố công nợ theo độ tuổi</CardTitle>
          <CardDescription>Số lượng và giá trị công nợ theo từng nhóm</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={bucketData}>
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
              <Bar dataKey="value" name="Giá trị">
                {bucketData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Bucket Summary Table */}
          <div className="mt-4 space-y-2">
            {bucketData.map((bucket) => (
              <div
                key={bucket.name}
                className="flex items-center justify-between p-2 border rounded"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: bucket.color }}
                  />
                  <span className="font-medium">{bucket.name}</span>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{formatCurrency(bucket.value)}</div>
                  <div className="text-xs text-muted-foreground">
                    {bucket.count} phiếu
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Xu hướng 30 ngày</CardTitle>
          <CardDescription>
            Biến động công nợ của khách hàng theo thời gian
          </CardDescription>
        </CardHeader>
        <CardContent>
          {trendLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(value as number)} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="Chưa đến hạn"
                  stroke={COLORS.current}
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="Quá hạn"
                  stroke={COLORS.days61_90}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <Alert>
              <AlertDescription>
                Chưa có dữ liệu xu hướng (cần ít nhất 1 ngày dữ liệu lịch sử)
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
