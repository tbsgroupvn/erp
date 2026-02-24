import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { NotificationService } from '../notification.service';

/**
 * Listens for Quotation (Bao gia) related events:
 * - quotation.created
 * - quotation.approved
 * - quotation.rejected
 * - quotation.converted
 * - quotation.expired
 */
@Injectable()
export class QuotationEventsListener {
  private readonly logger = new Logger(QuotationEventsListener.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly prisma: PrismaService,
  ) {}

  @OnEvent('quotation.created')
  async handleQuotationCreated(event: {
    quotationId: string;
    code: string;
    customerId: string;
    totalAmount: number;
    status: string;
    discountPercent: number;
    createdBy: string;
  }) {
    this.logger.log(`Quotation created: ${event.code}`);

    // Notify the customer's assigned sale person
    const customer = await this.prisma.customer.findUnique({
      where: { id: event.customerId },
      select: { saleId: true, fullName: true },
    });

    if (customer?.saleId && customer.saleId !== event.createdBy) {
      await this.notificationService.send({
        userId: customer.saleId,
        title: 'Bao gia moi',
        body: `Bao gia ${event.code} cho khach hang "${customer.fullName}" da duoc tao. Tong gia tri: ${event.totalAmount.toLocaleString()}.${event.discountPercent > 0 ? ` Chiet khau: ${event.discountPercent}% (cho duyet).` : ''}`,
        type: 'QUOTATION',
        referenceId: event.quotationId,
      });
    }
  }

  @OnEvent('quotation.approved')
  async handleQuotationApproved(event: {
    quotationId: string;
    code: string;
    approvedBy: string;
  }) {
    this.logger.log(`Quotation approved: ${event.code}`);

    // Notify the quotation creator
    const quotation = await this.prisma.quotation.findUnique({
      where: { id: event.quotationId },
      select: { createdBy: true },
    });

    if (quotation && quotation.createdBy !== event.approvedBy) {
      await this.notificationService.send({
        userId: quotation.createdBy,
        title: 'Bao gia da duyet',
        body: `Bao gia ${event.code} da duoc phe duyet. Ban co the chuyen doi thanh don hang.`,
        type: 'QUOTATION',
        referenceId: event.quotationId,
      });
    }
  }

  @OnEvent('quotation.rejected')
  async handleQuotationRejected(event: {
    quotationId: string;
    code: string;
    rejectedBy: string;
    reason: string;
  }) {
    this.logger.log(`Quotation rejected: ${event.code}`);

    // Notify the quotation creator
    const quotation = await this.prisma.quotation.findUnique({
      where: { id: event.quotationId },
      select: { createdBy: true },
    });

    if (quotation && quotation.createdBy !== event.rejectedBy) {
      await this.notificationService.send({
        userId: quotation.createdBy,
        title: 'Bao gia bi tu choi',
        body: `Bao gia ${event.code} da bi tu choi. Ly do: ${event.reason}.`,
        type: 'QUOTATION',
        referenceId: event.quotationId,
        isUrgent: true,
      });
    }
  }

  @OnEvent('quotation.converted')
  async handleQuotationConverted(event: {
    quotationId: string;
    quotationCode: string;
    orderId: string;
    orderCode: string;
    convertedBy: string;
  }) {
    this.logger.log(
      `Quotation ${event.quotationCode} converted to order ${event.orderCode}`,
    );

    // Notify the quotation creator
    const quotation = await this.prisma.quotation.findUnique({
      where: { id: event.quotationId },
      select: { createdBy: true },
    });

    if (quotation && quotation.createdBy !== event.convertedBy) {
      await this.notificationService.send({
        userId: quotation.createdBy,
        title: 'Bao gia da chuyen doi thanh don hang',
        body: `Bao gia ${event.quotationCode} da duoc chuyen doi thanh don hang ${event.orderCode}.`,
        type: 'QUOTATION',
        referenceId: event.quotationId,
      });
    }
  }

  @OnEvent('quotation.expired')
  async handleQuotationExpired(event: {
    count: number;
    expiredAt: Date;
  }) {
    this.logger.log(
      `${event.count} quotation(s) expired at ${event.expiredAt.toISOString()}`,
    );

    // Notify the creators of all expired quotations
    const expiredQuotations = await this.prisma.quotation.findMany({
      where: { status: 'EXPIRED' },
      select: { id: true, code: true, createdBy: true },
      orderBy: { updatedAt: 'desc' },
      take: event.count,
    });

    // Group by creator to avoid sending multiple notifications
    const byCreator = new Map<string, string[]>();
    for (const q of expiredQuotations) {
      const codes = byCreator.get(q.createdBy) ?? [];
      codes.push(q.code);
      byCreator.set(q.createdBy, codes);
    }

    for (const [creatorId, codes] of byCreator) {
      await this.notificationService.send({
        userId: creatorId,
        title: 'Bao gia het han',
        body: codes.length === 1
          ? `Bao gia ${codes[0]} da het han hieu luc.`
          : `${codes.length} bao gia da het han hieu luc: ${codes.join(', ')}.`,
        type: 'QUOTATION',
      });
    }
  }
}
