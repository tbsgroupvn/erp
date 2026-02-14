import { Injectable, OnModuleInit } from '@nestjs/common';
import { ApprovalType, UserRole } from '@prisma/client';
import { ApprovalEngine, ApprovalFlowStep } from '../approval-engine';

/**
 * Discount approval flow:
 *
 * - <= 3%:           Leader + KT Thanh toan (parallel, both must approve)
 * - > 3%:            + GD Kinh doanh
 * - > 5% or > 100M:  + BGD (COO)
 *
 * Since our engine is sequential, we model parallel approvals as
 * separate sequential steps but document that they can happen in parallel.
 * The default flow covers the most common case. Dynamic flow selection
 * happens in the service layer based on discount percentage and amount.
 */
@Injectable()
export class DiscountApprovalFlow implements OnModuleInit {
  constructor(private readonly approvalEngine: ApprovalEngine) {}

  onModuleInit(): void {
    // Register the default (base) flow for DISCOUNT
    // The actual steps will be dynamically determined based on discount params
    this.approvalEngine.defineFlow(ApprovalType.DISCOUNT, this.getBaseSteps());
  }

  /**
   * Base steps: Leader + KT TT (for discounts <= 3%)
   */
  getBaseSteps(): ApprovalFlowStep[] {
    return [
      { stepNumber: 1, approverRole: UserRole.SALES_LEADER },
      { stepNumber: 2, approverRole: UserRole.ACCOUNTANT_AR },
    ];
  }

  /**
   * Get the appropriate approval steps based on discount parameters.
   *
   * @param discountPercent - Discount percentage (e.g. 3.5 for 3.5%)
   * @param discountAmount - Absolute discount amount in VND
   */
  getStepsForDiscount(
    discountPercent: number,
    discountAmount: number,
  ): ApprovalFlowStep[] {
    const steps: ApprovalFlowStep[] = [
      { stepNumber: 1, approverRole: UserRole.SALES_LEADER },
      { stepNumber: 2, approverRole: UserRole.ACCOUNTANT_AR },
    ];

    // > 3% discount: add Sales Director
    if (discountPercent > 3) {
      steps.push({
        stepNumber: 3,
        approverRole: UserRole.SALES_DIRECTOR,
      });
    }

    // > 5% discount OR > 100M VND: add BGD (COO)
    if (discountPercent > 5 || discountAmount > 100_000_000) {
      steps.push({
        stepNumber: steps.length + 1,
        approverRole: UserRole.COO,
      });
    }

    return steps;
  }
}
