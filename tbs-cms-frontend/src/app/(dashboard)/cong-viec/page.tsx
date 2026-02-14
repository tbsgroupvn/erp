'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { TaskFilters } from '@/features/tasks/task-filters';
import { taskColumns } from '@/features/tasks/task-table-columns';
import { useTasks, useMyTasks } from '@/lib/hooks/use-tasks';
import { cn } from '@/lib/utils/cn';
import type { TaskQueryParams } from '@/lib/types';

const TABS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'mine', label: 'Của tôi' },
  { key: 'overdue', label: 'Quá hạn' },
] as const;

type TabKey = typeof TABS[number]['key'];

export default function CongViecPage() {
  const [filters, setFilters] = useState<TaskQueryParams>({});
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<TabKey>('all');

  const allTasksQuery = useTasks(activeTab === 'all' ? { ...filters, page, limit: 20 } : undefined);
  const myTasksQuery = useMyTasks(activeTab === 'mine' ? { ...filters, page, limit: 20 } : undefined);
  const overdueQuery = useTasks(activeTab === 'overdue' ? { ...filters, page, limit: 20, status: 'OPEN' as any } : undefined);

  const currentQuery = activeTab === 'mine' ? myTasksQuery : activeTab === 'overdue' ? overdueQuery : allTasksQuery;

  return (
    <div>
      <PageHeader title="Công việc" description="Quản lý công việc">
        <Link
          href="/cong-viec/tao-moi"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Tạo công việc
        </Link>
      </PageHeader>

      <div className="space-y-4">
        {/* Tab Filters */}
        <div className="flex gap-1 overflow-x-auto rounded-lg border p-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setPage(1); }}
              className={cn(
                'whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors',
                activeTab === tab.key
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <TaskFilters onFilterChange={(f) => { setFilters(f as TaskQueryParams); setPage(1); }} />

        <DataTable
          columns={taskColumns}
          data={currentQuery.data?.data ?? []}
          pageCount={currentQuery.data?.meta?.totalPages}
          page={page}
          onPageChange={setPage}
          isLoading={currentQuery.isLoading}
        />
      </div>
    </div>
  );
}
