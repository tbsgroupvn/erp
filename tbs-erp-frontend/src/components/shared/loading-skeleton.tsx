import { Skeleton } from '@/components/ui/skeleton';

/**
 * Page Skeleton - for loading full dashboard pages
 *
 * Shows a standardized skeleton layout with a title bar,
 * stat card grid, and a large content area placeholder.
 */
export function PageSkeleton() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-lg" />
    </div>
  );
}

/**
 * Dashboard Chart Skeleton - for loading chart sections
 */
export function ChartSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-6 space-y-4">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-[300px] w-full rounded-md" />
    </div>
  );
}

/**
 * Stat Cards Skeleton - for loading stat card grids
 */
export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border p-6 space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-48" />
        </div>
      ))}
    </div>
  );
}
