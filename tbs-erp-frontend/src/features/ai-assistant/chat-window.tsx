'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Trash2, Send, Bot, MessageSquare, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { MessageBubble } from './message-bubble';
import {
  useAISessions,
  useCreateSession,
  useDeleteSession,
  useStreamChat,
} from '@/lib/hooks/use-ai-assistant';
import { aiAssistantApi } from '@/lib/api/ai-assistant.api';
import type { AISession, AIMessage } from '@/lib/types/ai-assistant.types';

interface LocalMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
  timestamp?: string;
}

function TypingIndicator() {
  return (
    <div className="flex gap-3 mb-4">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-violet-600 text-white">
        <Bot size={14} />
      </div>
      <div className="rounded-2xl rounded-tl-sm bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 shadow-sm px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-zinc-400 animate-bounce [animation-delay:0ms]" />
          <span className="h-2 w-2 rounded-full bg-zinc-400 animate-bounce [animation-delay:150ms]" />
          <span className="h-2 w-2 rounded-full bg-zinc-400 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

function formatSessionTitle(session: AISession): string {
  if (session.title) return session.title;
  return `Phiên ${new Date(session.createdAt).toLocaleDateString('vi-VN')}`;
}

export function ChatWindow() {
  const { data: sessions = [], isLoading: sessionsLoading } = useAISessions();
  const createSession = useCreateSession();
  const deleteSession = useDeleteSession();
  const { startStream, stopStream } = useStreamChat();

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load messages when active session changes
  useEffect(() => {
    if (!activeSessionId) {
      setMessages([]);
      return;
    }
    setLoadingMessages(true);
    aiAssistantApi
      .getMessages(activeSessionId)
      .then((msgs: AIMessage[]) => {
        setMessages(
          msgs.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
          })),
        );
      })
      .catch(() => toast.error('Không thể tải tin nhắn'))
      .finally(() => setLoadingMessages(false));
  }, [activeSessionId]);

  const handleSelectSession = useCallback(
    (sessionId: string) => {
      if (isStreaming) {
        stopStream();
        setIsStreaming(false);
      }
      setActiveSessionId(sessionId);
    },
    [isStreaming, stopStream],
  );

  const handleNewSession = useCallback(async () => {
    if (isStreaming) {
      stopStream();
      setIsStreaming(false);
    }
    try {
      const session = await createSession.mutateAsync();
      setActiveSessionId(session.id);
      setMessages([]);
    } catch {
      toast.error('Không thể tạo phiên mới');
    }
  }, [createSession, isStreaming, stopStream]);

  const handleDeleteSession = useCallback(
    async (e: React.MouseEvent, sessionId: string) => {
      e.stopPropagation();
      await deleteSession.mutateAsync(sessionId);
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        setMessages([]);
      }
    },
    [deleteSession, activeSessionId],
  );

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    setInput('');
    textareaRef.current?.focus();

    // Generate stable local IDs for optimistic rendering
    const userMsgId = `local-user-${Date.now()}`;
    const assistantMsgId = `local-assistant-${Date.now() + 1}`;

    const now = new Date().toISOString();
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: 'user', content: trimmed, timestamp: now },
    ]);

    setIsStreaming(true);
    setIsTyping(true);

    startStream(activeSessionId ?? '', trimmed, {
      onSession: (sid) => {
        setActiveSessionId(sid);
      },
      onChunk: (_text, accumulated) => {
        setIsTyping(false);
        setMessages((prev) => {
          const existing = prev.find((m) => m.id === assistantMsgId);
          if (existing) {
            return prev.map((m) =>
              m.id === assistantMsgId ? { ...m, content: accumulated } : m,
            );
          }
          return [
            ...prev,
            { id: assistantMsgId, role: 'assistant', content: accumulated, streaming: true, timestamp: new Date().toISOString() },
          ];
        });
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      },
      onDone: () => {
        setIsTyping(false);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId ? { ...m, streaming: false } : m,
          ),
        );
        setIsStreaming(false);
      },
      onError: () => {
        setIsTyping(false);
        setMessages((prev) => {
          const existing = prev.find((m) => m.id === assistantMsgId);
          const errMsg = { id: assistantMsgId, role: 'assistant' as const, content: 'Xin lỗi, đã có lỗi xảy ra. Vui lòng thử lại.', streaming: false, timestamp: new Date().toISOString() };
          if (existing) {
            return prev.map((m) => m.id === assistantMsgId ? errMsg : m);
          }
          return [...prev, errMsg];
        });
        setIsStreaming(false);
        toast.error('Kết nối AI bị gián đoạn');
      },
    });
  }, [input, isStreaming, activeSessionId, startStream]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage],
  );

  const handleStop = useCallback(() => {
    stopStream();
    setIsStreaming(false);
    setIsTyping(false);
    setMessages((prev) =>
      prev.map((m) => (m.streaming ? { ...m, streaming: false } : m)),
    );
  }, [stopStream]);

  return (
    <div className="flex h-full overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 shadow-sm">
      {/* ------------------------------------------------------------------ */}
      {/* Left sidebar — session list */}
      {/* ------------------------------------------------------------------ */}
      <aside className="flex w-64 flex-shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800/50">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 p-3 dark:border-zinc-700">
          <div className="flex items-center gap-2">
            <Bot size={18} className="text-violet-600" />
            <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              TBS Assistant
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleNewSession}
            disabled={createSession.isPending}
            title="Tạo phiên mới"
          >
            <Plus size={14} />
          </Button>
        </div>

        {/* Session list */}
        <ScrollArea className="flex-1">
          {sessionsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={18} className="animate-spin text-zinc-400" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-zinc-400">
              Chưa có phiên chat nào.
              <br />
              Nhấn + để bắt đầu.
            </div>
          ) : (
            <div className="py-2">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => handleSelectSession(session.id)}
                  className={cn(
                    'group flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 mx-1 text-left transition-colors',
                    activeSessionId === session.id
                      ? 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
                      : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700/50',
                  )}
                  style={{ width: 'calc(100% - 8px)' }}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <MessageSquare size={13} className="flex-shrink-0 opacity-60" />
                    <span className="truncate text-xs font-medium">
                      {formatSessionTitle(session)}
                    </span>
                  </div>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => handleDeleteSession(e, session.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleDeleteSession(e as unknown as React.MouseEvent, session.id);
                    }}
                    className="hidden flex-shrink-0 rounded p-0.5 text-zinc-400 hover:text-red-500 group-hover:block cursor-pointer"
                    title="Xóa phiên"
                  >
                    <Trash2 size={12} />
                  </span>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer hint */}
        <div className="border-t border-zinc-200 p-3 dark:border-zinc-700">
          <p className="text-center text-xs text-zinc-400">Shift+Enter: xuống dòng</p>
        </div>
      </aside>

      {/* ------------------------------------------------------------------ */}
      {/* Right main — chat area */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {activeSessionId ? (
          <>
            {/* Message thread */}
            <ScrollArea className="flex-1 p-4">
              {loadingMessages ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={24} className="animate-spin text-zinc-400" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center py-16 text-center px-6">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 dark:bg-violet-900/30">
                    <Bot size={32} className="text-violet-600" />
                  </div>
                  <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                    Xin chào! Tôi là TBS Assistant.
                  </p>
                  <p className="mt-1.5 text-xs text-zinc-400 max-w-xs leading-relaxed">
                    Hỏi bất kỳ điều gì về đơn hàng, khách hàng, tài chính, container hoặc quy trình nghiệp vụ.
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {[
                      'Đơn hàng hôm nay',
                      'Công nợ quá hạn',
                      'Trạng thái container',
                    ].map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setInput(q)}
                        className="rounded-full border border-violet-200 dark:border-violet-700 px-3 py-1 text-xs text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mx-auto max-w-3xl">
                  {messages.map((msg) => (
                    <MessageBubble
                      key={msg.id}
                      role={msg.role}
                      content={msg.content}
                      streaming={msg.streaming}
                      timestamp={msg.timestamp}
                    />
                  ))}
                  {isTyping && <TypingIndicator />}
                  <div ref={bottomRef} />
                </div>
              )}
            </ScrollArea>

            {/* Input bar */}
            <div className="border-t border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
              <div className="mx-auto flex max-w-3xl items-end gap-2">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Nhập tin nhắn... (Enter gửi, Shift+Enter xuống dòng)"
                  disabled={isStreaming}
                  rows={1}
                  className="flex-1 resize-none rounded-xl border-zinc-300 bg-zinc-50 text-sm focus:border-violet-400 focus:ring-violet-200 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
                  style={{ minHeight: '40px', maxHeight: '160px' }}
                />
                {isStreaming ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleStop}
                    className="h-10 rounded-xl border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600"
                  >
                    <Loader2 size={14} className="mr-1 animate-spin" />
                    Dừng
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={sendMessage}
                    disabled={!input.trim() || isStreaming}
                    className="h-10 rounded-xl bg-violet-600 hover:bg-violet-700 text-white"
                  >
                    <Send size={14} />
                  </Button>
                )}
              </div>
            </div>
          </>
        ) : (
          /* Empty state — no session selected */
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 dark:bg-violet-900/30">
              <Bot size={32} className="text-violet-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-800 dark:text-zinc-100">
                TBS Assistant
              </h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Chọn phiên chat hoặc tạo mới để bắt đầu
              </p>
            </div>
            <Button
              onClick={handleNewSession}
              disabled={createSession.isPending}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              {createSession.isPending ? (
                <Loader2 size={14} className="mr-2 animate-spin" />
              ) : (
                <Plus size={14} className="mr-2" />
              )}
              Tạo phiên mới
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
