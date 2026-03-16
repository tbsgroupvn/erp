'use client';

import * as React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils/cn';
import type { ChatMessage } from '@/lib/types';
import { MessageContextMenu } from './message-context-menu';
import { useReactToMessage } from '@/lib/hooks/use-chat';
import { useAuthStore } from '@/lib/stores/auth-store';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const ALLOWED_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉'] as const;

interface MessageBubbleProps {
  message: ChatMessage;
  isSelf: boolean;
  onReply: (message: ChatMessage) => void;
  onEdit: (message: ChatMessage) => void;
  onDelete: (message: ChatMessage) => void;
}

export function MessageBubble({ message, isSelf, onReply, onEdit, onDelete }: MessageBubbleProps) {
  const isDeleted = message.status === 'DELETED';
  const userId = useAuthStore((s) => s.user?.id ?? '');
  const reactToMessage = useReactToMessage();
  const [pickerOpen, setPickerOpen] = React.useState(false);

  const handleReact = (emoji: string) => {
    reactToMessage.mutate({
      messageId: message.id,
      emoji,
      conversationId: message.conversationId,
    });
    setPickerOpen(false);
  };

  // Group raw reactions array (from DB: { emoji, userId }[]) into summary
  const reactionSummary = React.useMemo(() => {
    const raw = (message as ChatMessage & { _rawReactions?: { emoji: string; userId: string }[] })._rawReactions;
    if (!raw?.length) return message.reactions ?? [];
    const map = new Map<string, { count: number; userIds: string[] }>();
    for (const r of raw) {
      const entry = map.get(r.emoji) ?? { count: 0, userIds: [] };
      entry.count += 1;
      entry.userIds.push(r.userId);
      map.set(r.emoji, entry);
    }
    return Array.from(map.entries()).map(([emoji, { count, userIds }]) => ({
      emoji,
      count,
      userIds,
      reactedByMe: userIds.includes(userId),
    }));
  }, [message, userId]);

  return (
    <MessageContextMenu
      message={message}
      isSelf={isSelf}
      onReply={onReply}
      onEdit={onEdit}
      onDelete={onDelete}
    >
      <div
        className={cn(
          'group flex flex-col max-w-[70%]',
          isSelf ? 'items-end self-end' : 'items-start self-start',
        )}
      >
        {/* Sender name (not self) */}
        {!isSelf && message.sender && (
          <span className="text-xs text-muted-foreground mb-0.5 px-1 font-medium">
            {message.sender.fullName}
          </span>
        )}

        {/* Reply-to context */}
        {message.replyTo && !isDeleted && (
          <div
            className={cn(
              'text-xs px-3 py-1.5 rounded-t-lg border-l-2 border-primary/60 bg-muted/60 max-w-full',
              'text-muted-foreground mb-0.5 truncate',
            )}
          >
            {message.replyTo.status === 'DELETED'
              ? 'Da thu hoi'
              : message.replyTo.content}
          </div>
        )}

        {/* Bubble + emoji picker on hover */}
        <div className="relative">
          <div
            className={cn(
              'rounded-2xl px-3.5 py-2 text-sm break-words',
              isSelf
                ? 'bg-primary text-primary-foreground rounded-tr-sm'
                : 'bg-muted text-foreground rounded-tl-sm',
              isDeleted && 'opacity-60 italic',
            )}
          >
            {isDeleted ? (
              <span className="text-xs">Da thu hoi</span>
            ) : (
              message.content
            )}
          </div>

          {/* Emoji picker — visible on group hover */}
          {!isDeleted && (
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    'absolute -top-3 opacity-0 group-hover:opacity-100 transition-opacity',
                    'bg-background border border-border rounded-full px-1.5 py-0.5 text-xs shadow-sm',
                    'hover:bg-muted cursor-pointer',
                    isSelf ? 'right-full mr-1' : 'left-full ml-1',
                  )}
                  aria-label="Them cam xuc"
                  onClick={(e) => e.stopPropagation()}
                >
                  +
                </button>
              </PopoverTrigger>
              <PopoverContent
                side={isSelf ? 'left' : 'right'}
                className="w-auto p-1.5 flex gap-0.5"
              >
                {ALLOWED_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleReact(emoji)}
                    className="text-lg px-1.5 py-0.5 rounded hover:bg-muted transition-colors cursor-pointer"
                    aria-label={`React ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          )}
        </div>

        {/* Reactions row */}
        {reactionSummary.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1 px-1">
            <TooltipProvider>
              {reactionSummary.map((r) => (
                <Tooltip key={r.emoji}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleReact(r.emoji)}
                      className={cn(
                        'flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full border transition-colors cursor-pointer',
                        r.reactedByMe
                          ? 'bg-primary/10 border-primary/40 text-primary'
                          : 'bg-muted/60 border-border hover:bg-muted',
                      )}
                      aria-label={`${r.emoji} ${r.count}`}
                    >
                      <span>{r.emoji}</span>
                      <span className="font-medium">{r.count}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">{r.userIds.length} nguoi da react</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </TooltipProvider>
          </div>
        )}

        {/* Meta */}
        <div className="flex items-center gap-1 mt-0.5 px-1">
          <span className="text-[10px] text-muted-foreground/70">
            {formatDistanceToNow(new Date(message.createdAt), {
              addSuffix: true,
              locale: vi,
            })}
          </span>
          {message.status === 'EDITED' && (
            <span className="text-[10px] text-muted-foreground/50">(da sua)</span>
          )}
        </div>
      </div>
    </MessageContextMenu>
  );
}
