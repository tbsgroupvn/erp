'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { PATH_LABELS } from '@/lib/utils/constants';

/**
 * Maps a URL path segment to a Vietnamese display label.
 * Falls back to the raw segment (capitalised) for unrecognised paths.
 */
function getSegmentLabel(segment: string): string {
  // Numeric segments (e.g. IDs) are hidden in the label but kept in the path
  if (/^\d+$/.test(segment)) return `#${segment}`;
  return PATH_LABELS[segment] ?? segment;
}

interface BreadcrumbProps {
  className?: string;
  /** Max segments to show before truncating with ellipsis (default: 4) */
  maxSegments?: number;
}

/**
 * Shared Breadcrumb component — auto-generates from the current pathname.
 *
 * Used in:
 *  - `src/components/layout/topbar.tsx` (via `<Breadcrumbs />`)
 *  - Any page that wants a standalone breadcrumb trail
 *
 * @example
 * <Breadcrumb className="mb-4" />
 */
export function Breadcrumb({ className, maxSegments = 4 }: BreadcrumbProps) {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0) return null;

  // Truncate in the middle when there are too many segments
  const needsTruncation = segments.length > maxSegments;
  const visibleSegments = needsTruncation
    ? [...segments.slice(0, 1), null, ...segments.slice(-(maxSegments - 2))]
    : segments;

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn('flex items-center gap-1 text-sm', className)}
    >
      {/* Home link */}
      <Link
        href="/tong-quan"
        className="text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Trang chu"
      >
        <Home className="h-4 w-4" />
      </Link>

      {visibleSegments.map((segment, index) => {
        // Ellipsis placeholder
        if (segment === null) {
          return (
            <div key="ellipsis" className="flex items-center gap-1">
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" aria-hidden="true" />
              <span className="text-muted-foreground/60 select-none">...</span>
            </div>
          );
        }

        // Reconstruct href — handle ellipsis offset
        const segmentIndex = needsTruncation
          ? index < 2
            ? index
            : segments.length - (visibleSegments.length - 1 - index)
          : index;
        const href = '/' + segments.slice(0, segmentIndex + 1).join('/');
        const isLast = index === visibleSegments.length - 1;
        const label = getSegmentLabel(segment);

        return (
          <div key={href} className="flex items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" aria-hidden="true" />
            {isLast ? (
              <span
                className="font-semibold text-foreground max-w-[200px] truncate"
                aria-current="page"
              >
                {label}
              </span>
            ) : (
              <Link
                href={href}
                className="text-muted-foreground hover:text-foreground transition-colors max-w-[140px] truncate"
              >
                {label}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}
