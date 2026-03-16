'use client';

import * as React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Users } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { Conversation } from '@/lib/types';

interface ConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
  onlineUserIds?: Set<string>;
  onClick: () => void;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function ConversationItem({
  conversation,
  isSelected,
  onlineUserIds,
  onClick,
}: ConversationItemProps) {
  const lastMsg = conversation.messages?.[0] ?? null;
  const unread = conversation.unreadCount ?? 0;

  const name = conversation.displayName ?? conversation.name ?? 'Cuộc trò chuyện';
  const isOnline =
    conversation.type === 'DIRECT' &&
    conversation.dmTargetUser != null &&
    onlineUserIds?.has(conversation.dmTargetUser.id);

  const preview = lastMsg
    ? lastMsg.status === 'DELETED'
      ? 'Đã thu hồi'
      : lastMsg.content
    : 'Bắt đầu cuộc trò chuyện...';

  const time = lastMsg
    ? formatDistanceToNow(new Date(lastMsg.createdAt), { addSuffix: false, locale: vi })
    : null;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
        isSelected
          ? 'bg-primary/10 text-primary'
          : 'hover:bg-accent text-foreground',
      )}
    >
      {/* Avatar */}
      <div className="relative shrink-0">
        {conversation.type === 'GROUP' ? (
          <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
        ) : (
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground text-xs font-semibold">
            {getInitials(name)}
          </div>
        )}
        {isOnline && (
          <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-background" />
        )}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className="text-sm font-medium truncate">{name}</span>
          {time && (
            <span className="text-[10px] text-muted-foreground shrink-0">{time}</span>
          )}
        </div>
        <div className="flex items-center justify-between gap-1">
          <p className={cn('text-xs truncate', unread > 0 ? 'text-foreground font-medium' : 'text-muted-foreground')}>
            {preview}
          </p>
          {unread > 0 && (
            <span className="shrink-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
