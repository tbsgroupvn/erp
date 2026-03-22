'use client';

import { useQuery } from '@tanstack/react-query';
import { trackingApi } from '@/lib/api/tracking.api';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------
export const trackingKeys = {
  all: ['tracking'] as const,
  byNumber: (trackingNumber: string) => [...trackingKeys.all, 'number', trackingNumber] as const,
  container: (containerId: string) => [...trackingKeys.all, 'container', containerId] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useTracking(trackingNumber: string) {
  return useQuery({
    queryKey: trackingKeys.byNumber(trackingNumber),
    queryFn: () => trackingApi.getByTrackingNumber(trackingNumber),
    enabled: !!trackingNumber,
    staleTime: 2 * 60 * 1000,
  });
}

export function useContainerTracking(containerId: string) {
  return useQuery({
    queryKey: trackingKeys.container(containerId),
    queryFn: () => trackingApi.getContainerTracking(containerId),
    enabled: !!containerId,
    staleTime: 2 * 60 * 1000,
  });
}
