import { Injectable, BadRequestException } from '@nestjs/common';
import { CustomsDeclarationStatus } from '@prisma/client';

/**
 * Customs Declaration Status Finite State Machine.
 *
 * Manages customs declaration lifecycle transitions.
 * Key rules:
 *  - DRAFT can move to READY or CANCELLED
 *  - READY can move to SUBMITTED, back to DRAFT, or CANCELLED
 *  - SUBMITTED can be CHANNEL_ASSIGNED, REJECTED, or CANCELLED
 *  - CHANNEL_ASSIGNED can move to INSPECTING (YELLOW/RED) or CLEARED (GREEN)
 *  - INSPECTING can be CLEARED or REJECTED
 *  - CLEARED and CANCELLED are terminal states
 *  - REJECTED can be revised back to DRAFT
 */
@Injectable()
export class CustomsStatusMachine {
  private readonly transitions: Record<CustomsDeclarationStatus, CustomsDeclarationStatus[]> = {
    DRAFT: [
      CustomsDeclarationStatus.READY,
      CustomsDeclarationStatus.CANCELLED,
    ],
    READY: [
      CustomsDeclarationStatus.SUBMITTED,
      CustomsDeclarationStatus.DRAFT,
      CustomsDeclarationStatus.CANCELLED,
    ],
    SUBMITTED: [
      CustomsDeclarationStatus.CHANNEL_ASSIGNED,
      CustomsDeclarationStatus.REJECTED,
      CustomsDeclarationStatus.CANCELLED,
    ],
    CHANNEL_ASSIGNED: [
      CustomsDeclarationStatus.INSPECTING,
      CustomsDeclarationStatus.CLEARED,
    ],
    INSPECTING: [
      CustomsDeclarationStatus.CLEARED,
      CustomsDeclarationStatus.REJECTED,
    ],
    CLEARED: [],
    REJECTED: [
      CustomsDeclarationStatus.DRAFT,
    ],
    CANCELLED: [],
  };

  /**
   * Validates whether a status transition is allowed.
   *
   * @param from - Current customs declaration status
   * @param to - Target customs declaration status
   * @returns true if the transition is valid
   */
  validateTransition(from: CustomsDeclarationStatus, to: CustomsDeclarationStatus): boolean {
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
   * @param from - Current customs declaration status
   * @param to - Target customs declaration status
   * @throws BadRequestException if the transition is not allowed
   */
  assertTransition(from: CustomsDeclarationStatus, to: CustomsDeclarationStatus): void {
    if (!this.validateTransition(from, to)) {
      const allowed = this.getNextStatuses(from);
      throw new BadRequestException(
        `Invalid status transition from ${from} to ${to}. ` +
          `Allowed transitions: ${allowed.join(', ') || 'none (terminal state)'}`,
      );
    }
  }

  /**
   * Returns all valid next statuses from the current status.
   *
   * @param current - The current customs declaration status
   * @returns Array of valid target statuses
   */
  getNextStatuses(current: CustomsDeclarationStatus): CustomsDeclarationStatus[] {
    return this.transitions[current] ?? [];
  }

  /**
   * Returns whether the given status is a terminal state
   * (no further transitions possible).
   */
  isTerminal(status: CustomsDeclarationStatus): boolean {
    const nextStatuses = this.transitions[status];
    return !nextStatuses || nextStatuses.length === 0;
  }
}

/**
 * Standalone validation function for use outside of DI context.
 *
 * @param from - Current status string
 * @param to - Target status string
 * @returns true if the transition is valid
 */
export function validateTransition(from: string, to: string): boolean {
  const transitionMap: Record<string, string[]> = {
    DRAFT: ['READY', 'CANCELLED'],
    READY: ['SUBMITTED', 'DRAFT', 'CANCELLED'],
    SUBMITTED: ['CHANNEL_ASSIGNED', 'REJECTED', 'CANCELLED'],
    CHANNEL_ASSIGNED: ['INSPECTING', 'CLEARED'],
    INSPECTING: ['CLEARED', 'REJECTED'],
    CLEARED: [],
    REJECTED: ['DRAFT'],
    CANCELLED: [],
  };

  const allowed = transitionMap[from];
  if (!allowed) {
    return false;
  }

  return allowed.includes(to);
}
