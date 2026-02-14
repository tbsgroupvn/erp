'use client';

import { type ColumnDef } from '@tanstack/react-table';
import type { PayrollRecord } from '@/lib/types/payroll.types';
import { StatusBadge } from '@/components/shared/status-badge';
import { formatCurrency } from '@/lib/utils/format';

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

export const payrollColumns: ColumnDef<PayrollRecord>[] = [
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
    cell: ({ row }) => (
      <span>{formatCurrency(row.original.baseSalary)}</span>
    ),
  },
  {
    accessorKey: 'overtimePay',
    header: 'Tăng ca',
    cell: ({ row }) => (
      <span>{formatCurrency(row.original.overtimePay)}</span>
    ),
  },
  {
    accessorKey: 'grossSalary',
    header: 'Tổng lương',
    cell: ({ row }) => (
      <span>{formatCurrency(row.original.grossSalary)}</span>
    ),
  },
  {
    accessorKey: 'taxDeduction',
    header: 'Thuế TNCN',
    cell: ({ row }) => (
      <span className="text-red-600">{formatCurrency(row.original.taxDeduction)}</span>
    ),
  },
  {
    accessorKey: 'insuranceDeduction',
    header: 'Bảo hiểm',
    cell: ({ row }) => (
      <span className="text-red-600">{formatCurrency(row.original.insuranceDeduction)}</span>
    ),
  },
  {
    accessorKey: 'netSalary',
    header: 'Thực lĩnh',
    cell: ({ row }) => (
      <span className="font-bold text-green-700">
        {formatCurrency(row.original.netSalary)}
      </span>
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
];
