'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';
import { aiAssistantApi } from '@/lib/api/ai-assistant.api';
import { useAuthStore } from '@/lib/stores/auth-store';
import type { AISession, AIMessage } from '@/lib/types/ai-assistant.types';

// ---------------------------------------------------------------------------
// Query key factories
// ---------------------------------------------------------------------------
export const aiKeys = {
  all: ['ai-assistant'] as const,
  sessions: () => [...aiKeys.all, 'sessions'] as const,
  messages: (sessionId: string) => [...aiKeys.all, 'messages', sessionId] as const,
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/** List all sessions for the current user */
export function useAISessions() {
  return useQuery<AISession[]>({
    queryKey: aiKeys.sessions(),
    queryFn: () => aiAssistantApi.getSessions(),
    staleTime: 30_000,
  });
}

/** Create a new session */
export function useCreateSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => aiAssistantApi.createSession(),
    onSuccess: (newSession) => {
      queryClient.setQueryData<AISession[]>(aiKeys.sessions(), (old) =>
        old ? [newSession, ...old] : [newSession],
      );
    },
  });
}

/** Delete a session */
export function useDeleteSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => aiAssistantApi.deleteSession(sessionId),
    onSuccess: (_, sessionId) => {
      queryClient.setQueryData<AISession[]>(aiKeys.sessions(), (old) =>
        old ? old.filter((s) => s.id !== sessionId) : [],
      );
    },
  });
}

/** Get messages of a session */
export function useAIMessages(sessionId: string | null) {
  return useQuery<AIMessage[]>({
    queryKey: aiKeys.messages(sessionId ?? ''),
    queryFn: () => aiAssistantApi.getMessages(sessionId!),
    enabled: !!sessionId,
    staleTime: 10_000,
  });
}

/** Streaming chat hook — handles token injection and stream lifecycle */
export function useStreamChat() {
  const activeStreamRef = useRef<{ close: () => void } | null>(null);
  const accessToken = useAuthStore((s) => s.accessToken);

  const stopStream = useCallback(() => {
    if (activeStreamRef.current) {
      activeStreamRef.current.close();
      activeStreamRef.current = null;
    }
  }, []);

  const startStream = useCallback(
    (
      sessionId: string,
      message: string,
      callbacks: {
        onSession?: (sessionId: string) => void;
        onChunk?: (text: string, accumulated: string) => void;
        onDone?: (tokensUsed: number) => void;
        onError?: () => void;
      },
    ) => {
      // Close any existing stream
      stopStream();

      const stream = aiAssistantApi.streamChat(sessionId, message, accessToken, {
        onSession: callbacks.onSession,
        onChunk: callbacks.onChunk,
        onDone: (tokensUsed) => {
          callbacks.onDone?.(tokensUsed);
          activeStreamRef.current = null;
        },
        onError: (err) => {
          console.error('SSE error:', err);
          callbacks.onError?.();
          activeStreamRef.current = null;
        },
      });

      activeStreamRef.current = stream;
      return stream;
    },
    [stopStream, accessToken],
  );

  return { startStream, stopStream };
}
