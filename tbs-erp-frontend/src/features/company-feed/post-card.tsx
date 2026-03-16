'use client';

import { useState } from 'react';
import Image from 'next/image';
import { MessageSquare, Eye, Pin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useReactToPost } from '@/lib/hooks/use-company-feed';
import type { CompanyPost, ReactionType } from '@/lib/types/company-feed.types';
import {
  POST_CATEGORY_LABELS,
  POST_CATEGORY_COLORS,
  REACTION_EMOJI,
  REACTION_LABEL,
} from '@/lib/types/company-feed.types';

const REACTION_TYPES: ReactionType[] = ['LIKE', 'CLAP', 'CELEBRATE', 'HEART', 'INSIGHTFUL'];

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Vừa xong';
  if (diffMins < 60) return `${diffMins} phút trước`;
  if (diffHours < 24) return `${diffHours} giờ trước`;
  if (diffDays < 7) return `${diffDays} ngày trước`;
  return date.toLocaleDateString('vi-VN');
}

interface PostCardProps {
  post: CompanyPost;
  onViewDetail?: (post: CompanyPost) => void;
}

export function PostCard({ post, onViewDetail }: PostCardProps) {
  const user = useAuthStore((s) => s.user);
  const reactMutation = useReactToPost();
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  const userId = user?.id ?? '';

  // Nhóm reactions theo type để hiển thị count
  const reactionGroups = REACTION_TYPES.reduce<Record<ReactionType, number>>(
    (acc, type) => {
      acc[type] = post.reactions.filter((r) => r.type === type).length;
      return acc;
    },
    {} as Record<ReactionType, number>,
  );

  const myReactions = post.reactions
    .filter((r) => r.userId === userId)
    .map((r) => r.type);

  const totalReactions = post._count.reactions;

  function handleReact(type: ReactionType) {
    reactMutation.mutate({ id: post.id, type });
    setShowReactionPicker(false);
  }

  const displayDate = post.publishedAt ?? post.createdAt;

  return (
    <article
      className={cn(
        'rounded-xl border bg-card text-card-foreground shadow-sm transition-shadow hover:shadow-md',
        post.isPinned && 'border-yellow-400/70 bg-yellow-50/30 dark:bg-yellow-950/10',
      )}
    >
      {/* Cover Image */}
      {post.coverImage && (
        <div className="relative w-full h-48 rounded-t-xl overflow-hidden">
          <Image
            src={post.coverImage}
            alt={post.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 672px"
          />
        </div>
      )}

      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Badge className={cn('text-xs', POST_CATEGORY_COLORS[post.category])}>
              {POST_CATEGORY_LABELS[post.category]}
            </Badge>
            {post.isPinned && (
              <span className="flex items-center gap-1 text-xs text-yellow-600 font-medium">
                <Pin className="h-3 w-3" />
                Ghim
              </span>
            )}
          </div>
          <time
            className="text-xs text-muted-foreground shrink-0"
            dateTime={displayDate}
            title={new Date(displayDate).toLocaleString('vi-VN')}
          >
            {formatRelativeTime(displayDate)}
          </time>
        </div>

        {/* Title */}
        <h2 className="text-lg font-semibold leading-snug text-foreground mb-2 line-clamp-2">
          {post.title}
        </h2>

        {/* Excerpt */}
        {post.excerpt && (
          <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
            {post.excerpt}
          </p>
        )}

        {/* Reaction bar */}
        <div className="flex items-center justify-between pt-3 border-t border-border/60 mt-3">
          <div className="flex items-center gap-1">
            {/* Reaction summary pills */}
            {totalReactions > 0 && (
              <div className="flex items-center gap-0.5 mr-2">
                {REACTION_TYPES.filter((t) => reactionGroups[t] > 0).map((type) => (
                  <span key={type} className="text-sm">
                    {REACTION_EMOJI[type]}
                  </span>
                ))}
                <span className="text-xs text-muted-foreground ml-1">{totalReactions}</span>
              </div>
            )}

            {/* Reaction picker trigger */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowReactionPicker((v) => !v)}
                className={cn(
                  'flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  myReactions.length > 0
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80',
                )}
                aria-label="Reaction"
              >
                {myReactions.length > 0 ? (
                  <span>{REACTION_EMOJI[myReactions[0]]}</span>
                ) : (
                  <span>👍</span>
                )}
                <span>{myReactions.length > 0 ? REACTION_LABEL[myReactions[0]] : 'Thích'}</span>
              </button>

              {showReactionPicker && (
                <div className="absolute bottom-full left-0 mb-2 z-10 flex items-center gap-1 rounded-full border bg-background shadow-lg px-2 py-1.5">
                  {REACTION_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      title={REACTION_LABEL[type]}
                      onClick={() => handleReact(type)}
                      className={cn(
                        'text-xl p-1 rounded-full transition-transform hover:scale-125',
                        myReactions.includes(type) && 'bg-primary/15 scale-110',
                      )}
                    >
                      {REACTION_EMOJI[type]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <MessageSquare className="h-3.5 w-3.5" />
              {post._count.comments}
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Eye className="h-3.5 w-3.5" />
              {post.viewCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onViewDetail?.(post)}
            >
              Xem chi tiết
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
