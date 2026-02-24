import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { Prisma, ApprovalStatus } from '@prisma/client';
import { CreateClaimDto } from './dto/create-claim.dto';

@Injectable()
export class UnallocatedFundsService {
  private readonly logger = new Logger(UnallocatedFundsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Lists wallet transactions where allocationType is 'UNALLOCATED'.
   * These are funds that have been received but not yet assigned to any order or contract.
   */
  async listUnallocatedTransactions() {
    const transactions = await this.prisma.walletTransaction.findMany({
      where: {
        allocationType: 'UNALLOCATED',
      },
      orderBy: { createdAt: 'desc' },
      include: {
        wallet: {
          select: {
            id: true,
            customerId: true,
          },
        },
      },
    });

    this.logger.log(`Found ${transactions.length} unallocated transactions`);

    return transactions;
  }

  /**
   * Creates a claim on an unallocated fund.
   * A sale representative claims that an unallocated wallet transaction
   * belongs to a specific customer and should be allocated to an order/contract.
   */
  async createClaim(dto: CreateClaimDto, userId: string) {
    // Verify the wallet transaction exists and is unallocated
    const transaction = await this.prisma.walletTransaction.findUnique({
      where: { id: dto.walletTransactionId },
    });

    if (!transaction) {
      throw new NotFoundException(
        `Wallet transaction ${dto.walletTransactionId} not found`,
      );
    }

    if (transaction.allocationType !== 'UNALLOCATED') {
      throw new BadRequestException(
        `Wallet transaction ${dto.walletTransactionId} is already allocated (type: ${transaction.allocationType})`,
      );
    }

    // Verify amount does not exceed transaction amount
    if (dto.amount > Number(transaction.amount)) {
      throw new BadRequestException(
        `Claimed amount (${dto.amount}) exceeds transaction amount (${transaction.amount})`,
      );
    }

    // Verify customer exists
    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
      select: { id: true, code: true, fullName: true },
    });

    if (!customer) {
      throw new NotFoundException(`Customer ${dto.customerId} not found`);
    }

    // Verify target order/contract if provided
    if (dto.targetOrderId) {
      const order = await this.prisma.order.findUnique({
        where: { id: dto.targetOrderId },
        select: { id: true, code: true },
      });
      if (!order) {
        throw new NotFoundException(`Order ${dto.targetOrderId} not found`);
      }
    }

    if (dto.targetContractId) {
      const contract = await this.prisma.contract.findUnique({
        where: { id: dto.targetContractId },
        select: { id: true, code: true },
      });
      if (!contract) {
        throw new NotFoundException(`Contract ${dto.targetContractId} not found`);
      }
    }

    const claim = await this.prisma.unallocatedFundClaim.create({
      data: {
        walletTransactionId: dto.walletTransactionId,
        customerId: dto.customerId,
        claimedBySaleId: userId,
        amount: new Prisma.Decimal(dto.amount),
        evidence: dto.evidence ?? [],
        targetOrderId: dto.targetOrderId,
        targetContractId: dto.targetContractId,
        status: ApprovalStatus.PENDING,
        note: dto.note,
      },
    });

    this.eventEmitter.emit('unallocated-funds.claim.created', {
      claimId: claim.id,
      walletTransactionId: dto.walletTransactionId,
      customerId: dto.customerId,
      amount: dto.amount,
      claimedBy: userId,
    });

    this.logger.log(
      `Unallocated fund claim created: ${claim.id}, transaction=${dto.walletTransactionId}, customer=${customer.code}, amount=${dto.amount}`,
    );

    return claim;
  }

  /**
   * Lists all unallocated fund claims, optionally filtered by status.
   */
  async listClaims(status?: string) {
    const where: any = {};

    if (status) {
      where.status = status as ApprovalStatus;
    }

    const claims = await this.prisma.unallocatedFundClaim.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return claims;
  }

  /**
   * Approves a claim and moves funds from the unallocated/intermediate account
   * to the target order or contract.
   *
   * Updates the wallet transaction allocationType from UNALLOCATED to ORDER or CONTRACT,
   * and marks the claim as APPROVED.
   */
  async approveClaim(claimId: string, userId: string) {
    const claim = await this.prisma.unallocatedFundClaim.findUnique({
      where: { id: claimId },
    });

    if (!claim) {
      throw new NotFoundException(`Claim ${claimId} not found`);
    }

    if (claim.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException(
        `Claim ${claimId} is already ${claim.status}. Only PENDING claims can be approved.`,
      );
    }

    // Determine allocation target
    const allocationType = claim.targetOrderId
      ? 'ORDER'
      : claim.targetContractId
        ? 'CONTRACT'
        : 'UNALLOCATED'; // Should not happen if validation is correct

    const allocationId = claim.targetOrderId ?? claim.targetContractId ?? null;

    // Execute in transaction: approve claim + update wallet transaction allocation
    const result = await this.prisma.$transaction(async (tx) => {
      // Update the claim status
      const updatedClaim = await tx.unallocatedFundClaim.update({
        where: { id: claimId },
        data: {
          status: ApprovalStatus.APPROVED,
          approvedBy: userId,
          approvedAt: new Date(),
        },
      });

      // Update the wallet transaction to reflect the allocation
      await tx.walletTransaction.update({
        where: { id: claim.walletTransactionId },
        data: {
          allocationType,
          allocationId,
        },
      });

      return updatedClaim;
    });

    this.eventEmitter.emit('unallocated-funds.claim.approved', {
      claimId,
      walletTransactionId: claim.walletTransactionId,
      customerId: claim.customerId,
      amount: Number(claim.amount),
      allocationType,
      allocationId,
      approvedBy: userId,
    });

    this.logger.log(
      `Unallocated fund claim approved: ${claimId}, allocated to ${allocationType}=${allocationId} by ${userId}`,
    );

    return result;
  }
}
