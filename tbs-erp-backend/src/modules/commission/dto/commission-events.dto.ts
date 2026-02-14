/**
 * Event DTOs for commission flow
 * These interfaces define the structure of events emitted by the commission system
 */

export interface CommissionPendingEvent {
  commissionId: string;
  orderId: string;
  orderCode: string;
  saleId: string;
  commissionAmount: number;
  netProfit: number;
  createdAt: Date;
}

export interface CommissionApprovedEvent {
  commissionId: string;
  orderId: string;
  orderCode: string;
  saleId: string;
  commissionAmount: number;
  approvedBy: string;
  approvedAt: Date;
  arId: string;
  arCode: string;
}

export interface CommissionPaidEvent {
  commissionId: string;
  orderId: string;
  orderCode: string;
  saleId: string;
  commissionAmount: number;
  paidBy: string;
  paidAt: Date;
}
