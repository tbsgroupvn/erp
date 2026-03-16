'use client';

import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Search, X, Check } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { chatApi } from '@/lib/api/chat.api';
import { useCreateGroup } from '@/lib/hooks/use-chat';
import { Button } from '@/components/ui/button';
import type { ChatUser, Conversation } from '@/lib/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (conv: Conversation) => void;
}

export function NewGroupDialog({ open, onOpenChange, onCreated }: Props) {
  const [name, setName] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [selected, setSelected] = React.useState<ChatUser[]>([]);
  const createGroup = useCreateGroup();

  const { data: users = [], isFetching } = useQuery({
    queryKey: ['chat-user-search-group', query],
    queryFn: () => chatApi.searchUsers(query, 10),
    enabled: query.length > 0,
    staleTime: 5000,
  });

  const toggle = (user: ChatUser) => {
    setSelected((prev) =>
      prev.find((u) => u.id === user.id)
        ? prev.filter((u) => u.id !== user.id)
        : [...prev, user],
    );
  };

  const handleCreate = async () => {
    if (!name.trim() || selected.length === 0) return;
    const conv = await createGroup.mutateAsync({
      name: name.trim(),
      participantIds: selected.map((u) => u.id),
    });
    onCreated(conv);
    onOpenChange(false);
    setName('');
    setQuery('');
    setSelected([]);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm bg-background rounded-xl border shadow-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-sm font-semibold">Tạo nhóm chat</Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </div>

          {/* Group name */}
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tên nhóm..."
            className="w-full rounded-lg border bg-muted/50 px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-ring"
          />

          {/* Selected chips */}
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {selected.map((u) => (
                <span
                  key={u.id}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-medium"
                >
                  {u.fullName}
                  <button onClick={() => toggle(u)} className="hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Search */}
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm thành viên..."
              className="w-full rounded-lg border bg-muted/50 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Results */}
          <div className="flex flex-col gap-1 max-h-[160px] overflow-y-auto mb-4">
            {isFetching && <p className="text-xs text-muted-foreground text-center py-2">Đang tìm...</p>}
            {!isFetching && query.length > 0 && users.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">Không tìm thấy</p>
            )}
            {users.map((u) => {
              const isSelected = !!selected.find((s) => s.id === u.id);
              return (
                <button
                  key={u.id}
                  onClick={() => toggle(u)}
                  className="flex items-center gap-3 rounded-lg px-3 py-1.5 text-left hover:bg-accent text-sm transition-colors"
                >
                  <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground text-xs font-semibold shrink-0">
                    {u.fullName.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                  </div>
                  <span className="flex-1 font-medium">{u.fullName}</span>
                  {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                </button>
              );
            })}
          </div>

          <Button
            className="w-full"
            disabled={!name.trim() || selected.length === 0 || createGroup.isPending}
            onClick={handleCreate}
          >
            Tạo nhóm ({selected.length} thành viên)
          </Button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
