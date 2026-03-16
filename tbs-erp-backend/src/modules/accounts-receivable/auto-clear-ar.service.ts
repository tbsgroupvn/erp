import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@core/database/prisma.service';
import { ArStatus } from './dto/ar-query.dto';

export interface AutoClearRecord {
  arId: string;
  arCode: string;
  orderId: string | null;
  paymentAmount: number;
  isFullyPaid: boolean;
}

export interface AutoClearResult {
  customerId: string;
  totalCleared: number;
  clearedRecords: AutoClearRecord[];
  walletBalanceAfter: number;
}

@Injectable()
export class AutoClearArService {
  private readonly logger = new Logger(AutoClearArService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Auto-clear open/partial ARs using the customer's wallet balance.
   * Pays oldest due ARs first (dueDate ASC).
   * Uses FOR UPDATE lock on wallet to prevent race conditions.
   * Uses cent-based arithmetic to avoid floating-point precision issues.
   */
  async autoClear(
    customerId: string,
    triggerSource: string,
  ): Promise<AutoClearResult> {
    return this.prisma.executeInTransaction(async (tx) => {
      // 1. Lock wallet (FOR UPDATE) to prevent concurrent deductions
      const walletRows = await tx.$queryRaw<Array<{ id: string; balance: any }>>`
        SELECT id, balance FROM wallets WHERE customer_id = ${customerId} FOR UPDATE`;

      if (walletRows.length === 0) {
        this.logger.log(`No wallet found for customer ${customerId}, skipping auto-clear`);
        return { customerId, totalCleared: 0, clearedRecords: [], walletBalanceAfter: 0 };
      }

      let walletBalanceCents = Math.round(Number(walletRows[0].balance) * 100);
      const walletId = walletRows[0].id;

      // 2. If balance <= 0, nothing to clear
      if (walletBalanceCents <= 0) {
        this.logger.log(
          `Wallet balance is ${walletBalanceCents / 100} for customer ${customerId}, skipping auto-clear`,
        );
        return {
          customerId,
          totalCleared: 0,
          clearedRecords: [],
          walletBalanceAfter: walletBalanceCents / 100,
        };
      }

      // 3. Fetch open/partial ARs, oldest due first
      const openARs = await tx.accountReceivable.findMany({
        where: {
          customerId,
          status: { in: [ArStatus.OPEN, ArStatus.PARTIAL] },
        },
        orderBy: { dueDate: 'asc' },
      });

      if (openARs.length === 0) {
        this.logger.log(`No open/partial ARs for customer ${customerId}, skipping auto-clear`);
        return {
          customerId,
          totalCleared: 0,
          clearedRecords: [],
          walletBalanceAfter: walletBalanceCents / 100,
        };
      }

      // 4. Loop through ARs and pay from wallet
      const clearedRecords: AutoClearRecord[] = [];
      let totalClearedCents = 0;

      for (const ar of openARs) {
        if (walletBalanceCents <= 0) break;

        const amountCents = Math.round(Number(ar.amount) * 100);
        const paidCents = Math.round(Number(ar.paidAmount) * 100);
        const nettedCents = Math.round(Number(ar.nettedAmount) * 100);
        const outstandingCents = amountCents - paidCents - nettedCents;

        if (outstandingCents <= 0) continue;

        const paymentCents = Math.min(walletBalanceCents, outstandingCents);
        const paymentAmount = paymentCents / 100;

        const newPaidCents = paidCents + paymentCents;
        const totalSettledCents = newPaidCents + nettedCents;
        const isFullyPaid = totalSettledCents >= amountCents;

        // Update AR
        await tx.accountReceivable.update({
          where: { id: ar.id },
          data: {
            paidAmount: new Prisma.Decimal(newPaidCents / 100),
            status: isFullyPaid ? ArStatus.PAID : ArStatus.PARTIAL,
            note: ar.note
              ? `${ar.note}\n[Auto-clear] ${paymentAmount} VND - ${triggerSource}`
              : `[Auto-clear] ${paymentAmount} VND - ${triggerSource}`,
          },
        });

        // Create wallet deduction transaction
        await tx.walletTransaction.create({
          data: {
            walletId,
            amount: new Prisma.Decimal(-paymentAmount),
            type: 'DEDUCT',
            reference: ar.code,
            note: `Auto-clear AR ${ar.code} - ${triggerSource}`,
          },
        });

        walletBalanceCents -= paymentCents;
        totalClearedCents += paymentCents;

        clearedRecords.push({
          arId: ar.id,
          arCode: ar.code,
          orderId: ar.orderId,
          paymentAmount,
          isFullyPaid,
        });

        this.logger.log(
          `Auto-cleared AR ${ar.code}: ${paymentAmount} VND, ` +
            `status=${isFullyPaid ? 'PAID' : 'PARTIAL'}`,
        );
      }

      // 5. Update wallet balance using decrement (safe for concurrent operations)
      if (totalClearedCents > 0) {
        await tx.wallet.update({
          where: { id: walletId },
          data: {
            balance: { decrement: new Prisma.Decimal(totalClearedCents / 100) },
          },
        });
      }

      const result: AutoClearResult = {
        customerId,
        totalCleared: totalClearedCents / 100,
        clearedRecords,
        walletBalanceAfter: walletBalanceCents / 100,
      };

      this.logger.log(
        `Auto-clear completed for customer ${customerId}: ` +
          `cleared ${result.totalCleared} VND across ${clearedRecords.length} ARs, ` +
          `wallet remaining ${result.walletBalanceAfter} VND, trigger=${triggerSource}`,
      );

      return result;
    });
  }
}
