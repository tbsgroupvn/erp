import { ApprovalType, ApprovalStatus, UserRole } from '@prisma/client';

/**
 * Base class for all approval-related events.
 */
abstract class BaseApprovalEvent {
  readonly timestamp: Date;

  constructor() {
    this.timestamp = new Date();
  }
}

/**
 * Emitted when a new approval request is created.
 */
export class ApprovalRequestedEvent extends BaseApprovalEvent {
  static readonly EVENT_NAME = 'approval.requested';

  constructor(
    public readonly approvalId: string,
    public readonly type: ApprovalType,
    public readonly referenceId: string,
    public readonly referenceCode: string | null,
    public readonly requestedBy: string,
    public readonly currentStep: number,
    public readonly totalSteps: number,
    public readonly approverRole: UserRole,
    public readonly requestData?: Record<string, any>,
  ) {
    super();
  }
}

/**
 * Emitted when an approval is completed (all steps approved).
 */
export class ApprovalCompletedEvent extends BaseApprovalEvent {
  static readonly EVENT_NAME = 'approval.completed';

  constructor(
    public readonly approvalId: string,
    public readonly type: ApprovalType,
    public readonly referenceId: string,
    public readonly referenceCode: string | null,
    public readonly requestedBy: string,
    public readonly finalApprovedBy: string,
    public readonly status: ApprovalStatus,
  ) {
    super();
  }
}

/**
 * Emitted when an approval step is rejected.
 */
export class ApprovalRejectedEvent extends BaseApprovalEvent {
  static readonly EVENT_NAME = 'approval.rejected';

  constructor(
    public readonly approvalId: string,
    public readonly type: ApprovalType,
    public readonly referenceId: string,
    public readonly referenceCode: string | null,
    public readonly requestedBy: string,
    public readonly rejectedBy: string,
    public readonly rejectedAtStep: number,
    public readonly comment?: string,
  ) {
    super();
  }
}
