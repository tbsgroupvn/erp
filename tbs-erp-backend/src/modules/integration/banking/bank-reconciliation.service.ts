import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { AccountStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { ManualMatchDto } from './dto/manual-match.dto';

// Trang thai webhook transaction
const STATUS_PENDING = 'PENDING';
const STATUS_AUTO_CREDITED = 'AUTO_CREDITED';
const STATUS_MANUAL_MATCHED = 'MANUAL_MATCHED';
const STATUS_FAILED = 'FAILED';

export interface ReconciliationSummary {
  // Tong quan giao dich
  totalTransactions: number;
  pendingCount: number;       // Chua doi chieu (can xu ly thu cong)
  autoCreditedCount: number;  // Da tu dong nap vi thanh cong
  manualMatchedCount: number; // Da khop thu cong boi ke toan
  failedCount: number;        // Loi (parse sai, KH khong ton tai...)

  // Tong tien theo trang thai
  totalAmountPending: number;
  totalAmountProcessed: number;  // = autoCredited + manualMatched

  // 20 giao dich moi nhat chua match (PENDING + FAILED)
  unmatchedTransactions: Array<{
    id: string;
    bankTraceId: string;
    provider: string;
    amount: number;
    description: string;
    parsedCustomerCode: string | null;
    bankCode: string | null;
    accountNumber: string | null;
    transactionDate: Date;
    errorMessage: string | null;
    status: string;
    createdAt: Date;
  }>;

  generatedAt: Date;
}

export interface ManualMatchResult {
  transactionId: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  amountMatched: number;
  arLinked: string | null;
  walletCredited: boolean;
  status: 'MANUAL_MATCHED';
}

/**
 * Service xu ly doi chieu ngan hang (bank reconciliation dashboard).
 *
 * Chuc nang:
 * 1. Summary: thong ke tong giao dich theo trang thai, list 20 GD chua match
 * 2. Manual match: ke toan tu doi chieu thu cong GD chua parse duoc
 */
@Injectable()
export class BankReconciliationService {
  private readonly logger = new Logger(BankReconciliationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lay dashboard summary doi chieu ngan hang.
   *
   * Bao gom:
   * - Tong quan theo trang thai (pending / auto_credited / manual_matched / failed)
   * - Tong tien da xu ly va chua xu ly
   * - 20 giao dich moi nhat chua match (PENDING + FAILED) de ke toan xu ly
   */
  async getSummary(): Promise<ReconciliationSummary> {
    this.logger.log('Lay bank reconciliation summary');

    // Dem theo trang thai
    const counts = await this.prisma.bankWebhookTransaction.groupBy({
      by: ['status'],
      _count: { id: true },
      _sum: { amount: true },
    });

    const countMap: Record<string, { count: number; amount: number }> = {};
    for (const row of counts) {
      countMap[row.status] = {
        count: row._count.id,
        amount: Number(row._sum.amount ?? 0),
      };
    }

    const pendingCount = countMap[STATUS_PENDING]?.count ?? 0;
    const autoCreditedCount = countMap[STATUS_AUTO_CREDITED]?.count ?? 0;
    const manualMatchedCount = countMap[STATUS_MANUAL_MATCHED]?.count ?? 0;
    const failedCount = countMap[STATUS_FAILED]?.count ?? 0;

    const totalTransactions = pendingCount + autoCreditedCount + manualMatchedCount + failedCount;
    const totalAmountPending = countMap[STATUS_PENDING]?.amount ?? 0;
    const totalAmountProcessed =
      (countMap[STATUS_AUTO_CREDITED]?.amount ?? 0) +
      (countMap[STATUS_MANUAL_MATCHED]?.amount ?? 0);

    // Lay 20 giao dich chua match (PENDING + FAILED) moi nhat
    const unmatchedRaw = await this.prisma.bankWebhookTransaction.findMany({
      where: {
        status: { in: [STATUS_PENDING, STATUS_FAILED] },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        bankTraceId: true,
        provider: true,
        amount: true,
        description: true,
        parsedCustomerCode: true,
        bankCode: true,
        accountNumber: true,
        transactionDate: true,
        errorMessage: true,
        status: true,
        createdAt: true,
      },
    });

    const unmatchedTransactions = unmatchedRaw.map((t) => ({
      ...t,
      amount: Number(t.amount),
    }));

    return {
      totalTransactions,
      pendingCount,
      autoCreditedCount,
      manualMatchedCount,
      failedCount,
      totalAmountPending,
      totalAmountProcessed,
      unmatchedTransactions,
      generatedAt: new Date(),
    };
  }

  /**
   * Doi chieu thu cong: ke toan chon giao dich va map vao khach hang + cong no.
   *
   * Flow:
   * 1. Kiem tra transaction ton tai va chua duoc xu ly thanh cong
   * 2. Kiem tra customer ton tai
   * 3. Neu co arId: kiem tra AR va cap nhat trang thai (paidAmount)
   * 4. Ghi nhan transaction -> MANUAL_MATCHED
   * 5. Nap vi khach hang (tuy chon: neu khong co arId)
   */
  async manualMatch(dto: ManualMatchDto, operatorId: string): Promise<ManualMatchResult> {
    this.logger.log(
      `Manual match: transactionId=${dto.transactionId} customerId=${dto.customerId} amount=${dto.amount}`,
    );

    return this.prisma.$transaction(async (tx) => {
      // 1. Kiem tra transaction
      const bwt = await tx.bankWebhookTransaction.findUnique({
        where: { id: dto.transactionId },
      });
      if (!bwt) {
        throw new NotFoundException(`Giao dich ${dto.transactionId} khong tim thay`);
      }
      if ([STATUS_AUTO_CREDITED, STATUS_MANUAL_MATCHED].includes(bwt.status)) {
        throw new ConflictException(
          `Giao dich ${bwt.bankTraceId} da duoc xu ly (status=${bwt.status}). Khong the match lai.`,
        );
      }

      const txAmount = Number(bwt.amount);
      if (dto.amount <= 0 || dto.amount > txAmount) {
        throw new BadRequestException(
          `So tien match (${dto.amount}) phai > 0 va <= so tien giao dich (${txAmount})`,
        );
      }

      // 2. Kiem tra customer
      const customer = await tx.customer.findUnique({
        where: { id: dto.customerId },
        select: { id: true, code: true, fullName: true },
      });
      if (!customer) {
        throw new NotFoundException(`Khach hang ${dto.customerId} khong tim thay`);
      }

      // 3. Neu co arId: lien ket voi cong no phai thu
      let arLinked: string | null = null;
      if (dto.arId) {
        const ar = await tx.accountReceivable.findUnique({
          where: { id: dto.arId },
          select: { id: true, customerId: true, amount: true, paidAmount: true, nettedAmount: true, status: true },
        });
        if (!ar) {
          throw new NotFoundException(`Cong no ${dto.arId} khong tim thay`);
        }
        if (ar.customerId !== dto.customerId) {
          throw new BadRequestException('Cong no khong thuoc khach hang nay');
        }
        if (ar.status === AccountStatus.PAID) {
          throw new ConflictException('Cong no nay da duoc thanh toan day du');
        }

        // Tinh remaining = amount - paidAmount - nettedAmount
        const remaining = Number(ar.amount) - Number(ar.paidAmount) - Number(ar.nettedAmount);
        if (dto.amount > remaining) {
          throw new BadRequestException(
            `So tien match (${dto.amount}) vuot qua so con lai cua cong no (${remaining})`,
          );
        }

        // Cap nhat paidAmount cua AR
        const newPaidTotal = Number(ar.paidAmount) + dto.amount;
        const newRemaining = Number(ar.amount) - newPaidTotal - Number(ar.nettedAmount);
        await tx.accountReceivable.update({
          where: { id: dto.arId },
          data: {
            paidAmount: { increment: new Decimal(dto.amount) },
            status: newRemaining <= 0 ? AccountStatus.PAID : AccountStatus.PARTIAL,
          },
        });
        arLinked = dto.arId;
        this.logger.log(`AR ${dto.arId} cap nhat: paid +${dto.amount}, remaining ${newRemaining}`);
      }

      // 4. Ghi nhan transaction -> MANUAL_MATCHED
      await tx.bankWebhookTransaction.update({
        where: { id: dto.transactionId },
        data: {
          status: STATUS_MANUAL_MATCHED,
          matchedCustomerId: dto.customerId,
          processedAt: new Date(),
          // Luu ghi chu vao errorMessage (re-use field de khong can alter schema)
          errorMessage: dto.note ? `[MANUAL_MATCH] ${dto.note}` : '[MANUAL_MATCH by accountant]',
        },
      });

      // 5. Ghi nop vi khach hang (neu khong co arId -> nap vi de KH tra sau)
      let walletCredited = false;
      if (!dto.arId) {
        const wallet = await tx.wallet.findUnique({ where: { customerId: dto.customerId } });
        if (wallet) {
          await tx.wallet.update({
            where: { customerId: dto.customerId },
            data: {
              balance: { increment: new Decimal(dto.amount) },
            },
          });
          await tx.walletTransaction.create({
            data: {
              walletId: wallet.id,
              type: 'TOPUP',
              amount: new Decimal(dto.amount),
              reference: `MANUAL-MATCH:${bwt.bankTraceId}`,
              note: `Doi chieu thu cong boi ke toan. ${dto.note ?? ''}`.trim(),
            },
          });
          walletCredited = true;
          this.logger.log(
            `Vi khach hang ${customer.code} nap +${dto.amount} (manual match)`,
          );
        }
      }

      this.logger.log(
        `Manual match hoan tat: transactionId=${dto.transactionId} customer=${customer.code} ` +
        `amount=${dto.amount} arLinked=${arLinked ?? 'none'} wallet=${walletCredited}`,
      );

      return {
        transactionId: dto.transactionId,
        customerId: dto.customerId,
        customerCode: customer.code,
        customerName: customer.fullName,
        amountMatched: dto.amount,
        arLinked,
        walletCredited,
        status: 'MANUAL_MATCHED',
      };
    });
  }
}
