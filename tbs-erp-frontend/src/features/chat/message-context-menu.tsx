'use client';

import * as React from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { Reply, Pencil, Trash2 } from 'lucide-react';
import type { ChatMessage } from '@/lib/types';

interface Props {
  message: ChatMessage;
  isSelf: boolean;
  onReply: (message: ChatMessage) => void;
  onEdit: (message: ChatMessage) => void;
  onDelete: (message: ChatMessage) => void;
  children: React.ReactNode;
}

export function MessageContextMenu({
  message,
  isSelf,
  onReply,
  onEdit,
  onDelete,
  children,
}: Props) {
  const isDeleted = message.status === 'DELETED';
  const canEdit =
    isSelf &&
    !isDeleted &&
    Date.now() - new Date(message.createdAt).getTime() < 5 * 60 * 1000;

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="z-50 min-w-[160px] overflow-hidden rounded-md border bg-popover p-1 shadow-md animate-in fade-in-0 zoom-in-95">
          {!isDeleted && (
            <ContextMenu.Item
              className="flex items-center gap-2 rounded-sm px-3 py-1.5 text-sm cursor-pointer hover:bg-accent focus:outline-none"
              onSelect={() => onReply(message)}
            >
              <Reply className="h-3.5 w-3.5" />
              Trả lời
            </ContextMenu.Item>
          )}
          {canEdit && (
            <ContextMenu.Item
              className="flex items-center gap-2 rounded-sm px-3 py-1.5 text-sm cursor-pointer hover:bg-accent focus:outline-none"
              onSelect={() => onEdit(message)}
            >
              <Pencil className="h-3.5 w-3.5" />
              Chỉnh sửa
            </ContextMenu.Item>
          )}
          {isSelf && !isDeleted && (
            <ContextMenu.Item
              className="flex items-center gap-2 rounded-sm px-3 py-1.5 text-sm text-destructive cursor-pointer hover:bg-destructive/10 focus:outline-none"
              onSelect={() => onDelete(message)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Thu hồi
            </ContextMenu.Item>
          )}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
