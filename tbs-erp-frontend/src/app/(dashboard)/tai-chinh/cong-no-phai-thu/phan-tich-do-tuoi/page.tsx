'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertCircle,
  TrendingUp,
  DollarSign,
  Clock,
  Users,
  AlertTriangle
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { useAgingSummary, useAgingTrends, useHighRiskCustomers } from '@/lib/hooks/use-ar-aging';
import { formatCurrency } from '@/lib/utils/format';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const COLORS = {
  current: '#10B981',
  days1_30: '#3B82F6',
  days31_60: '#F59E0B',
  days61_90: '#EF4444',
  days90Plus: '#991B1B',
};

export default function ARAgingDashboardPage() {
  const { data: summary, isLoading: summaryLoading } = useAgingSummary();
  const { data: trends, isLoading: trendsLoading } = useAgingTrends(30);
  const { data: highRisk, isLoading: highRiskLoading } = useHighRiskCustomers();

  // Prepare chart data
  const bucketData = summary ? [
    { name: 'Chưa đến hạn', value: summary.current, color: COLORS.current },
    { name: '1-30 ngày', value: summary.days1_30, color: COLORS.days1_30 },
    { name: '31-60 ngày', value: summary.days31_60, color: COLORS.days31_60 },
    { name: '61-90 ngày', value: summary.days61_90, color: COLORS.days61_90 },
    { name: '90+ ngày', value: summary.days90Plus, color: COLORS.days90Plus },
  ] : [];

  const trendData = trends?.map((t) => ({
    date: new Date(t.snapshotDate).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit'
    }),
    'Chưa đến hạn': t.current,
    'Quá hạn': t.days1_30 + t.days31_60 + t.days61_90 + t.days90Plus,
  })) || [];

  const totalOverdue = summary
    ? summary.days1_30 + summary.days31_60 + summary.days61_90 + summary.days90Plus
    : 0;

  const overduePercentage = summary && summary.totalOutstanding > 0
    ? Math.round((totalOverdue / summary.totalOutstanding) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Phân tích Độ tuổi Công nợ</h1>
        <p className="text-muted-foreground mt-1">
          Theo dõi và quản lý công nợ khách hàng theo thời gian
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng công nợ</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-8 w-full" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {formatCurrency(summary?.totalOutstanding || 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Tổng công nợ phải thu
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quá hạn</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-8 w-full" />
            ) : (
              <>
                <div className="text-2xl font-bold text-orange-600">
                  {formatCurrency(totalOverdue)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {overduePercentage}% tổng công nợ
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">KH Rủi ro cao</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {highRiskLoading ? (
              <Skeleton className="h-8 w-full" />
            ) : (
              <>
                <div className="text-2xl font-bold text-red-600">
                  {highRisk?.length || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Cần chú ý theo dõi
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quá hạn nghiêm trọng</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-8 w-full" />
            ) : (
              <>
                <div className="text-2xl font-bold text-red-700">
                  {formatCurrency(summary?.days90Plus || 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Quá hạn &gt;90 ngày
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Aging Distribution - Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Phân bố theo độ tuổi</CardTitle>
            <CardDescription>Công nợ được chia theo các nhóm độ tuổi</CardDescription>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={bucketData}>
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
                    {bucketData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Aging Proportion - Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Tỷ lệ công nợ</CardTitle>
            <CardDescription>Phần trăm công nợ theo độ tuổi</CardDescription>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={bucketData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name}: ${(percent * 100).toFixed(0)}%`
                    }
                  >
                    {bucketData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value as number)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Trend Line Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Xu hướng 30 ngày</CardTitle>
          <CardDescription>Biến động công nợ theo thời gian</CardDescription>
        </CardHeader>
        <CardContent>
          {trendsLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : (
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
          )}
        </CardContent>
      </Card>

      {/* High Risk Customers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Khách hàng rủi ro cao</CardTitle>
          <CardDescription>
            Danh sách khách hàng có mức độ rủi ro HIGH hoặc CRITICAL
          </CardDescription>
        </CardHeader>
        <CardContent>
          {highRiskLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : highRisk && highRisk.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã KH</TableHead>
                  <TableHead>Tên khách hàng</TableHead>
                  <TableHead>Mức độ</TableHead>
                  <TableHead className="text-right">Tổng công nợ</TableHead>
                  <TableHead className="text-right">Quá hạn</TableHead>
                  <TableHead className="text-right">&gt;90 ngày</TableHead>
                  <TableHead>Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {highRisk.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.customer?.code}
                    </TableCell>
                    <TableCell>{item.customer?.fullName}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          item.riskLevel === 'CRITICAL'
                            ? 'destructive'
                            : 'default'
                        }
                      >
                        {item.riskLevel === 'CRITICAL' ? 'Nghiêm trọng' : 'Cao'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(item.totalOutstanding)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(item.totalOverdue)}
                    </TableCell>
                    <TableCell className="text-right text-red-600">
                      {formatCurrency(item.days90Plus)}
                    </TableCell>
                    <TableCell>
                      {item.customer?.isBlocked ? (
                        <Badge variant="destructive">Đã chặn</Badge>
                      ) : (
                        <Badge variant="outline">Hoạt động</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Không có khách hàng rủi ro cao
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
