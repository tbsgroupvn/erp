'use client';

import * as React from 'react';
import { Video, Plus, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { JitsiMeet } from '@/features/video/jitsi-meet';
import { RoomList } from '@/features/video/room-list';
import { ScheduleMeetingDialog } from '@/features/video/schedule-meeting-dialog';
import { useCreateRoom, useGetRoomToken } from '@/lib/hooks/use-video';
import type { RoomToken } from '@/lib/types/video.types';

export default function VideoPage() {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [activeToken, setActiveToken] = React.useState<RoomToken | null>(null);
  const createRoom = useCreateRoom();
  const getToken = useGetRoomToken();

  // Bat dau ngay: tao instant room va join
  const handleInstantMeeting = async () => {
    try {
      const room = await createRoom.mutateAsync({ title: 'Cuoc hop nhanh' });
      const token = await getToken.mutateAsync(room.id);
      setActiveToken(token);
    } catch {
      // error handled in hooks
    }
  };

  const handleDialogCreated = async (roomId: string) => {
    try {
      const token = await getToken.mutateAsync(roomId);
      setActiveToken(token);
    } catch {
      // skip auto-join if scheduled for later
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Video className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Cuoc hop video</h1>
            <p className="text-xs text-muted-foreground">
              Tao va tham gia cuoc hop qua Jitsi Meet
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleInstantMeeting}
            disabled={createRoom.isPending || getToken.isPending}
          >
            <Zap className="h-4 w-4 mr-1.5" />
            {createRoom.isPending || getToken.isPending
              ? 'Dang tao...'
              : 'Bat dau ngay'}
          </Button>

          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Tao cuoc hop
          </Button>
        </div>
      </div>

      {/* Active full-page embed */}
      {activeToken && (
        <div className="rounded-xl overflow-hidden border shadow-md" style={{ height: 600 }}>
          <JitsiMeet
            roomName={activeToken.roomName}
            domain={activeToken.domain}
            token={activeToken.token}
            displayName={activeToken.displayName}
            onLeave={() => setActiveToken(null)}
          />
        </div>
      )}

      {/* Cuoc hop dang dien ra */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Dang dien ra
        </h2>
        <RoomList filterStatus="ACTIVE" />
      </section>

      {/* Cuoc hop sap toi */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Sap dien ra
        </h2>
        <RoomList filterStatus="SCHEDULED" />
      </section>

      {/* Dialog tao cuoc hop */}
      <ScheduleMeetingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={handleDialogCreated}
      />
    </div>
  );
}
