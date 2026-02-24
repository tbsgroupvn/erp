import { Injectable, Logger } from '@nestjs/common';
import {
  CustomerTier,
  ServiceType,
  OrderStatus,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { DEPOSIT_RATE } from '@common/constants';
import { PrismaService } from '@core/database/prisma.service';

export interface ProcurementGateResult {
  /** Whether procurement (creating supplier orders) is allowed */
  allowed: boolean;
  /** Current deposit paid percentage (0-100) */
  depositPaidPercent: number;
  /** Whether this order should get priority treatment (100% deposit) */
  isPriority: boolean;
  /** Total deposit paid */
  depositPaid: number;
  /** Total order amount */
  totalAmount: number;
  /** Minimum percent required to unlock procurement */
  requiredPercent: number;
}

export interface DepositRequirement {
  /** Whether a deposit is required for this order */
  required: boolean;
  /** The deposit rate percentage (0-100) */
  depositRate: number;
  /** The required deposit amount */
  depositAmount: number;
  /** The service type used for calculation */
  serviceType: ServiceType;
  /** The customer tier used for calculation */
  customerTier: CustomerTier;
}

export interface DepositSatisfactionResult {
  /** Whether the deposit requirement has been met */
  satisfied: boolean;
  /** Total deposit required */
  required: number;
  /** Total deposit already paid */
  paid: number;
  /** Remaining deposit amount needed */
  remaining: number;
}

/**
 * Deposit Gate Service.
 *
 * Controls order progression by enforcing deposit requirements based on:
 *  - Customer tier: NEW=100%, REGULAR=70%, VIP=50%, STRATEGIC=30%
 *  - Service type: MHH orders always require deposit before SOURCING
 *  - Custom overrides: Customer-level depositRate field can override tier defaults
 *
 * The deposit gate blocks transition to SOURCING status for MHH orders
 * when the deposit has not been paid.
 */
@Injectable()
export class DepositGateService {
  private readonly logger = new Logger(DepositGateService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Hard rule: checks if procurement (creating supplier orders) is allowed.
   * Requires at least 70% of total order amount paid as deposit.
   * If 100% is paid, the order gets priority treatment.
   */
  async canProcure(orderId: string): Promise<ProcurementGateResult> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        totalAmount: true,
        depositPaid: true,
        isDepositPaid: true,
      },
    });

    if (!order) {
      return {
        allowed: false,
        depositPaidPercent: 0,
        isPriority: false,
        depositPaid: 0,
        totalAmount: 0,
        requiredPercent: 70,
      };
    }

    const totalAmount = Number(order.totalAmount);
    const depositPaid = Number(order.depositPaid);
    const depositPaidPercent = totalAmount > 0
      ? (depositPaid / totalAmount) * 100
      : 0;

    const allowed = depositPaidPercent >= 70;
    const isPriority = depositPaidPercent >= 100;

    return {
      allowed,
      depositPaidPercent: Math.round(depositPaidPercent * 100) / 100,
      isPriority,
      depositPaid,
      totalAmount,
      requiredPercent: 70,
    };
  }

  /**
   * Returns detailed procurement gate status for frontend display.
   */
  async getProcurementGateStatus(orderId: string) {
    const gate = await this.canProcure(orderId);

    return {
      ...gate,
      message: !gate.allowed
        ? `Cần cọc tối thiểu 70% để mua hàng. Hiện tại: ${gate.depositPaidPercent.toFixed(1)}%`
        : gate.isPriority
          ? 'Đã cọc 100% - Đơn hàng ưu tiên'
          : `Đủ điều kiện mua hàng (${gate.depositPaidPercent.toFixed(1)}%)`,
    };
  }

  /**
   * Calculates the deposit requirement for an order based on customer tier
   * and service type.
   *
   * @param totalAmount - The total order amount
   * @param customerTier - The customer's tier
   * @param serviceType - The order's service type
   * @param customerDepositRate - Optional override from the customer record
   */
  checkDepositRequirement(
    totalAmount: number,
    customerTier: CustomerTier,
    serviceType: ServiceType,
    customerDepositRate?: number,
  ): DepositRequirement {
    // VCT (pure shipping) typically doesn't require upfront deposit
    // unless the customer is NEW tier
    if (
      serviceType === ServiceType.VCT &&
      customerTier !== CustomerTier.NEW
    ) {
      return {
        required: false,
        depositRate: 0,
        depositAmount: 0,
        serviceType,
        customerTier,
      };
    }

    // Use customer-level override if set, otherwise use tier-based rate
    const depositRate =
      customerDepositRate !== undefined && customerDepositRate > 0
        ? customerDepositRate
        : DEPOSIT_RATE[customerTier];

    const depositAmount = Math.ceil((totalAmount * depositRate) / 100);

    return {
      required: depositAmount > 0,
      depositRate,
      depositAmount,
      serviceType,
      customerTier,
    };
  }

  /**
   * Checks whether the deposit for a given order has been satisfied.
   *
   * @param order - The order with depositRequired and depositPaid fields
   */
  isDepositSatisfied(order: {
    depositRequired: Decimal | number;
    depositPaid: Decimal | number;
    isDepositPaid: boolean;
  }): DepositSatisfactionResult {
    const required = Number(order.depositRequired);
    const paid = Number(order.depositPaid);

    // If no deposit required, it's automatically satisfied
    if (required <= 0) {
      return { satisfied: true, required: 0, paid, remaining: 0 };
    }

    const remaining = Math.max(0, required - paid);
    const satisfied = order.isDepositPaid || paid >= required;

    return { satisfied, required, paid, remaining };
  }

  /**
   * Determines whether the SOURCING status transition should be blocked
   * due to unpaid deposit.
   *
   * This is the core deposit gate: MHH orders cannot proceed to SOURCING
   * (goods purchasing) without deposit being paid.
   *
   * @param order - The order to check
   * @param targetStatus - The status the order wants to transition to
   */
  shouldBlockTransition(
    order: {
      serviceType: ServiceType;
      status: OrderStatus;
      depositRequired: Decimal | number;
      depositPaid: Decimal | number;
      isDepositPaid: boolean;
    },
    targetStatus: OrderStatus,
  ): { blocked: boolean; reason?: string } {
    // Only block the transition to SOURCING
    if (targetStatus !== OrderStatus.SOURCING) {
      return { blocked: false };
    }

    // MHH orders must have deposit paid before sourcing
    if (order.serviceType === ServiceType.MHH) {
      const depositCheck = this.isDepositSatisfied(order);

      if (!depositCheck.satisfied) {
        const reason =
          `Cannot proceed to SOURCING: deposit not satisfied. ` +
          `Required: ${depositCheck.required}, Paid: ${depositCheck.paid}, ` +
          `Remaining: ${depositCheck.remaining}`;

        this.logger.warn(reason);
        return { blocked: true, reason };
      }
    }

    return { blocked: false };
  }
}
