'use client';

import { useState, useMemo, type ElementType } from 'react';
import dynamic from 'next/dynamic';
import { Plus, LayoutGrid, BarChart3, List } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { TaskFilters } from '@/features/tasks/task-filters';
import { taskColumns } from '@/features/tasks/task-table-columns';
import { TaskDetailSheet } from '@/features/tasks/task-detail-sheet';
import { TaskForm } from '@/features/tasks/task-form';
import { WorkloadStats } from '@/features/tasks/workload-stats';
import { useTasks, useMyTasks } from '@/lib/hooks/use-tasks';
import { cn } from '@/lib/utils/cn';
import type { TaskQueryParams } from '@/lib/types';
import type { Task } from '@/lib/types';

// Lazy-load heavy view components (dnd-kit ~40KB, gantt rendering)
const KanbanBoard = dynamic(
  () => import('@/features/tasks/kanban-board').then((m) => m.KanbanBoard),
  { ssr: false, loading: () => <div className="h-96 animate-pulse bg-muted rounded" /> },
);
const GanttChart = dynamic(
  () => import('@/features/tasks/gantt-chart').then((m) => m.GanttChart),
  { ssr: false, loading: () => <div className="h-64 animate-pulse bg-muted rounded" /> },
);

// ---------------------------------------------------------------------------
// View mode
// ---------------------------------------------------------------------------

type ViewMode = 'kanban' | 'gantt' | 'list';

const VIEW_BUTTONS: { mode: ViewMode; label: string; icon: ElementType }[] = [
  { mode: 'kanban', label: 'Kanban', icon: LayoutGrid },
  { mode: 'gantt', label: 'Gantt', icon: BarChart3 },
  { mode: 'list', label: 'Danh sách', icon: List },
];

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

const TABS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'mine', label: 'Của tôi' },
  { key: 'overdue', label: 'Quá hạn' },
] as const;

type TabKey = typeof TABS[number]['key'];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CongViecPage() {
  const [filters, setFilters] = useState<TaskQueryParams>({});
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');

  // Detail sheet
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Create/edit form
  const [formOpen, setFormOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);

  // Queries — fetch large limit for kanban/gantt views, paginated for list
  const listParams = useMemo(
    () => ({
      ...filters,
      page,
      limit: viewMode === 'list' ? 20 : 200,
    }),
    [filters, page, viewMode],
  );

  const allTasksQuery = useTasks(activeTab === 'all' ? listParams : undefined);
  const myTasksQuery = useMyTasks(activeTab === 'mine' ? listParams : undefined);
  const overdueParams = useMemo(
    () => ({ ...listParams, dueDateTo: new Date().toISOString().split('T')[0] }),
    [listParams],
  );
  const overdueQuery = useTasks(activeTab === 'overdue' ? overdueParams : undefined);

  const currentQuery =
    activeTab === 'mine'
      ? myTasksQuery
      : activeTab === 'overdue'
      ? overdueQuery
      : allTasksQuery;

  const tasks = (currentQuery.data?.data ?? []) as Task[];

  const handleCardClick = (task: Task) => {
    setSelectedTask(task);
    setSheetOpen(true);
  };

  const handleCreateClick = () => {
    setEditTask(null);
    setFormOpen(true);
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Công việc" description="Quản lý và theo dõi tiến độ công việc" infoKey="cong-viec">
        <button
          onClick={handleCreateClick}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Tạo công việc
        </button>
      </PageHeader>

      {/* Tabs + View switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto rounded-lg border p-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                setPage(1);
              }}
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

        {/* View mode buttons */}
        <div className="flex items-center gap-1 rounded-lg border p-1">
          {VIEW_BUTTONS.map(({ mode, label, icon: Icon }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors',
                viewMode === mode
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent text-muted-foreground',
              )}
              aria-label={label}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <TaskFilters
        onFilterChange={(f) => {
          setFilters(f as TaskQueryParams);
          setPage(1);
        }}
      />

      {/* Workload stats */}
      {!currentQuery.isLoading && tasks.length > 0 && (
        <WorkloadStats tasks={tasks} />
      )}

      {/* Main content */}
      <div>
        {currentQuery.isLoading ? (
          <div className="flex h-60 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : viewMode === 'kanban' ? (
          <KanbanBoard tasks={tasks} onCardClick={handleCardClick} />
        ) : viewMode === 'gantt' ? (
          <GanttChart tasks={tasks} onTaskClick={handleCardClick} />
        ) : (
          <DataTable
            columns={taskColumns}
            data={tasks}
            pageCount={currentQuery.data?.meta?.totalPages}
            page={page}
            onPageChange={setPage}
            isLoading={currentQuery.isLoading}
          />
        )}
      </div>

      {/* Task detail sheet */}
      <TaskDetailSheet
        task={selectedTask}
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false);
          setSelectedTask(null);
        }}
      />

      {/* Create/edit form */}
      <TaskForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditTask(null);
        }}
        editTask={editTask}
      />
    </div>
  );
}
