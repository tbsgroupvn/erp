'use client';

import { cn } from '@/lib/utils/cn';

interface SkeletonProps {
  className?: string;
}

function Bone({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-md bg-muted',
        'after:absolute after:inset-0 after:-translate-x-full',
        'after:animate-[shimmer_1.5s_infinite]',
        'after:bg-gradient-to-r after:from-transparent after:via-background/60 after:to-transparent',
        className
      )}
    />
  );
}

// ─── Table Skeleton ────────────────────────────────────────────────────────────
interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function TableSkeleton({ rows = 5, columns = 5, className }: TableSkeletonProps) {
  return (
    <div className={cn('rounded-xl border bg-card shadow-sm overflow-hidden', className)}>
      {/* Header */}
      <div className="border-b bg-gradient-to-r from-muted/50 to-muted/20 px-4 py-3.5 flex gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <Bone key={i} className={cn('h-4', i === 0 ? 'w-28' : i === columns - 1 ? 'w-16' : 'flex-1')} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className="flex gap-4 border-b px-4 py-3.5 last:border-0"
          style={{ animationDelay: `${rowIdx * 60}ms` }}
        >
          {Array.from({ length: columns }).map((_, colIdx) => (
            <Bone
              key={colIdx}
              className={cn(
                'h-4',
                colIdx === 0 ? 'w-28' : colIdx === columns - 1 ? 'w-16' : 'flex-1',
                colIdx === 1 && 'w-20'
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Detail Skeleton ───────────────────────────────────────────────────────────
interface DetailSkeletonProps {
  className?: string;
}

export function DetailSkeleton({ className }: DetailSkeletonProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Page header */}
      <div className="flex items-center justify-between pb-6 border-b border-border/60">
        <div className="space-y-2">
          <Bone className="h-7 w-56" />
          <Bone className="h-4 w-72" />
        </div>
        <div className="flex gap-2">
          <Bone className="h-9 w-24 rounded-lg" />
          <Bone className="h-9 w-28 rounded-lg" />
        </div>
      </div>

      {/* Stat cards row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <Bone className="h-3.5 w-20" />
              <Bone className="h-10 w-10 rounded-xl" />
            </div>
            <Bone className="h-8 w-24" />
            <Bone className="h-3 w-32" />
          </div>
        ))}
      </div>

      {/* Content blocks */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main block */}
        <div className="lg:col-span-2 rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="border-b px-6 py-4 bg-gradient-to-r from-muted/60 to-transparent">
            <Bone className="h-5 w-32" />
          </div>
          <div className="p-6 space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <Bone className="h-4 w-24 shrink-0" />
                <Bone className={cn('h-4', i % 3 === 0 ? 'w-48' : i % 3 === 1 ? 'w-32' : 'w-56')} />
              </div>
            ))}
          </div>
        </div>
        {/* Side block */}
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="border-b px-6 py-4 bg-gradient-to-r from-muted/60 to-transparent">
            <Bone className="h-5 w-28" />
          </div>
          <div className="p-6 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <Bone className="h-3 w-16" />
                <Bone className={cn('h-4', i % 2 === 0 ? 'w-full' : 'w-3/4')} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Card Grid Skeleton ────────────────────────────────────────────────────────
interface CardGridSkeletonProps {
  cards?: number;
  columns?: 2 | 3 | 4;
  className?: string;
}

export function CardGridSkeleton({ cards = 6, columns = 3, className }: CardGridSkeletonProps) {
  const gridClass = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  }[columns];

  return (
    <div className={cn(`grid gap-4 ${gridClass}`, className)}>
      {Array.from({ length: cards }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border bg-card p-5 space-y-4"
          style={{ animationDelay: `${i * 40}ms` }}
        >
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <Bone className="h-4 w-3/4" />
              <Bone className="h-3 w-1/2" />
            </div>
            <Bone className="h-8 w-8 rounded-lg shrink-0 ml-3" />
          </div>
          <div className="space-y-2">
            <Bone className="h-3 w-full" />
            <Bone className="h-3 w-5/6" />
            <Bone className="h-3 w-4/6" />
          </div>
          <div className="flex gap-2 pt-1">
            <Bone className="h-6 w-16 rounded-full" />
            <Bone className="h-6 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── List Page Skeleton (header + filter bar + table) ─────────────────────────
interface ListPageSkeletonProps {
  rows?: number;
  columns?: number;
  showFilters?: boolean;
  className?: string;
}

export function ListPageSkeleton({ rows = 5, columns = 5, showFilters = true, className }: ListPageSkeletonProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Page header */}
      <div className="flex items-center justify-between pb-6 border-b border-border/60">
        <div className="space-y-2">
          <Bone className="h-7 w-48" />
          <Bone className="h-4 w-64" />
        </div>
        <Bone className="h-9 w-32 rounded-lg" />
      </div>

      {/* Filter / search bar */}
      {showFilters && (
        <div className="flex flex-wrap gap-3">
          <Bone className="h-9 w-64 rounded-lg" />
          <Bone className="h-9 w-36 rounded-lg" />
          <Bone className="h-9 w-36 rounded-lg" />
        </div>
      )}

      {/* Table */}
      <TableSkeleton rows={rows} columns={columns} />
    </div>
  );
}
