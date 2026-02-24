import { Injectable, BadRequestException } from '@nestjs/common';
import { ComplaintStatus } from '@prisma/client';

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
export class ComplaintStatusMachine {
  private readonly transitions: Record<ComplaintStatus, ComplaintStatus[]> = {
    OPEN: [
      ComplaintStatus.INVESTIGATING,
    ],
    INVESTIGATING: [
      ComplaintStatus.PENDING_RESOLUTION,
      ComplaintStatus.RESOLVED,
    ],
    PENDING_RESOLUTION: [
      ComplaintStatus.RESOLVED,
    ],
    RESOLVED: [
      ComplaintStatus.CLOSED,
    ],
    CLOSED: [],
  };

  /**
   * Validates whether a status transition is allowed.
   *
   * @param from - Current complaint status
   * @param to - Target complaint status
   * @returns true if the transition is valid
   */
  validateTransition(from: ComplaintStatus, to: ComplaintStatus): boolean {
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
   * @param from - Current complaint status
   * @param to - Target complaint status
   * @throws BadRequestException if the transition is not allowed
   */
  assertTransition(from: ComplaintStatus, to: ComplaintStatus): void {
    if (!this.validateTransition(from, to)) {
      throw new BadRequestException(
        `Invalid status transition from ${from} to ${to}`,
      );
    }
  }

  /**
   * Returns all valid next statuses from the current status.
   *
   * @param current - The current complaint status
   * @returns Array of valid target statuses
   */
  getNextStatuses(current: ComplaintStatus): ComplaintStatus[] {
    return this.transitions[current] ?? [];
  }

  /**
   * Returns whether the given status is a terminal state
   * (no further transitions possible).
   */
  isTerminal(status: ComplaintStatus): boolean {
    const nextStatuses = this.transitions[status];
    return !nextStatuses || nextStatuses.length === 0;
  }
}
