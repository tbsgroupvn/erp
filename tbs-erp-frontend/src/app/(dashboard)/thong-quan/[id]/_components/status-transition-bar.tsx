'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type {
  CustomsDeclarationStatus,
  CustomsChannel,
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

interface StatusTransitionBarProps {
  currentStatus: CustomsDeclarationStatus;
  availableTransitions: CustomsDeclarationStatus[];
  statusNote: string;
  isTransitionPending: boolean;
  isChannelPending: boolean;
  onStatusTransition: (nextStatus: CustomsDeclarationStatus) => void;
  onChannelAssign: (channel: CustomsChannel) => void;
  onStatusNoteChange: (note: string) => void;
}

export function StatusTransitionBar({
  currentStatus,
  availableTransitions,
  statusNote,
  isTransitionPending,
  isChannelPending,
  onStatusTransition,
  onChannelAssign,
  onStatusNoteChange,
}: StatusTransitionBarProps) {
  if (availableTransitions.length === 0) return null;

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-3 pt-4">
        <span className="text-sm font-medium text-muted-foreground">Chuyển trạng thái:</span>
        {availableTransitions.map((nextStatus) => (
          <Button
            key={nextStatus}
            variant={
              nextStatus === 'CANCELLED' || nextStatus === 'REJECTED' ? 'destructive' : 'outline'
            }
            size="sm"
            onClick={() => onStatusTransition(nextStatus)}
            disabled={isTransitionPending}
          >
            {STATUS_LABELS[nextStatus]}
          </Button>
        ))}
        {currentStatus === 'SUBMITTED' && (
          <>
            <span className="ml-4 text-sm font-medium text-muted-foreground">Phân luồng:</span>
            {(['GREEN', 'YELLOW', 'RED'] as CustomsChannel[]).map((ch) => (
              <Button
                key={ch}
                variant="outline"
                size="sm"
                onClick={() => onChannelAssign(ch)}
                disabled={isChannelPending}
                className={CHANNEL_COLORS[ch]}
              >
                {CHANNEL_LABELS[ch]}
              </Button>
            ))}
          </>
        )}
        <Input
          placeholder="Ghi chú (tùy chọn)"
          value={statusNote}
          onChange={(e) => onStatusNoteChange(e.target.value)}
          className="ml-auto h-8 w-48"
        />
      </CardContent>
    </Card>
  );
}
