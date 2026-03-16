'use client';

import * as React from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { PageHeader } from '@/components/shared/page-header';

// Doanh số imports
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSalesReport, useFinancialReport } from '@/lib/hooks/use-reports';
import { formatCurrency } from '@/lib/utils/format';
import type { ReportQueryParams } from '@/lib/api/report.api';

// Tổng hợp imports
import {
  FileBarChart,
  ShoppingCart,
  CreditCard,
  Clock,
  Wallet,
} from 'lucide-react';
import {
  ExportButton,
} from '@/features/reports/export-button';
import {
  DateRangeFilter,
  MonthYearFilter,
  StatusFilter,
  FilterCard,
  useReportFilters,
} from '@/features/reports/report-filters';

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

const TABS = [
  { key: 'default', label: 'Doanh số' },
  { key: 'tai-chinh', label: 'Tài chính' },
  { key: 'tong-hop', label: 'Xuất báo cáo' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

// ---------------------------------------------------------------------------
// Doanh số content
// ---------------------------------------------------------------------------

function DoanhSoContent() {
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
      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label htmlFor="ds-dateFrom">Từ ngày</Label>
              <Input
                id="ds-dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-44"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ds-dateTo">Đến ngày</Label>
              <Input
                id="ds-dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-44"
              />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium leading-none">Chi nhánh</p>
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

      {isLoading && (
        <p className="text-sm text-muted-foreground py-4">Đang tải...</p>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <CardTitle className="text-sm font-medium text-muted-foreground">Tổng đơn hàng</CardTitle>
                <p className="text-2xl font-bold mt-1">{data.totalOrders}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <CardTitle className="text-sm font-medium text-muted-foreground">Tổng doanh thu</CardTitle>
                <p className="text-2xl font-bold mt-1">{formatCurrency(data.totalRevenue)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <CardTitle className="text-sm font-medium text-muted-foreground">Tổng lợi nhuận</CardTitle>
                <p className="text-2xl font-bold mt-1">{formatCurrency(data.totalProfit)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <CardTitle className="text-sm font-medium text-muted-foreground">Giá trị đơn TB</CardTitle>
                <p className="text-2xl font-bold mt-1">{formatCurrency(data.averageOrderValue)}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base">Doanh số theo nhân viên</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 font-medium">Nhân viên</th>
                      <th className="text-left py-2 px-3 font-medium">Số đơn hàng</th>
                      <th className="text-left py-2 px-3 font-medium">Doanh thu</th>
                      <th className="text-left py-2 px-3 font-medium">Lợi nhuận</th>
                      <th className="text-left py-2 px-3 font-medium">Tỉ lệ chuyển đổi (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-4 text-muted-foreground">
                          Không có dữ liệu
                        </td>
                      </tr>
                    ) : (
                      data.items.map((item) => (
                        <tr key={item.employeeId} className="border-b last:border-b-0 hover:bg-muted/50">
                          <td className="py-2 px-3">{item.employeeName}</td>
                          <td className="py-2 px-3">{item.totalOrders}</td>
                          <td className="py-2 px-3">{formatCurrency(item.totalRevenue)}</td>
                          <td className="py-2 px-3">{formatCurrency(item.totalProfit)}</td>
                          <td className="py-2 px-3">{Number(item.conversionRate).toFixed(2)}%</td>
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

// ---------------------------------------------------------------------------
// Tài chính content
// ---------------------------------------------------------------------------

function TaiChinhContent() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const params: ReportQueryParams = {
    ...(dateFrom && { dateFrom }),
    ...(dateTo && { dateTo }),
  };

  const { data, isLoading, refetch } = useFinancialReport(params);

  return (
    <div>
      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label htmlFor="tc-dateFrom">Từ ngày</Label>
              <Input
                id="tc-dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-44"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tc-dateTo">Đến ngày</Label>
              <Input
                id="tc-dateTo"
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

      {isLoading && (
        <p className="text-sm text-muted-foreground py-4">Đang tải...</p>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <CardTitle className="text-sm font-medium text-muted-foreground">Tổng doanh thu</CardTitle>
                <p className="text-2xl font-bold mt-1">{formatCurrency(data.totalRevenue)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <CardTitle className="text-sm font-medium text-muted-foreground">Tổng chi phí</CardTitle>
                <p className="text-2xl font-bold mt-1">{formatCurrency(data.totalExpense)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <CardTitle className="text-sm font-medium text-muted-foreground">Lợi nhuận ròng</CardTitle>
                <p className="text-2xl font-bold mt-1">{formatCurrency(data.netProfit)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <CardTitle className="text-sm font-medium text-muted-foreground">Số dư tiền mặt</CardTitle>
                <p className="text-2xl font-bold mt-1">{formatCurrency(data.cashBalance)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <CardTitle className="text-sm font-medium text-muted-foreground">Công nợ phải thu</CardTitle>
                <p className="text-2xl font-bold mt-1">{formatCurrency(data.receivableTotal)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <CardTitle className="text-sm font-medium text-muted-foreground">Công nợ phải trả</CardTitle>
                <p className="text-2xl font-bold mt-1">{formatCurrency(data.payableTotal)}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-base">Doanh thu theo tháng</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 font-medium">Tháng</th>
                        <th className="text-left py-2 px-3 font-medium">Số tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.revenueByMonth.length === 0 ? (
                        <tr>
                          <td colSpan={2} className="text-center py-4 text-muted-foreground">Không có dữ liệu</td>
                        </tr>
                      ) : (
                        data.revenueByMonth.map((row) => (
                          <tr key={row.month} className="border-b last:border-b-0 hover:bg-muted/50">
                            <td className="py-2 px-3">{row.month}</td>
                            <td className="py-2 px-3">{formatCurrency(row.amount)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-base">Chi phí theo danh mục</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 font-medium">Danh mục</th>
                        <th className="text-left py-2 px-3 font-medium">Số tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.expenseByCategory.length === 0 ? (
                        <tr>
                          <td colSpan={2} className="text-center py-4 text-muted-foreground">Không có dữ liệu</td>
                        </tr>
                      ) : (
                        data.expenseByCategory.map((row) => (
                          <tr key={row.category} className="border-b last:border-b-0 hover:bg-muted/50">
                            <td className="py-2 px-3">{row.category}</td>
                            <td className="py-2 px-3">{formatCurrency(row.amount)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base">Lợi nhuận theo tháng</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 font-medium">Tháng</th>
                      <th className="text-left py-2 px-3 font-medium">Số tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.profitByMonth.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="text-center py-4 text-muted-foreground">Không có dữ liệu</td>
                      </tr>
                    ) : (
                      data.profitByMonth.map((row) => (
                        <tr key={row.month} className="border-b last:border-b-0 hover:bg-muted/50">
                          <td className="py-2 px-3">{row.month}</td>
                          <td className="py-2 px-3">{formatCurrency(row.amount)}</td>
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

// ---------------------------------------------------------------------------
// Tổng hợp (export) content
// ---------------------------------------------------------------------------

const ORDER_STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Chờ xử lý' },
  { value: 'CONFIRMED', label: 'Đã xác nhận' },
  { value: 'PROCESSING', label: 'Đang xử lý' },
  { value: 'COMPLETED', label: 'Hoàn thành' },
  { value: 'CANCELLED', label: 'Đã hủy' },
];

const AR_STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Chưa thanh toán' },
  { value: 'PARTIAL', label: 'Thanh toán một phần' },
  { value: 'PAID', label: 'Đã thanh toán' },
  { value: 'OVERDUE', label: 'Quá hạn' },
];

function OrdersReportSection() {
  const { dateRange, setDateRange, status, setStatus, reset } = useReportFilters();
  const exportParams: Record<string, string | undefined> = {
    ...(dateRange.from && { from: dateRange.from }),
    ...(dateRange.to && { to: dateRange.to }),
    ...(status && { status }),
  };
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2">
              <ShoppingCart className="h-5 w-5 text-blue-700" />
            </div>
            <div>
              <CardTitle className="text-base">Báo cáo đơn hàng</CardTitle>
              <CardDescription className="text-xs">Danh sách đơn hàng theo khoảng thời gian và trạng thái</CardDescription>
            </div>
          </div>
          <ExportButton endpoint="/reports/orders/export" filename="bao-cao-don-hang" params={exportParams} formats={['csv', 'html']} label="Xuất" />
        </div>
      </CardHeader>
      <CardContent>
        <FilterCard onReset={reset}>
          <DateRangeFilter value={dateRange} onChange={setDateRange} label="Từ ngày / Đến ngày" />
          <StatusFilter value={status} onChange={setStatus} options={ORDER_STATUS_OPTIONS} label="Trạng thái đơn hàng" />
        </FilterCard>
      </CardContent>
    </Card>
  );
}

function ARReportSection() {
  const { dateRange, setDateRange, status, setStatus, reset } = useReportFilters();
  const exportParams: Record<string, string | undefined> = {
    ...(dateRange.from && { from: dateRange.from }),
    ...(dateRange.to && { to: dateRange.to }),
    ...(status && { status }),
  };
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-2">
              <CreditCard className="h-5 w-5 text-green-700" />
            </div>
            <div>
              <CardTitle className="text-base">Báo cáo công nợ phải thu</CardTitle>
              <CardDescription className="text-xs">Tất cả hóa đơn công nợ của khách hàng</CardDescription>
            </div>
          </div>
          <ExportButton endpoint="/reports/ar/export" filename="cong-no-phai-thu" params={exportParams} formats={['csv', 'html']} label="Xuất" />
        </div>
      </CardHeader>
      <CardContent>
        <FilterCard onReset={reset}>
          <DateRangeFilter value={dateRange} onChange={setDateRange} label="Từ ngày / Đến ngày" />
          <StatusFilter value={status} onChange={setStatus} options={AR_STATUS_OPTIONS} label="Trạng thái công nợ" />
        </FilterCard>
      </CardContent>
    </Card>
  );
}

function AttendanceReportSection() {
  const { monthYear, setMonthYear, reset } = useReportFilters();
  const exportParams = { month: monthYear.month, year: monthYear.year };
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-orange-100 p-2">
              <Clock className="h-5 w-5 text-orange-700" />
            </div>
            <div>
              <CardTitle className="text-base">Báo cáo chấm công</CardTitle>
              <CardDescription className="text-xs">Tổng hợp chấm công toàn bộ nhân viên theo tháng</CardDescription>
            </div>
          </div>
          <ExportButton endpoint="/reports/attendance/export" filename={`cham-cong-${monthYear.month}-${monthYear.year}`} params={exportParams} formats={['csv', 'html']} label="Xuất" />
        </div>
      </CardHeader>
      <CardContent>
        <FilterCard onReset={reset}>
          <MonthYearFilter value={monthYear} onChange={setMonthYear} label="Chọn tháng" />
        </FilterCard>
      </CardContent>
    </Card>
  );
}

function PayrollReportSection() {
  const { monthYear, setMonthYear, reset } = useReportFilters();
  const exportParams = { month: monthYear.month, year: monthYear.year };
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-100 p-2">
              <Wallet className="h-5 w-5 text-purple-700" />
            </div>
            <div>
              <CardTitle className="text-base">Bảng lương</CardTitle>
              <CardDescription className="text-xs">Báo cáo chi lương toàn bộ nhân viên theo tháng</CardDescription>
            </div>
          </div>
          <ExportButton endpoint="/reports/payroll/export" filename={`bang-luong-${monthYear.month}-${monthYear.year}`} params={exportParams} formats={['csv', 'html']} label="Xuất" />
        </div>
      </CardHeader>
      <CardContent>
        <FilterCard onReset={reset}>
          <MonthYearFilter value={monthYear} onChange={setMonthYear} label="Chọn tháng" />
        </FilterCard>
      </CardContent>
    </Card>
  );
}

function TongHopContent() {
  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <FileBarChart className="h-4 w-4" />
        <span>4 loại báo cáo</span>
      </div>
      <div className="space-y-4">
        <OrdersReportSection />
        <ARReportSection />
        <AttendanceReportSection />
        <PayrollReportSection />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inner component (reads searchParams — must be inside Suspense)
// ---------------------------------------------------------------------------

function BaoCaoInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const activeTab = (searchParams.get('tab') as TabKey) || 'default';

  const setTab = (tab: TabKey) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'default') params.delete('tab');
    else params.set('tab', tab);
    router.push(`${pathname}?${params.toString()}`);
  };

  const titles: Record<TabKey, { title: string; description: string }> = {
    'default': { title: 'Báo cáo doanh số', description: 'Thống kê doanh số bán hàng theo nhân viên và chi nhánh' },
    'tai-chinh': { title: 'Báo cáo tài chính', description: 'Tổng hợp tình hình tài chính doanh nghiệp' },
    'tong-hop': { title: 'Báo cáo tổng hợp', description: 'Xuất báo cáo dữ liệu ra Excel (CSV) hoặc in / lưu PDF' },
  };

  const current = titles[activeTab];

  return (
    <div>
      <PageHeader title={current.title} description={current.description} infoKey="bao-cao" />

      {/* Tab bar */}
      <div className="flex gap-1 border-b mb-6">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              activeTab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'default' && <DoanhSoContent />}
      {activeTab === 'tai-chinh' && <TaiChinhContent />}
      {activeTab === 'tong-hop' && <TongHopContent />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page export
// ---------------------------------------------------------------------------

export default function BaoCaoPage() {
  return (
    <React.Suspense>
      <BaoCaoInner />
    </React.Suspense>
  );
}
