import { OrderStatus } from '@prisma/client';

/**
 * The 13-stage order lifecycle, in sequential order.
 */
export const ORDER_LIFECYCLE: OrderStatus[] = [
  OrderStatus.CONSULTING,
  OrderStatus.QUOTATION,
  OrderStatus.PENDING_DEPOSIT,
  OrderStatus.SOURCING,
  OrderStatus.WAREHOUSE_CN,
  OrderStatus.PACKING,
  OrderStatus.CONSOLIDATION,
  OrderStatus.IN_TRANSIT,
  OrderStatus.CUSTOMS,
  OrderStatus.WAREHOUSE_VN,
  OrderStatus.DELIVERING,
  OrderStatus.SETTLEMENT,
  OrderStatus.COMPLETED,
];

/**
 * Special statuses that are not part of the main lifecycle progression.
 */
export const SPECIAL_STATUSES: OrderStatus[] = [
  OrderStatus.ON_HOLD,
  OrderStatus.CANCELLED,
  OrderStatus.RETURNED,
  OrderStatus.ISSUE,
];

/**
 * Statuses from which an order can no longer be cancelled.
 * Once goods are in transit or beyond, cancellation is not allowed.
 */
export const NON_CANCELLABLE_STATUSES: OrderStatus[] = [
  OrderStatus.IN_TRANSIT,
  OrderStatus.CUSTOMS,
  OrderStatus.WAREHOUSE_VN,
  OrderStatus.DELIVERING,
  OrderStatus.SETTLEMENT,
  OrderStatus.COMPLETED,
  OrderStatus.CANCELLED,
];

/**
 * Terminal statuses -- orders in these statuses cannot transition further.
 */
export const TERMINAL_STATUSES: OrderStatus[] = [
  OrderStatus.COMPLETED,
  OrderStatus.CANCELLED,
];

/**
 * Map of valid transitions from each status.
 * Includes forward lifecycle progression plus special transitions.
 */
const TRANSITION_MAP: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.CONSULTING]: [
    OrderStatus.QUOTATION,
    OrderStatus.ON_HOLD,
    OrderStatus.CANCELLED,
    OrderStatus.ISSUE,
  ],
  [OrderStatus.QUOTATION]: [
    OrderStatus.PENDING_DEPOSIT,
    OrderStatus.SOURCING, // VCT orders can skip deposit; MHH blocked by OrderStatusMachine
    OrderStatus.ON_HOLD,
    OrderStatus.CANCELLED,
    OrderStatus.ISSUE,
  ],
  [OrderStatus.PENDING_DEPOSIT]: [
    OrderStatus.SOURCING,
    OrderStatus.ON_HOLD,
    OrderStatus.CANCELLED,
    OrderStatus.ISSUE,
  ],
  [OrderStatus.SOURCING]: [
    OrderStatus.WAREHOUSE_CN,
    OrderStatus.ON_HOLD,
    OrderStatus.CANCELLED,
    OrderStatus.ISSUE,
  ],
  [OrderStatus.WAREHOUSE_CN]: [
    OrderStatus.PACKING,
    OrderStatus.ON_HOLD,
    OrderStatus.CANCELLED,
    OrderStatus.ISSUE,
  ],
  [OrderStatus.PACKING]: [
    OrderStatus.CONSOLIDATION,
    OrderStatus.ON_HOLD,
    OrderStatus.CANCELLED,
    OrderStatus.ISSUE,
  ],
  [OrderStatus.CONSOLIDATION]: [
    OrderStatus.IN_TRANSIT,
    OrderStatus.ON_HOLD,
    OrderStatus.CANCELLED,
    OrderStatus.ISSUE,
  ],
  [OrderStatus.IN_TRANSIT]: [
    OrderStatus.CUSTOMS,
    OrderStatus.ON_HOLD,
    OrderStatus.ISSUE,
  ],
  [OrderStatus.CUSTOMS]: [
    OrderStatus.WAREHOUSE_VN,
    OrderStatus.ON_HOLD,
    OrderStatus.ISSUE,
  ],
  [OrderStatus.WAREHOUSE_VN]: [
    OrderStatus.DELIVERING,
    OrderStatus.ON_HOLD,
    OrderStatus.ISSUE,
  ],
  [OrderStatus.DELIVERING]: [
    OrderStatus.SETTLEMENT,
    OrderStatus.ON_HOLD,
    OrderStatus.ISSUE,
  ],
  [OrderStatus.SETTLEMENT]: [
    OrderStatus.COMPLETED,
    OrderStatus.ON_HOLD,
    OrderStatus.ISSUE,
  ],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.RETURNED]: [],
  [OrderStatus.ON_HOLD]: [
    // ON_HOLD can return to any lifecycle status (restored by admin)
    ...ORDER_LIFECYCLE,
    OrderStatus.CANCELLED,
    OrderStatus.ISSUE,
  ],
  [OrderStatus.ISSUE]: [
    // ISSUE can return to any lifecycle status once resolved, or be cancelled
    ...ORDER_LIFECYCLE,
    OrderStatus.ON_HOLD,
    OrderStatus.CANCELLED,
  ],
};

/**
 * Returns all valid next statuses from the given current status.
 */
export function getNextStatuses(current: OrderStatus): OrderStatus[] {
  return TRANSITION_MAP[current] ?? [];
}

/**
 * Checks whether transitioning from one status to another is valid.
 */
export function isValidTransition(
  from: OrderStatus,
  to: OrderStatus,
): boolean {
  const validTargets = TRANSITION_MAP[from];
  if (!validTargets) {
    return false;
  }
  return validTargets.includes(to);
}

/**
 * Returns the lifecycle stage index (1-13) for a given status,
 * or -1 if the status is a special status not in the main lifecycle.
 */
export function getLifecycleStageIndex(status: OrderStatus): number {
  const index = ORDER_LIFECYCLE.indexOf(status);
  return index === -1 ? -1 : index + 1;
}

/**
 * Vietnamese labels for each order status.
 */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  [OrderStatus.CONSULTING]: 'Tiếp nhận',
  [OrderStatus.QUOTATION]: 'Báo giá',
  [OrderStatus.PENDING_DEPOSIT]: 'Chờ cọc',
  [OrderStatus.SOURCING]: 'Mua hàng',
  [OrderStatus.WAREHOUSE_CN]: 'Nhập kho TQ',
  [OrderStatus.PACKING]: 'Đóng gói',
  [OrderStatus.CONSOLIDATION]: 'Ghép cont',
  [OrderStatus.IN_TRANSIT]: 'Vận chuyển',
  [OrderStatus.CUSTOMS]: 'Thông quan',
  [OrderStatus.WAREHOUSE_VN]: 'Nhập kho VN',
  [OrderStatus.DELIVERING]: 'Giao hàng',
  [OrderStatus.SETTLEMENT]: 'Quyết toán',
  [OrderStatus.COMPLETED]: 'Hoàn thành',
  [OrderStatus.ON_HOLD]: 'Tạm giữ',
  [OrderStatus.CANCELLED]: 'Đã hủy',
  [OrderStatus.RETURNED]: 'Trả hàng',
  [OrderStatus.ISSUE]: 'Có vấn đề',
};
