import { apiClient } from './client';
import type {
  BaseResponse,
  PaginatedResponse,
  Notification,
  QueryParams,
} from '@/lib/types';

export interface NotificationQueryParams extends QueryParams {
  isRead?: boolean;
  type?: string;
}

export const notificationsApi = {
  /** GET /notifications */
  list: (params?: NotificationQueryParams) =>
    apiClient
      .get<PaginatedResponse<Notification>>('/notifications', { params })
      .then((r) => r.data),

  /** PATCH /notifications/:id/read */
  markAsRead: (id: string) =>
    apiClient
      .patch<BaseResponse<Notification>>(`/notifications/${id}/read`)
      .then((r) => r.data.data),

  /** GET /notifications/unread-count */
  getUnreadCount: () =>
    apiClient
      .get<BaseResponse<{ count: number }>>('/notifications/unread-count')
      .then((r) => r.data.data.count),
};
