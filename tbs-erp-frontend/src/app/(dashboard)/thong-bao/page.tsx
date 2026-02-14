'use client';

import { useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNotifications, useUnreadCount, useMarkAsRead } from '@/lib/hooks/use-notifications';
import { formatDate } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

export default function ThongBaoPage() {
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const { data: notificationsData, isLoading } = useNotifications({
    isRead: showUnreadOnly ? false : undefined,
    page,
    limit: 20,
  });
  const { data: unreadCount } = useUnreadCount();
  const markAsRead = useMarkAsRead();

  const handleMarkAsRead = async (id: string) => {
    try {
      await markAsRead.mutateAsync(id);
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const notifications = notificationsData?.data ?? [];
  const totalPages = notificationsData?.meta?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      <PageHeader title="Thông báo" description="Trung tâm thông báo" />

      <div className="flex gap-2 border-b">
        <button
          onClick={() => {
            setShowUnreadOnly(false);
            setPage(1);
          }}
          className={cn(
            'px-4 py-2 border-b-2 transition-colors',
            !showUnreadOnly
              ? 'border-primary text-primary font-medium'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          Tất cả
        </button>
        <button
          onClick={() => {
            setShowUnreadOnly(true);
            setPage(1);
          }}
          className={cn(
            'px-4 py-2 border-b-2 transition-colors flex items-center gap-2',
            showUnreadOnly
              ? 'border-primary text-primary font-medium'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          Chưa đọc
          {(unreadCount ?? 0) > 0 && (
            <span className="inline-flex items-center justify-center rounded-full bg-red-500 px-2 py-0.5 text-xs font-medium text-white">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Đang tải...</div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {showUnreadOnly ? 'Không có thông báo chưa đọc' : 'Không có thông báo nào'}
          </div>
        ) : (
          notifications.map((notification: { id: string; title: string; body: string; isRead: boolean; channel: string | null; createdAt: string }) => (
            <Card
              key={notification.id}
              onClick={() => !notification.isRead && handleMarkAsRead(notification.id)}
              className={cn(
                'cursor-pointer transition-all hover:shadow-md',
                !notification.isRead && 'border-l-4 border-l-blue-500 bg-blue-50/30',
              )}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className={cn('text-sm', !notification.isRead && 'font-semibold')}>
                        {notification.title}
                      </h3>
                      {!notification.isRead && (
                        <span className="h-2 w-2 rounded-full bg-blue-500" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{notification.body}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{formatDate(notification.createdAt)}</span>
                      {notification.channel && (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5">
                          {notification.channel}
                        </span>
                      )}
                    </div>
                  </div>
                  {!notification.isRead ? (
                    <BellOff className="h-4 w-4 text-blue-500" />
                  ) : (
                    <Bell className="h-4 w-4 text-gray-400" />
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Trước
          </Button>
          <span className="text-sm text-muted-foreground">
            Trang {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Sau
          </Button>
        </div>
      )}
    </div>
  );
}
