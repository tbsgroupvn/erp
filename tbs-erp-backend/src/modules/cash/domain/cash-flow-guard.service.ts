import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';

export interface CashFlowCheckResult {
  allowed: boolean;
  alertLevel: 'OK' | 'WARNING' | 'CRITICAL';
  availableFunds: number;
  projectedSpend: number;
  utilizationPercent: number;
  reason?: string;
  warningMessage?: string;
}

export interface CashFlowStatus {
  totalCustomerDeposits: number;
  totalWalletBalances: number;
  totalAvailableFunds: number;
  totalSupplierPayments: number;
  utilizationPercent: number;
  remaining: number;
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
}

/**
 * Cash Flow Control Guard - Core business rule:
 *   Tien TBS tra NCC <= (Tien khach coc + So du vi khach)
 *
 * Two levels of check:
 * 1. Per-order: validates a single supplier payment against its order's funds
 * 2. System-wide: validates total supplier payments against total available funds
 */
@Injectable()
export class CashFlowGuardService {
  private readonly logger = new Logger(CashFlowGuardService.name);

  private readonly WARNING_THRESHOLD = 0.8;
  private readonly CRITICAL_THRESHOLD = 0.95;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Per-order cash flow validation.
   * availableFunds = depositPaid + walletBalance
   * projectedSpend = existingApprovedPayments + newPaymentAmount
   */
  async validateSupplierPayment(
    orderId: string,
    paymentAmount: number,
  ): Promise<CashFlowCheckResult> {
    // 1. Get order with deposit info and customer wallet
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        code: true,
        depositPaid: true,
        customerId: true,
      },
    });

    if (!order) {
      return {
        allowed: false,
        alertLevel: 'CRITICAL',
        availableFunds: 0,
        projectedSpend: paymentAmount,
        utilizationPercent: 100,
        reason: `Order ${orderId} not found`,
      };
    }

    // 2. Get customer wallet balance
    const wallet = await this.prisma.wallet.findUnique({
      where: { customerId: order.customerId },
      select: { balance: true },
    });
    const walletBalance = Number(wallet?.balance ?? 0);

    // 3. Get existing approved PAYMENT vouchers for this order
    const existingPayments = await this.prisma.paymentVoucher.aggregate({
      where: {
        orderId,
        type: 'PAYMENT',
        status: 'APPROVED',
      },
      _sum: { amount: true },
    });
    const existingPaid = Number(existingPayments._sum.amount ?? 0);

    // 4. Calculate
    const depositPaid = Number(order.depositPaid);
    const availableFunds = depositPaid + walletBalance;
    const projectedSpend = existingPaid + paymentAmount;

    // Avoid division by zero
    const utilizationPercent =
      availableFunds > 0 ? (projectedSpend / availableFunds) * 100 : projectedSpend > 0 ? 100 : 0;

    // 5. Check: BLOCK if projected > available
    if (projectedSpend > availableFunds) {
      const reason =
        `Vuot quy don ${order.code}: Chi NCC du kien ${projectedSpend.toLocaleString()} VND, ` +
        `Quy kha dung ${availableFunds.toLocaleString()} VND ` +
        `(Coc: ${depositPaid.toLocaleString()}, Vi: ${walletBalance.toLocaleString()})`;

      this.logger.warn(`CASH FLOW BLOCKED: ${reason}`);

      return {
        allowed: false,
        alertLevel: 'CRITICAL',
        availableFunds,
        projectedSpend,
        utilizationPercent,
        reason,
      };
    }

    // 6. Check: WARNING if > 80%
    let alertLevel: 'OK' | 'WARNING' | 'CRITICAL' = 'OK';
    let warningMessage: string | undefined;

    if (utilizationPercent >= this.CRITICAL_THRESHOLD * 100) {
      alertLevel = 'CRITICAL';
      warningMessage =
        `Don ${order.code}: Su dung quy ${utilizationPercent.toFixed(1)}% ` +
        `(${projectedSpend.toLocaleString()} / ${availableFunds.toLocaleString()})`;
      this.emitAlert(orderId, order.code, alertLevel, utilizationPercent);
    } else if (utilizationPercent >= this.WARNING_THRESHOLD * 100) {
      alertLevel = 'WARNING';
      warningMessage =
        `Don ${order.code}: Gan vuot quy - su dung ${utilizationPercent.toFixed(1)}% ` +
        `(${projectedSpend.toLocaleString()} / ${availableFunds.toLocaleString()})`;
      this.emitAlert(orderId, order.code, alertLevel, utilizationPercent);
    }

    return {
      allowed: true,
      alertLevel,
      availableFunds,
      projectedSpend,
      utilizationPercent,
      warningMessage,
    };
  }

  /**
   * System-wide cash flow validation.
   * Total approved PAYMENT vouchers <= Total approved RECEIPT deposits + Total wallet balances
   */
  async validateSystemCashFlow(): Promise<CashFlowCheckResult> {
    const [totalPayments, totalReceipts, totalWallets] = await Promise.all([
      // Total approved supplier payments
      this.prisma.paymentVoucher.aggregate({
        where: { type: 'PAYMENT', status: 'APPROVED' },
        _sum: { amount: true },
      }),
      // Total approved receipt (deposits from customers)
      this.prisma.paymentVoucher.aggregate({
        where: { type: 'RECEIPT', status: 'APPROVED' },
        _sum: { amount: true },
      }),
      // Total wallet balances across all customers
      this.prisma.wallet.aggregate({
        _sum: { balance: true },
      }),
    ]);

    const totalSupplierPayments = Number(totalPayments._sum.amount ?? 0);
    const totalCustomerDeposits = Number(totalReceipts._sum.amount ?? 0);
    const totalWalletBalances = Number(totalWallets._sum.balance ?? 0);
    const totalAvailableFunds = totalCustomerDeposits + totalWalletBalances;

    const utilizationPercent =
      totalAvailableFunds > 0
        ? (totalSupplierPayments / totalAvailableFunds) * 100
        : totalSupplierPayments > 0
          ? 100
          : 0;

    if (totalSupplierPayments > totalAvailableFunds) {
      const reason =
        `He thong vuot quy: Tong chi NCC ${totalSupplierPayments.toLocaleString()} > ` +
        `Tong quy kha dung ${totalAvailableFunds.toLocaleString()} ` +
        `(Coc: ${totalCustomerDeposits.toLocaleString()}, Vi: ${totalWalletBalances.toLocaleString()})`;

      return {
        allowed: false,
        alertLevel: 'CRITICAL',
        availableFunds: totalAvailableFunds,
        projectedSpend: totalSupplierPayments,
        utilizationPercent,
        reason,
      };
    }

    let alertLevel: 'OK' | 'WARNING' | 'CRITICAL' = 'OK';
    if (utilizationPercent >= this.CRITICAL_THRESHOLD * 100) {
      alertLevel = 'CRITICAL';
    } else if (utilizationPercent >= this.WARNING_THRESHOLD * 100) {
      alertLevel = 'WARNING';
    }

    return {
      allowed: true,
      alertLevel,
      availableFunds: totalAvailableFunds,
      projectedSpend: totalSupplierPayments,
      utilizationPercent,
    };
  }

  /**
   * Get overall cash flow status for monitoring dashboard.
   */
  async getSystemFlowStatus(): Promise<CashFlowStatus> {
    const [totalPayments, totalReceipts, totalWallets] = await Promise.all([
      this.prisma.paymentVoucher.aggregate({
        where: { type: 'PAYMENT', status: 'APPROVED' },
        _sum: { amount: true },
      }),
      this.prisma.paymentVoucher.aggregate({
        where: { type: 'RECEIPT', status: 'APPROVED' },
        _sum: { amount: true },
      }),
      this.prisma.wallet.aggregate({
        _sum: { balance: true },
      }),
    ]);

    const totalSupplierPayments = Number(totalPayments._sum.amount ?? 0);
    const totalCustomerDeposits = Number(totalReceipts._sum.amount ?? 0);
    const totalWalletBalances = Number(totalWallets._sum.balance ?? 0);
    const totalAvailableFunds = totalCustomerDeposits + totalWalletBalances;
    const remaining = totalAvailableFunds - totalSupplierPayments;

    const utilizationPercent =
      totalAvailableFunds > 0
        ? (totalSupplierPayments / totalAvailableFunds) * 100
        : totalSupplierPayments > 0
          ? 100
          : 0;

    let status: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';
    if (utilizationPercent >= this.CRITICAL_THRESHOLD * 100) {
      status = 'CRITICAL';
    } else if (utilizationPercent >= this.WARNING_THRESHOLD * 100) {
      status = 'WARNING';
    }

    return {
      totalCustomerDeposits,
      totalWalletBalances,
      totalAvailableFunds,
      totalSupplierPayments,
      utilizationPercent: Math.round(utilizationPercent * 10) / 10,
      remaining,
      status,
    };
  }

  /**
   * Get per-order cash flow status.
   */
  async getOrderFlowStatus(orderId: string): Promise<
    CashFlowStatus & {
      orderId: string;
      orderCode: string;
    }
  > {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        code: true,
        depositPaid: true,
        customerId: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    const wallet = await this.prisma.wallet.findUnique({
      where: { customerId: order.customerId },
      select: { balance: true },
    });

    const existingPayments = await this.prisma.paymentVoucher.aggregate({
      where: {
        orderId,
        type: 'PAYMENT',
        status: 'APPROVED',
      },
      _sum: { amount: true },
    });

    const depositPaid = Number(order.depositPaid);
    const walletBalance = Number(wallet?.balance ?? 0);
    const totalSupplierPayments = Number(existingPayments._sum.amount ?? 0);
    const totalAvailableFunds = depositPaid + walletBalance;
    const remaining = totalAvailableFunds - totalSupplierPayments;

    const utilizationPercent =
      totalAvailableFunds > 0
        ? (totalSupplierPayments / totalAvailableFunds) * 100
        : totalSupplierPayments > 0
          ? 100
          : 0;

    let status: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';
    if (utilizationPercent >= this.CRITICAL_THRESHOLD * 100) {
      status = 'CRITICAL';
    } else if (utilizationPercent >= this.WARNING_THRESHOLD * 100) {
      status = 'WARNING';
    }

    return {
      orderId: order.id,
      orderCode: order.code,
      totalCustomerDeposits: depositPaid,
      totalWalletBalances: walletBalance,
      totalAvailableFunds,
      totalSupplierPayments,
      utilizationPercent: Math.round(utilizationPercent * 10) / 10,
      remaining,
      status,
    };
  }

  /**
   * Emit alert events for notification system.
   */
  private emitAlert(
    orderId: string,
    orderCode: string,
    level: 'WARNING' | 'CRITICAL',
    utilizationPercent: number,
  ): void {
    const eventName = level === 'CRITICAL' ? 'cash-flow.critical' : 'cash-flow.warning';
    this.eventEmitter.emit(eventName, {
      orderId,
      orderCode,
      utilizationPercent,
      level,
      timestamp: new Date(),
    });
  }
}
