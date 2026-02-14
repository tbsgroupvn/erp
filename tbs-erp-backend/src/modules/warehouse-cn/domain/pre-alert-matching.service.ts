import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface PreAlertMatchResult {
  /** Whether a matching pre-alert was found */
  matched: boolean;
  /** The matched pre-alert ID (if found) */
  preAlertId?: string;
  /** The customer ID from the pre-alert */
  customerId?: string;
  /** The order ID from the pre-alert */
  orderId?: string;
  /** Whether a LostAndFound record was created instead */
  isLostAndFound: boolean;
  /** The LostAndFound ID (if created) */
  lostAndFoundId?: string;
}

/**
 * Pre-Alert Matching Service.
 *
 * When a package arrives at Warehouse CN, this service attempts to match
 * the tracking number against pre-alerts submitted by customers.
 *
 * Flow:
 *  1. Customer or sale creates a PreAlert with trackingNumber
 *  2. Package arrives at warehouse, agent scans tracking number
 *  3. This service searches for a matching PreAlert
 *  4. If found: auto-assign package to customer/order, update PreAlert status
 *  5. If not found: create a LostAndFound record for manual resolution
 */
@Injectable()
export class PreAlertMatchingService {
  private readonly logger = new Logger(PreAlertMatchingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Attempts to match a tracking number against existing pre-alerts.
   *
   * @param trackingNumber - The Chinese tracking number scanned at receiving
   * @param packageId - The ID of the newly created package record
   * @param receivedBy - The user ID of the warehouse agent
   */
  async matchTracking(
    trackingNumber: string,
    packageId: string,
    receivedBy: string,
  ): Promise<PreAlertMatchResult> {
    this.logger.log(`Attempting to match tracking number: ${trackingNumber}`);

    // Search for a matching pre-alert in WAITING status
    const preAlert = await this.prisma.preAlert.findFirst({
      where: {
        trackingNumber: {
          equals: trackingNumber,
          mode: 'insensitive',
        },
        status: 'WAITING',
      },
      select: {
        id: true,
        customerId: true,
        orderId: true,
        description: true,
      },
    });

    if (preAlert) {
      // Match found -- update pre-alert and assign package
      await this.prisma.preAlert.update({
        where: { id: preAlert.id },
        data: {
          status: 'RECEIVED',
          matchedPackageId: packageId,
        },
      });

      this.logger.log(
        `Pre-alert matched: tracking=${trackingNumber}, ` +
          `preAlert=${preAlert.id}, customer=${preAlert.customerId}, ` +
          `order=${preAlert.orderId ?? 'N/A'}`,
      );

      this.eventEmitter.emit('prealert.matched', {
        preAlertId: preAlert.id,
        packageId,
        customerId: preAlert.customerId,
        orderId: preAlert.orderId,
        trackingNumber,
      });

      return {
        matched: true,
        preAlertId: preAlert.id,
        customerId: preAlert.customerId,
        orderId: preAlert.orderId ?? undefined,
        isLostAndFound: false,
      };
    }

    // No match found -- create LostAndFound record
    this.logger.warn(
      `No pre-alert match for tracking number: ${trackingNumber}. Creating LostAndFound.`,
    );

    const lostAndFoundCode = await this.generateLostAndFoundCode();

    const lostAndFound = await this.prisma.lostAndFound.create({
      data: {
        code: lostAndFoundCode,
        trackingNumber,
        description: `Unmatched package received with tracking: ${trackingNumber}`,
        warehouse: 'CN',
        status: 'UNIDENTIFIED',
        receivedBy,
      },
    });

    this.eventEmitter.emit('warehouse.lostandfound.created', {
      lostAndFoundId: lostAndFound.id,
      code: lostAndFoundCode,
      trackingNumber,
      warehouse: 'CN',
    });

    return {
      matched: false,
      isLostAndFound: true,
      lostAndFoundId: lostAndFound.id,
    };
  }

  /**
   * Generates the next LostAndFound code: TBS-LAF-NNNNNN.
   */
  private async generateLostAndFoundCode(): Promise<string> {
    const latest = await this.prisma.lostAndFound.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { code: true },
    });

    let sequence = 1;
    if (latest) {
      const match = latest.code.match(/TBS-LAF-(\d+)/);
      if (match) {
        sequence = parseInt(match[1], 10) + 1;
      }
    }

    return `TBS-LAF-${String(sequence).padStart(6, '0')}`;
  }
}
