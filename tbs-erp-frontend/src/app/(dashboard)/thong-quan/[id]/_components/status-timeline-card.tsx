'use client';

import { Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/shared/status-badge';
import { formatDate } from '@/lib/utils/format';
import type {
  CustomsDeclarationStatus,
  CustomsChannel,
  CustomsStatusHistory,
} from '@/lib/types/customs.types';

const STATUS_LABELS: Record<CustomsDeclarationStatus, string> = {
  DRAFT: 'Nháp',
  READY: 'Sẵn sàng',
  SUBMITTED: 'Đã gửi',
  CHANNEL_ASSIGNED: 'Đã phân luồng',
  INSPECTING: 'Đang kiểm',
  CLEARED: 'Đã thông quan',
  REJECTED: 'Từ chối',
  CANCELLED: 'Đã hủy',
};

const CHANNEL_LABELS: Record<CustomsChannel, string> = {
  GREEN: 'Xanh',
  YELLOW: 'Vàng',
  RED: 'Đỏ',
};

const CHANNEL_COLORS: Record<CustomsChannel, string> = {
  GREEN: 'bg-green-100 text-green-700',
  YELLOW: 'bg-yellow-100 text-yellow-700',
  RED: 'bg-red-100 text-red-700',
};

interface StatusTimelineCardProps {
  history: CustomsStatusHistory[];
}

export function StatusTimelineCard({ history }: StatusTimelineCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="h-5 w-5" />
          Lịch sử trạng thái
        </CardTitle>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có lịch sử.</p>
        ) : (
          <div className="relative space-y-0">
            {history.map((event, idx) => {
              const isChannelEvent = !!event.channel;
              return (
                <div key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
                  {idx < history.length - 1 && (
                    <div className="absolute left-[7px] top-4 h-full w-px bg-border" />
                  )}
                  <div
                    className={`relative z-10 mt-1.5 h-[15px] w-[15px] flex-shrink-0 rounded-full border-2 ${
                      isChannelEvent
                        ? 'border-amber-500 bg-amber-100'
                        : 'border-primary bg-background'
                    }`}
                  />
                  <div className="flex-1 pt-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {event.fromStatus
                          ? `${STATUS_LABELS[event.fromStatus as CustomsDeclarationStatus] ?? event.fromStatus} -> ${STATUS_LABELS[event.toStatus as CustomsDeclarationStatus] ?? event.toStatus}`
                          : (STATUS_LABELS[event.toStatus as CustomsDeclarationStatus] ??
                            event.toStatus)}
                      </span>
                      {event.channel && (
                        <StatusBadge
                          label={`Luồng ${CHANNEL_LABELS[event.channel]}`}
                          colorClass={CHANNEL_COLORS[event.channel]}
                        />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(event.createdAt)}
                      {event.changedBy && (
                        <span className="ml-2 text-xs">(bởi {event.changedBy})</span>
                      )}
                    </p>
                    {event.note && (
                      <p className="mt-1 text-xs text-muted-foreground italic">{event.note}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
