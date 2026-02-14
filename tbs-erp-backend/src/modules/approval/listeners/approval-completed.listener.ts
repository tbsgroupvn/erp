import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ApprovalType } from '@prisma/client';

export interface ApprovalCompletedEvent {
  approvalId: string;
  type: ApprovalType;
  referenceId: string;
  status: 'APPROVED' | 'REJECTED';
  approverId: string;
  comment?: string;
}

/**
 * Listens for approval.completed events and re-emits more specific events
 * based on the approval type. This decouples the approval system from
 * the business modules.
 */
@Injectable()
export class ApprovalCompletedListener {
  private readonly logger = new Logger(ApprovalCompletedListener.name);

  constructor(private readonly eventEmitter: EventEmitter2) {}

  @OnEvent('approval.completed')
  async handleApprovalCompleted(event: ApprovalCompletedEvent): Promise<void> {
    this.logger.log(
      `Approval completed: type=${event.type}, status=${event.status}, ref=${event.referenceId}`,
    );

    // Map approval types to specific event names
    const typeEventMap: Record<string, { event: string; refKey: string }> = {
      [ApprovalType.DISCOUNT]: { event: 'discount.approval.completed', refKey: 'orderId' },
      [ApprovalType.PAYMENT_VOUCHER]: { event: 'voucher.approval.completed', refKey: 'voucherId' },
      [ApprovalType.RECEIPT_VOUCHER]: { event: 'voucher.approval.completed', refKey: 'voucherId' },
      [ApprovalType.ORDER_CANCEL]: { event: 'order.cancel.approval.completed', refKey: 'orderId' },
      [ApprovalType.CREDIT_EXTENSION]: { event: 'credit.extension.approval.completed', refKey: 'customerId' },
      [ApprovalType.DEPOSIT_EXEMPTION]: { event: 'deposit.exemption.approval.completed', refKey: 'orderId' },
      [ApprovalType.CONTAINER_PLAN]: { event: 'container.plan.approval.completed', refKey: 'planId' },
      [ApprovalType.WAREHOUSE_RELEASE]: { event: 'warehouse.release.approval.completed', refKey: 'releaseId' },
      [ApprovalType.LEAVE_REQUEST]: { event: 'leave.approval.completed', refKey: 'leaveId' },
      [ApprovalType.OVERTIME_REQUEST]: { event: 'overtime.approval.completed', refKey: 'overtimeId' },
      [ApprovalType.PURCHASE_ORDER]: { event: 'purchase.approval.completed', refKey: 'purchaseId' },
      [ApprovalType.QUOTATION_SPECIAL]: { event: 'quotation.special.approval.completed', refKey: 'quotationId' },
      [ApprovalType.EXPENSE_CLAIM]: { event: 'expense.approval.completed', refKey: 'expenseId' },
      [ApprovalType.SALARY_ADJUSTMENT]: { event: 'salary.adjustment.approval.completed', refKey: 'adjustmentId' },
    };

    const mapping = typeEventMap[event.type];

    if (mapping) {
      this.eventEmitter.emit(mapping.event, {
        [mapping.refKey]: event.referenceId,
        status: event.status,
        approverId: event.approverId,
      });
    } else {
      // CUSTOM or unknown types — emit generic event
      this.eventEmitter.emit('custom.approval.completed', {
        type: event.type,
        referenceId: event.referenceId,
        status: event.status,
        approverId: event.approverId,
      });
    }
  }
}
