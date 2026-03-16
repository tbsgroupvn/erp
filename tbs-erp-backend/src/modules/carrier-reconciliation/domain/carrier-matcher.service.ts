import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { CarrierReconItemStatus } from '@prisma/client';

// Carrier status keywords indicating delivered
const DELIVERED_KEYWORDS = ['da giao', 'giao thanh cong', 'delivered', 'thanh cong'];
// Carrier status keywords indicating returned
const RETURNED_KEYWORDS = ['hoan hang', 'tra hang', 'returned', 'hoan', 'khong giao duoc'];

export interface MatchResult {
  matchStatus: CarrierReconItemStatus;
  matchedDeliveryId: string | null;
  matchedOrderId: string | null;
  matchedOrderCode: string | null;
  matchedCustomerId: string | null;
  erpDeliveryStatus: string | null;
  erpCodAmount: number | null;
  codVariance: number | null;
  exceptionReason: string | null;
}

@Injectable()
export class CarrierMatcherService {
  private readonly logger = new Logger(CarrierMatcherService.name);

  /** Tolerance for COD amount comparison (VND) */
  private readonly COD_TOLERANCE = 1000;

  constructor(private readonly prisma: PrismaService) {}

  async match(
    carrierTrackingNumber: string,
    carrierCodAmount: number,
    carrierStatus: string | null,
  ): Promise<MatchResult> {
    // 1. Find delivery by carrierTrackingNumber (exact match)
    let delivery = await this.prisma.delivery.findFirst({
      where: { carrierTrackingNumber },
      select: {
        id: true,
        code: true,
        status: true,
        codAmount: true,
        orderId: true,
        order: {
          select: {
            id: true,
            code: true,
            customerId: true,
          },
        },
      },
    });

    // 2. Fallback: match by delivery code
    if (!delivery) {
      delivery = await this.prisma.delivery.findFirst({
        where: { code: carrierTrackingNumber },
        select: {
          id: true,
          code: true,
          status: true,
          codAmount: true,
          orderId: true,
          order: {
            select: {
              id: true,
              code: true,
              customerId: true,
            },
          },
        },
      });
    }

    // 3. Unmatched
    if (!delivery) {
      return {
        matchStatus: CarrierReconItemStatus.UNMATCHED,
        matchedDeliveryId: null,
        matchedOrderId: null,
        matchedOrderCode: null,
        matchedCustomerId: null,
        erpDeliveryStatus: null,
        erpCodAmount: null,
        codVariance: null,
        exceptionReason: `Ma van don "${carrierTrackingNumber}" khong tim thay trong ERP`,
      };
    }

    const erpCodAmount = Number(delivery.codAmount);
    const codVariance = carrierCodAmount - erpCodAmount;
    const isCarrierDelivered = this.isStatusDelivered(carrierStatus);
    const isCarrierReturned = this.isStatusReturned(carrierStatus);
    const erpDeliveryStatus = delivery.status;

    const baseResult = {
      matchedDeliveryId: delivery.id,
      matchedOrderId: delivery.order.id,
      matchedOrderCode: delivery.order.code,
      matchedCustomerId: delivery.order.customerId,
      erpDeliveryStatus,
      erpCodAmount,
      codVariance,
    };

    // 4. Carrier returned + ERP returned/RTO -> SKIPPED (no COD to process)
    if (isCarrierReturned && ['RETURN_TO_ORIGIN', 'RTO_RECEIVED'].includes(erpDeliveryStatus)) {
      return {
        ...baseResult,
        matchStatus: CarrierReconItemStatus.SKIPPED,
        exceptionReason: null,
      };
    }

    // 5. Carrier returned but ERP shows delivered -> STATUS_MISMATCH
    if (isCarrierReturned && erpDeliveryStatus === 'DELIVERED') {
      return {
        ...baseResult,
        matchStatus: CarrierReconItemStatus.STATUS_MISMATCH,
        exceptionReason: `Carrier bao hoan hang nhung ERP da giao (${erpDeliveryStatus})`,
      };
    }

    // 6. Carrier delivered but ERP not delivered -> STATUS_MISMATCH
    if (isCarrierDelivered && erpDeliveryStatus !== 'DELIVERED') {
      return {
        ...baseResult,
        matchStatus: CarrierReconItemStatus.STATUS_MISMATCH,
        exceptionReason: `Carrier bao da giao nhung ERP trang thai ${erpDeliveryStatus}`,
      };
    }

    // 7. COD amount mismatch (beyond tolerance)
    if (Math.abs(codVariance) > this.COD_TOLERANCE) {
      return {
        ...baseResult,
        matchStatus: CarrierReconItemStatus.AMOUNT_MISMATCH,
        exceptionReason:
          `COD lech: Carrier ${carrierCodAmount.toLocaleString()} vs ERP ${erpCodAmount.toLocaleString()} ` +
          `(lech ${codVariance.toLocaleString()} VND)`,
      };
    }

    // 8. All good -> MATCHED
    return {
      ...baseResult,
      matchStatus: CarrierReconItemStatus.MATCHED,
      exceptionReason: null,
    };
  }

  private isStatusDelivered(status: string | null): boolean {
    if (!status) return true; // No status info = assume delivered
    const lower = this.normalizeVietnamese(status.toLowerCase());
    return DELIVERED_KEYWORDS.some((kw) => lower.includes(kw));
  }

  private isStatusReturned(status: string | null): boolean {
    if (!status) return false;
    const lower = this.normalizeVietnamese(status.toLowerCase());
    return RETURNED_KEYWORDS.some((kw) => lower.includes(kw));
  }

  private normalizeVietnamese(str: string): string {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd');
  }
}
