'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { MasterOrderStatus, Branch } from '@/lib/types';
import { useEmployees } from '@/lib/hooks/use-employees';
import {
  MASTER_ORDER_STATUS_LABELS,
  BRANCH_LABELS,
} from '@/lib/utils/constants';

interface OrderFiltersProps {
  onFilterChange: (filters: {
    status?: MasterOrderStatus;
    branch?: Branch;
    search?: string;
    startDate?: string;
    endDate?: string;
    saleId?: string;
  }) => void;
}

const STATUS_TABS = [
  { value: undefined, label: 'Tất cả' },
  { value: MasterOrderStatus.ACTIVE, label: MASTER_ORDER_STATUS_LABELS[MasterOrderStatus.ACTIVE] },
  { value: MasterOrderStatus.COMPLETED, label: MASTER_ORDER_STATUS_LABELS[MasterOrderStatus.COMPLETED] },
  { value: MasterOrderStatus.CANCELLED, label: MASTER_ORDER_STATUS_LABELS[MasterOrderStatus.CANCELLED] },
];

export function OrderFilters({ onFilterChange }: OrderFiltersProps) {
  const [activeStatus, setActiveStatus] = useState<MasterOrderStatus | undefined>();
  const [branch, setBranch] = useState<Branch | undefined>();
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [saleId, setSaleId] = useState<string | undefined>();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const { data: salesData } = useEmployees({ departmentCode: 'SALES', limit: 100 });
  const salesEmployees = salesData?.data ?? [];

  const filtersRef = useRef({ activeStatus, branch, search, startDate, endDate, saleId });
  filtersRef.current = { activeStatus, branch, search, startDate, endDate, saleId };

  const applyFilters = useCallback((overrides: Partial<{
    status: MasterOrderStatus | undefined;
    branch: Branch | undefined;
    search: string;
    startDate: string;
    endDate: string;
    saleId: string | undefined;
  }> = {}) => {
    const cur = filtersRef.current;
    const filters = {
      status: 'status' in overrides ? overrides.status : cur.activeStatus,
      branch: 'branch' in overrides ? overrides.branch : cur.branch,
      search: 'search' in overrides ? overrides.search : cur.search,
      startDate: 'startDate' in overrides ? overrides.startDate : cur.startDate,
      endDate: 'endDate' in overrides ? overrides.endDate : cur.endDate,
      saleId: 'saleId' in overrides ? overrides.saleId : cur.saleId,
    };
    onFilterChange(filters);
  }, [onFilterChange]);

  // Debounced search
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      applyFilters({ search: value });
    }, 300);
  }, [applyFilters]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="space-y-4">
      {/* Status Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-lg border p-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.label}
            onClick={() => {
              setActiveStatus(tab.value);
              applyFilters({ status: tab.value });
            }}
            className={cn(
              'whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors',
              activeStatus === tab.value
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-accent',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Tìm theo mã đơn, khách hàng..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

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

        {/* Sale */}
        <select
          value={saleId || ''}
          onChange={(e) => {
            const val = e.target.value || undefined;
            setSaleId(val);
            applyFilters({ saleId: val });
          }}
          className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Nhân viên Sale</option>
          {salesEmployees.map((emp: any) => (
            <option key={emp.id} value={emp.id}>
              {emp.fullName} ({emp.code})
            </option>
          ))}
        </select>

        {/* Date Range */}
        <input
          type="date"
          value={startDate}
          onChange={(e) => {
            setStartDate(e.target.value);
            applyFilters({ startDate: e.target.value });
          }}
          className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <span className="text-sm text-muted-foreground">-</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => {
            setEndDate(e.target.value);
            applyFilters({ endDate: e.target.value });
          }}
          className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
    </div>
  );
}
