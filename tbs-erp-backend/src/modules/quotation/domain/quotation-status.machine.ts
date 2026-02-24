import { Injectable, BadRequestException } from '@nestjs/common';
import { QuotationStatus } from '@prisma/client';

/**
 * Quotation Status Finite State Machine.
 *
 * Manages quotation lifecycle transitions.
 * Key rules:
 *  - DRAFT can move to PENDING_APPROVAL
 *  - PENDING_APPROVAL can move to APPROVED or REJECTED
 *  - APPROVED can move to CONVERTED or EXPIRED
 *  - REJECTED can return to DRAFT for revision
 *  - CONVERTED and EXPIRED are terminal states
 */
@Injectable()
export class QuotationStatusMachine {
  private readonly transitions: Record<QuotationStatus, QuotationStatus[]> = {
    DRAFT: [
      QuotationStatus.PENDING_APPROVAL,
    ],
    PENDING_APPROVAL: [
      QuotationStatus.APPROVED,
      QuotationStatus.REJECTED,
    ],
    APPROVED: [
      QuotationStatus.CONVERTED,
      QuotationStatus.EXPIRED,
    ],
    REJECTED: [
      QuotationStatus.DRAFT,
    ],
    CONVERTED: [],
    EXPIRED: [],
  };

  /**
   * Validates whether a status transition is allowed.
   *
   * @param from - Current quotation status
   * @param to - Target quotation status
   * @returns true if the transition is valid
   */
  validateTransition(from: QuotationStatus, to: QuotationStatus): boolean {
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
   * @param from - Current quotation status
   * @param to - Target quotation status
   * @throws BadRequestException if the transition is not allowed
   */
  assertTransition(from: QuotationStatus, to: QuotationStatus): void {
    if (!this.validateTransition(from, to)) {
      throw new BadRequestException(
        `Invalid status transition from ${from} to ${to}`,
      );
    }
  }

  /**
   * Returns all valid next statuses from the current status.
   *
   * @param current - The current quotation status
   * @returns Array of valid target statuses
   */
  getNextStatuses(current: QuotationStatus): QuotationStatus[] {
    return this.transitions[current] ?? [];
  }

  /**
   * Returns whether the given status is a terminal state
   * (no further transitions possible).
   */
  isTerminal(status: QuotationStatus): boolean {
    const nextStatuses = this.transitions[status];
    return !nextStatuses || nextStatuses.length === 0;
  }
}
