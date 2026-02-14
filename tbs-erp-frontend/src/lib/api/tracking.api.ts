import { apiClient } from './client';
import type { BaseResponse } from '@/lib/types';
import type {
  TrackingInfo,
  ContainerTracking,
} from '@/lib/types/tracking.types';

export const trackingApi = {
  /** GET /tracking/:trackingNumber */
  getByTrackingNumber: (trackingNumber: string) =>
    apiClient
      .get<BaseResponse<TrackingInfo>>(`/tracking/${trackingNumber}`)
      .then((r) => r.data.data),

  /** GET /tracking/container/:containerId */
  getContainerTracking: (containerId: string) =>
    apiClient
      .get<BaseResponse<ContainerTracking>>(`/tracking/container/${containerId}`)
      .then((r) => r.data.data),
};
