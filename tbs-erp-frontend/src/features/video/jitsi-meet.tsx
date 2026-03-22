'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, PhoneOff, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JitsiMeetExternalAPIInstance = any;

interface JitsiMeetProps {
  roomName: string;
  domain: string;
  token?: string;
  displayName: string;
  onLeave?: () => void;
  isFloating?: boolean;
}

/**
 * Embeds Jitsi Meet via iframe + External API.
 * Jitsi External API is loaded dynamically from the Jitsi server.
 *
 * isFloating=true  → floating pip window (bottom-right, minimizable)
 * isFloating=false → full page embed
 */
export function JitsiMeet({
  roomName,
  domain,
  token,
  displayName,
  onLeave,
  isFloating,
}: JitsiMeetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<JitsiMeetExternalAPIInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const scriptId = `jitsi-api-${domain}`;
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    const initApi = () => {
      if (!window.JitsiMeetExternalAPI) return;
      if (apiRef.current) return;

      apiRef.current = new window.JitsiMeetExternalAPI(domain, {
        roomName,
        parentNode: containerRef.current,
        userInfo: { displayName },
        jwt: token ?? undefined,
        configOverwrite: {
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          disableDeepLinking: true,
        },
        interfaceConfigOverwrite: {
          TOOLBAR_BUTTONS: [
            'microphone',
            'camera',
            'hangup',
            'tileview',
            'fullscreen',
            'chat',
            'settings',
          ],
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
        },
      });

      apiRef.current.addEventListener('videoConferenceJoined', () => {
        setLoading(false);
      });

      apiRef.current.addEventListener('readyToClose', () => {
        onLeave?.();
      });
    };

    if (script) {
      // Script already loaded by a previous mount
      initApi();
    } else {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://${domain}/external_api.js`;
      script.async = true;
      script.onload = initApi;
      document.head.appendChild(script);
    }

    return () => {
      apiRef.current?.dispose?.();
      apiRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomName, domain, token, displayName]);

  if (isFloating) {
    return (
      <div
        className={`fixed bottom-4 right-4 z-50 bg-black rounded-xl overflow-hidden shadow-2xl transition-all duration-200 ${
          minimized ? 'w-64 h-14' : 'w-96 h-72'
        }`}
      >
        {/* Floating header */}
        <div className="flex items-center justify-between px-3 py-2 bg-gray-900 text-white text-sm shrink-0">
          <span className="truncate font-medium text-xs">Video call</span>
          <div className="flex gap-1 ml-2">
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-white hover:bg-white/10"
              onClick={() => setMinimized((v) => !v)}
              title={minimized ? 'Mở rộng' : 'Thu nhỏ'}
            >
              {minimized ? (
                <Maximize2 className="h-3 w-3" />
              ) : (
                <Minimize2 className="h-3 w-3" />
              )}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-red-400 hover:text-red-300 hover:bg-white/10"
              onClick={onLeave}
              title="Kết thúc cuộc gọi"
            >
              <PhoneOff className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {!minimized && (
          <div ref={containerRef} className="w-full h-56 relative">
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
                <Loader2 className="animate-spin text-white h-8 w-8" />
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Full page embed
  return (
    <div className="relative w-full h-full min-h-[600px] bg-gray-900 rounded-lg overflow-hidden">
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white z-10">
          <Loader2 className="animate-spin h-10 w-10" />
          <p className="text-sm">Đang kết nối cuộc họp...</p>
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
