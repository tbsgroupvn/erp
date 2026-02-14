'use client';

import { cn } from '@/lib/utils/cn';
import { TRACKING_EVENT_LABELS } from '@/lib/utils/constants';
import { formatDate } from '@/lib/utils/format';
import type { TrackingEvent } from '@/lib/types/tracking.types';
import type { TrackingEventType } from '@/lib/types/enums';

interface TrackingTimelineProps {
  events: TrackingEvent[];
  currentStage?: TrackingEventType;
}

// Ordered list of all event types for determining status
const EVENT_ORDER: TrackingEventType[] = [
  'PICKED_UP' as TrackingEventType,
  'IN_WAREHOUSE_CN' as TrackingEventType,
  'PACKED' as TrackingEventType,
  'LOADED_CONTAINER' as TrackingEventType,
  'DEPARTED_CN' as TrackingEventType,
  'IN_TRANSIT' as TrackingEventType,
  'ARRIVED_PORT' as TrackingEventType,
  'CUSTOMS_CLEARANCE' as TrackingEventType,
  'CUSTOMS_RELEASED' as TrackingEventType,
  'IN_WAREHOUSE_VN' as TrackingEventType,
  'OUT_FOR_DELIVERY' as TrackingEventType,
  'DELIVERED' as TrackingEventType,
];

function getEventStatus(
  eventType: TrackingEventType,
  currentStage?: TrackingEventType,
  completedEvents?: Set<string>,
): 'completed' | 'current' | 'pending' {
  if (completedEvents?.has(eventType)) {
    if (eventType === currentStage) return 'current';
    return 'completed';
  }
  return 'pending';
}

export function TrackingTimeline({ events, currentStage }: TrackingTimelineProps) {
  const completedEvents = new Set(events.map((e) => e.eventType));

  return (
    <div className="space-y-0">
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">Chưa có sự kiện theo dõi nào.</p>
      ) : (
        <div className="relative">
          {events.map((event, index) => {
            const status = getEventStatus(event.eventType, currentStage, completedEvents);
            const isLast = index === events.length - 1;

            return (
              <div key={event.id} className="relative flex gap-4 pb-6">
                {/* Connecting line */}
                {!isLast && (
                  <div
                    className={cn(
                      'absolute left-[11px] top-6 w-0.5 h-full',
                      status === 'completed' || status === 'current'
                        ? 'bg-green-300'
                        : 'bg-gray-200',
                    )}
                  />
                )}

                {/* Dot */}
                <div className="relative z-10 flex-shrink-0">
                  <div
                    className={cn(
                      'h-6 w-6 rounded-full border-2 flex items-center justify-center',
                      status === 'completed'
                        ? 'border-green-500 bg-green-500'
                        : status === 'current'
                          ? 'border-blue-500 bg-blue-500'
                          : 'border-gray-300 bg-white',
                    )}
                  >
                    {(status === 'completed' || status === 'current') && (
                      <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      'text-sm font-medium',
                      status === 'current'
                        ? 'text-blue-700'
                        : status === 'completed'
                          ? 'text-green-700'
                          : 'text-muted-foreground',
                    )}
                  >
                    {TRACKING_EVENT_LABELS[event.eventType as TrackingEventType] || event.eventType}
                  </p>
                  {event.location && (
                    <p className="text-xs text-muted-foreground mt-0.5">{event.location}</p>
                  )}
                  {event.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDate(event.timestamp)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
