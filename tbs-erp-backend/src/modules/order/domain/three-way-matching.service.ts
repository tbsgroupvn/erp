import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';

export interface ThreeWayMatchResult {
  matched: boolean;
  orderId: string;
  orderCode: string;
  quantityOrdered: number;
  quantityReceived: number;
  quantityVariancePercent: number;
  totalQuotedCNY: number;
  totalPaidCNY: number;
  paymentVariancePercent: number;
  discrepancies: string[];
}

const TOLERANCE_PERCENT = 5;

@Injectable()
export class ThreeWayMatchingService {
  private readonly logger = new Logger(ThreeWayMatchingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 3-Way Matching: PO (SupplierOrder) ↔ GR (Packages) ↔ Invoice (PaymentVouchers)
   *
   * Compares:
   * - quantityOrdered (from SupplierOrders) vs quantityReceived (from Packages)
   * - totalQuoted (from SupplierOrders) vs totalPaid (from approved PaymentVouchers)
   *
   * Tolerance: 5%
   */
  async validateMatch(orderId: string): Promise<ThreeWayMatchResult> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, code: true },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    // 1. Total quantity ordered from SupplierOrders
    const supplierOrders = await this.prisma.supplierOrder.aggregate({
      where: { orderId, status: { notIn: ['CANCELLED', 'REFUNDED'] } },
      _sum: { quantityOrdered: true, quantityReceived: true, totalCNY: true },
    });

    const quantityOrdered = supplierOrders._sum.quantityOrdered ?? 0;
    const quantityReceived = supplierOrders._sum.quantityReceived ?? 0;
    const totalQuotedCNY = Number(supplierOrders._sum.totalCNY ?? 0);

    // 2. Total packages received at CN warehouse
    const packageCount = await this.prisma.package.count({
      where: { orderId, receivedCNAt: { not: null } },
    });

    // 3. Total paid from approved PaymentVouchers linked to supplier orders for this order
    const paidAgg = await this.prisma.paymentVoucher.aggregate({
      where: {
        supplierOrder: { orderId },
        type: 'PAYMENT',
        status: 'APPROVED',
      },
      _sum: { amount: true },
    });
    const totalPaidCNY = Number(paidAgg._sum.amount ?? 0);

    // 4. Calculate variances
    const discrepancies: string[] = [];

    const quantityVariancePercent =
      quantityOrdered > 0
        ? ((quantityReceived - quantityOrdered) / quantityOrdered) * 100
        : 0;

    if (quantityOrdered > 0 && quantityReceived > quantityOrdered * (1 + TOLERANCE_PERCENT / 100)) {
      discrepancies.push(
        `Số lượng nhận (${quantityReceived}) vượt quá đặt (${quantityOrdered}) hơn ${TOLERANCE_PERCENT}%`,
      );
    }

    const paymentVariancePercent =
      totalQuotedCNY > 0
        ? ((totalPaidCNY - totalQuotedCNY) / totalQuotedCNY) * 100
        : 0;

    if (totalQuotedCNY > 0 && totalPaidCNY > totalQuotedCNY * (1 + TOLERANCE_PERCENT / 100)) {
      discrepancies.push(
        `Tổng chi (${totalPaidCNY.toLocaleString()}) vượt quá báo giá (${totalQuotedCNY.toLocaleString()}) hơn ${TOLERANCE_PERCENT}%`,
      );
    }

    const matched = discrepancies.length === 0;

    this.logger.log(
      `3-way match for order ${order.code}: matched=${matched}, ` +
        `qty=${quantityReceived}/${quantityOrdered}, paid=${totalPaidCNY}/${totalQuotedCNY}`,
    );

    return {
      matched,
      orderId,
      orderCode: order.code,
      quantityOrdered,
      quantityReceived,
      quantityVariancePercent: Math.round(quantityVariancePercent * 100) / 100,
      totalQuotedCNY,
      totalPaidCNY,
      paymentVariancePercent: Math.round(paymentVariancePercent * 100) / 100,
      discrepancies,
    };
  }

  /**
   * Detailed matching report including per-supplier-order breakdown.
   */
  async getMatchingReport(orderId: string) {
    const summary = await this.validateMatch(orderId);

    // Get per-supplier-order breakdown
    const supplierOrders = await this.prisma.supplierOrder.findMany({
      where: { orderId, status: { notIn: ['CANCELLED', 'REFUNDED'] } },
      select: {
        id: true,
        code: true,
        supplierName: true,
        quantityOrdered: true,
        quantityReceived: true,
        totalCNY: true,
        status: true,
        paymentVouchers: {
          where: { type: 'PAYMENT', status: 'APPROVED' },
          select: { id: true, code: true, amount: true },
        },
      },
    });

    const breakdown = supplierOrders.map((so) => {
      const totalPaid = so.paymentVouchers.reduce(
        (sum, v) => sum + Number(v.amount),
        0,
      );
      const totalQuoted = Number(so.totalCNY ?? 0);

      return {
        supplierOrderId: so.id,
        supplierOrderCode: so.code,
        supplierName: so.supplierName,
        status: so.status,
        quantityOrdered: so.quantityOrdered,
        quantityReceived: so.quantityReceived,
        totalQuotedCNY: totalQuoted,
        totalPaidCNY: totalPaid,
        paymentOverrun: totalQuoted > 0 ? totalPaid > totalQuoted * (1 + TOLERANCE_PERCENT / 100) : false,
        vouchers: so.paymentVouchers.map((v) => ({
          id: v.id,
          code: v.code,
          amount: Number(v.amount),
        })),
      };
    });

    return {
      ...summary,
      breakdown,
    };
  }

  /**
   * Quick check if a new payment would exceed the supplier order quoted total.
   * Returns a flag warning (does not block).
   */
  async checkPaymentOverrun(
    supplierOrderId: string,
    newPaymentAmount: number,
  ): Promise<{ overrun: boolean; message?: string }> {
    const so = await this.prisma.supplierOrder.findUnique({
      where: { id: supplierOrderId },
      select: { id: true, code: true, totalCNY: true },
    });

    if (!so) return { overrun: false };

    const totalQuoted = Number(so.totalCNY ?? 0);
    if (totalQuoted <= 0) return { overrun: false };

    const existingPaid = await this.prisma.paymentVoucher.aggregate({
      where: {
        supplierOrderId,
        type: 'PAYMENT',
        status: 'APPROVED',
      },
      _sum: { amount: true },
    });

    const alreadyPaid = Number(existingPaid._sum.amount ?? 0);
    const projectedTotal = alreadyPaid + newPaymentAmount;

    if (projectedTotal > totalQuoted * (1 + TOLERANCE_PERCENT / 100)) {
      return {
        overrun: true,
        message:
          `Tổng chi dự kiến (${projectedTotal.toLocaleString()}) sẽ vượt quá báo giá NCC ` +
          `${so.code} (${totalQuoted.toLocaleString()}) hơn ${TOLERANCE_PERCENT}%`,
      };
    }

    return { overrun: false };
  }
}
