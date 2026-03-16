'use client';

import { useState } from 'react';
import { Plus, FileSpreadsheet } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { EmployeeFilters } from '@/features/employees/employee-filters';
import { employeeColumns } from '@/features/employees/employee-table-columns';
import { useEmployees } from '@/lib/hooks/use-employees';
import type { EmployeeQueryParams } from '@/lib/types';

export default function NhanSuPage() {
  const [filters, setFilters] = useState<EmployeeQueryParams>({});
  const [page, setPage] = useState(1);
  const { data, isLoading } = useEmployees({ ...filters, page, limit: 20 });

  return (
    <div>
      <PageHeader title="Nhân sự" description="Quản lý nhân viên" infoKey="nhan-su">
        <div className="flex items-center gap-2">
          <Link
            href="/nhan-su/nhap-excel"
            className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Nhập Excel
          </Link>
          <Link
            href="/nhan-su/tao-moi"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Thêm nhân viên
          </Link>
        </div>
      </PageHeader>

      <div className="space-y-4">
        <EmployeeFilters onFilterChange={(f) => { setFilters(f as EmployeeQueryParams); setPage(1); }} />
        <DataTable
          columns={employeeColumns}
          data={data?.data ?? []}
          pageCount={data?.meta?.totalPages}
          page={page}
          onPageChange={setPage}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
