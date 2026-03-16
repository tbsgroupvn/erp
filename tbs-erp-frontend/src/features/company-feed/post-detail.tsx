'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { MessageSquare, Eye, Pin, Send, Trash2, CornerDownRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils/cn';
import { useAuthStore } from '@/lib/stores/auth-store';
import {
  usePost,
  usePostComments,
  useReactToPost,
  useCreateComment,
  useDeleteComment,
} from '@/lib/hooks/use-company-feed';
import { sanitizeHtml } from '@/lib/utils/sanitize-html';
import type { PostComment, ReactionType } from '@/lib/types/company-feed.types';
import {
  POST_CATEGORY_LABELS,
  POST_CATEGORY_COLORS,
  REACTION_EMOJI,
  REACTION_LABEL,
} from '@/lib/types/company-feed.types';

const REACTION_TYPES: ReactionType[] = ['LIKE', 'CLAP', 'CELEBRATE', 'HEART', 'INSIGHTFUL'];

function CommentItem({
  comment,
  postId,
  currentUserId,
  onReply,
}: {
  comment: PostComment;
  postId: string;
  currentUserId: string;
  onReply: (parentId: string, authorId: string) => void;
}) {
  const deleteComment = useDeleteComment();
  const isAuthor = comment.authorId === currentUserId;

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
          {comment.authorId.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="rounded-xl bg-muted/60 px-3 py-2">
            <p className="text-xs font-semibold text-foreground mb-0.5">
              {comment.authorId.slice(0, 8)}...
            </p>
            <p className="text-sm text-foreground whitespace-pre-wrap break-words">
              {comment.content}
            </p>
          </div>
          <div className="flex items-center gap-3 mt-1 pl-1">
            <time className="text-xs text-muted-foreground">
              {new Date(comment.createdAt).toLocaleString('vi-VN')}
            </time>
            <button
              type="button"
              onClick={() => onReply(comment.id, comment.authorId)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Trả lời
            </button>
            {isAuthor && (
              <button
                type="button"
                onClick={() => deleteComment.mutate({ commentId: comment.id, postId })}
                disabled={deleteComment.isPending}
                className="text-xs text-destructive/70 hover:text-destructive transition-colors"
              >
                Xóa
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="pl-9 space-y-2">
          {comment.replies.map((reply) => (
            <div key={reply.id} className="flex items-start gap-2">
              <CornerDownRight className="h-3.5 w-3.5 text-muted-foreground mt-1.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="rounded-xl bg-muted/40 px-3 py-2">
                  <p className="text-xs font-semibold text-foreground mb-0.5">
                    {reply.authorId.slice(0, 8)}...
                  </p>
                  <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                    {reply.content}
                  </p>
                </div>
                <div className="flex items-center gap-3 mt-1 pl-1">
                  <time className="text-xs text-muted-foreground">
                    {new Date(reply.createdAt).toLocaleString('vi-VN')}
                  </time>
                  {reply.authorId === currentUserId && (
                    <button
                      type="button"
                      onClick={() => deleteComment.mutate({ commentId: reply.id, postId })}
                      disabled={deleteComment.isPending}
                      className="text-xs text-destructive/70 hover:text-destructive transition-colors"
                    >
                      Xóa
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface PostDetailProps {
  postId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PostDetail({ postId, open, onOpenChange }: PostDetailProps) {
  const user = useAuthStore((s) => s.user);
  const userId = user?.id ?? '';

  const { data: post, isLoading: loadingPost } = usePost(postId ?? '');
  const { data: comments = [], isLoading: loadingComments } = usePostComments(postId ?? '');
  const reactMutation = useReactToPost();
  const createComment = useCreateComment(postId ?? '');

  const [commentText, setCommentText] = useState('');
  const [replyTarget, setReplyTarget] = useState<{ parentId: string; authorId: string } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleReply(parentId: string, authorId: string) {
    setReplyTarget({ parentId, authorId });
    setTimeout(() => textareaRef.current?.focus(), 100);
  }

  function handleCancelReply() {
    setReplyTarget(null);
    setCommentText('');
  }

  async function handleSubmitComment() {
    const content = commentText.trim();
    if (!content) return;

    await createComment.mutateAsync({
      content,
      parentId: replyTarget?.parentId,
    });

    setCommentText('');
    setReplyTarget(null);
  }

  if (!postId) return null;

  const myReactions = post?.reactions.filter((r) => r.userId === userId).map((r) => r.type) ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
        {loadingPost ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : post ? (
          <>
            {/* Scrollable content area */}
            <div className="flex-1 overflow-y-auto">
              {/* Cover */}
              {post.coverImage && (
                <div className="relative w-full h-48">
                  <Image
                    src={post.coverImage}
                    alt={post.title}
                    fill
                    className="object-cover"
                    sizes="672px"
                  />
                </div>
              )}

              <div className="p-6">
                <DialogHeader className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
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
                  <DialogTitle className="text-left text-xl font-bold leading-snug">
                    {post.title}
                  </DialogTitle>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <time>
                      {post.publishedAt
                        ? new Date(post.publishedAt).toLocaleString('vi-VN')
                        : new Date(post.createdAt).toLocaleString('vi-VN')}
                    </time>
                    <span className="flex items-center gap-1">
                      <Eye className="h-3.5 w-3.5" />
                      {post.viewCount} lượt xem
                    </span>
                  </div>
                </DialogHeader>

                {/* HTML Content — sanitized via DOMPurify before render */}
                <div
                  className="prose prose-sm dark:prose-invert max-w-none mb-6"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.content) }}
                />

                {/* Reaction bar */}
                <div className="flex items-center gap-2 py-3 border-y border-border/60 mb-5">
                  {REACTION_TYPES.map((type) => {
                    const count = post.reactions.filter((r) => r.type === type).length;
                    const isActive = myReactions.includes(type);
                    return (
                      <button
                        key={type}
                        type="button"
                        title={REACTION_LABEL[type]}
                        onClick={() => reactMutation.mutate({ id: post.id, type })}
                        disabled={reactMutation.isPending}
                        className={cn(
                          'flex items-center gap-1 rounded-full px-2.5 py-1 text-sm transition-colors',
                          isActive
                            ? 'bg-primary/15 text-primary font-semibold'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80',
                        )}
                      >
                        <span>{REACTION_EMOJI[type]}</span>
                        {count > 0 && <span className="text-xs">{count}</span>}
                      </button>
                    );
                  })}
                </div>

                {/* Comments */}
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Bình luận ({post._count.comments})
                  </h3>

                  {loadingComments ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex gap-2">
                          <Skeleton className="h-7 w-7 rounded-full shrink-0" />
                          <Skeleton className="h-16 flex-1 rounded-xl" />
                        </div>
                      ))}
                    </div>
                  ) : comments.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Chưa có bình luận. Hãy là người đầu tiên!
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {comments.map((comment) => (
                        <CommentItem
                          key={comment.id}
                          comment={comment}
                          postId={post.id}
                          currentUserId={userId}
                          onReply={handleReply}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Comment input — sticky at bottom */}
            <div className="border-t border-border bg-background p-4 space-y-2">
              {replyTarget && (
                <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted rounded-md px-3 py-1.5">
                  <span className="flex items-center gap-1">
                    <CornerDownRight className="h-3 w-3" />
                    Đang trả lời bình luận
                  </span>
                  <button
                    type="button"
                    onClick={handleCancelReply}
                    className="hover:text-foreground transition-colors"
                  >
                    Hủy
                  </button>
                </div>
              )}
              <div className="flex gap-2">
                <Textarea
                  ref={textareaRef}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Viết bình luận..."
                  rows={2}
                  className="flex-1 resize-none text-sm min-h-0"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmitComment();
                    }
                  }}
                />
                <Button
                  type="button"
                  size="icon"
                  onClick={handleSubmitComment}
                  disabled={!commentText.trim() || createComment.isPending}
                  className="self-end shrink-0"
                >
                  <Send className="h-4 w-4" />
                  <span className="sr-only">Gửi</span>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Nhấn Enter để gửi, Shift+Enter để xuống dòng</p>
            </div>
          </>
        ) : (
          <div className="p-6 text-center text-muted-foreground">
            Không tìm thấy bài viết
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
