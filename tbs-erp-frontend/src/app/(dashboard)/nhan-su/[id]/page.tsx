'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { StatusBadge } from '@/components/shared/status-badge';
import { LoadingOverlay } from '@/components/shared/loading-overlay';
import { useEmployee } from '@/lib/hooks/use-employees';
import { EMPLOYEE_STATUS_LABELS, EMPLOYEE_STATUS_COLORS, BRANCH_LABELS } from '@/lib/utils/constants';
import { formatDate } from '@/lib/utils/format';
import type { EmployeeStatus, Branch } from '@/lib/types';

export default function EmployeeDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: employee, isLoading } = useEmployee(id);

  if (isLoading) return <LoadingOverlay className="h-[60vh]" />;
  if (!employee) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Không tìm thấy nhân viên</p>
        <Link href="/nhan-su" className="text-primary hover:underline mt-2 inline-block">
          Quay lại danh sách
        </Link>
      </div>
    );
  }

  const emp = employee as any;
  const status = emp.status as EmployeeStatus;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/nhan-su" className="inline-flex h-9 w-9 items-center justify-center rounded-md border hover:bg-accent">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{emp.fullName}</h1>
            <StatusBadge
              label={EMPLOYEE_STATUS_LABELS[status] || status}
              colorClass={EMPLOYEE_STATUS_COLORS[status] || 'bg-gray-100 text-gray-700'}
            />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Mã NV: {emp.code}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Personal Info */}
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Thông tin cá nhân</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Họ tên</dt>
              <dd>{emp.fullName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Email</dt>
              <dd>{emp.email || '---'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Số điện thoại</dt>
              <dd>{emp.phone || '---'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Mã số thuế</dt>
              <dd>{emp.taxCode || '---'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Bảo hiểm</dt>
              <dd>{emp.insuranceId || '---'}</dd>
            </div>
          </dl>
        </div>

        {/* Employment Info */}
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Thông tin công việc</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Chức vụ</dt>
              <dd>{emp.positionTitle}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Ngày vào làm</dt>
              <dd>{formatDate(emp.joinDate, 'dd/MM/yyyy')}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Ngân hàng</dt>
              <dd>{emp.bankName || '---'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Số TK</dt>
              <dd>{emp.bankAccount || '---'}</dd>
            </div>
          </dl>
        </div>

        {/* Department & Branch */}
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Phòng ban & Chi nhánh</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Phòng ban</dt>
              <dd>{emp.departmentCode}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Chi nhánh</dt>
              <dd>{BRANCH_LABELS[emp.branch as Branch] || emp.branch}</dd>
            </div>
            {emp.manager && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Quản lý</dt>
                <dd>
                  <Link href={`/nhan-su/${emp.manager.id}`} className="text-primary hover:underline">
                    {emp.manager.fullName}
                  </Link>
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* Stats */}
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Thống kê</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-md bg-muted/50 p-4 text-center">
              <p className="text-2xl font-bold">{emp.subordinates?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-1">Nhân viên cấp dưới</p>
            </div>
            <div className="rounded-md bg-muted/50 p-4 text-center">
              <p className="text-2xl font-bold">---</p>
              <p className="text-xs text-muted-foreground mt-1">Ngày công tháng này</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
