import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DebtNettingItemType } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { CreateNettingRequestDto } from './dto/create-netting-request.dto';
import { NettingQueryDto } from './dto/netting-query.dto';

@Injectable()
export class DebtNettingService {
  private readonly logger = new Logger(DebtNettingService.name);
  private readonly DEBT_NETTING_MIN: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
  ) {
    this.DEBT_NETTING_MIN = this.configService.get<number>(
      'business.debtNetting.minAmount',
      100000,
    );
  }

  /**
   * Finds counterparties with both AR and AP balances (netting opportunities).
   */
  async findNettingOpportunities() {
    // Find customers/vendors that appear in both AR and AP
    const arByPartner = await this.prisma.accountReceivable.groupBy({
      by: ['customerId'],
      _sum: { amount: true, paidAmount: true, nettedAmount: true },
      where: { status: { in: ['OPEN', 'PARTIAL'] } },
    });

    const apByVendor = await this.prisma.accountPayable.groupBy({
      by: ['vendorId'],
      _sum: { amount: true, paidAmount: true, nettedAmount: true },
      where: { status: { in: ['OPEN', 'PARTIAL'] } },
    });

    // Build opportunities: pairs that share a common counterparty relationship
    const opportunities = [];

    for (const ar of arByPartner) {
      const arBalance = parseFloat(
        (
          Number(ar._sum.amount ?? 0) -
          Number(ar._sum.paidAmount ?? 0) -
          Number(ar._sum.nettedAmount ?? 0)
        ).toFixed(2),
      );

      if (arBalance <= 0) continue;

      // Find matching AP for same entity (customerId might match vendorId logic)
      for (const ap of apByVendor) {
        if (!ap.vendorId) continue;

        const apBalance = parseFloat(
          (
            Number(ap._sum.amount ?? 0) -
            Number(ap._sum.paidAmount ?? 0) -
            Number(ap._sum.nettedAmount ?? 0)
          ).toFixed(2),
        );

        if (apBalance <= 0) continue;

        opportunities.push({
          counterpartyId: ar.customerId,
          vendorId: ap.vendorId,
          arBalance,
          apBalance,
          nettableAmount: Math.min(arBalance, apBalance),
        });
      }
    }

    return opportunities;
  }

  /**
   * Creates a netting request (voucher).
   * Validates that netting amount <= min(totalAR, totalAP) for the counterparty.
   */
  async createNettingRequest(dto: CreateNettingRequestDto, userId: string) {
    // Validate AR records exist and sum up
    const arRecords = await this.prisma.accountReceivable.findMany({
      where: { id: { in: dto.arIds }, status: { in: ['OPEN', 'PARTIAL'] } },
    });

    if (arRecords.length !== dto.arIds.length) {
      throw new BadRequestException('Some AR records not found or not in OPEN/PARTIAL status.');
    }

    const totalAR = parseFloat(
      arRecords
        .reduce(
          (sum, ar) => sum + Number(ar.amount) - Number(ar.paidAmount) - Number(ar.nettedAmount),
          0,
        )
        .toFixed(2),
    );

    // Validate AP records exist and sum up
    const apRecords = await this.prisma.accountPayable.findMany({
      where: { id: { in: dto.apIds }, status: { in: ['OPEN', 'PARTIAL'] } },
    });

    if (apRecords.length !== dto.apIds.length) {
      throw new BadRequestException('Some AP records not found or not in OPEN/PARTIAL status.');
    }

    const totalAP = parseFloat(
      apRecords
        .reduce(
          (sum, ap) => sum + Number(ap.amount) - Number(ap.paidAmount) - Number(ap.nettedAmount),
          0,
        )
        .toFixed(2),
    );

    // Validate netting amount
    const maxNetting = Math.min(totalAR, totalAP);
    if (dto.nettingAmount > maxNetting) {
      throw new BadRequestException(
        `Netting amount (${dto.nettingAmount}) exceeds maximum nettable amount (${maxNetting}). AR balance: ${totalAR}, AP balance: ${totalAP}`,
      );
    }

    // KT-2: Enforce configurable minimum threshold for debt netting
    if (dto.nettingAmount < this.DEBT_NETTING_MIN) {
      throw new BadRequestException(
        `Số tiền bù trừ (${dto.nettingAmount}) thấp hơn ngưỡng tối thiểu (${this.DEBT_NETTING_MIN}). Vui lòng điều chỉnh số tiền.`,
      );
    }

    // Generate code
    const code = await this.generateCode();

    const netting = await this.prisma.debtNetting.create({
      data: {
        code,
        partnerId: dto.counterpartyId,
        partnerName: dto.counterpartyName,
        arAmount: totalAR,
        apAmount: totalAP,
        netAmount: dto.nettingAmount,
        status: 'PENDING',
        note: dto.notes,
        createdBy: userId,
      },
    });

    // Create netting items to track which AR/AP records are included
    const nettingItems = [
      ...dto.arIds.map((id) => ({
        nettingId: netting.id,
        type: 'AR' as DebtNettingItemType,
        referenceId: id,
        amount: 0, // Will be allocated during execution
      })),
      ...dto.apIds.map((id) => ({
        nettingId: netting.id,
        type: 'AP' as DebtNettingItemType,
        referenceId: id,
        amount: 0,
      })),
    ];

    await this.prisma.debtNettingItem.createMany({ data: nettingItems });

    this.logger.log(`Netting request ${code} created by ${userId}: ${dto.nettingAmount}`);

    return netting;
  }

  /**
   * Approves a netting request (CFO/Chief Accountant).
   */
  async approveNetting(id: string, userId: string) {
    const netting = await this.prisma.debtNetting.findUnique({
      where: { id },
    });

    if (!netting) {
      throw new NotFoundException(`Netting request ${id} not found.`);
    }

    if (netting.status !== 'PENDING') {
      throw new BadRequestException(
        `Cannot approve netting in status ${netting.status}. Must be PENDING.`,
      );
    }

    const updated = await this.prisma.debtNetting.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy: userId,
        approvedAt: new Date(),
      },
    });

    this.logger.log(`Netting ${netting.code} approved by ${userId}`);

    return updated;
  }

  /**
   * Executes an approved netting.
   * Updates AR/AP records with netted amounts and creates journal entries.
   */
  async executeNetting(id: string, userId: string) {
    const netting = await this.prisma.debtNetting.findUnique({
      where: { id },
    });

    if (!netting) {
      throw new NotFoundException(`Netting request ${id} not found.`);
    }

    if (netting.status !== 'APPROVED') {
      throw new BadRequestException(
        `Cannot execute netting in status ${netting.status}. Must be APPROVED.`,
      );
    }

    if (netting.executedAt) {
      throw new BadRequestException('Already executed');
    }

    const nettingItems = await this.prisma.debtNettingItem.findMany({
      where: { nettingId: id },
    });

    await this.prisma.executeInTransaction(async (tx) => {
      // Use integer-based arithmetic (cents) to avoid floating-point precision issues
      const netAmountCents = Math.round(Number(netting.netAmount) * 100);
      let remainingCents = netAmountCents;

      // Update AR records
      const arItems = nettingItems.filter((item) => item.type === 'AR');
      for (const item of arItems) {
        if (remainingCents <= 0) break;

        const ar = await tx.accountReceivable.findUnique({
          where: { id: item.referenceId },
        });

        if (!ar) continue;

        const arBalanceCents =
          Math.round(Number(ar.amount) * 100) -
          Math.round(Number(ar.paidAmount) * 100) -
          Math.round(Number(ar.nettedAmount) * 100);
        const nettedHereCents = Math.min(remainingCents, arBalanceCents);
        const nettedHere = nettedHereCents / 100;

        const totalSettledCents =
          Math.round(Number(ar.paidAmount) * 100) +
          Math.round(Number(ar.nettedAmount) * 100) +
          nettedHereCents;
        const amountCents = Math.round(Number(ar.amount) * 100);

        await tx.accountReceivable.update({
          where: { id: item.referenceId },
          data: {
            nettedAmount: { increment: nettedHere },
            status: totalSettledCents >= amountCents ? 'NETTED' : 'PARTIAL',
          },
        });

        await tx.debtNettingItem.update({
          where: { id: item.id },
          data: { amount: nettedHere },
        });

        remainingCents -= nettedHereCents;
      }

      // Update AP records
      remainingCents = netAmountCents;
      const apItems = nettingItems.filter((item) => item.type === 'AP');
      for (const item of apItems) {
        if (remainingCents <= 0) break;

        const ap = await tx.accountPayable.findUnique({
          where: { id: item.referenceId },
        });

        if (!ap) continue;

        const apBalanceCents =
          Math.round(Number(ap.amount) * 100) -
          Math.round(Number(ap.paidAmount) * 100) -
          Math.round(Number(ap.nettedAmount) * 100);
        const nettedHereCents = Math.min(remainingCents, apBalanceCents);
        const nettedHere = nettedHereCents / 100;

        const totalSettledCents =
          Math.round(Number(ap.paidAmount) * 100) +
          Math.round(Number(ap.nettedAmount) * 100) +
          nettedHereCents;
        const amountCents = Math.round(Number(ap.amount) * 100);

        await tx.accountPayable.update({
          where: { id: item.referenceId },
          data: {
            nettedAmount: { increment: nettedHere },
            status: totalSettledCents >= amountCents ? 'NETTED' : 'PARTIAL',
          },
        });

        await tx.debtNettingItem.update({
          where: { id: item.id },
          data: { amount: nettedHere },
        });

        remainingCents -= nettedHereCents;
      }

      // Update netting with execution timestamp
      await tx.debtNetting.update({
        where: { id },
        data: { executedAt: new Date(), executedBy: userId },
      });
    });

    this.eventEmitter.emit('debt.netting.executed', {
      nettingId: id,
      code: netting.code,
      partnerId: netting.partnerId,
      netAmount: Number(netting.netAmount),
      executedBy: userId,
    });

    this.logger.log(`Netting ${netting.code} executed by ${userId}`);

    return { message: 'Netting executed successfully', code: netting.code };
  }

  /**
   * Lists netting requests with pagination.
   */
  async findAll(query: NettingQueryDto) {
    const where: any = {};

    if (query.status) where.status = query.status;

    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { partnerName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.debtNetting.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: query.orderBy,
      }),
      this.prisma.debtNetting.count({ where }),
    ]);

    return { data, total, page: query.page, limit: query.limit };
  }

  /**
   * Gets netting history for a specific counterparty.
   */
  async getNettingHistory(counterpartyId: string) {
    return this.prisma.debtNetting.findMany({
      where: { partnerId: counterpartyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Generates netting code in the format NET-YYYYMM-XXXX.
   */
  private async generateCode(): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `NET-${yearMonth}`;

    const latest = await this.prisma.debtNetting.findFirst({
      where: { code: { startsWith: prefix } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });

    let sequence = 1;
    if (latest) {
      const lastSeq = parseInt(latest.code.split('-').pop() || '0', 10);
      sequence = lastSeq + 1;
    }

    return `${prefix}-${String(sequence).padStart(4, '0')}`;
  }
}
