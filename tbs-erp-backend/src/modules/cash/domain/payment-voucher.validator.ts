import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@core/database/prisma.service';
import { CashFlowGuardService } from './cash-flow-guard.service';

export interface VoucherValidationInput {
  type: string;
  orderId: string;
  amount: number;
  reason: string;
  beneficiary: string;
  costType: string;
  attachments: string[];
  createdBy: string;
  createdAt?: Date;
}

export interface VoucherValidationResult {
  isValid: boolean;
  isBlocked: boolean;
  isFlagged: boolean;
  blockReasons: string[];
  flagReasons: string[];
}

/**
 * Anti-fraud validation for payment vouchers.
 * Two levels of validation:
 * - BLOCK: Hard blocks that prevent voucher creation entirely
 * - FLAG: Soft warnings that flag the voucher for extra scrutiny
 */
@Injectable()
export class PaymentVoucherValidator {
  private readonly logger = new Logger(PaymentVoucherValidator.name);

  // Known approved vendors list (in production this would come from DB)
  private readonly APPROVED_VENDORS: string[] = [];

  /** Anti-fraud thresholds from config */
  private readonly expensePercentThreshold: number;
  private readonly miscExpenseThreshold: number;
  private readonly maxVouchersPerDay: number;
  private readonly minReasonLength: number;
  private readonly businessHoursStart: number;
  private readonly businessHoursEnd: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly cashFlowGuard: CashFlowGuardService,
  ) {
    this.expensePercentThreshold = this.configService.get<number>(
      'business.antifraud.expensePercentThreshold',
      0.9,
    );
    this.miscExpenseThreshold = this.configService.get<number>(
      'business.antifraud.miscExpenseThreshold',
      5_000_000,
    );
    this.maxVouchersPerDay = this.configService.get<number>(
      'business.antifraud.maxVouchersPerDay',
      5,
    );
    this.minReasonLength = this.configService.get<number>('business.antifraud.minReasonLength', 20);
    this.businessHoursStart = this.configService.get<number>(
      'business.antifraud.businessHoursStart',
      7,
    );
    this.businessHoursEnd = this.configService.get<number>(
      'business.antifraud.businessHoursEnd',
      19,
    );
  }

  /**
   * Run all validation checks on a payment voucher.
   */
  async validate(input: VoucherValidationInput): Promise<VoucherValidationResult> {
    const blockReasons: string[] = [];
    const flagReasons: string[] = [];

    // Only apply anti-fraud checks to PAYMENT type (chi)
    if (input.type !== 'PAYMENT') {
      return {
        isValid: true,
        isBlocked: false,
        isFlagged: false,
        blockReasons: [],
        flagReasons: [],
      };
    }

    // ==================== BLOCK CHECKS ====================

    // 1. No order ID
    if (!input.orderId) {
      blockReasons.push('Missing orderId: Payment voucher must be linked to an order');
    }

    // 2. Order is closed (COMPLETED or CANCELLED)
    if (input.orderId) {
      const order = await this.prisma.order.findUnique({
        where: { id: input.orderId },
        select: {
          id: true,
          status: true,
          saleId: true,
          totalAmount: true,
          code: true,
        },
      });

      if (!order) {
        blockReasons.push(`Order ${input.orderId} not found`);
      } else {
        if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
          blockReasons.push(
            `Order ${order.code} is ${order.status}. Cannot create payment voucher for closed orders.`,
          );
        }

        // B3. Cash flow control: Tien TBS tra NCC <= (Coc khach + Vi khach)
        if (order.status !== 'COMPLETED' && order.status !== 'CANCELLED') {
          const cfCheck = await this.cashFlowGuard.validateSupplierPayment(
            input.orderId,
            input.amount,
          );
          if (!cfCheck.allowed) {
            blockReasons.push(cfCheck.reason!);
          }
          if (cfCheck.alertLevel === 'WARNING' && cfCheck.warningMessage) {
            flagReasons.push(cfCheck.warningMessage);
          }
        }

        // ==================== FLAG CHECKS ====================

        // F1. Total cost exceeds configured % of order revenue
        if (order.totalAmount) {
          const orderRevenue = order.totalAmount.toNumber();
          if (orderRevenue > 0 && input.amount > orderRevenue * this.expensePercentThreshold) {
            flagReasons.push(
              `Payment amount (${input.amount}) exceeds ${this.expensePercentThreshold * 100}% of order revenue (${orderRevenue}). Possible over-billing.`,
            );
          }
        }
      }
    }

    // 4. No attachments
    if (!input.attachments || input.attachments.length === 0) {
      blockReasons.push(
        'Missing attachments: Payment voucher requires at least one supporting document',
      );
    }

    // 5. Reason too short
    if (!input.reason || input.reason.trim().length < this.minReasonLength) {
      blockReasons.push(
        `Reason must be at least ${this.minReasonLength} characters. Provide a detailed explanation.`,
      );
    }

    // 6. No beneficiary
    if (!input.beneficiary || input.beneficiary.trim().length === 0) {
      blockReasons.push('Missing beneficiary: Must specify who receives the payment');
    }

    // 7. No cost type
    if (!input.costType || input.costType.trim().length === 0) {
      blockReasons.push('Missing cost type: Must specify the type of expense');
    }

    // ==================== FLAG CHECKS (continued) ====================

    // F2. "Phat sinh" (incidental expense) exceeding configured threshold
    const lowerReason = (input.reason || '').toLowerCase();
    const lowerCostType = (input.costType || '').toLowerCase();
    if (
      (lowerReason.includes('phat sinh') ||
        lowerReason.includes('phát sinh') ||
        lowerCostType.includes('phat sinh') ||
        lowerCostType.includes('phát sinh')) &&
      input.amount > this.miscExpenseThreshold
    ) {
      flagReasons.push(
        `Incidental expense ("phát sinh") exceeding ${this.miscExpenseThreshold.toLocaleString()} VND (${input.amount}). Requires additional review.`,
      );
    }

    // F3. Pattern of small consecutive vouchers from same creator
    const recentVouchers = await this.prisma.paymentVoucher.count({
      where: {
        createdBy: input.createdBy,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24h
        },
        type: 'PAYMENT',
      },
    });

    if (recentVouchers >= this.maxVouchersPerDay) {
      flagReasons.push(
        `Creator has ${recentVouchers} payment vouchers in the last 24 hours. Possible voucher splitting pattern.`,
      );
    }

    // F4. Vendor/beneficiary not in approved list
    if (
      this.APPROVED_VENDORS.length > 0 &&
      !this.APPROVED_VENDORS.some((v) => v.toLowerCase() === input.beneficiary.toLowerCase())
    ) {
      flagReasons.push(`Beneficiary "${input.beneficiary}" is not in the approved vendor list.`);
    }

    // F5. Created outside business hours
    const createdAt = input.createdAt ?? new Date();
    const hour = createdAt.getHours();
    if (hour < this.businessHoursStart || hour >= this.businessHoursEnd) {
      flagReasons.push(
        `Voucher created outside business hours (${hour}:00). Business hours are ${String(this.businessHoursStart).padStart(2, '0')}:00 - ${String(this.businessHoursEnd).padStart(2, '0')}:00.`,
      );
    }

    const isBlocked = blockReasons.length > 0;
    const isFlagged = flagReasons.length > 0;

    if (isBlocked) {
      this.logger.warn(
        `Payment voucher BLOCKED for order ${input.orderId}: ${blockReasons.join('; ')}`,
      );
    }

    if (isFlagged) {
      this.logger.warn(
        `Payment voucher FLAGGED for order ${input.orderId}: ${flagReasons.join('; ')}`,
      );
    }

    return {
      isValid: !isBlocked,
      isBlocked,
      isFlagged,
      blockReasons,
      flagReasons,
    };
  }
}
