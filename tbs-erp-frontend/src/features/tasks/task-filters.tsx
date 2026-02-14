'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { TaskStatus, TaskPriority } from '@/lib/types';
import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS } from '@/lib/utils/constants';

interface TaskFiltersProps {
  onFilterChange: (filters: {
    status?: TaskStatus;
    priority?: TaskPriority;
    assigneeId?: string;
    search?: string;
  }) => void;
}

export function TaskFilters({ onFilterChange }: TaskFiltersProps) {
  const [status, setStatus] = useState<TaskStatus | undefined>();
  const [priority, setPriority] = useState<TaskPriority | undefined>();
  const [search, setSearch] = useState('');

  const applyFilters = (overrides: Partial<{
    status: TaskStatus | undefined;
    priority: TaskPriority | undefined;
    search: string;
  }> = {}) => {
    const filters = {
      status: overrides.status !== undefined ? overrides.status : status,
      priority: overrides.priority !== undefined ? overrides.priority : priority,
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
          placeholder="Tìm theo tiêu đề, mã công việc..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            applyFilters({ search: e.target.value });
          }}
          className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Status */}
      <select
        value={status || ''}
        onChange={(e) => {
          const val = e.target.value ? (e.target.value as TaskStatus) : undefined;
          setStatus(val);
          applyFilters({ status: val });
        }}
        className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">Trạng thái</option>
        {Object.entries(TASK_STATUS_LABELS).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>

      {/* Priority */}
      <select
        value={priority || ''}
        onChange={(e) => {
          const val = e.target.value ? (e.target.value as TaskPriority) : undefined;
          setPriority(val);
          applyFilters({ priority: val });
        }}
        className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">Ưu tiên</option>
        {Object.entries(TASK_PRIORITY_LABELS).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
