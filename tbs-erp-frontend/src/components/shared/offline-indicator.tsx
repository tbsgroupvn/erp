'use client';

/**
 * offline-indicator.tsx
 * Fixed-position badge that reflects the current offline / sync state.
 *
 * States:
 *   - Offline (no network): red dot + "Ngoại tuyến"
 *   - Has pending mutations: yellow badge + "{N} thao tác chờ đồng bộ"
 *   - Syncing in progress:  spinner + "Đang đồng bộ..."
 *   - Just completed:       brief green flash + "Đã đồng bộ" then hidden
 *   - All good / online:    hidden
 */

import { useEffect, useRef, useState } from 'react';
import { WifiOff, RefreshCw, CheckCircle2, CloudOff } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useOffline } from '@/lib/offline/use-offline';

type VisualState = 'hidden' | 'offline' | 'pending' | 'syncing' | 'synced';

export function OfflineIndicator() {
  const { isOnline, pendingCount, isSyncing, syncNow } = useOffline();
  const [visualState, setVisualState] = useState<VisualState>('hidden');
  const syncdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track previous isSyncing to detect the transition syncing → not syncing
  const wasSyncingRef = useRef(false);

  useEffect(() => {
    // Clear any pending hide-timer when state changes.
    if (syncdTimerRef.current) {
      clearTimeout(syncdTimerRef.current);
      syncdTimerRef.current = null;
    }

    const justFinishedSync = wasSyncingRef.current && !isSyncing;
    wasSyncingRef.current = isSyncing;

    if (!isOnline) {
      setVisualState('offline');
    } else if (isSyncing) {
      setVisualState('syncing');
    } else if (justFinishedSync && pendingCount === 0) {
      // Briefly show "Đã đồng bộ" then hide.
      setVisualState('synced');
      syncdTimerRef.current = setTimeout(() => setVisualState('hidden'), 2500);
    } else if (pendingCount > 0) {
      setVisualState('pending');
    } else {
      setVisualState('hidden');
    }

    // Always return cleanup so the timer is cleared on unmount or dep change.
    return () => {
      if (syncdTimerRef.current) clearTimeout(syncdTimerRef.current);
    };
  }, [isOnline, pendingCount, isSyncing]);

  if (visualState === 'hidden') return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Trạng thái kết nối"
      className={cn(
        // Position: bottom-left, above bottom padding, stays on top of content
        'fixed bottom-4 left-4 z-50',
        'flex items-center gap-2',
        'rounded-full px-4 py-2 shadow-lg',
        'text-sm font-medium',
        'transition-all duration-300 ease-in-out',
        'select-none',
        {
          // Offline: red
          'bg-red-600 text-white': visualState === 'offline',
          // Pending: amber
          'bg-amber-500 text-white': visualState === 'pending',
          // Syncing: blue
          'bg-blue-600 text-white': visualState === 'syncing',
          // Synced: green
          'bg-emerald-600 text-white': visualState === 'synced',
        },
      )}
    >
      {/* Icon */}
      {visualState === 'offline' && (
        <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      )}
      {visualState === 'pending' && (
        <CloudOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      )}
      {visualState === 'syncing' && (
        <RefreshCw
          className="h-4 w-4 shrink-0 animate-spin"
          aria-hidden="true"
        />
      )}
      {visualState === 'synced' && (
        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
      )}

      {/* Label */}
      <span>
        {visualState === 'offline' && 'Ngoại tuyến'}
        {visualState === 'pending' &&
          `${pendingCount} thao tác chờ đồng bộ`}
        {visualState === 'syncing' && 'Đang đồng bộ...'}
        {visualState === 'synced' && 'Đã đồng bộ'}
      </span>

      {/* Manual sync button — only show when pending and online */}
      {visualState === 'pending' && isOnline && (
        <button
          type="button"
          onClick={() => syncNow()}
          title="Đồng bộ ngay"
          aria-label="Đồng bộ ngay"
          className={cn(
            'ml-1 rounded-full bg-white/20 p-1 transition-colors',
            'hover:bg-white/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-white',
          )}
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
