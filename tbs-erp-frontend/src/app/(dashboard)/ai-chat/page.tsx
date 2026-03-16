'use client';

import { ChatWindow } from '@/features/ai-assistant/chat-window';

/**
 * Dedicated full-page AI Chat route (/ai-chat).
 * Uses the same ChatWindow component as the embedded tool tab,
 * but with full viewport height for a better standalone experience.
 */
export default function AiChatPage() {
  return (
    <div
      className="flex flex-col"
      style={{ height: 'calc(100vh - 64px - 2rem)' }}
    >
      <ChatWindow />
    </div>
  );
}
