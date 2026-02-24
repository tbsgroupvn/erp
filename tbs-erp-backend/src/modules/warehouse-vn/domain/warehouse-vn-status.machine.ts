import { Injectable, BadRequestException } from '@nestjs/common';

type WarehouseVNStatus = 'RECEIVED' | 'SORTED' | 'READY' | 'DELIVERED';

/**
 * Warehouse VN (Vietnam) Status Finite State Machine.
 *
 * Manages Vietnam warehouse package lifecycle transitions.
 * Key rules:
 *  - RECEIVED can move to SORTED
 *  - SORTED can move to READY
 *  - READY can move to DELIVERED
 *  - DELIVERED is a terminal state
 */
@Injectable()
export class WarehouseVNStatusMachine {
  private readonly transitions: Record<WarehouseVNStatus, WarehouseVNStatus[]> = {
    RECEIVED: ['SORTED'],
    SORTED: ['READY'],
    READY: ['DELIVERED'],
    DELIVERED: [],
  };

  /**
   * Validates whether a status transition is allowed.
   *
   * @param from - Current warehouse VN status
   * @param to - Target warehouse VN status
   * @returns true if the transition is valid
   */
  validateTransition(from: WarehouseVNStatus, to: WarehouseVNStatus): boolean {
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
   * @param from - Current warehouse VN status
   * @param to - Target warehouse VN status
   * @throws BadRequestException if the transition is not allowed
   */
  assertTransition(from: WarehouseVNStatus, to: WarehouseVNStatus): void {
    if (!this.validateTransition(from, to)) {
      throw new BadRequestException(
        `Invalid status transition from ${from} to ${to}`,
      );
    }
  }

  /**
   * Returns all valid next statuses from the current status.
   *
   * @param current - The current warehouse VN status
   * @returns Array of valid target statuses
   */
  getNextStatuses(current: WarehouseVNStatus): WarehouseVNStatus[] {
    return this.transitions[current] ?? [];
  }

  /**
   * Returns whether the given status is a terminal state
   * (no further transitions possible).
   */
  isTerminal(status: WarehouseVNStatus): boolean {
    const nextStatuses = this.transitions[status];
    return !nextStatuses || nextStatuses.length === 0;
  }
}
