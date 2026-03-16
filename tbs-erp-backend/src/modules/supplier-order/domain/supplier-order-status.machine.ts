import { Injectable } from '@nestjs/common';
import { SupplierOrderStatus } from '@prisma/client';
import { BaseStatusMachine } from '@common/domain/base-status-machine';

/**
 * Supplier Order Status Finite State Machine.
 *
 * Manages supplier order lifecycle transitions.
 * Key rules:
 *  - DRAFT can move to QUOTED, ORDERED, or CANCELLED
 *  - QUOTED can move to ORDERED or CANCELLED
 *  - ORDERED can be CONFIRMED, CANCELLED, or flagged as ISSUE
 *  - CONFIRMED can progress to shipping stages, be CANCELLED, or flagged as ISSUE
 *  - PARTIALLY_SHIPPED can complete shipping or flag ISSUE
 *  - SHIPPED_CN can be RECEIVED_CN or flag ISSUE
 *  - RECEIVED_CN can be returned to supplier
 *  - RETURN_IN_PROGRESS leads to REFUNDED (terminal)
 *  - REFUNDED and CANCELLED are terminal states
 *  - ISSUE can retry (ORDERED, CONFIRMED) or be CANCELLED
 */
@Injectable()
export class SupplierOrderStatusMachine extends BaseStatusMachine<SupplierOrderStatus> {
  constructor() {
    super(
      {
        DRAFT: [SupplierOrderStatus.QUOTED, SupplierOrderStatus.ORDERED, SupplierOrderStatus.CANCELLED],
        QUOTED: [SupplierOrderStatus.ORDERED, SupplierOrderStatus.CANCELLED],
        ORDERED: [
          SupplierOrderStatus.CONFIRMED,
          SupplierOrderStatus.CANCELLED,
          SupplierOrderStatus.ISSUE,
        ],
        CONFIRMED: [
          SupplierOrderStatus.PARTIALLY_SHIPPED,
          SupplierOrderStatus.SHIPPED_CN,
          SupplierOrderStatus.CANCELLED,
          SupplierOrderStatus.ISSUE,
        ],
        PARTIALLY_SHIPPED: [
          SupplierOrderStatus.SHIPPED_CN,
          SupplierOrderStatus.RECEIVED_CN,
          SupplierOrderStatus.ISSUE,
        ],
        SHIPPED_CN: [SupplierOrderStatus.RECEIVED_CN, SupplierOrderStatus.ISSUE],
        RECEIVED_CN: [SupplierOrderStatus.RETURN_IN_PROGRESS, SupplierOrderStatus.ISSUE],
        RETURN_IN_PROGRESS: [SupplierOrderStatus.REFUNDED, SupplierOrderStatus.ISSUE],
        REFUNDED: [],
        CANCELLED: [],
        ISSUE: [
          SupplierOrderStatus.ORDERED,
          SupplierOrderStatus.CONFIRMED,
          SupplierOrderStatus.RETURN_IN_PROGRESS,
          SupplierOrderStatus.CANCELLED,
        ],
      },
      [SupplierOrderStatus.REFUNDED, SupplierOrderStatus.CANCELLED],
    );
  }
}
