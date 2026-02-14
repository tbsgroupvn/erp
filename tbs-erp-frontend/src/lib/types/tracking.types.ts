import type { TrackingEventType } from './enums';

export interface TrackingEvent {
  id: string;
  eventType: TrackingEventType;
  location: string;
  description?: string;
  timestamp: string;
}

export interface TrackingInfo {
  trackingNumber: string;
  packageId?: string;
  orderId?: string;
  orderCode?: string;
  currentStage: TrackingEventType;
  estimatedDelivery?: string;
  events: TrackingEvent[];
}

export interface ContainerTracking {
  containerId: string;
  containerCode: string;
  currentStage: TrackingEventType;
  estimatedArrival?: string;
  events: TrackingEvent[];
  packageCount: number;
}
