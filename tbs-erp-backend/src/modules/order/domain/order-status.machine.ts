import { Injectable } from '@nestjs/common';
import { DomainException } from '@common/exceptions/domain.exception';
import { ErrorCode } from '@common/exceptions/error-codes';
import { OrderStatus, ServiceType } from '@prisma/client';
import { BaseStatusMachine } from '@common/domain/base-status-machine';
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
 *
 * NOTE: This FSM extends BaseStatusMachine but overrides core methods
 * because it delegates to external transition maps in @common/constants
 * and applies service-type-specific business rules.
 */
@Injectable()
export class OrderStatusMachine extends BaseStatusMachine<OrderStatus> {
  constructor() {
    // Pass empty transition map and terminal statuses from constants.
    // The actual transition logic is delegated to @common/constants functions.
    super({}, [...TERMINAL_STATUSES]);
  }

  /**
   * Validates whether a status transition is allowed.
   *
   * @param from - Current order status
   * @param to - Target order status
   * @param serviceType - The order's service type (affects MHH deposit gate)
   * @returns true if the transition is valid
   */
  override validateTransition(from: OrderStatus, to: OrderStatus, serviceType?: ServiceType): boolean {
    // Terminal statuses cannot transition, EXCEPT COMPLETED → SETTLEMENT (reopen by BGĐ)
    if (TERMINAL_STATUSES.includes(from)) {
      if (from === OrderStatus.COMPLETED && to === OrderStatus.SETTLEMENT) {
        return true;
      }
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
  override getNextStatuses(current: OrderStatus, serviceType?: ServiceType): OrderStatus[] {
    const candidates = getNextStatusesFromMap(current);

    // For MHH, remove SOURCING from QUOTATION targets (must go via PENDING_DEPOSIT)
    if (serviceType === ServiceType.MHH && current === OrderStatus.QUOTATION) {
      return candidates.filter((s) => s !== OrderStatus.SOURCING);
    }

    return candidates;
  }

  /**
   * Validates and throws if the transition is invalid.
   * Used by the order service to enforce transitions.
   */
  override assertTransition(from: OrderStatus, to: OrderStatus, serviceType?: ServiceType): void {
    if (!this.validateTransition(from, to, serviceType)) {
      throw new DomainException(
        ErrorCode.ORDER_INVALID_TRANSITION,
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
}
