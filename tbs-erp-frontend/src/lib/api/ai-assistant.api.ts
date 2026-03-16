import { apiClient } from './client';
import type { BaseResponse } from '@/lib/types';
import type { AISession, AIMessage, ChatResponse, ChatDto, StreamChunk } from '@/lib/types/ai-assistant.types';

export const aiAssistantApi = {
  /** GET /ai/sessions */
  getSessions: () =>
    apiClient
      .get<BaseResponse<AISession[]>>('/ai/sessions')
      .then((r) => r.data.data ?? []),

  /** POST /ai/sessions */
  createSession: () =>
    apiClient
      .post<BaseResponse<AISession>>('/ai/sessions')
      .then((r) => r.data.data!),

  /** DELETE /ai/sessions/:id */
  deleteSession: (id: string) =>
    apiClient
      .delete<BaseResponse<null>>(`/ai/sessions/${id}`)
      .then((r) => r.data),

  /** GET /ai/sessions/:id/messages */
  getMessages: (sessionId: string) =>
    apiClient
      .get<BaseResponse<AIMessage[]>>(`/ai/sessions/${sessionId}/messages`)
      .then((r) => r.data.data ?? []),

  /** POST /ai/chat (non-streaming) */
  chat: (dto: ChatDto) =>
    apiClient
      .post<BaseResponse<ChatResponse>>('/ai/chat', dto)
      .then((r) => r.data.data!),

  /**
   * Open SSE stream for AI chat.
   * Uses fetch + ReadableStream to support Authorization Bearer header.
   * Returns a controller object with a close() method.
   */
  streamChat: (
    sessionId: string,
    message: string,
    token: string | null,
    callbacks: {
      onSession?: (sessionId: string) => void;
      onChunk?: (text: string, accumulated: string) => void;
      onDone?: (tokensUsed: number) => void;
      onError?: (err: unknown) => void;
    },
  ): { close: () => void } => {
    const baseUrl =
      (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) ||
      'http://localhost:3001/api/v1';

    const params = new URLSearchParams({ message });
    if (sessionId) params.set('sessionId', sessionId);

    const url = `${baseUrl}/ai/stream?${params.toString()}`;
    const controller = new AbortController();
    let accumulated = '';

    const headers: Record<string, string> = {
      Accept: 'text/event-stream',
      'Cache-Control': 'no-cache',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    fetch(url, {
      headers,
      signal: controller.signal,
      credentials: 'include',
    })
      .then(async (res) => {
        if (!res.ok) {
          callbacks.onError?.(new Error(`HTTP ${res.status}`));
          return;
        }
        if (!res.body) {
          callbacks.onError?.(new Error('No response body'));
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const raw = line.slice(6).trim();
            if (!raw) continue;
            try {
              const chunk: StreamChunk = JSON.parse(raw);
              if (chunk.type === 'session' && chunk.sessionId) {
                callbacks.onSession?.(chunk.sessionId);
              } else if (chunk.type === 'text' && chunk.text) {
                accumulated += chunk.text;
                callbacks.onChunk?.(chunk.text, accumulated);
              } else if (chunk.type === 'done') {
                callbacks.onDone?.(chunk.tokensUsed ?? 0);
              }
            } catch {
              // ignore malformed JSON
            }
          }
        }
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        callbacks.onError?.(err);
      });

    return { close: () => controller.abort() };
  },
};
