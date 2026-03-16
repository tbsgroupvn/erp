'use client';

import * as React from 'react';
import { Send, X, Smile } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { EmojiPicker } from '@/features/emoji/emoji-picker';
import type { ChatMessage } from '@/lib/types';

interface MessageInputProps {
  onSend: (content: string, replyToId?: string) => void;
  onTyping?: () => void;
  replyTo?: ChatMessage | null;
  onCancelReply?: () => void;
  disabled?: boolean;
}

export function MessageInput({
  onSend,
  onTyping,
  replyTo,
  onCancelReply,
  disabled,
}: MessageInputProps) {
  const [value, setValue] = React.useState('');
  const [emojiOpen, setEmojiOpen] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed, replyTo?.id);
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    // Auto-resize
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    // Typing indicator
    onTyping?.();
  };

  const handleSelectEmoji = (emoji: string) => {
    // Chèn emoji vào vị trí con trỏ hiện tại
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart ?? value.length;
      const end = textarea.selectionEnd ?? value.length;
      const newValue = value.slice(0, start) + emoji + value.slice(end);
      setValue(newValue);
      // Đặt con trỏ sau emoji vừa chèn
      requestAnimationFrame(() => {
        textarea.setSelectionRange(start + emoji.length, start + emoji.length);
        textarea.focus();
        // Cập nhật chiều cao
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
      });
    } else {
      setValue((prev) => prev + emoji);
    }
    setEmojiOpen(false);
  };

  return (
    <div className="border-t bg-background">
      {/* Reply preview */}
      {replyTo && (
        <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 border-b text-xs text-muted-foreground">
          <div className="flex-1 truncate">
            <span className="font-medium text-foreground">
              {replyTo.sender?.fullName ?? 'User'}:
            </span>{' '}
            {replyTo.status === 'DELETED' ? 'Da thu hoi' : replyTo.content}
          </div>
          <button
            onClick={onCancelReply}
            className="shrink-0 rounded-sm p-0.5 hover:bg-muted focus:outline-none"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Input area */}
      <form onSubmit={handleSubmit} className="flex items-end gap-2 px-4 py-3">
        {/* Emoji Picker button */}
        <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled}
              className={cn(
                'h-10 w-10 rounded-xl shrink-0 text-muted-foreground',
                'hover:text-foreground hover:bg-muted/80',
                emojiOpen && 'text-foreground bg-muted/80',
              )}
              title="Chon emoji"
            >
              <Smile className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="start"
            sideOffset={8}
            className="p-0 border-0 shadow-none bg-transparent w-auto"
          >
            <EmojiPicker onSelect={handleSelectEmoji} />
          </PopoverContent>
        </Popover>

        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Nhap tin nhan... (Enter de gui, Shift+Enter xuong dong)"
          disabled={disabled}
          className={cn(
            'flex-1 resize-none rounded-xl border bg-muted/50 px-3.5 py-2.5 text-sm',
            'placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring',
            'min-h-[40px] max-h-[120px] transition-all',
          )}
        />
        <Button
          type="submit"
          size="icon"
          disabled={!value.trim() || disabled}
          className="h-10 w-10 rounded-xl shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
