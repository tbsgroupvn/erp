'use client';

import {
  useQuery,
  useMutation,
  useInfiniteQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import { useEffect, useRef, useCallback } from 'react';
import { chatApi } from '@/lib/api/chat.api';
import { useAuthStore } from '@/lib/stores/auth-store';
import type { CreateDMDto, CreateGroupDto, SendMessageDto, EditMessageDto, ChatMessage } from '@/lib/types';

// ─── Query key factory ───

export const chatKeys = {
  all: ['chat'] as const,
  conversations: () => [...chatKeys.all, 'conversations'] as const,
  messages: (id: string) => [...chatKeys.all, 'messages', id] as const,
  totalUnread: () => [...chatKeys.all, 'unread'] as const,
  onlineUsers: () => [...chatKeys.all, 'online'] as const,
};

// ─── Queries ───

export function useConversations(search?: string) {
  return useQuery({
    queryKey: [...chatKeys.conversations(), search],
    queryFn: () => chatApi.listConversations(search),
    staleTime: 10_000,
  });
}

export function useMessages(conversationId: string | null) {
  return useInfiniteQuery({
    queryKey: chatKeys.messages(conversationId ?? ''),
    queryFn: ({ pageParam }) =>
      chatApi.getMessages(conversationId!, pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextCursor ?? undefined : undefined,
    enabled: !!conversationId,
    staleTime: 0,
  });
}

export function useChatUnreadCount() {
  return useQuery({
    queryKey: chatKeys.totalUnread(),
    queryFn: () => chatApi.getTotalUnread(),
    refetchInterval: 30_000,
    select: (data) => data.total,
  });
}

export function useOnlineUsers() {
  return useQuery({
    queryKey: chatKeys.onlineUsers(),
    queryFn: () => chatApi.getOnlineUsers(),
    refetchInterval: 30_000,
    select: (data) => new Set<string>(data),
  });
}

// ─── Mutations ───

export function useCreateDM() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateDMDto) => chatApi.createDM(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatKeys.conversations() });
    },
  });
}

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateGroupDto) => chatApi.createGroup(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatKeys.conversations() });
      toast.success('Tạo nhóm thành công');
    },
  });
}

export function useSendMessage(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: SendMessageDto) => chatApi.sendMessage(conversationId, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatKeys.messages(conversationId) });
      qc.invalidateQueries({ queryKey: chatKeys.conversations() });
    },
  });
}

export function useEditMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: EditMessageDto; conversationId: string }) =>
      chatApi.editMessage(id, dto),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: chatKeys.messages(vars.conversationId) });
    },
  });
}

export function useDeleteMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; conversationId: string }) =>
      chatApi.deleteMessage(id),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: chatKeys.messages(vars.conversationId) });
    },
  });
}

export function useMarkAsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => chatApi.markAsRead(conversationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatKeys.totalUnread() });
      qc.invalidateQueries({ queryKey: chatKeys.conversations() });
    },
  });
}

export function useReactToMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string; conversationId: string }) =>
      chatApi.reactToMessage(messageId, emoji),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: chatKeys.messages(vars.conversationId) });
    },
  });
}

// ─── WebSocket hook ───

/**
 * Subscribe to real-time chat events for the given conversation.
 * - Emits chat:join when conversationId changes
 * - Invalidates message cache on chat:message:new / edited / deleted
 * - Provides a typing emit handler (debounced)
 */
export function useChatWebSocket(conversationId: string | null) {
  const qc = useQueryClient();
  const socket = globalThis.__wsSocket ?? undefined;
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Heartbeat: emit every 30s to keep presence alive
  useEffect(() => {
    if (!socket) return;

    heartbeatRef.current = setInterval(() => {
      socket.emit('chat:heartbeat');
    }, 30_000);

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [socket]);

  useEffect(() => {
    if (!socket || !conversationId) return;

    socket.emit('chat:join', { conversationId });

    const handleNew = (msg: Pick<ChatMessage, 'conversationId'>) => {
      if (msg.conversationId === conversationId) {
        qc.invalidateQueries({ queryKey: chatKeys.messages(conversationId) });
      }
      qc.invalidateQueries({ queryKey: chatKeys.conversations() });
      qc.invalidateQueries({ queryKey: chatKeys.totalUnread() });
    };

    const handleEdited = (msg: Pick<ChatMessage, 'conversationId'>) => {
      if (msg.conversationId === conversationId) {
        qc.invalidateQueries({ queryKey: chatKeys.messages(conversationId) });
      }
    };

    const handleDeleted = (payload: { conversationId: string }) => {
      if (payload.conversationId === conversationId) {
        qc.invalidateQueries({ queryKey: chatKeys.messages(conversationId) });
      }
    };

    const handleConvCreated = () => {
      qc.invalidateQueries({ queryKey: chatKeys.conversations() });
    };

    const handleReactionUpdate = (payload: { conversationId: string }) => {
      if (payload.conversationId === conversationId) {
        qc.invalidateQueries({ queryKey: chatKeys.messages(conversationId) });
      }
    };

    const handlePresence = (payload: { userId: string; online: boolean }) => {
      qc.setQueryData(chatKeys.onlineUsers(), (old: string[] | undefined) => {
        const current = old ?? [];
        if (payload.online) {
          return current.includes(payload.userId) ? current : [...current, payload.userId];
        }
        return current.filter((id) => id !== payload.userId);
      });
    };

    socket.on('chat:message:new', handleNew);
    socket.on('chat:message:edited', handleEdited);
    socket.on('chat:message:deleted', handleDeleted);
    socket.on('chat:conversation:created', handleConvCreated);
    socket.on('chat:reaction:update', handleReactionUpdate);
    socket.on('chat:presence', handlePresence);

    return () => {
      socket.off('chat:message:new', handleNew);
      socket.off('chat:message:edited', handleEdited);
      socket.off('chat:message:deleted', handleDeleted);
      socket.off('chat:conversation:created', handleConvCreated);
      socket.off('chat:reaction:update', handleReactionUpdate);
      socket.off('chat:presence', handlePresence);
    };
  }, [socket, conversationId, qc]);

  const emitTyping = useCallback(
    (isTyping: boolean) => {
      if (!socket || !conversationId) return;
      socket.emit(isTyping ? 'chat:typing:start' : 'chat:typing:stop', { conversationId });
    },
    [socket, conversationId],
  );

  const handleInputChange = useCallback(() => {
    if (!conversationId) return;
    emitTyping(true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => emitTyping(false), 2000);
  }, [emitTyping, conversationId]);

  return { handleInputChange };
}

// ─── Typing indicator hook ───

export function useChatTyping(conversationId: string | null) {
  const userId = useAuthStore((s) => s.user?.id);
  const typingUsers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const socket = globalThis.__wsSocket ?? undefined;

  useEffect(() => {
    if (!socket || !conversationId) return;

    const handler = (event: { conversationId: string; userId: string; isTyping: boolean }) => {
      if (event.conversationId !== conversationId || event.userId === userId) return;
      // We don't use state here to avoid re-render loop — components subscribe directly
    };

    socket.on('chat:typing', handler);
    return () => { socket.off('chat:typing', handler); };
  }, [socket, conversationId, userId]);

  return typingUsers;
}
