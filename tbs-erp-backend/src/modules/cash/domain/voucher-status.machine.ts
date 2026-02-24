import { Injectable, BadRequestException } from '@nestjs/common';
import { ApprovalStatus } from '@prisma/client';

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
export class VoucherStatusMachine {
  private readonly transitions: Record<ApprovalStatus, ApprovalStatus[]> = {
    PENDING: [
      ApprovalStatus.APPROVED,
      ApprovalStatus.REJECTED,
    ],
    APPROVED: [],
    REJECTED: [],
    CANCELLED: [],
  };

  /**
   * Validates whether a status transition is allowed.
   *
   * @param from - Current voucher approval status
   * @param to - Target voucher approval status
   * @returns true if the transition is valid
   */
  validateTransition(from: ApprovalStatus, to: ApprovalStatus): boolean {
    const allowedTargets = this.transitions[from];

    if (!allowedTargets) {
      return false;
    }

    return allowedTargets.includes(to);
  }

  /**
   * Validates and throws if the transition is invalid.
   * Used by the service to enforce transitions.
   *
   * @param from - Current voucher approval status
   * @param to - Target voucher approval status
   * @throws BadRequestException if the transition is not allowed
   */
  assertTransition(from: ApprovalStatus, to: ApprovalStatus): void {
    if (!this.validateTransition(from, to)) {
      throw new BadRequestException(
        `Invalid status transition from ${from} to ${to}`,
      );
    }
  }

  /**
   * Returns all valid next statuses from the current status.
   *
   * @param current - The current voucher approval status
   * @returns Array of valid target statuses
   */
  getNextStatuses(current: ApprovalStatus): ApprovalStatus[] {
    return this.transitions[current] ?? [];
  }

  /**
   * Returns whether the given status is a terminal state
   * (no further transitions possible).
   */
  isTerminal(status: ApprovalStatus): boolean {
    const nextStatuses = this.transitions[status];
    return !nextStatuses || nextStatuses.length === 0;
  }
}
