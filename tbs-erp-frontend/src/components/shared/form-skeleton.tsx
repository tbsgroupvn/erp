'use client';

import { cn } from '@/lib/utils/cn';

interface FormSkeletonProps {
  /** Number of field groups to show */
  fields?: number;
  className?: string;
}

function Bone({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-muted',
        className,
      )}
    />
  );
}

/**
 * Skeleton placeholder for forms while data is loading (e.g. edit mode).
 * Shows a realistic form layout with label + input pairs.
 */
export function FormSkeleton({ fields = 6, className }: FormSkeletonProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Header area */}
      <div className="flex items-center gap-4">
        <Bone className="h-9 w-9 rounded-md" />
        <Bone className="h-7 w-48" />
      </div>

      {/* Form card */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="border-b px-6 py-4">
          <Bone className="h-5 w-36" />
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {Array.from({ length: fields }).map((_, i) => (
              <div key={i} className={cn('space-y-2', i === 0 && 'sm:col-span-2')}>
                <Bone className="h-3.5 w-24" />
                <Bone className="h-10 w-full rounded-md" />
              </div>
            ))}
          </div>
          {/* Textarea area */}
          <div className="space-y-2">
            <Bone className="h-3.5 w-20" />
            <Bone className="h-20 w-full rounded-md" />
          </div>
        </div>
      </div>

      {/* Items section */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="border-b px-6 py-4">
          <Bone className="h-5 w-32" />
        </div>
        <div className="p-6 space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-lg border p-4 space-y-3">
              <Bone className="h-4 w-20" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2 space-y-2">
                  <Bone className="h-3.5 w-24" />
                  <Bone className="h-9 w-full rounded-md" />
                </div>
                <div className="space-y-2">
                  <Bone className="h-3.5 w-16" />
                  <Bone className="h-9 w-full rounded-md" />
                </div>
                <div className="space-y-2">
                  <Bone className="h-3.5 w-16" />
                  <Bone className="h-9 w-full rounded-md" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex justify-end gap-3">
        <Bone className="h-10 w-20 rounded-md" />
        <Bone className="h-10 w-32 rounded-md" />
      </div>
    </div>
  );
}
