import { Injectable, OnModuleInit } from '@nestjs/common';
import { ApprovalType, UserRole } from '@prisma/client';
import { ApprovalEngine, ApprovalFlowStep } from '../approval-engine';

/**
 * Order cancellation approval flow:
 *
 * - Chua coc (no deposit paid):       Leader only
 * - Da coc (deposit paid):            Leader + GD Kinh doanh
 * - Da mua hang+ (goods purchased):   GD Kinh doanh + BGD (COO)
 *
 * The appropriate flow is selected based on the order's current state.
 */
export enum CancelOrderStage {
  NO_DEPOSIT = 'NO_DEPOSIT',
  DEPOSIT_PAID = 'DEPOSIT_PAID',
  GOODS_PURCHASED = 'GOODS_PURCHASED',
}

@Injectable()
export class CancelOrderApprovalFlow implements OnModuleInit {
  constructor(private readonly approvalEngine: ApprovalEngine) {}

  onModuleInit(): void {
    // Register the default (most common) cancel flow
    this.approvalEngine.defineFlow(
      ApprovalType.ORDER_CANCEL,
      this.getBaseSteps(),
    );
  }

  /**
   * Default base steps (no deposit case).
   */
  getBaseSteps(): ApprovalFlowStep[] {
    return [{ stepNumber: 1, approverRole: UserRole.SALES_LEADER }];
  }

  /**
   * Get the appropriate cancel approval steps based on order stage.
   */
  getStepsForStage(stage: CancelOrderStage): ApprovalFlowStep[] {
    switch (stage) {
      case CancelOrderStage.NO_DEPOSIT:
        // Chua coc: Leader only
        return [{ stepNumber: 1, approverRole: UserRole.SALES_LEADER }];

      case CancelOrderStage.DEPOSIT_PAID:
        // Da coc: Leader + GD KD
        return [
          { stepNumber: 1, approverRole: UserRole.SALES_LEADER },
          { stepNumber: 2, approverRole: UserRole.SALES_DIRECTOR },
        ];

      case CancelOrderStage.GOODS_PURCHASED:
        // Da mua hang+: GD KD + BGD
        return [
          { stepNumber: 1, approverRole: UserRole.SALES_DIRECTOR },
          { stepNumber: 2, approverRole: UserRole.COO },
        ];

      default:
        return this.getBaseSteps();
    }
  }

  /**
   * Determine the cancellation stage from order data.
   */
  determineCancelStage(order: {
    isDepositPaid: boolean;
    status: string;
  }): CancelOrderStage {
    // If order is in SOURCING or later stages, goods have been purchased
    const purchasedStatuses = [
      'SOURCING',
      'WAREHOUSE_CN',
      'PACKING',
      'CONSOLIDATION',
      'IN_TRANSIT',
      'CUSTOMS',
      'WAREHOUSE_VN',
      'DELIVERING',
      'SETTLEMENT',
    ];

    if (purchasedStatuses.includes(order.status)) {
      return CancelOrderStage.GOODS_PURCHASED;
    }

    if (order.isDepositPaid) {
      return CancelOrderStage.DEPOSIT_PAID;
    }

    return CancelOrderStage.NO_DEPOSIT;
  }
}
