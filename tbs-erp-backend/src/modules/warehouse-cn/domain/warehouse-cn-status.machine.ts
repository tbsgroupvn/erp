import { Injectable, BadRequestException } from '@nestjs/common';

type WarehouseCNStatus = 'RECEIVED' | 'CHECKED' | 'PACKED' | 'SHIPPED';

/**
 * Warehouse CN (China) Status Finite State Machine.
 *
 * Manages China warehouse package lifecycle transitions.
 * Key rules:
 *  - RECEIVED can move to CHECKED
 *  - CHECKED can move to PACKED
 *  - PACKED can move to SHIPPED
 *  - SHIPPED is a terminal state
 */
@Injectable()
export class WarehouseCNStatusMachine {
  private readonly transitions: Record<WarehouseCNStatus, WarehouseCNStatus[]> = {
    RECEIVED: ['CHECKED'],
    CHECKED: ['PACKED'],
    PACKED: ['SHIPPED'],
    SHIPPED: [],
  };

  /**
   * Validates whether a status transition is allowed.
   *
   * @param from - Current warehouse CN status
   * @param to - Target warehouse CN status
   * @returns true if the transition is valid
   */
  validateTransition(from: WarehouseCNStatus, to: WarehouseCNStatus): boolean {
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
   * @param from - Current warehouse CN status
   * @param to - Target warehouse CN status
   * @throws BadRequestException if the transition is not allowed
   */
  assertTransition(from: WarehouseCNStatus, to: WarehouseCNStatus): void {
    if (!this.validateTransition(from, to)) {
      throw new BadRequestException(
        `Invalid status transition from ${from} to ${to}`,
      );
    }
  }

  /**
   * Returns all valid next statuses from the current status.
   *
   * @param current - The current warehouse CN status
   * @returns Array of valid target statuses
   */
  getNextStatuses(current: WarehouseCNStatus): WarehouseCNStatus[] {
    return this.transitions[current] ?? [];
  }

  /**
   * Returns whether the given status is a terminal state
   * (no further transitions possible).
   */
  isTerminal(status: WarehouseCNStatus): boolean {
    const nextStatuses = this.transitions[status];
    return !nextStatuses || nextStatuses.length === 0;
  }
}
