'use client';

import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Search, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { chatApi } from '@/lib/api/chat.api';
import { useCreateDM } from '@/lib/hooks/use-chat';
import { Button } from '@/components/ui/button';
import type { Conversation } from '@/lib/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (conv: Conversation) => void;
}

export function NewDMDialog({ open, onOpenChange, onCreated }: Props) {
  const [query, setQuery] = React.useState('');
  const createDM = useCreateDM();

  const { data: users = [], isFetching } = useQuery({
    queryKey: ['chat-user-search', query],
    queryFn: () => chatApi.searchUsers(query, 10),
    enabled: query.length > 0,
    staleTime: 5000,
  });

  const handleSelect = async (userId: string) => {
    const conv = await createDM.mutateAsync({ targetUserId: userId });
    onCreated(conv);
    onOpenChange(false);
    setQuery('');
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm bg-background rounded-xl border shadow-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-sm font-semibold">Nhắn tin trực tiếp</Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm theo tên hoặc email..."
              className="w-full rounded-lg border bg-muted/50 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Results */}
          <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto">
            {isFetching && (
              <p className="text-xs text-muted-foreground text-center py-3">Đang tìm...</p>
            )}
            {!isFetching && query.length > 0 && users.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3">Không tìm thấy</p>
            )}
            {users.map((u) => (
              <button
                key={u.id}
                onClick={() => handleSelect(u.id)}
                disabled={createDM.isPending}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-accent text-sm transition-colors"
              >
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground text-xs font-semibold shrink-0">
                  {u.fullName.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                </div>
                <div>
                  <p className="font-medium">{u.fullName}</p>
                  <p className="text-xs text-muted-foreground">{u.role}</p>
                </div>
              </button>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
