import { Injectable } from '@nestjs/common';
import { QuotationStatus } from '@prisma/client';
import { BaseStatusMachine } from '@common/domain/base-status-machine';

/**
 * Quotation Status Finite State Machine.
 *
 * Manages quotation lifecycle transitions.
 * Key rules:
 *  - DRAFT can move to PENDING_APPROVAL
 *  - PENDING_APPROVAL can move to APPROVED or REJECTED
 *  - APPROVED can move to CONVERTED or EXPIRED
 *  - REJECTED can return to DRAFT for revision
 *  - CONVERTED and EXPIRED are terminal states
 */
@Injectable()
export class QuotationStatusMachine extends BaseStatusMachine<QuotationStatus> {
  constructor() {
    super(
      {
        DRAFT: [QuotationStatus.PENDING_APPROVAL],
        PENDING_APPROVAL: [QuotationStatus.APPROVED, QuotationStatus.REJECTED],
        APPROVED: [QuotationStatus.CONVERTED, QuotationStatus.EXPIRED],
        REJECTED: [QuotationStatus.DRAFT],
        CONVERTED: [],
        EXPIRED: [],
      },
      [QuotationStatus.CONVERTED, QuotationStatus.EXPIRED],
    );
  }
}
