'use client';

import { useState, useEffect } from 'react';
import { Search, SlidersHorizontal, RotateCcw, Bookmark } from 'lucide-react';
import { TaskStatus, TaskPriority } from '@/lib/types';
import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS } from '@/lib/utils/constants';
import type { TaskQueryParams } from '@/lib/types';
import { cn } from '@/lib/utils/cn';

const SAVED_FILTERS_KEY = 'tbs_task_saved_filters';

interface TaskFiltersProps {
  onFilterChange: (filters: TaskQueryParams) => void;
}

interface FilterState {
  search: string;
  status: TaskStatus | '';
  priority: TaskPriority | '';
  assigneeId: string;
  dueDateFrom: string;
  dueDateTo: string;
  sortBy: TaskQueryParams['sortBy'] | '';
  sortOrder: 'asc' | 'desc';
}

const DEFAULT_FILTERS: FilterState = {
  search: '',
  status: '',
  priority: '',
  assigneeId: '',
  dueDateFrom: '',
  dueDateTo: '',
  sortBy: '',
  sortOrder: 'asc',
};

function filterStateToParams(f: FilterState): TaskQueryParams {
  const params: TaskQueryParams = {};
  if (f.search) params.search = f.search;
  if (f.status) params.status = f.status;
  if (f.priority) params.priority = f.priority;
  if (f.assigneeId) params.assigneeId = f.assigneeId;
  if (f.dueDateFrom) params.dueDateFrom = f.dueDateFrom;
  if (f.dueDateTo) params.dueDateTo = f.dueDateTo;
  if (f.sortBy) {
    params.sortBy = f.sortBy;
    params.sortOrder = f.sortOrder;
  }
  return params;
}

export function TaskFilters({ onFilterChange }: TaskFiltersProps) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [savedFilters, setSavedFilters] = useState<{ name: string; filters: FilterState }[]>([]);

  // Load saved filters from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SAVED_FILTERS_KEY);
      if (stored) setSavedFilters(JSON.parse(stored));
    } catch {
      // ignore
    }
  }, []);

  const applyFilters = (updated: FilterState) => {
    setFilters(updated);
    onFilterChange(filterStateToParams(updated));
  };

  const handleChange = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    applyFilters({ ...filters, [key]: value });
  };

  const handleReset = () => {
    applyFilters(DEFAULT_FILTERS);
  };

  const handleSave = () => {
    const name = prompt('Tên bộ lọc:');
    if (!name?.trim()) return;
    const updated = [...savedFilters, { name: name.trim(), filters }];
    setSavedFilters(updated);
    try {
      localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const handleLoadSaved = (saved: FilterState) => {
    applyFilters(saved);
  };

  const hasActiveFilters =
    filters.search ||
    filters.status ||
    filters.priority ||
    filters.assigneeId ||
    filters.dueDateFrom ||
    filters.dueDateTo ||
    filters.sortBy;

  return (
    <div className="space-y-3">
      {/* Main row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Tìm theo tiêu đề, mã công việc..."
            value={filters.search}
            onChange={(e) => handleChange('search', e.target.value)}
            className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Status */}
        <select
          value={filters.status}
          onChange={(e) => handleChange('status', e.target.value as TaskStatus | '')}
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
          value={filters.priority}
          onChange={(e) => handleChange('priority', e.target.value as TaskPriority | '')}
          className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Ưu tiên</option>
          {Object.entries(TASK_PRIORITY_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>

        {/* Sort */}
        <select
          value={filters.sortBy}
          onChange={(e) => handleChange('sortBy', e.target.value as TaskQueryParams['sortBy'] | '')}
          className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Sắp xếp</option>
          <option value="dueDate">Theo hạn</option>
          <option value="priority">Theo ưu tiên</option>
          <option value="createdAt">Theo ngày tạo</option>
        </select>

        {filters.sortBy && (
          <select
            value={filters.sortOrder}
            onChange={(e) => handleChange('sortOrder', e.target.value as 'asc' | 'desc')}
            className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="asc">Tăng dần</option>
            <option value="desc">Giảm dần</option>
          </select>
        )}

        {/* Advanced toggle */}
        <button
          onClick={() => setShowAdvanced((v) => !v)}
          className={cn(
            'inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm transition-colors',
            showAdvanced ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
          )}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Nâng cao
        </button>

        {hasActiveFilters && (
          <button
            onClick={handleReset}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-destructive/50 px-3 text-sm text-destructive hover:bg-destructive/10"
          >
            <RotateCcw className="h-4 w-4" />
            Xóa bộ lọc
          </button>
        )}
      </div>

      {/* Advanced filters */}
      {showAdvanced && (
        <div className="rounded-lg border bg-muted/30 p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Hạn từ ngày
              </label>
              <input
                type="date"
                value={filters.dueDateFrom}
                onChange={(e) => handleChange('dueDateFrom', e.target.value)}
                className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Đến ngày
              </label>
              <input
                type="date"
                value={filters.dueDateTo}
                onChange={(e) => handleChange('dueDateTo', e.target.value)}
                className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex items-end gap-2 ml-auto">
              <button
                onClick={handleSave}
                className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm hover:bg-accent"
              >
                <Bookmark className="h-4 w-4" />
                Lưu bộ lọc
              </button>
            </div>
          </div>

          {/* Saved filters */}
          {savedFilters.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="self-center text-xs text-muted-foreground">Đã lưu:</span>
              {savedFilters.map((sf, i) => (
                <button
                  key={i}
                  onClick={() => handleLoadSaved(sf.filters)}
                  className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-0.5 text-xs hover:bg-accent"
                >
                  <Bookmark className="h-3 w-3" />
                  {sf.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
