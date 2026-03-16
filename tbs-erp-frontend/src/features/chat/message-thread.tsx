'use client';

import * as React from 'react';
import { Loader2, Users, ChevronDown, Pin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StartCallButton } from '@/features/video/start-call-button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  useMessages,
  useSendMessage,
  useEditMessage,
  useDeleteMessage,
  useMarkAsRead,
  useChatWebSocket,
} from '@/lib/hooks/use-chat';
import { useAuthStore } from '@/lib/stores/auth-store';
import { MessageBubble } from './message-bubble';
import { MessageInput } from './message-input';
import { TypingIndicator } from './typing-indicator';
import type { ChatMessage, Conversation } from '@/lib/types';

interface MessageThreadProps {
  conversation: Conversation;
}

export function MessageThread({ conversation }: MessageThreadProps) {
  const userId = useAuthStore((s) => s.user?.id ?? '');
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const [replyTo, setReplyTo] = React.useState<ChatMessage | null>(null);
  const [editingMsg, setEditingMsg] = React.useState<ChatMessage | null>(null);
  const [typingNames, setTypingNames] = React.useState<string[]>([]);

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useMessages(
    conversation.id,
  );
  const sendMessage = useSendMessage(conversation.id);
  const editMessage = useEditMessage();
  const deleteMessage = useDeleteMessage();
  const markAsRead = useMarkAsRead();
  const { handleInputChange } = useChatWebSocket(conversation.id);

  // Flatten pages (DESC order → reverse for display ASC)
  const allMessages = React.useMemo(() => {
    const pages = data?.pages ?? [];
    const flat = pages.flatMap((p) => p.items);
    return [...flat].reverse();
  }, [data]);

  // Auto-scroll to bottom on new messages
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMessages.length]);

  // Mark as read when conversation opens
  React.useEffect(() => {
    if (conversation.id) {
      markAsRead.mutate(conversation.id);
    }
  }, [conversation.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for typing events
  React.useEffect(() => {
    const socket = globalThis.__wsSocket;
    if (!socket) return;

    const timers = new Map<string, ReturnType<typeof setTimeout>>();

    const handler = (event: {
      conversationId: string;
      userId: string;
      isTyping: boolean;
      _timestamp?: string;
    }) => {
      if (event.conversationId !== conversation.id || event.userId === userId) return;

      if (event.isTyping) {
        // Get user name from conversation participants (best effort)
        const p = conversation.participants?.find((pt) => pt.userId === event.userId);
        // ChatParticipant may have an eagerly-loaded user object (server-enriched)
        const name = (p as (typeof p & { user?: { fullName?: string } }) | undefined)?.user?.fullName ?? 'Ai đó';

        setTypingNames((prev) =>
          prev.includes(name) ? prev : [...prev, name],
        );

        // Auto-clear after 3s
        if (timers.has(event.userId)) clearTimeout(timers.get(event.userId)!);
        timers.set(
          event.userId,
          setTimeout(() => {
            setTypingNames((prev) => prev.filter((n) => n !== name));
            timers.delete(event.userId);
          }, 3000),
        );
      } else {
        setTypingNames((prev) => prev.filter((_, i) => i !== 0)); // best-effort clear
      }
    };

    socket.on('chat:typing', handler);
    return () => {
      socket.off('chat:typing', handler);
      timers.forEach(clearTimeout);
    };
  }, [conversation.id, conversation.participants, userId]);

  const handleSend = (content: string, replyToId?: string) => {
    if (editingMsg) {
      editMessage.mutate({
        id: editingMsg.id,
        dto: { content },
        conversationId: conversation.id,
      });
      setEditingMsg(null);
      return;
    }
    sendMessage.mutate({ content, replyToId });
    setReplyTo(null);
  };

  const name =
    conversation.displayName ??
    conversation.name ??
    (conversation.type === 'GROUP' ? 'Nhóm chat' : 'Cuộc trò chuyện');

  const participantCount = conversation.participants?.filter((p) => !p.leftAt).length ?? 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-background">
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground text-xs font-semibold">
          {conversation.type === 'GROUP' ? (
            <Users className="h-4 w-4" />
          ) : (
            name
              .split(' ')
              .map((p) => p[0])
              .slice(0, 2)
              .join('')
              .toUpperCase()
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{name}</p>
          {conversation.type === 'GROUP' && (
            <p className="text-xs text-muted-foreground">{participantCount} thành viên</p>
          )}
        </div>
        <StartCallButton conversationId={conversation.id} />
      </div>

      {/* Pinned message banner */}
      {conversation.pinnedMessageId && (() => {
        const pinned = allMessages.find((m) => m.id === conversation.pinnedMessageId);
        if (!pinned) return null;
        return (
          <div className="flex items-center gap-2 px-4 py-2 border-b bg-amber-50 dark:bg-amber-950/20 text-sm">
            <Pin className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="font-medium text-amber-700 dark:text-amber-300 shrink-0">Da ghim:</span>
            <span className="truncate text-muted-foreground">{pinned.content}</span>
          </div>
        );
      })()}

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {/* Load more */}
        {hasNextPage && (
          <div className="flex justify-center mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="text-xs"
            >
              {isFetchingNextPage ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 mr-1 rotate-180" />
              )}
              Tải thêm
            </Button>
          </div>
        )}

        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && allMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-sm text-muted-foreground">Chưa có tin nhắn nào</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Hãy bắt đầu cuộc trò chuyện!</p>
          </div>
        )}

        {/* Messages */}
        <div className="flex flex-col gap-2">
          {allMessages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isSelf={msg.senderId === userId}
              onReply={setReplyTo}
              onEdit={setEditingMsg}
              onDelete={(m) =>
                deleteMessage.mutate({ id: m.id, conversationId: conversation.id })
              }
            />
          ))}
        </div>

        <div ref={bottomRef} />
      </div>

      {/* Typing indicator */}
      <TypingIndicator names={typingNames} />

      {/* Input */}
      <MessageInput
        onSend={handleSend}
        onTyping={handleInputChange}
        replyTo={editingMsg ?? replyTo}
        onCancelReply={() => {
          setReplyTo(null);
          setEditingMsg(null);
        }}
        disabled={sendMessage.isPending || editMessage.isPending}
      />
    </div>
  );
}
