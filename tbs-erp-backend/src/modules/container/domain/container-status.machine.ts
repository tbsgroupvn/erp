import { Injectable, BadRequestException } from '@nestjs/common';
import { ContainerStatus } from '@prisma/client';

/**
 * Container Status Finite State Machine.
 *
 * Manages container lifecycle transitions.
 * Key rules:
 *  - PLANNING can move to LOADING
 *  - LOADING can move to IN_TRANSIT
 *  - IN_TRANSIT can move to ARRIVED or ON_HOLD_BORDER
 *  - ON_HOLD_BORDER can resume to IN_TRANSIT or move to ARRIVED
 *  - ARRIVED can move to CUSTOMS
 *  - CUSTOMS can move to COMPLETED
 *  - COMPLETED is a terminal state
 */
@Injectable()
export class ContainerStatusMachine {
  private readonly transitions: Record<ContainerStatus, ContainerStatus[]> = {
    PLANNING: [
      ContainerStatus.LOADING,
    ],
    LOADING: [
      ContainerStatus.IN_TRANSIT,
    ],
    IN_TRANSIT: [
      ContainerStatus.ARRIVED,
      ContainerStatus.ON_HOLD_BORDER,
    ],
    ON_HOLD_BORDER: [
      ContainerStatus.IN_TRANSIT,
      ContainerStatus.ARRIVED,
    ],
    ARRIVED: [
      ContainerStatus.CUSTOMS,
    ],
    CUSTOMS: [
      ContainerStatus.COMPLETED,
    ],
    COMPLETED: [],
  };

  /**
   * Validates whether a status transition is allowed.
   *
   * @param from - Current container status
   * @param to - Target container status
   * @returns true if the transition is valid
   */
  validateTransition(from: ContainerStatus, to: ContainerStatus): boolean {
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
   * @param from - Current container status
   * @param to - Target container status
   * @throws BadRequestException if the transition is not allowed
   */
  assertTransition(from: ContainerStatus, to: ContainerStatus): void {
    if (!this.validateTransition(from, to)) {
      throw new BadRequestException(
        `Invalid status transition from ${from} to ${to}`,
      );
    }
  }

  /**
   * Returns all valid next statuses from the current status.
   *
   * @param current - The current container status
   * @returns Array of valid target statuses
   */
  getNextStatuses(current: ContainerStatus): ContainerStatus[] {
    return this.transitions[current] ?? [];
  }

  /**
   * Returns whether the given status is a terminal state
   * (no further transitions possible).
   */
  isTerminal(status: ContainerStatus): boolean {
    const nextStatuses = this.transitions[status];
    return !nextStatuses || nextStatuses.length === 0;
  }
}
