import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { NotificationService } from '../notification.service';

/**
 * Listens for Contract (Hop dong) related events:
 * - contract.created
 * - contract.statusChanged
 * - contract.createdFromQuotation
 */
@Injectable()
export class ContractEventsListener {
  private readonly logger = new Logger(ContractEventsListener.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly prisma: PrismaService,
  ) {}

  @OnEvent('contract.created')
  async handleContractCreated(event: {
    contractId: string;
    code: string;
    type: string;
    customerId: string;
    createdBy: string;
  }) {
    this.logger.log(`Contract created: ${event.code} (${event.type})`);

    try {
      // Notify CEO/COO about new contract
      const executives = await this.prisma.user.findMany({
        where: { role: { in: ['CEO', 'COO'] }, isActive: true },
        select: { id: true },
      });

      const customer = await this.prisma.customer.findUnique({
        where: { id: event.customerId },
        select: { fullName: true, companyName: true },
      });

      const customerLabel = customer?.companyName || customer?.fullName || event.customerId;

      for (const executive of executives) {
        if (executive.id === event.createdBy) continue;
        await this.notificationService.send({
          userId: executive.id,
          title: 'Hop dong moi',
          body: `Hop dong ${event.code} (${event.type}) cho khach hang "${customerLabel}" da duoc tao.`,
          type: 'CONTRACT',
          referenceId: event.contractId,
        });
      }
    } catch (error) {
      this.logger.error(
        `Failed to process contract.created for contract ${event.contractId}: ${error.message}`,
        error.stack,
      );
    }
  }

  @OnEvent('contract.statusChanged')
  async handleContractStatusChanged(event: {
    contractId: string;
    code: string;
    fromStatus: string;
    toStatus: string;
    changedBy: string;
  }) {
    this.logger.log(`Contract ${event.code} status: ${event.fromStatus} -> ${event.toStatus}`);

    try {
      // Notify the contract creator about status change
      const contract = await this.prisma.contract.findUnique({
        where: { id: event.contractId },
        select: { createdBy: true },
      });

      if (contract && contract.createdBy !== event.changedBy) {
        await this.notificationService.send({
          userId: contract.createdBy,
          title: 'Trang thai hop dong thay doi',
          body: `Hop dong ${event.code} da chuyen trang thai tu ${event.fromStatus} sang ${event.toStatus}.`,
          type: 'CONTRACT',
          referenceId: event.contractId,
          isUrgent: event.toStatus === 'CANCELLED' || event.toStatus === 'SUSPENDED',
        });
      }
    } catch (error) {
      this.logger.error(
        `Failed to process contract.statusChanged for contract ${event.contractId}: ${error.message}`,
        error.stack,
      );
    }
  }

  @OnEvent('contract.createdFromQuotation')
  async handleContractCreatedFromQuotation(event: {
    contractId: string;
    contractCode: string;
    quotationId: string;
    quotationCode: string;
    customerId: string;
    createdBy: string;
  }) {
    this.logger.log(
      `Contract appendix ${event.contractCode} auto-created from quotation ${event.quotationCode}`,
    );

    try {
      // Notify the quotation creator that a contract appendix was auto-created
      const quotation = await this.prisma.quotation.findUnique({
        where: { id: event.quotationId },
        select: { createdBy: true },
      });

      if (quotation) {
        await this.notificationService.send({
          userId: quotation.createdBy,
          title: 'Phu luc hop dong tu dong tao',
          body: `Phu luc hop dong ${event.contractCode} da duoc tu dong tao tu bao gia ${event.quotationCode}.`,
          type: 'CONTRACT',
          referenceId: event.contractId,
        });
      }
    } catch (error) {
      this.logger.error(
        `Failed to process contract.createdFromQuotation for contract ${event.contractId}: ${error.message}`,
        error.stack,
      );
    }
  }
}
