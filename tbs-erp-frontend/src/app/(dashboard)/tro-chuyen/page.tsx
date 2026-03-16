'use client';

import * as React from 'react';
import { MessageSquare } from 'lucide-react';
import { ConversationList } from '@/features/chat/conversation-list';
import { MessageThread } from '@/features/chat/message-thread';
import { useConversations } from '@/lib/hooks/use-chat';

export default function TroChuyen() {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const { data: conversations = [] } = useConversations();

  const selectedConversation = React.useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  return (
    // -m-6 negates the <main> padding so chat fills the full content area
    <div className="flex h-full -m-6 overflow-hidden border-t">
      {/* Left — conversation list */}
      <div className="w-[280px] shrink-0 border-r flex flex-col bg-background">
        <ConversationList selectedId={selectedId} onSelect={setSelectedId} />
      </div>

      {/* Right — message thread or empty state */}
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        {selectedConversation ? (
          <MessageThread conversation={selectedConversation} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <MessageSquare className="h-7 w-7 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Chọn một cuộc trò chuyện</p>
              <p className="text-xs text-muted-foreground mt-1">
                Hoặc bắt đầu cuộc trò chuyện mới bằng nút + bên trái
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
