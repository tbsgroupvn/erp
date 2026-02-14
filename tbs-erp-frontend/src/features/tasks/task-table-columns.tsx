'use client';

import { type ColumnDef } from '@tanstack/react-table';
import type { Task, TaskStatus, TaskPriority } from '@/lib/types';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_COLORS,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_COLORS,
} from '@/lib/utils/constants';
import { formatDate } from '@/lib/utils/format';
import { MoreHorizontal, Eye, Pencil } from 'lucide-react';
import Link from 'next/link';

export const taskColumns: ColumnDef<Task>[] = [
  {
    accessorKey: 'code',
    header: 'Mã',
    cell: ({ row }) => (
      <Link
        href={`/cong-viec/${row.original.id}`}
        className="font-medium text-primary hover:underline"
      >
        {row.original.code}
      </Link>
    ),
  },
  {
    accessorKey: 'title',
    header: 'Tiêu đề',
    cell: ({ row }) => (
      <span className="line-clamp-1 max-w-[250px]">{row.original.title}</span>
    ),
  },
  {
    accessorKey: 'assignee.fullName',
    header: 'Người thực hiện',
    cell: ({ row }) => (
      <span>{row.original.assignee?.fullName ?? '---'}</span>
    ),
  },
  {
    accessorKey: 'priority',
    header: 'Ưu tiên',
    cell: ({ row }) => {
      const priority = row.original.priority as TaskPriority;
      return (
        <StatusBadge
          label={TASK_PRIORITY_LABELS[priority] || priority}
          colorClass={TASK_PRIORITY_COLORS[priority] || 'bg-gray-100 text-gray-700'}
        />
      );
    },
  },
  {
    accessorKey: 'status',
    header: 'Trạng thái',
    cell: ({ row }) => {
      const status = row.original.status as TaskStatus;
      return (
        <StatusBadge
          label={TASK_STATUS_LABELS[status] || status}
          colorClass={TASK_STATUS_COLORS[status] || 'bg-gray-100 text-gray-700'}
        />
      );
    },
  },
  {
    accessorKey: 'dueDate',
    header: 'Hạn',
    cell: ({ row }) => {
      const dueDate = row.original.dueDate;
      if (!dueDate) return <span className="text-muted-foreground">---</span>;
      const isOverdue = new Date(dueDate) < new Date() && row.original.status !== 'COMPLETED';
      return (
        <span className={isOverdue ? 'text-destructive font-medium' : ''}>
          {formatDate(dueDate, 'dd/MM/yyyy')}
        </span>
      );
    },
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => (
      <div className="relative group">
        <button className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent">
          <MoreHorizontal className="h-4 w-4" />
        </button>
        <div className="absolute right-0 top-full z-10 hidden w-48 rounded-md border bg-popover p-1 shadow-md group-hover:block">
          <Link
            href={`/cong-viec/${row.original.id}`}
            className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
          >
            <Eye className="h-4 w-4" /> Xem
          </Link>
          <Link
            href={`/cong-viec/${row.original.id}?edit=true`}
            className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
          >
            <Pencil className="h-4 w-4" /> Sửa
          </Link>
        </div>
      </div>
    ),
  },
];
