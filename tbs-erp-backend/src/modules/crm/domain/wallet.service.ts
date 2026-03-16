import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { Prisma, Wallet, WalletTransaction } from '@prisma/client';

export type WalletTransactionType = 'TOPUP' | 'DEDUCT' | 'REFUND';

export interface WalletOperationResult {
  wallet: Wallet;
  transaction: WalletTransaction;
}

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lock wallet row with SELECT ... FOR UPDATE to prevent race conditions.
   * Must be called within a transaction.
   */
  private async lockWalletRow(
    tx: Prisma.TransactionClient,
    customerId: string,
  ): Promise<{ id: string; balance: number } | null> {
    const rows = await tx.$queryRaw<Array<{ id: string; balance: any }>>`
      SELECT id, balance FROM wallets WHERE customer_id = ${customerId} FOR UPDATE`;

    if (rows.length === 0) return null;
    return { id: rows[0].id, balance: Number(rows[0].balance) };
  }

  /**
   * Get or create a wallet for a customer.
   */
  async getOrCreateWallet(customerId: string): Promise<Wallet> {
    let wallet = await this.prisma.wallet.findUnique({
      where: { customerId },
    });

    if (!wallet) {
      wallet = await this.prisma.wallet.create({
        data: { customerId },
      });
      this.logger.log(`Created new wallet for customer ${customerId}`);
    }

    return wallet;
  }

  /**
   * Get current balance for a customer's wallet.
   */
  async getBalance(customerId: string): Promise<{
    balance: number;
    currency: string;
    walletId: string;
  }> {
    const wallet = await this.getOrCreateWallet(customerId);
    return {
      balance: wallet.balance.toNumber(),
      currency: wallet.currency,
      walletId: wallet.id,
    };
  }

  /**
   * Top up a customer's wallet.
   */
  async topup(
    customerId: string,
    amount: number,
    reference?: string,
    note?: string,
    bankTraceId?: string,
  ): Promise<WalletOperationResult> {
    if (amount <= 0) {
      throw new BadRequestException('Topup amount must be positive');
    }

    return this.prisma.executeInTransaction(async (tx) => {
      // Ensure wallet exists
      await tx.wallet.upsert({
        where: { customerId },
        create: { customerId },
        update: {},
      });

      // Lock wallet row to prevent concurrent operations from overwriting
      const locked = await this.lockWalletRow(tx, customerId);
      if (!locked) {
        throw new NotFoundException(`Wallet not found for customer ${customerId}`);
      }

      const updatedWallet = await tx.wallet.update({
        where: { id: locked.id },
        data: {
          balance: { increment: new Prisma.Decimal(amount) },
        },
      });

      const transaction = await tx.walletTransaction.create({
        data: {
          walletId: locked.id,
          amount: new Prisma.Decimal(amount),
          type: 'TOPUP',
          reference,
          note,
          bankTraceId: bankTraceId || null,
        },
      });

      this.logger.log(
        `Wallet topup: customer=${customerId}, amount=${amount}, balance=${updatedWallet.balance}, bankTraceId=${bankTraceId ?? 'N/A'}`,
      );

      return { wallet: updatedWallet, transaction };
    });
  }

  /**
   * Deduct from a customer's wallet. Validates sufficient balance.
   */
  async deduct(
    customerId: string,
    amount: number,
    reference?: string,
    note?: string,
  ): Promise<WalletOperationResult> {
    if (amount <= 0) {
      throw new BadRequestException('Deduct amount must be positive');
    }

    return this.prisma.executeInTransaction(async (tx) => {
      // FOR UPDATE lock to prevent concurrent deduction race condition
      const locked = await this.lockWalletRow(tx, customerId);

      if (!locked) {
        throw new NotFoundException(`Wallet not found for customer ${customerId}`);
      }

      if (locked.balance < amount) {
        throw new BadRequestException(
          `Insufficient wallet balance. Current balance: ${locked.balance}, requested: ${amount}`,
        );
      }

      const updatedWallet = await tx.wallet.update({
        where: { id: locked.id },
        data: {
          balance: { decrement: new Prisma.Decimal(amount) },
        },
      });

      const transaction = await tx.walletTransaction.create({
        data: {
          walletId: locked.id,
          amount: new Prisma.Decimal(-amount),
          type: 'DEDUCT',
          reference,
          note,
        },
      });

      this.logger.log(
        `Wallet deduct: customer=${customerId}, amount=${amount}, balance=${updatedWallet.balance}`,
      );

      return { wallet: updatedWallet, transaction };
    });
  }

  /**
   * Refund to a customer's wallet.
   */
  async refund(
    customerId: string,
    amount: number,
    reference?: string,
    note?: string,
  ): Promise<WalletOperationResult> {
    if (amount <= 0) {
      throw new BadRequestException('Refund amount must be positive');
    }

    return this.prisma.executeInTransaction(async (tx) => {
      // Lock wallet row to prevent concurrent operations from overwriting
      const locked = await this.lockWalletRow(tx, customerId);

      if (!locked) {
        throw new NotFoundException(`Wallet not found for customer ${customerId}`);
      }

      const updatedWallet = await tx.wallet.update({
        where: { id: locked.id },
        data: {
          balance: { increment: new Prisma.Decimal(amount) },
        },
      });

      const transaction = await tx.walletTransaction.create({
        data: {
          walletId: locked.id,
          amount: new Prisma.Decimal(amount),
          type: 'REFUND',
          reference,
          note,
        },
      });

      this.logger.log(
        `Wallet refund: customer=${customerId}, amount=${amount}, balance=${updatedWallet.balance}`,
      );

      return { wallet: updatedWallet, transaction };
    });
  }

  /**
   * Get wallet transaction history for a customer.
   */
  async getTransactions(
    customerId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<{ transactions: WalletTransaction[]; total: number }> {
    const wallet = await this.prisma.wallet.findUnique({
      where: { customerId },
    });

    if (!wallet) {
      return { transactions: [], total: 0 };
    }

    const [transactions, total] = await Promise.all([
      this.prisma.walletTransaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        take: options?.limit ?? 20,
        skip: options?.offset ?? 0,
      }),
      this.prisma.walletTransaction.count({
        where: { walletId: wallet.id },
      }),
    ]);

    return { transactions, total };
  }
}
