'use client';

import { useState } from 'react';
import { Video, Users, Clock, PhoneOff, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useMyRooms, useGetRoomToken, useEndRoom } from '@/lib/hooks/use-video';
import { useAuthStore } from '@/lib/stores/auth-store';
import { JitsiMeet } from './jitsi-meet';
import type { RoomToken, VideoRoom } from '@/lib/types/video.types';

interface RoomListProps {
  filterStatus?: 'ACTIVE' | 'SCHEDULED';
}

/**
 * Danh sach phong hop ACTIVE hoac SCHEDULED.
 * Cho phep user join truc tiep hoac host ket thuc phong.
 */
export function RoomList({ filterStatus }: RoomListProps) {
  const userId = useAuthStore((s) => s.user?.id ?? '');
  const { data: rooms, isLoading } = useMyRooms();
  const getToken = useGetRoomToken();
  const endRoom = useEndRoom();
  const [activeToken, setActiveToken] = useState<RoomToken | null>(null);

  const filtered = filterStatus
    ? (rooms ?? []).filter((r) => r.status === filterStatus)
    : (rooms ?? []);

  const handleJoin = async (roomId: string) => {
    try {
      const token = await getToken.mutateAsync(roomId);
      setActiveToken(token);
    } catch {
      // error handled in hook
    }
  };

  const handleEnd = (roomId: string) => {
    endRoom.mutate(roomId);
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        Không có cuộc họp nào
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {filtered.map((room) => (
          <RoomCard
            key={room.id}
            room={room}
            currentUserId={userId}
            onJoin={() => handleJoin(room.id)}
            onEnd={() => handleEnd(room.id)}
            joiningId={getToken.isPending ? room.id : null}
            endingId={endRoom.isPending ? room.id : null}
          />
        ))}
      </div>

      {activeToken && (
        <JitsiMeet
          roomName={activeToken.roomName}
          domain={activeToken.domain}
          token={activeToken.token}
          displayName={activeToken.displayName}
          isFloating
          onLeave={() => setActiveToken(null)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Individual room card
// ---------------------------------------------------------------------------
interface RoomCardProps {
  room: VideoRoom;
  currentUserId: string;
  onJoin: () => void;
  onEnd: () => void;
  joiningId: string | null;
  endingId: string | null;
}

function RoomCard({
  room,
  currentUserId,
  onJoin,
  onEnd,
  joiningId,
  endingId,
}: RoomCardProps) {
  const isHost = room.hostId === currentUserId;
  const participantCount = room.participants.length;

  const formatTime = (iso?: string) => {
    if (!iso) return null;
    return new Date(iso).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const statusLabel =
    room.status === 'ACTIVE'
      ? { label: 'Đang diễn ra', color: 'bg-green-500' }
      : { label: 'Sắp diễn ra', color: 'bg-blue-500' };

  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`inline-block h-2 w-2 rounded-full ${statusLabel.color}`}
              />
              <p className="text-sm font-medium truncate">{room.title}</p>
              {isHost && (
                <Badge variant="outline" className="text-xs shrink-0">
                  Host
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {participantCount} người
              </span>
              {room.scheduledAt && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatTime(room.scheduledAt)}
                </span>
              )}
              {room.startedAt && (
                <span className="flex items-center gap-1">
                  <Video className="h-3 w-3 text-green-500" />
                  Bắt đầu lúc {formatTime(room.startedAt)}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => window.open(room.joinUrl, '_blank')}
              title="Mở trong tab mới"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Link
            </Button>

            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={onJoin}
              disabled={joiningId === room.id}
            >
              <Video className="h-3 w-3 mr-1" />
              {joiningId === room.id ? 'Đang vào...' : 'Tham gia'}
            </Button>

            {isHost && room.status === 'ACTIVE' && (
              <Button
                size="sm"
                variant="destructive"
                className="h-7 text-xs"
                onClick={onEnd}
                disabled={endingId === room.id}
                title="Kết thúc phòng họp"
              >
                <PhoneOff className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
