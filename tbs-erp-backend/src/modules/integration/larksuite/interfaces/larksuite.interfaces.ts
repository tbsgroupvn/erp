/**
 * Result of syncing data with LarkSuite.
 */
export interface LarkSyncResult {
  /** Total records processed */
  totalProcessed: number;
  /** Number of records created */
  created: number;
  /** Number of records updated */
  updated: number;
  /** Number of records skipped (no changes) */
  skipped: number;
  /** Number of records that failed */
  failed: number;
  /** Details of failed records */
  failures: Array<{
    identifier: string;
    reason: string;
  }>;
  /** Timestamp of the sync */
  syncedAt: Date;
}

/**
 * A calendar event from LarkSuite.
 */
export interface CalendarEvent {
  /** Event ID in LarkSuite */
  eventId: string;
  /** Event title */
  title: string;
  /** Event description */
  description?: string;
  /** Start time */
  startTime: Date;
  /** End time */
  endTime: Date;
  /** Whether it is an all-day event */
  isAllDay: boolean;
  /** Location */
  location?: string;
  /** Organizer name */
  organizer: string;
  /** Attendees */
  attendees: Array<{
    name: string;
    email: string;
    status: 'ACCEPTED' | 'DECLINED' | 'TENTATIVE' | 'PENDING';
  }>;
  /** Meeting link (if online meeting) */
  meetingLink?: string;
  /** Recurrence rule */
  recurrence?: string;
}

/**
 * Result of creating an approval in LarkSuite.
 */
export interface LarkApprovalResult {
  /** Approval instance ID in LarkSuite */
  approvalInstanceId: string;
  /** Approval code / definition code */
  approvalCode: string;
  /** Current status */
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'DELETED';
  /** Initiator */
  initiator: string;
  /** Approvers */
  approvers: Array<{
    userId: string;
    name: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
  }>;
  /** Created timestamp */
  createdAt: Date;
}

/**
 * LarkSuite user information with ERP mapping.
 */
export interface LarkUser {
  /** LarkSuite user ID */
  larkUserId: string;
  /** LarkSuite open ID */
  openId: string;
  /** User name in LarkSuite */
  name: string;
  /** Email address */
  email: string;
  /** Department in LarkSuite */
  department?: string;
  /** Job title */
  jobTitle?: string;
  /** Avatar URL */
  avatarUrl?: string;
  /** Corresponding ERP employee ID (if mapped) */
  erpEmployeeId?: string;
  /** Whether the user is active */
  isActive: boolean;
}
