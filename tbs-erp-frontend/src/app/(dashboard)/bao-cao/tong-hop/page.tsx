'use client';

import { useState } from 'react';
import {
  FileBarChart,
  ShoppingCart,
  CreditCard,
  Clock,
  Wallet,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  ExportButton,
} from '@/features/reports/export-button';
import {
  DateRangeFilter,
  MonthYearFilter,
  StatusFilter,
  FilterCard,
  useReportFilters,
  type DateRangeValue,
  type MonthYearValue,
} from '@/features/reports/report-filters';

// ============================================
// Order Status options
// ============================================
const ORDER_STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Cho xu ly' },
  { value: 'CONFIRMED', label: 'Da xac nhan' },
  { value: 'PROCESSING', label: 'Dang xu ly' },
  { value: 'COMPLETED', label: 'Hoan thanh' },
  { value: 'CANCELLED', label: 'Da huy' },
];

const AR_STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Chua thanh toan' },
  { value: 'PARTIAL', label: 'Thanh toan mot phan' },
  { value: 'PAID', label: 'Da thanh toan' },
  { value: 'OVERDUE', label: 'Qua han' },
];

// ============================================
// Individual report sections
// ============================================

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
              <CardTitle className="text-base">Bao cao don hang</CardTitle>
              <CardDescription className="text-xs">
                Danh sach don hang theo khoang thoi gian va trang thai
              </CardDescription>
            </div>
          </div>
          <ExportButton
            endpoint="/reports/orders/export"
            filename="bao-cao-don-hang"
            params={exportParams}
            formats={['csv', 'html']}
            label="Xuat"
          />
        </div>
      </CardHeader>
      <CardContent>
        <FilterCard onReset={reset}>
          <DateRangeFilter value={dateRange} onChange={setDateRange} label="Tu ngay / Den ngay" />
          <StatusFilter
            value={status}
            onChange={setStatus}
            options={ORDER_STATUS_OPTIONS}
            label="Trang thai don hang"
          />
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
              <CardTitle className="text-base">Bao cao cong no phai thu</CardTitle>
              <CardDescription className="text-xs">
                Tat ca hoa don cong no cua khach hang
              </CardDescription>
            </div>
          </div>
          <ExportButton
            endpoint="/reports/ar/export"
            filename="cong-no-phai-thu"
            params={exportParams}
            formats={['csv', 'html']}
            label="Xuat"
          />
        </div>
      </CardHeader>
      <CardContent>
        <FilterCard onReset={reset}>
          <DateRangeFilter value={dateRange} onChange={setDateRange} label="Tu ngay / Den ngay" />
          <StatusFilter
            value={status}
            onChange={setStatus}
            options={AR_STATUS_OPTIONS}
            label="Trang thai cong no"
          />
        </FilterCard>
      </CardContent>
    </Card>
  );
}

function AttendanceReportSection() {
  const { monthYear, setMonthYear, reset } = useReportFilters();

  const exportParams = {
    month: monthYear.month,
    year: monthYear.year,
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-orange-100 p-2">
              <Clock className="h-5 w-5 text-orange-700" />
            </div>
            <div>
              <CardTitle className="text-base">Bao cao cham cong</CardTitle>
              <CardDescription className="text-xs">
                Tong hop cham cong toan bo nhan vien theo thang
              </CardDescription>
            </div>
          </div>
          <ExportButton
            endpoint="/reports/attendance/export"
            filename={`cham-cong-${monthYear.month}-${monthYear.year}`}
            params={exportParams}
            formats={['csv', 'html']}
            label="Xuat"
          />
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

  const exportParams = {
    month: monthYear.month,
    year: monthYear.year,
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-100 p-2">
              <Wallet className="h-5 w-5 text-purple-700" />
            </div>
            <div>
              <CardTitle className="text-base">Bang luong</CardTitle>
              <CardDescription className="text-xs">
                Bao cao chi luong toan bo nhan vien theo thang
              </CardDescription>
            </div>
          </div>
          <ExportButton
            endpoint="/reports/payroll/export"
            filename={`bang-luong-${monthYear.month}-${monthYear.year}`}
            params={exportParams}
            formats={['csv', 'html']}
            label="Xuat"
          />
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

// ============================================
// Main page
// ============================================

export default function BaoCaoTongHopPage() {
  return (
    <div>
      <PageHeader
        title="Bao cao tong hop"
        description="Xuat bao cao du lieu ra Excel (CSV) hoac in / luu PDF"
      >
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileBarChart className="h-4 w-4" />
          <span>4 loai bao cao</span>
        </div>
      </PageHeader>

      <div className="space-y-4">
        <OrdersReportSection />
        <ARReportSection />
        <AttendanceReportSection />
        <PayrollReportSection />
      </div>
    </div>
  );
}
