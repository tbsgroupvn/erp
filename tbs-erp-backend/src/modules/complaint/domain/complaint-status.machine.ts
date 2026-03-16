import { Injectable } from '@nestjs/common';
import { ComplaintStatus } from '@prisma/client';
import { BaseStatusMachine } from '@common/domain/base-status-machine';

/**
 * Complaint Status Finite State Machine.
 *
 * Manages complaint lifecycle transitions.
 * Key rules:
 *  - OPEN can move to INVESTIGATING
 *  - INVESTIGATING can move to PENDING_RESOLUTION or RESOLVED
 *  - PENDING_RESOLUTION can move to RESOLVED
 *  - RESOLVED can move to CLOSED
 *  - CLOSED is a terminal state
 */
@Injectable()
export class ComplaintStatusMachine extends BaseStatusMachine<ComplaintStatus> {
  constructor() {
    super(
      {
        OPEN: [ComplaintStatus.INVESTIGATING],
        INVESTIGATING: [ComplaintStatus.PENDING_RESOLUTION, ComplaintStatus.RESOLVED],
        PENDING_RESOLUTION: [ComplaintStatus.RESOLVED],
        RESOLVED: [ComplaintStatus.CLOSED],
        CLOSED: [],
      },
      [ComplaintStatus.CLOSED],
    );
  }
}
