import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Decimal } from '@prisma/client/runtime/library';

export interface PaymentProcessResult {
  /** Amount deducted from the customer's wallet */
  walletDeducted: number;
  /** Amount charged against the customer's credit limit */
  creditUsed: number;
  /** Remaining amount that could not be covered */
  remaining: number;
  /** Whether the full amount was covered and delivery can proceed */
  canDeliver: boolean;
  /** Breakdown of payment sources */
  breakdown: PaymentBreakdown;
}

export interface PaymentBreakdown {
  walletBalanceBefore: number;
  walletBalanceAfter: number;
  creditLimitTotal: number;
  creditUsedBefore: number;
  creditUsedAfter: number;
  creditRemaining: number;
}

/**
 * Payment Priority Service.
 *
 * Implements the payment waterfall logic for order payments:
 *  1. Check wallet balance -> deduct if sufficient
 *  2. Check credit limit remaining -> use credit if sufficient
 *  3. Combine wallet + credit -> partial payment from both sources
 *  4. If still not enough -> block delivery, send notification
 *
 * This service handles the payment allocation for order settlement
 * and delivery release decisions.
 */
@Injectable()
export class PaymentPriorityService {
  private readonly logger = new Logger(PaymentPriorityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Process a payment for an order using the priority waterfall.
   *
   * @param orderId - The order to process payment for
   * @param amount - The total amount to be paid
   * @param customerId - The customer making the payment
   * @returns Payment processing result with breakdown
   */
  async processPayment(
    orderId: string,
    amount: number,
    customerId: string,
  ): Promise<PaymentProcessResult> {
    this.logger.log(
      `Processing payment for order ${orderId}: amount=${amount}, customer=${customerId}`,
    );

    return this.prisma.executeInTransaction(async (tx) => {
      // Fetch the customer's wallet and credit info
      const customer = await tx.customer.findUniqueOrThrow({
        where: { id: customerId },
        select: {
          id: true,
          creditLimit: true,
          currentDebt: true,
          wallet: {
            select: { id: true, balance: true },
          },
        },
      });

      const walletBalance = customer.wallet
        ? Number(customer.wallet.balance)
        : 0;
      const creditLimit = Number(customer.creditLimit);
      const currentDebt = Number(customer.currentDebt);
      const creditRemaining = Math.max(0, creditLimit - currentDebt);

      let remainingAmount = amount;
      let walletDeducted = 0;
      let creditUsed = 0;

      // Step 1: Deduct from wallet
      if (walletBalance > 0 && remainingAmount > 0) {
        walletDeducted = Math.min(walletBalance, remainingAmount);
        remainingAmount -= walletDeducted;

        if (customer.wallet) {
          // Deduct wallet balance
          await tx.wallet.update({
            where: { id: customer.wallet.id },
            data: {
              balance: {
                decrement: new Decimal(walletDeducted),
              },
            },
          });

          // Record wallet transaction
          await tx.walletTransaction.create({
            data: {
              walletId: customer.wallet.id,
              amount: new Decimal(-walletDeducted),
              type: 'DEDUCT',
              reference: orderId,
              note: `Payment for order ${orderId}`,
            },
          });
        }

        this.logger.log(
          `Step 1: Deducted ${walletDeducted} from wallet (balance was ${walletBalance})`,
        );
      }

      // Step 2: Use credit limit
      if (creditRemaining > 0 && remainingAmount > 0) {
        creditUsed = Math.min(creditRemaining, remainingAmount);
        remainingAmount -= creditUsed;

        // Increase customer's current debt
        await tx.customer.update({
          where: { id: customerId },
          data: {
            currentDebt: {
              increment: new Decimal(creditUsed),
            },
          },
        });

        this.logger.log(
          `Step 2: Used ${creditUsed} from credit (limit=${creditLimit}, debt was ${currentDebt})`,
        );
      }

      const canDeliver = remainingAmount <= 0;

      // Step 4: If still not enough, emit event for notification
      if (!canDeliver) {
        this.logger.warn(
          `Payment insufficient for order ${orderId}: remaining=${remainingAmount}`,
        );

        this.eventEmitter.emit('payment.insufficient', {
          orderId,
          customerId,
          totalAmount: amount,
          walletDeducted,
          creditUsed,
          remaining: remainingAmount,
        });
      }

      const breakdown: PaymentBreakdown = {
        walletBalanceBefore: walletBalance,
        walletBalanceAfter: walletBalance - walletDeducted,
        creditLimitTotal: creditLimit,
        creditUsedBefore: currentDebt,
        creditUsedAfter: currentDebt + creditUsed,
        creditRemaining: creditRemaining - creditUsed,
      };

      return {
        walletDeducted,
        creditUsed,
        remaining: remainingAmount,
        canDeliver,
        breakdown,
      };
    });
  }
}
