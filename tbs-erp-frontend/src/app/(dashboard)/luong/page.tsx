'use client';

import { useState, useMemo } from 'react';
import { Calculator, CheckCircle, Loader2, FileText, X } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { usePayrollList, usePayrollSummary, useCalculatePayroll, useApprovePayroll } from '@/lib/hooks/use-payroll';
import { formatCurrency } from '@/lib/utils/format';
import type { ColumnDef } from '@tanstack/react-table';
import type { PayrollRecord } from '@/lib/types/payroll.types';

const MONTHS = [
  { value: 1, label: 'Tháng 1' },
  { value: 2, label: 'Tháng 2' },
  { value: 3, label: 'Tháng 3' },
  { value: 4, label: 'Tháng 4' },
  { value: 5, label: 'Tháng 5' },
  { value: 6, label: 'Tháng 6' },
  { value: 7, label: 'Tháng 7' },
  { value: 8, label: 'Tháng 8' },
  { value: 9, label: 'Tháng 9' },
  { value: 10, label: 'Tháng 10' },
  { value: 11, label: 'Tháng 11' },
  { value: 12, label: 'Tháng 12' },
];

const PAYROLL_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Nháp',
  CALCULATED: 'Đã tính',
  APPROVED: 'Đã duyệt',
  PAID: 'Đã trả',
};

const PAYROLL_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  CALCULATED: 'bg-blue-100 text-blue-700',
  APPROVED: 'bg-green-100 text-green-700',
  PAID: 'bg-emerald-100 text-emerald-700',
};

export default function LuongPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [page, setPage] = useState(1);
  const [selectedPayslip, setSelectedPayslip] = useState<PayrollRecord | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  const params = useMemo(() => ({
    month,
    year,
    page,
    limit: 20,
    ...(statusFilter ? { status: statusFilter } : {}),
  }), [month, year, page, statusFilter]);

  const { data: payrollData, isLoading } = usePayrollList(params);
  const { data: summary } = usePayrollSummary(month, year);
  const calculatePayroll = useCalculatePayroll();
  const approvePayroll = useApprovePayroll();

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  const payrollColumns: ColumnDef<PayrollRecord>[] = useMemo(
    () => [
      {
        id: 'employee',
        header: 'Nhân viên',
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.employeeName}</p>
            <p className="text-xs text-muted-foreground">{row.original.employeeCode}</p>
          </div>
        ),
      },
      {
        accessorKey: 'baseSalary',
        header: 'Lương cơ bản',
        cell: ({ row }) => <span>{formatCurrency(row.original.baseSalary)}</span>,
      },
      {
        accessorKey: 'grossSalary',
        header: 'Tổng lương',
        cell: ({ row }) => <span>{formatCurrency(row.original.grossSalary)}</span>,
      },
      {
        accessorKey: 'netSalary',
        header: 'Thực lĩnh',
        cell: ({ row }) => (
          <span className="font-bold text-green-700">{formatCurrency(row.original.netSalary)}</span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Trạng thái',
        cell: ({ row }) => {
          const status = row.original.status;
          return (
            <StatusBadge
              label={PAYROLL_STATUS_LABELS[status] || status}
              colorClass={PAYROLL_STATUS_COLORS[status] || 'bg-gray-100 text-gray-700'}
            />
          );
        },
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedPayslip(row.original)}
          >
            <FileText className="mr-1 h-4 w-4" />
            Phiếu lương
          </Button>
        ),
      },
    ],
    [],
  );

  return (
    <div>
      <PageHeader title="Bảng lương" description="Quản lý bảng lương nhân viên" infoKey="luong">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => calculatePayroll.mutate({ month, year })}
            disabled={calculatePayroll.isPending}
          >
            {calculatePayroll.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Calculator className="mr-1 h-4 w-4" />}
            Tính lương
          </Button>
          <Button
            onClick={() => approvePayroll.mutate({ month, year })}
            disabled={approvePayroll.isPending}
            className="bg-green-600 hover:bg-green-700"
          >
            {approvePayroll.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-1 h-4 w-4" />}
            Duyệt lương
          </Button>
        </div>
      </PageHeader>

      <div className="space-y-4">
        {/* Month/Year/Status selector */}
        <div className="flex items-center gap-3">
          <select
            value={month}
            onChange={(e) => { setMonth(Number(e.target.value)); setPage(1); }}
            className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => { setYear(Number(e.target.value)); setPage(1); }}
            className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="DRAFT">Nháp</option>
            <option value="CALCULATED">Đã tính</option>
            <option value="APPROVED">Đã duyệt</option>
            <option value="PAID">Đã trả</option>
          </select>
        </div>

        {/* Summary cards */}
        {summary && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Tổng lương gross</p>
              <p className="text-2xl font-bold">{formatCurrency(summary.totalGross)}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Tổng khấu trừ</p>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(summary.totalDeductions)}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Tổng thực lĩnh</p>
              <p className="text-2xl font-bold text-green-700">{formatCurrency(summary.totalNet)}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Số nhân viên</p>
              <p className="text-2xl font-bold">{summary.employeeCount}</p>
            </div>
          </div>
        )}

        {/* Payslip detail */}
        {selectedPayslip && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-lg">
                Phiếu lương — {selectedPayslip.employeeName} ({selectedPayslip.employeeCode})
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setSelectedPayslip(null)}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2 rounded-lg border p-4">
                  <h4 className="font-semibold text-green-700">Thu nhập</h4>
                  <div className="flex justify-between text-sm">
                    <span>Lương cơ bản</span>
                    <span>{formatCurrency(selectedPayslip.baseSalary)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Tăng ca</span>
                    <span>{formatCurrency(selectedPayslip.overtimePay)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Phụ cấp</span>
                    <span>{formatCurrency(selectedPayslip.allowances)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 font-semibold">
                    <span>Tổng thu nhập</span>
                    <span>{formatCurrency(selectedPayslip.grossSalary)}</span>
                  </div>
                </div>
                <div className="space-y-2 rounded-lg border p-4">
                  <h4 className="font-semibold text-red-600">Khấu trừ</h4>
                  <div className="flex justify-between text-sm">
                    <span>Thuế TNCN</span>
                    <span>{formatCurrency(selectedPayslip.taxDeduction)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Bảo hiểm</span>
                    <span>{formatCurrency(selectedPayslip.insuranceDeduction)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Khấu trừ khác</span>
                    <span>{formatCurrency(selectedPayslip.otherDeductions)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 font-semibold">
                    <span>Tổng khấu trừ</span>
                    <span>{formatCurrency(selectedPayslip.taxDeduction + selectedPayslip.insuranceDeduction + selectedPayslip.otherDeductions)}</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between rounded-lg bg-green-50 p-4">
                <span className="text-lg font-bold">Thực lĩnh</span>
                <span className="text-2xl font-bold text-green-700">{formatCurrency(selectedPayslip.netSalary)}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Kỳ lương: Tháng {selectedPayslip.month}/{selectedPayslip.year} • Trạng thái: {PAYROLL_STATUS_LABELS[selectedPayslip.status] || selectedPayslip.status}
              </p>
            </CardContent>
          </Card>
        )}

        <DataTable
          columns={payrollColumns}
          data={payrollData?.data ?? []}
          pageCount={payrollData?.meta?.totalPages}
          page={page}
          onPageChange={setPage}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
