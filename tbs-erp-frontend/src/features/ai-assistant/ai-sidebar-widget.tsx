'use client';

import React, { useState } from 'react';
import { Bot, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ChatWindow } from './chat-window';

interface AISidebarWidgetProps {
  className?: string;
}

/**
 * Floating mini-widget that opens the AI chat as a modal.
 * Place inside the dashboard layout if desired, or use the standalone page.
 */
export function AISidebarWidget({ className }: AISidebarWidgetProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'fixed bottom-6 left-6 z-50 flex h-12 w-12 items-center justify-center rounded-full',
          'bg-violet-600 text-white shadow-lg hover:bg-violet-700 transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2',
          className,
        )}
        title="Mo TBS Assistant"
        aria-label="Mo TBS Assistant"
      >
        <Bot size={20} />
      </button>

      {/* Full-size dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="h-[85vh] max-w-5xl p-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>TBS Assistant</DialogTitle>
          </DialogHeader>
          <div className="h-full">
            <ChatWindow />
          </div>
          {/* Close button */}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300"
            aria-label="Dong"
          >
            <X size={14} />
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}
