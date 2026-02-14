'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExpandableTextProps {
  content: string;
  maxLines?: number;
  className?: string;
  expandText?: string;
  collapseText?: string;
}

export function ExpandableText({
  content,
  maxLines = 3,
  className,
  expandText = 'Xem thêm',
  collapseText = 'Thu gọn',
}: ExpandableTextProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className={className}>
      <div
        className={cn(
          'overflow-hidden transition-all duration-300',
          !isExpanded && `line-clamp-${maxLines}`
        )}
      >
        {content}
      </div>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-blue-600 transition-colors hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        aria-expanded={isExpanded}
        aria-label={isExpanded ? collapseText : expandText}
      >
        {isExpanded ? (
          <>
            {collapseText}
            <ChevronUp className="h-4 w-4" aria-hidden="true" />
          </>
        ) : (
          <>
            {expandText}
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </>
        )}
      </button>
    </div>
  );
}
