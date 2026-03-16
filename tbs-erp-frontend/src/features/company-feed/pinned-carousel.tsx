'use client';

import { Pin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import type { CompanyPost } from '@/lib/types/company-feed.types';
import { POST_CATEGORY_LABELS, POST_CATEGORY_COLORS } from '@/lib/types/company-feed.types';

interface PinnedCarouselProps {
  posts: CompanyPost[];
  onSelect?: (post: CompanyPost) => void;
}

export function PinnedCarousel({ posts, onSelect }: PinnedCarouselProps) {
  if (posts.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        <Pin className="h-3.5 w-3.5" />
        <span>Bài ghim</span>
      </div>

      <div
        className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {posts.map((post) => (
          <button
            key={post.id}
            type="button"
            onClick={() => onSelect?.(post)}
            style={{ scrollSnapAlign: 'start' }}
            className={cn(
              'min-w-[260px] max-w-[300px] flex-shrink-0',
              'rounded-lg border-2 border-yellow-400/60 bg-yellow-50/50 dark:bg-yellow-950/20 p-4',
              'text-left transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ring',
            )}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <Badge className={cn('text-xs', POST_CATEGORY_COLORS[post.category])}>
                {POST_CATEGORY_LABELS[post.category]}
              </Badge>
              <span className="flex items-center gap-1 text-xs text-yellow-600 font-medium shrink-0">
                <Pin className="h-3 w-3" />
                Ghim
              </span>
            </div>

            <h3 className="text-sm font-semibold line-clamp-2 text-foreground">
              {post.title}
            </h3>

            {post.excerpt && (
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                {post.excerpt}
              </p>
            )}

            <p className="mt-2 text-xs text-muted-foreground">
              {post.publishedAt
                ? new Date(post.publishedAt).toLocaleDateString('vi-VN')
                : new Date(post.createdAt).toLocaleDateString('vi-VN')}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
