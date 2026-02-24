import { Injectable, BadRequestException } from '@nestjs/common';
import { SupplierOrderStatus } from '@prisma/client';

/**
 * Supplier Order Status Finite State Machine.
 *
 * Manages supplier order lifecycle transitions.
 * Key rules:
 *  - DRAFT can move to QUOTED, ORDERED, or CANCELLED
 *  - QUOTED can move to ORDERED or CANCELLED
 *  - ORDERED can be CONFIRMED, CANCELLED, or flagged as ISSUE
 *  - CONFIRMED can progress to shipping stages, be CANCELLED, or flagged as ISSUE
 *  - PARTIALLY_SHIPPED can complete shipping or flag ISSUE
 *  - SHIPPED_CN can be RECEIVED_CN or flag ISSUE
 *  - RECEIVED_CN can be returned to supplier
 *  - RETURN_IN_PROGRESS leads to REFUNDED (terminal)
 *  - REFUNDED and CANCELLED are terminal states
 *  - ISSUE can retry (ORDERED, CONFIRMED) or be CANCELLED
 */
@Injectable()
export class SupplierOrderStatusMachine {
  private readonly transitions: Record<SupplierOrderStatus, SupplierOrderStatus[]> = {
    DRAFT: [
      SupplierOrderStatus.QUOTED,
      SupplierOrderStatus.ORDERED,
      SupplierOrderStatus.CANCELLED,
    ],
    QUOTED: [
      SupplierOrderStatus.ORDERED,
      SupplierOrderStatus.CANCELLED,
    ],
    ORDERED: [
      SupplierOrderStatus.CONFIRMED,
      SupplierOrderStatus.CANCELLED,
      SupplierOrderStatus.ISSUE,
    ],
    CONFIRMED: [
      SupplierOrderStatus.PARTIALLY_SHIPPED,
      SupplierOrderStatus.SHIPPED_CN,
      SupplierOrderStatus.CANCELLED,
      SupplierOrderStatus.ISSUE,
    ],
    PARTIALLY_SHIPPED: [
      SupplierOrderStatus.SHIPPED_CN,
      SupplierOrderStatus.RECEIVED_CN,
      SupplierOrderStatus.ISSUE,
    ],
    SHIPPED_CN: [
      SupplierOrderStatus.RECEIVED_CN,
      SupplierOrderStatus.ISSUE,
    ],
    RECEIVED_CN: [
      SupplierOrderStatus.RETURN_IN_PROGRESS,
      SupplierOrderStatus.ISSUE,
    ],
    RETURN_IN_PROGRESS: [
      SupplierOrderStatus.REFUNDED,
      SupplierOrderStatus.ISSUE,
    ],
    REFUNDED: [],
    CANCELLED: [],
    ISSUE: [
      SupplierOrderStatus.ORDERED,
      SupplierOrderStatus.CONFIRMED,
      SupplierOrderStatus.RETURN_IN_PROGRESS,
      SupplierOrderStatus.CANCELLED,
    ],
  };

  /**
   * Validates whether a status transition is allowed.
   *
   * @param from - Current supplier order status
   * @param to - Target supplier order status
   * @returns true if the transition is valid
   */
  validateTransition(from: SupplierOrderStatus, to: SupplierOrderStatus): boolean {
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
   * @param from - Current supplier order status
   * @param to - Target supplier order status
   * @throws BadRequestException if the transition is not allowed
   */
  assertTransition(from: SupplierOrderStatus, to: SupplierOrderStatus): void {
    if (!this.validateTransition(from, to)) {
      throw new BadRequestException(
        `Invalid status transition from ${from} to ${to}`,
      );
    }
  }

  /**
   * Returns all valid next statuses from the current status.
   *
   * @param current - The current supplier order status
   * @returns Array of valid target statuses
   */
  getNextStatuses(current: SupplierOrderStatus): SupplierOrderStatus[] {
    return this.transitions[current] ?? [];
  }

  /**
   * Returns whether the given status is a terminal state
   * (no further transitions possible).
   */
  isTerminal(status: SupplierOrderStatus): boolean {
    const nextStatuses = this.transitions[status];
    return !nextStatuses || nextStatuses.length === 0;
  }
}
