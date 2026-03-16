'use client';

import * as React from 'react';
import { Search, Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useConversations, useOnlineUsers } from '@/lib/hooks/use-chat';
import { ConversationItem } from './conversation-item';
import { NewDMDialog } from './new-dm-dialog';
import { NewGroupDialog } from './new-group-dialog';
import type { Conversation } from '@/lib/types';

interface ConversationListProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ConversationList({ selectedId, onSelect }: ConversationListProps) {
  const [search, setSearch] = React.useState('');
  const [dmOpen, setDmOpen] = React.useState(false);
  const [groupOpen, setGroupOpen] = React.useState(false);

  const { data: conversations = [], isLoading } = useConversations(search || undefined);
  const { data: onlineSet } = useOnlineUsers();

  const handleConvCreated = (conv: Conversation) => {
    onSelect(conv.id);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 border-b">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold">Trò chuyện</h2>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="Nhắn tin trực tiếp"
              onClick={() => setDmOpen(true)}
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="Tạo nhóm"
              onClick={() => setGroupOpen(true)}
            >
              <Users className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm cuộc trò chuyện..."
            className="w-full rounded-lg border bg-muted/50 pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        <div className="px-2 py-2 flex flex-col gap-0.5">
          {isLoading && (
            <div className="flex flex-col gap-2 p-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          )}

          {!isLoading && conversations.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">
                {search ? 'Không tìm thấy' : 'Chưa có cuộc trò chuyện nào'}
              </p>
              {!search && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 text-xs"
                  onClick={() => setDmOpen(true)}
                >
                  Bắt đầu nhắn tin
                </Button>
              )}
            </div>
          )}

          {conversations.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              isSelected={selectedId === conv.id}
              onlineUserIds={onlineSet}
              onClick={() => onSelect(conv.id)}
            />
          ))}
        </div>
      </ScrollArea>

      {/* Dialogs */}
      <NewDMDialog open={dmOpen} onOpenChange={setDmOpen} onCreated={handleConvCreated} />
      <NewGroupDialog open={groupOpen} onOpenChange={setGroupOpen} onCreated={handleConvCreated} />
    </div>
  );
}
