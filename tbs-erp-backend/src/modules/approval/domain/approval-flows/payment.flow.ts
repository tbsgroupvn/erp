import { Injectable, OnModuleInit } from '@nestjs/common';
import { ApprovalType, UserRole } from '@prisma/client';
import { ApprovalEngine, ApprovalFlowStep } from '../approval-engine';

/**
 * Payment voucher approval flow:
 *
 * All payment vouchers: KT Thanh toan -> BGD chi tien (COO)
 * > 50M VND:            + KT Tong hop (CHIEF_ACCOUNTANT)
 *
 * Flow: ACCOUNTANT_AR -> COO  (base)
 *       ACCOUNTANT_AR -> CHIEF_ACCOUNTANT -> COO  (> 50M)
 */
@Injectable()
export class PaymentApprovalFlow implements OnModuleInit {
  constructor(private readonly approvalEngine: ApprovalEngine) {}

  onModuleInit(): void {
    this.approvalEngine.defineFlow(
      ApprovalType.PAYMENT_VOUCHER,
      this.getBaseSteps(),
    );
  }

  /**
   * Base steps for all payment vouchers.
   */
  getBaseSteps(): ApprovalFlowStep[] {
    return [
      { stepNumber: 1, approverRole: UserRole.ACCOUNTANT_AR },
      { stepNumber: 2, approverRole: UserRole.COO },
    ];
  }

  /**
   * Get steps based on payment amount.
   * > 50M VND adds the Chief Accountant step.
   */
  getStepsForAmount(amount: number): ApprovalFlowStep[] {
    if (amount > 50_000_000) {
      return [
        { stepNumber: 1, approverRole: UserRole.ACCOUNTANT_AR },
        { stepNumber: 2, approverRole: UserRole.CHIEF_ACCOUNTANT },
        { stepNumber: 3, approverRole: UserRole.COO },
      ];
    }

    return this.getBaseSteps();
  }
}
