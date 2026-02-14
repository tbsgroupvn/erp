'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFinancialReport } from '@/lib/hooks/use-reports';
import { formatCurrency } from '@/lib/utils/format';
import type { ReportQueryParams } from '@/lib/api/report.api';

export default function BaoCaoTaiChinhPage() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const params: ReportQueryParams = {
    ...(dateFrom && { dateFrom }),
    ...(dateTo && { dateTo }),
  };

  const { data, isLoading, refetch } = useFinancialReport(params);

  return (
    <div>
      <PageHeader
        title="Báo cáo tài chính"
        description="Tổng hợp tình hình tài chính doanh nghiệp"
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
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
                  Tổng chi phí
                </CardTitle>
                <p className="text-2xl font-bold mt-1">
                  {formatCurrency(data.totalExpense)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Lợi nhuận ròng
                </CardTitle>
                <p className="text-2xl font-bold mt-1">
                  {formatCurrency(data.netProfit)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Số dư tiền mặt
                </CardTitle>
                <p className="text-2xl font-bold mt-1">
                  {formatCurrency(data.cashBalance)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Công nợ phải thu
                </CardTitle>
                <p className="text-2xl font-bold mt-1">
                  {formatCurrency(data.receivableTotal)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Công nợ phải trả
                </CardTitle>
                <p className="text-2xl font-bold mt-1">
                  {formatCurrency(data.payableTotal)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Revenue by month */}
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-base">
                  Doanh thu theo tháng
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 font-medium">
                          Tháng
                        </th>
                        <th className="text-left py-2 px-3 font-medium">
                          Số tiền
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.revenueByMonth.length === 0 ? (
                        <tr>
                          <td
                            colSpan={2}
                            className="text-center py-4 text-muted-foreground"
                          >
                            Không có dữ liệu
                          </td>
                        </tr>
                      ) : (
                        data.revenueByMonth.map((row) => (
                          <tr
                            key={row.month}
                            className="border-b last:border-b-0 hover:bg-muted/50"
                          >
                            <td className="py-2 px-3">{row.month}</td>
                            <td className="py-2 px-3">
                              {formatCurrency(row.amount)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Expense by category */}
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-base">
                  Chi phí theo danh mục
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 font-medium">
                          Danh mục
                        </th>
                        <th className="text-left py-2 px-3 font-medium">
                          Số tiền
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.expenseByCategory.length === 0 ? (
                        <tr>
                          <td
                            colSpan={2}
                            className="text-center py-4 text-muted-foreground"
                          >
                            Không có dữ liệu
                          </td>
                        </tr>
                      ) : (
                        data.expenseByCategory.map((row) => (
                          <tr
                            key={row.category}
                            className="border-b last:border-b-0 hover:bg-muted/50"
                          >
                            <td className="py-2 px-3">{row.category}</td>
                            <td className="py-2 px-3">
                              {formatCurrency(row.amount)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Profit by month */}
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base">
                Lợi nhuận theo tháng
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 font-medium">
                        Tháng
                      </th>
                      <th className="text-left py-2 px-3 font-medium">
                        Số tiền
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.profitByMonth.length === 0 ? (
                      <tr>
                        <td
                          colSpan={2}
                          className="text-center py-4 text-muted-foreground"
                        >
                          Không có dữ liệu
                        </td>
                      </tr>
                    ) : (
                      data.profitByMonth.map((row) => (
                        <tr
                          key={row.month}
                          className="border-b last:border-b-0 hover:bg-muted/50"
                        >
                          <td className="py-2 px-3">{row.month}</td>
                          <td className="py-2 px-3">
                            {formatCurrency(row.amount)}
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
