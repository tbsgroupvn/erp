'use client';

import { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { EmployeeStatus, Branch } from '@/lib/types';
import { EMPLOYEE_STATUS_LABELS, BRANCH_LABELS } from '@/lib/utils/constants';
import { useDebounce } from '@/lib/hooks/use-debounce';

interface EmployeeFiltersProps {
  onFilterChange: (filters: {
    status?: EmployeeStatus;
    branch?: Branch;
    departmentCode?: string;
    search?: string;
  }) => void;
}

export function EmployeeFilters({ onFilterChange }: EmployeeFiltersProps) {
  const [status, setStatus] = useState<EmployeeStatus | undefined>();
  const [branch, setBranch] = useState<Branch | undefined>();
  const [departmentCode, setDepartmentCode] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    applyFilters({ search: debouncedSearch });
  }, [debouncedSearch]);

  const applyFilters = (overrides: Partial<{
    status: EmployeeStatus | undefined;
    branch: Branch | undefined;
    departmentCode: string;
    search: string;
  }> = {}) => {
    const filters = {
      status: overrides.status !== undefined ? overrides.status : status,
      branch: overrides.branch !== undefined ? overrides.branch : branch,
      departmentCode: overrides.departmentCode !== undefined ? overrides.departmentCode : departmentCode,
      search: overrides.search !== undefined ? overrides.search : search,
    };
    onFilterChange(filters);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Tìm theo tên, mã nhân viên..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
          }}
          className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Department */}
      <input
        type="text"
        placeholder="Phòng ban"
        value={departmentCode}
        onChange={(e) => {
          setDepartmentCode(e.target.value);
          applyFilters({ departmentCode: e.target.value });
        }}
        className="h-9 w-36 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />

      {/* Branch */}
      <select
        value={branch || ''}
        onChange={(e) => {
          const val = e.target.value ? (e.target.value as Branch) : undefined;
          setBranch(val);
          applyFilters({ branch: val });
        }}
        className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">Chi nhánh</option>
        {Object.entries(BRANCH_LABELS).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>

      {/* Status */}
      <select
        value={status || ''}
        onChange={(e) => {
          const val = e.target.value ? (e.target.value as EmployeeStatus) : undefined;
          setStatus(val);
          applyFilters({ status: val });
        }}
        className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">Trạng thái</option>
        {Object.entries(EMPLOYEE_STATUS_LABELS).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
