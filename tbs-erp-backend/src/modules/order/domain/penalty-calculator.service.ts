import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '@core/database/prisma.service';
import { WalletService } from '@modules/crm/domain/wallet.service';

export interface PenaltyCalculation {
  penaltyPercent: number;
  penaltyAmount: number;
  reverseShippingPercent: number;
  reverseShippingAmount: number;
  totalPenalty: number;
}

export interface PenaltyPreview extends PenaltyCalculation {
  orderId: string;
  orderCode: string;
  orderTotalAmount: number;
  depositPaid: number;
  deductFromDeposit: number;
  deductFromWallet: number;
  writeToAR: number;
  refundToCustomer: number;
  walletBalance: number;
}

@Injectable()
export class PenaltyCalculatorService {
  private readonly logger = new Logger(PenaltyCalculatorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
  ) {}

  async getConfig(stage: OrderStatus) {
    const config = await this.prisma.cancelPenaltyConfig.findUnique({
      where: { stage },
    });

    if (!config || !config.isActive) {
      return null;
    }

    return config;
  }

  calculatePenalty(
    totalAmount: number,
    penaltyPercent: number,
    reverseShippingPercent: number,
  ): PenaltyCalculation {
    const penaltyAmount = Math.ceil((totalAmount * penaltyPercent) / 100);
    const reverseShippingAmount = Math.ceil((totalAmount * reverseShippingPercent) / 100);
    const totalPenalty = penaltyAmount + reverseShippingAmount;

    return {
      penaltyPercent,
      penaltyAmount,
      reverseShippingPercent,
      reverseShippingAmount,
      totalPenalty,
    };
  }

  async previewPenalty(orderId: string): Promise<PenaltyPreview> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        code: true,
        status: true,
        totalAmount: true,
        depositPaid: true,
        customerId: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    const config = await this.getConfig(order.status);
    if (!config) {
      throw new NotFoundException(
        `No penalty config for stage ${order.status}`,
      );
    }

    const totalAmount = Number(order.totalAmount);
    const depositPaid = Number(order.depositPaid);

    const penalty = this.calculatePenalty(
      totalAmount,
      Number(config.penaltyPercent),
      Number(config.reverseShippingPercent),
    );

    // Get wallet balance
    const wallet = await this.prisma.wallet.findUnique({
      where: { customerId: order.customerId },
      select: { balance: true },
    });
    const walletBalance = wallet ? Number(wallet.balance) : 0;

    // Calculate cascade deduction
    const deductFromDeposit = Math.min(depositPaid, penalty.totalPenalty);
    let remaining = penalty.totalPenalty - deductFromDeposit;
    const deductFromWallet = Math.min(walletBalance, remaining);
    remaining -= deductFromWallet;
    const writeToAR = remaining;
    const refundToCustomer = Math.max(0, depositPaid - penalty.totalPenalty);

    return {
      orderId: order.id,
      orderCode: order.code,
      orderTotalAmount: totalAmount,
      depositPaid,
      ...penalty,
      deductFromDeposit,
      deductFromWallet,
      writeToAR,
      refundToCustomer,
      walletBalance,
    };
  }
}
