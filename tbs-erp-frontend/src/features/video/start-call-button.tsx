'use client';

import { useState } from 'react';
import { Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { JitsiMeet } from './jitsi-meet';
import { useStartDMCall, useGetRoomToken } from '@/lib/hooks/use-video';
import type { RoomToken } from '@/lib/types/video.types';

interface StartCallButtonProps {
  conversationId: string;
}

/**
 * Nút video call trong header của MessageThread.
 * Click -> tạo room -> lấy token -> hiện floating Jitsi window.
 */
export function StartCallButton({ conversationId }: StartCallButtonProps) {
  const [tokenData, setTokenData] = useState<RoomToken | null>(null);
  const startCall = useStartDMCall();
  const getToken = useGetRoomToken();

  const handleStartCall = async () => {
    try {
      const room = await startCall.mutateAsync(conversationId);
      const token = await getToken.mutateAsync(room.id);
      setTokenData(token);
    } catch {
      // Errors handled in hook (toast)
    }
  };

  const handleLeave = () => {
    setTokenData(null);
  };

  const isPending = startCall.isPending || getToken.isPending;

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        onClick={handleStartCall}
        disabled={isPending || !!tokenData}
        title="Bat dau video call"
        className="h-8 w-8 p-0"
      >
        <Video className="h-4 w-4" />
      </Button>

      {tokenData && (
        <JitsiMeet
          roomName={tokenData.roomName}
          domain={tokenData.domain}
          token={tokenData.token}
          displayName={tokenData.displayName}
          isFloating
          onLeave={handleLeave}
        />
      )}
    </>
  );
}
