'use client';

import { useState, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  useSensor,
  useSensors,
  PointerSensor,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils/cn';
import { TaskStatus } from '@/lib/types';
import type { Task } from '@/lib/types';
import { TaskCard } from './task-card';
import { useOptimisticTaskStatus } from '@/lib/hooks/use-tasks';

// ---------------------------------------------------------------------------
// Column definitions — mapped to real TaskStatus enum values
// ---------------------------------------------------------------------------

interface KanbanColumnDef {
  status: TaskStatus;
  label: string;
  headerClass: string;
  countClass: string;
}

const COLUMNS: KanbanColumnDef[] = [
  {
    status: TaskStatus.OPEN,
    label: 'Cần làm',
    headerClass: 'bg-slate-50 border-slate-200',
    countClass: 'bg-slate-200 text-slate-700',
  },
  {
    status: TaskStatus.IN_PROGRESS,
    label: 'Đang làm',
    headerClass: 'bg-blue-50 border-blue-200',
    countClass: 'bg-blue-200 text-blue-700',
  },
  {
    status: TaskStatus.COMPLETED,
    label: 'Hoàn thành',
    headerClass: 'bg-green-50 border-green-200',
    countClass: 'bg-green-200 text-green-700',
  },
  {
    status: TaskStatus.CANCELLED,
    label: 'Đã hủy',
    headerClass: 'bg-gray-50 border-gray-200',
    countClass: 'bg-gray-200 text-gray-600',
  },
];

// ---------------------------------------------------------------------------
// Sortable task item wrapper
// ---------------------------------------------------------------------------

interface SortableTaskProps {
  task: Task;
  onCardClick: (task: Task) => void;
}

function SortableTask({ task, onCardClick }: SortableTaskProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { task },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <TaskCard
        task={task}
        onClick={onCardClick}
        isDragging={isDragging}
        dragHandleProps={
          {
            ...attributes,
            ...listeners,
          } as React.HTMLAttributes<HTMLButtonElement>
        }
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Droppable column
// ---------------------------------------------------------------------------

interface KanbanColumnProps {
  column: KanbanColumnDef;
  tasks: Task[];
  onCardClick: (task: Task) => void;
  isOver?: boolean;
}

function KanbanColumn({ column, tasks, onCardClick, isOver }: KanbanColumnProps) {
  const taskIds = useMemo(() => tasks.map((t) => t.id), [tasks]);

  return (
    <div
      className={cn(
        'flex min-h-[400px] w-72 flex-shrink-0 flex-col rounded-xl border-2 transition-colors duration-150',
        column.headerClass,
        isOver && 'border-primary/60 shadow-md',
      )}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-3">
        <span className="text-sm font-semibold text-foreground">{column.label}</span>
        <span
          className={cn(
            'flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-xs font-bold',
            column.countClass,
          )}
        >
          {tasks.length}
        </span>
      </div>

      {/* Cards */}
      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 pb-3">
          {tasks.map((task) => (
            <SortableTask key={task.id} task={task} onCardClick={onCardClick} />
          ))}
          {tasks.length === 0 && (
            <div className="flex flex-1 items-center justify-center rounded-lg border-2 border-dashed border-muted py-8">
              <p className="text-xs text-muted-foreground">Kéo thả công việc vào đây</p>
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Kanban board
// ---------------------------------------------------------------------------

interface KanbanBoardProps {
  tasks: Task[];
  onCardClick: (task: Task) => void;
}

export function KanbanBoard({ tasks, onCardClick }: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [overColumnStatus, setOverColumnStatus] = useState<TaskStatus | null>(null);
  const updateStatus = useOptimisticTaskStatus();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  // Group tasks by status
  const grouped = useMemo(() => {
    const map = new Map<TaskStatus, Task[]>();
    COLUMNS.forEach((col) => map.set(col.status, []));
    tasks.forEach((task) => {
      const bucket = map.get(task.status as TaskStatus);
      if (bucket) bucket.push(task);
      else {
        // Fallback: put unknown statuses in OPEN
        map.get(TaskStatus.OPEN)?.push(task);
      }
    });
    return map;
  }, [tasks]);

  const handleDragStart = (event: DragStartEvent) => {
    const task = event.active.data.current?.task as Task | undefined;
    setActiveTask(task ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
    setOverColumnStatus(null);

    if (!over) return;

    // Resolve destination status:
    // "over" can be a column droppable (id = status string) or another task card (id = taskId)
    const overId = String(over.id);
    let destStatus: TaskStatus | null = null;

    // Check if over.id is a column status value
    const matchedColumn = COLUMNS.find((c) => c.status === overId);
    if (matchedColumn) {
      destStatus = matchedColumn.status;
    } else {
      // Resolve from the task's current column
      for (const [status, list] of grouped.entries()) {
        if (list.some((t) => t.id === overId)) {
          destStatus = status;
          break;
        }
      }
    }

    const draggedTask = tasks.find((t) => t.id === String(active.id));
    if (!draggedTask || !destStatus || draggedTask.status === destStatus) return;

    updateStatus.mutate({ id: draggedTask.id, status: destStatus });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.status}
            column={col}
            tasks={grouped.get(col.status) ?? []}
            onCardClick={onCardClick}
            isOver={overColumnStatus === col.status}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask && (
          <TaskCard task={activeTask} isDragging />
        )}
      </DragOverlay>
    </DndContext>
  );
}
