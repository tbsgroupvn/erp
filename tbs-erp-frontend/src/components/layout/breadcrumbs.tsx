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
        className="text-muted-foreground/60 hover:text-foreground transition-colors duration-200"
        aria-label="Trang tong quan"
      >
        <Home className="h-3.5 w-3.5" />
      </Link>

      {segments.map((segment, index) => {
        const href = '/' + segments.slice(0, index + 1).join('/');
        const isLast = index === segments.length - 1;
        const label = getSegmentLabel(segment);

        return (
          <div key={href} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
            {isLast ? (
              <span className="text-[13px] font-medium text-foreground">
                {label}
              </span>
            ) : (
              <Link
                href={href}
                className={cn(
                  'text-[13px] text-muted-foreground/60 hover:text-foreground transition-colors duration-200'
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
