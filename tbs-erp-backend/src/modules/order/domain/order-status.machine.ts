import { Injectable, BadRequestException } from '@nestjs/common';
import { OrderStatus, ServiceType } from '@prisma/client';
import {
  isValidTransition,
  getNextStatuses as getNextStatusesFromMap,
  NON_CANCELLABLE_STATUSES,
  TERMINAL_STATUSES,
} from '@common/constants';

/**
 * Order Status Finite State Machine.
 *
 * Manages order lifecycle transitions with business rule enforcement.
 * Key rules:
 *  - MHH (Mua hang ho) orders MUST go through PENDING_DEPOSIT before SOURCING
 *  - VCT orders can skip PENDING_DEPOSIT if deposit is not required
 *  - Terminal statuses (COMPLETED, CANCELLED) have no further transitions
 *  - ON_HOLD and ISSUE can return to any lifecycle status
 */
@Injectable()
export class OrderStatusMachine {
  /**
   * Validates whether a status transition is allowed.
   *
   * @param from - Current order status
   * @param to - Target order status
   * @param serviceType - The order's service type (affects MHH deposit gate)
   * @returns true if the transition is valid
   */
  validateTransition(
    from: OrderStatus,
    to: OrderStatus,
    serviceType?: ServiceType,
  ): boolean {
    // Terminal statuses cannot transition
    if (TERMINAL_STATUSES.includes(from)) {
      return false;
    }

    // Check the base transition map
    if (!isValidTransition(from, to)) {
      return false;
    }

    // MHH orders MUST go through PENDING_DEPOSIT before SOURCING.
    // Direct transition from QUOTATION -> SOURCING is blocked for MHH.
    if (
      serviceType === ServiceType.MHH &&
      from === OrderStatus.QUOTATION &&
      to === OrderStatus.SOURCING
    ) {
      return false;
    }

    return true;
  }

  /**
   * Returns all valid next statuses from the current status,
   * optionally filtered by service type rules.
   */
  getNextStatuses(
    current: OrderStatus,
    serviceType?: ServiceType,
  ): OrderStatus[] {
    const candidates = getNextStatusesFromMap(current);

    // For MHH, remove SOURCING from QUOTATION targets (must go via PENDING_DEPOSIT)
    if (
      serviceType === ServiceType.MHH &&
      current === OrderStatus.QUOTATION
    ) {
      return candidates.filter((s) => s !== OrderStatus.SOURCING);
    }

    return candidates;
  }

  /**
   * Validates and throws if the transition is invalid.
   * Used by the order service to enforce transitions.
   */
  assertTransition(
    from: OrderStatus,
    to: OrderStatus,
    serviceType?: ServiceType,
  ): void {
    if (!this.validateTransition(from, to, serviceType)) {
      throw new BadRequestException(
        `Invalid status transition from ${from} to ${to}` +
          (serviceType ? ` for service type ${serviceType}` : ''),
      );
    }
  }

  /**
   * Checks whether an order in the given status can be cancelled.
   */
  canCancel(status: OrderStatus): boolean {
    return !NON_CANCELLABLE_STATUSES.includes(status);
  }

  /**
   * Returns whether the given status is a terminal state.
   */
  isTerminal(status: OrderStatus): boolean {
    return TERMINAL_STATUSES.includes(status);
  }
}
