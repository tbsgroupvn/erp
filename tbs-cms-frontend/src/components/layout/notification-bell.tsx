'use client';

import * as React from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Bell, Check } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import type { Notification } from '@/lib/types';

interface NotificationBellProps {
  notifications?: Notification[];
  onMarkAsRead?: (id: string) => void;
  onMarkAllAsRead?: () => void;
  onNotificationClick?: (notification: Notification) => void;
}

export function NotificationBell({
  notifications = [],
  onMarkAsRead,
  onMarkAllAsRead,
  onNotificationClick,
}: NotificationBellProps) {
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-accent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Thông báo"
        >
          <Bell className="h-5 w-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className={cn(
            'z-50 w-[380px] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[side=bottom]:slide-in-from-top-2'
          )}
          align="end"
          sideOffset={8}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3">
            <h4 className="text-sm font-semibold">
              Th&#244;ng b&#225;o
              {unreadCount > 0 && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  ({unreadCount} ch&#432;a &#273;&#7885;c)
                </span>
              )}
            </h4>
            {unreadCount > 0 && onMarkAllAsRead && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto px-2 py-1 text-xs"
                onClick={onMarkAllAsRead}
              >
                <Check className="mr-1 h-3 w-3" />
                &#272;&#225;nh d&#7845;u t&#7845;t c&#7843;
              </Button>
            )}
          </div>

          <Separator />

          {/* Notification list */}
          <ScrollArea className="max-h-[400px]">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Bell className="h-10 w-10 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">
                  Kh&#244;ng c&#243; th&#244;ng b&#225;o
                </p>
              </div>
            ) : (
              <div className="flex flex-col">
                {notifications.map((notification) => (
                  <button
                    key={notification.id}
                    className={cn(
                      'flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-accent',
                      !notification.isRead && 'bg-accent/50'
                    )}
                    onClick={() => {
                      if (!notification.isRead) {
                        onMarkAsRead?.(notification.id);
                      }
                      onNotificationClick?.(notification);
                    }}
                  >
                    <div className="flex items-start gap-2">
                      {!notification.isRead && (
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            'text-sm leading-tight',
                            !notification.isRead && 'font-medium'
                          )}
                        >
                          {notification.title}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                          {notification.body}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground/70">
                          {formatDistanceToNow(new Date(notification.createdAt), {
                            addSuffix: true,
                            locale: vi,
                          })}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
