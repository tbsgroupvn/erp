// ============================================
// NOTIFICATION TYPES
// ============================================

import { NotificationChannel } from './enums';

/** Notification entity */
export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  channel: NotificationChannel;
  type: string | null;
  referenceId: string | null;
  isRead: boolean;
  isUrgent: boolean;
  sentAt: string | null;
  readAt: string | null;
  createdAt: string;
}
