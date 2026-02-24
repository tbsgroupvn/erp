import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '@core/database/prisma.service';
import { CommissionService } from '@modules/commission/commission.service';

export interface ComplaintResolvedEvent {
  complaintId: string;
  code: string;
  resolutionType: string;
  compensationAmount: number;
}

/**
 * Listens for complaint.resolved events and triggers commission clawback
 * when the resolution involves a REFUND or CREDIT.
 */
@Injectable()
export class ComplaintResolvedListener {
  private readonly logger = new Logger(ComplaintResolvedListener.name);

  constructor(
    private readonly commissionService: CommissionService,
    private readonly prisma: PrismaService,
  ) {}

  @OnEvent('complaint.resolved')
  async handleComplaintResolved(event: ComplaintResolvedEvent) {
    if (!['REFUND', 'CREDIT'].includes(event.resolutionType)) {
      return;
    }

    // Fetch the complaint to get the orderId (not included in the event payload)
    const complaint = await this.prisma.complaint.findUnique({
      where: { id: event.complaintId },
      select: { orderId: true },
    });

    if (!complaint?.orderId) {
      this.logger.warn(
        `Complaint ${event.complaintId} has no orderId — skipping commission clawback`,
      );
      return;
    }

    try {
      await this.commissionService.clawbackCommission(
        complaint.orderId,
        event.complaintId,
        `Clawback due to complaint resolution: ${event.resolutionType}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to clawback commission for complaint ${event.complaintId}: ${error.message}`,
        error.stack,
      );
    }
  }
}
