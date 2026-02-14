'use client';

import * as React from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { User as UserIcon, KeyRound, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/utils/cn';
import { useAuthStore } from '@/lib/stores/auth-store';
import { ROLE_LABELS } from '@/lib/utils/permissions';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function UserMenu() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  if (!user) return null;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-accent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">
              {getInitials(user.fullName)}
            </AvatarFallback>
          </Avatar>
          <div className="hidden md:block text-left">
            <p className="text-sm font-medium leading-tight">{user.fullName}</p>
            <p className="text-xs text-muted-foreground">
              {ROLE_LABELS[user.role]}
            </p>
          </div>
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={cn(
            'z-50 min-w-[200px] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[side=bottom]:slide-in-from-top-2',
            'data-[side=top]:slide-in-from-bottom-2'
          )}
          align="end"
          sideOffset={8}
        >
          <DropdownMenu.Label className="px-2 py-1.5">
            <p className="text-sm font-medium">{user.fullName}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </DropdownMenu.Label>

          <DropdownMenu.Separator className="my-1 h-px bg-border" />

          <DropdownMenu.Item
            className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent focus:bg-accent"
            onSelect={() => router.push('/ho-so')}
          >
            <UserIcon className="h-4 w-4" />
            <span>H&#7891; s&#417;</span>
          </DropdownMenu.Item>

          <DropdownMenu.Item
            className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent focus:bg-accent"
            onSelect={() => router.push('/doi-mat-khau')}
          >
            <KeyRound className="h-4 w-4" />
            <span>&#272;&#7893;i m&#7853;t kh&#7849;u</span>
          </DropdownMenu.Item>

          <DropdownMenu.Separator className="my-1 h-px bg-border" />

          <DropdownMenu.Item
            className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive outline-none transition-colors hover:bg-destructive/10 focus:bg-destructive/10"
            onSelect={logout}
          >
            <LogOut className="h-4 w-4" />
            <span>&#272;&#259;ng xu&#7845;t</span>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
