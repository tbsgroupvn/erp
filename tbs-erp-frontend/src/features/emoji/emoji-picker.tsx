'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { emojiApi } from '@/lib/api/emoji.api';
import type { CustomEmoji } from '@/lib/api/emoji.api';
import { cn } from '@/lib/utils/cn';

// Bộ emoji phổ biến (Unicode subset)
const POPULAR_EMOJIS = [
  '😀','😂','🤣','😊','😍','🥰','😘','😎','🤔','😭',
  '😱','🥳','👍','👎','❤️','🔥','✨','🎉','💪','👋',
  '🙏','💯','🚀','✅','❌','⚠️','📦','💰','📊','🏆',
  '👀','😅','🤦','🙌','💡','🎯','⏰','📝','🔑','💬',
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  className?: string;
}

type Tab = 'popular' | 'custom';

export function EmojiPicker({ onSelect, className }: EmojiPickerProps) {
  const [tab, setTab] = React.useState<Tab>('popular');
  const [search, setSearch] = React.useState('');

  const { data: customEmojis = [], isLoading } = useQuery({
    queryKey: ['custom-emojis'],
    queryFn: () => emojiApi.list(),
    staleTime: 5 * 60 * 1000, // 5 phút
  });

  const filteredPopular = React.useMemo(() => {
    if (!search.trim()) return POPULAR_EMOJIS;
    // Unicode emoji không có tên để search, trả về tất cả khi search
    return POPULAR_EMOJIS;
  }, [search]);

  const filteredCustom = React.useMemo(() => {
    if (!search.trim()) return customEmojis;
    const q = search.toLowerCase().replace(/:/g, '');
    return customEmojis.filter((e) =>
      e.name.toLowerCase().replace(/:/g, '').includes(q) ||
      e.category.toLowerCase().includes(q),
    );
  }, [customEmojis, search]);

  const handleSelectCustom = (emoji: CustomEmoji) => {
    // Tăng usage count (fire-and-forget)
    emojiApi.incrementUsage(emoji.id).catch(() => {});
    onSelect(emoji.name); // Trả về :tbs_logo: để render trong chat
  };

  return (
    <TooltipProvider>
      <div
        className={cn(
          'w-[320px] rounded-xl border bg-popover shadow-lg overflow-hidden',
          className,
        )}
      >
        {/* Search */}
        <div className="px-3 pt-3 pb-2 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Tìm emoji..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList className="w-full rounded-none border-b h-9 bg-transparent">
            <TabsTrigger value="popular" className="flex-1 text-xs h-full rounded-none">
              Phổ biến
            </TabsTrigger>
            <TabsTrigger value="custom" className="flex-1 text-xs h-full rounded-none">
              Công ty {customEmojis.length > 0 && `(${customEmojis.length})`}
            </TabsTrigger>
          </TabsList>

          {/* Popular emojis */}
          <TabsContent value="popular" className="m-0">
            <div className="grid grid-cols-8 gap-0.5 p-2 max-h-[200px] overflow-y-auto">
              {filteredPopular.map((emoji, idx) => (
                <button
                  key={idx}
                  onClick={() => onSelect(emoji)}
                  className={cn(
                    'h-9 w-9 flex items-center justify-center rounded-md text-xl',
                    'hover:bg-accent transition-colors focus:outline-none focus:ring-1 focus:ring-ring',
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </TabsContent>

          {/* Custom company emojis */}
          <TabsContent value="custom" className="m-0">
            <div className="max-h-[200px] overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center h-16 text-sm text-muted-foreground">
                  Đang tải...
                </div>
              ) : filteredCustom.length === 0 ? (
                <div className="flex items-center justify-center h-16 text-sm text-muted-foreground">
                  {search ? 'Không tìm thấy emoji' : 'Chưa có emoji công ty'}
                </div>
              ) : (
                <div className="grid grid-cols-6 gap-0.5 p-2">
                  {filteredCustom.map((emoji) => (
                    <Tooltip key={emoji.id}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => handleSelectCustom(emoji)}
                          className={cn(
                            'h-11 w-11 flex items-center justify-center rounded-md p-1',
                            'hover:bg-accent transition-colors focus:outline-none focus:ring-1 focus:ring-ring',
                          )}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={emoji.imageUrl}
                            alt={emoji.name}
                            className="h-8 w-8 object-contain"
                            loading="lazy"
                          />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        {emoji.name}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}
