'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSalesReport } from '@/lib/hooks/use-reports';
import { formatCurrency } from '@/lib/utils/format';
import type { ReportQueryParams } from '@/lib/api/report.api';

export default function BaoCaoDoanhSoPage() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [branch, setBranch] = useState('all');

  const params: ReportQueryParams = {
    ...(dateFrom && { dateFrom }),
    ...(dateTo && { dateTo }),
    ...(branch !== 'all' && { branch }),
  };

  const { data, isLoading, refetch } = useSalesReport(params);

  return (
    <div>
      <PageHeader
        title="Báo cáo doanh số"
        description="Thống kê doanh số bán hàng theo nhân viên và chi nhánh"
      />

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label htmlFor="dateFrom">Từ ngày</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-44"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="dateTo">Đến ngày</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-44"
              />
            </div>
            <div className="space-y-1">
              <Label>Chi nhánh</Label>
              <Select value={branch} onValueChange={setBranch}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Chọn chi nhánh" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  <SelectItem value="HN">Hà Nội</SelectItem>
                  <SelectItem value="HCM">Hồ Chí Minh</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => refetch()} variant="outline">
              Làm mới
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading */}
      {isLoading && (
        <p className="text-sm text-muted-foreground py-4">Đang tải...</p>
      )}

      {/* Summary cards */}
      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Tổng đơn hàng
                </CardTitle>
                <p className="text-2xl font-bold mt-1">{data.totalOrders}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Tổng doanh thu
                </CardTitle>
                <p className="text-2xl font-bold mt-1">
                  {formatCurrency(data.totalRevenue)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Tổng lợi nhuận
                </CardTitle>
                <p className="text-2xl font-bold mt-1">
                  {formatCurrency(data.totalProfit)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Giá trị đơn TB
                </CardTitle>
                <p className="text-2xl font-bold mt-1">
                  {formatCurrency(data.averageOrderValue)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Sales by employee table */}
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base">
                Doanh số theo nhân viên
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 font-medium">
                        Nhân viên
                      </th>
                      <th className="text-left py-2 px-3 font-medium">
                        Số đơn hàng
                      </th>
                      <th className="text-left py-2 px-3 font-medium">
                        Doanh thu
                      </th>
                      <th className="text-left py-2 px-3 font-medium">
                        Lợi nhuận
                      </th>
                      <th className="text-left py-2 px-3 font-medium">
                        Tỉ lệ chuyển đổi (%)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="text-center py-4 text-muted-foreground"
                        >
                          Không có dữ liệu
                        </td>
                      </tr>
                    ) : (
                      data.items.map((item) => (
                        <tr
                          key={item.employeeId}
                          className="border-b last:border-b-0 hover:bg-muted/50"
                        >
                          <td className="py-2 px-3">{item.employeeName}</td>
                          <td className="py-2 px-3">{item.totalOrders}</td>
                          <td className="py-2 px-3">
                            {formatCurrency(item.totalRevenue)}
                          </td>
                          <td className="py-2 px-3">
                            {formatCurrency(item.totalProfit)}
                          </td>
                          <td className="py-2 px-3">
                            {item.conversionRate.toFixed(2)}%
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
