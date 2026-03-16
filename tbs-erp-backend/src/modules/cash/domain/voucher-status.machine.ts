import { Injectable } from '@nestjs/common';
import { ApprovalStatus } from '@prisma/client';
import { BaseStatusMachine } from '@common/domain/base-status-machine';

/**
 * Voucher Status Finite State Machine.
 *
 * Manages payment voucher approval lifecycle transitions.
 * Uses ApprovalStatus enum since PaymentVoucher uses ApprovalStatus.
 * Key rules:
 *  - PENDING can move to APPROVED or REJECTED
 *  - APPROVED is a terminal state
 *  - REJECTED is a terminal state
 *  - CANCELLED is a terminal state
 */
@Injectable()
export class VoucherStatusMachine extends BaseStatusMachine<ApprovalStatus> {
  constructor() {
    super(
      {
        PENDING: [ApprovalStatus.APPROVED, ApprovalStatus.REJECTED],
        APPROVED: [],
        REJECTED: [],
        CANCELLED: [],
        RETURNED: [ApprovalStatus.PENDING],
        WITHDRAWN: [],
      },
      [ApprovalStatus.APPROVED, ApprovalStatus.REJECTED, ApprovalStatus.CANCELLED, ApprovalStatus.WITHDRAWN],
    );
  }
}
