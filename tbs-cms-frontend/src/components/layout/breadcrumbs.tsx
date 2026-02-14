'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';

import { cn } from '@/lib/utils/cn';
import { PATH_LABELS } from '@/lib/utils/constants';

function getSegmentLabel(segment: string): string {
  return PATH_LABELS[segment] ?? segment;
}

export function Breadcrumbs() {
  const pathname = usePathname();

  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm">
      <Link
        href="/tong-quan"
        className="text-muted-foreground hover:text-foreground transition-colors"
      >
        <Home className="h-4 w-4" />
      </Link>

      {segments.map((segment, index) => {
        const href = '/' + segments.slice(0, index + 1).join('/');
        const isLast = index === segments.length - 1;
        const label = getSegmentLabel(segment);

        return (
          <div key={href} className="flex items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            {isLast ? (
              <span className="font-medium text-foreground">{label}</span>
            ) : (
              <Link
                href={href}
                className={cn(
                  'text-muted-foreground hover:text-foreground transition-colors'
                )}
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
