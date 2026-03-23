-- ============================================================
-- Migration: add_partial_indexes
-- Purpose: Partial indexes to reduce index size 30-40% by
--          only indexing non-terminal / actionable rows.
--          These are the hot-path queries in TBS ERP.
-- ============================================================

-- ------------------------------------------------------------
-- ORDERS (table: orders)
-- Terminal states: COMPLETED, CANCELLED, RETURNED
-- Hot states: everything else (13 active statuses)
-- ------------------------------------------------------------

-- Active orders by status + created_at (general list view, admin)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_active_status_created
  ON "orders" (status, created_at DESC)
  WHERE status NOT IN ('COMPLETED', 'CANCELLED', 'RETURNED');

-- Active orders by sale (sales dashboard, 95%+ of sale queries filter out terminals)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_active_by_sale
  ON "orders" (sale_id, status, created_at DESC)
  WHERE status NOT IN ('COMPLETED', 'CANCELLED', 'RETURNED');

-- Active orders by customer (customer portal, order detail page)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_active_by_customer
  ON "orders" (customer_id, status, created_at DESC)
  WHERE status NOT IN ('COMPLETED', 'CANCELLED', 'RETURNED');

-- Active orders by container (container detail → packages/orders drill-down)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_active_by_container
  ON "orders" (container_id, status)
  WHERE status NOT IN ('COMPLETED', 'CANCELLED', 'RETURNED')
    AND container_id IS NOT NULL;

-- ------------------------------------------------------------
-- PACKAGES (table: packages)
-- WarehouseCNStatus terminal: SHIPPED
-- WarehouseVNStatus terminal: DELIVERED
-- ------------------------------------------------------------

-- In-transit CN packages (not yet shipped out of CN warehouse)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_package_cn_in_warehouse
  ON "packages" (container_id, warehouse_cn_status)
  WHERE warehouse_cn_status IS NOT NULL
    AND warehouse_cn_status != 'SHIPPED';

-- VN packages not yet delivered (active in VN warehouse)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_package_vn_active
  ON "packages" (container_id, warehouse_vn_status)
  WHERE warehouse_vn_status IS NOT NULL
    AND warehouse_vn_status != 'DELIVERED';

-- ------------------------------------------------------------
-- CONTAINERS (table: containers)
-- Terminal states: COMPLETED
-- No CANCELLED status in ContainerStatus enum
-- Active: PLANNING, LOADING, IN_TRANSIT, ARRIVED, CUSTOMS,
--         CUSTOMS_HOLD, ON_HOLD_BORDER
-- ------------------------------------------------------------

-- Active containers (operations view)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_container_active
  ON "containers" (status, created_at DESC)
  WHERE status != 'COMPLETED';

-- Active containers by route (route-specific operations)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_container_active_by_route
  ON "containers" (shipping_route, status, estimated_arrival_at)
  WHERE status != 'COMPLETED';

-- ------------------------------------------------------------
-- ACCOUNT RECEIVABLES (table: account_receivables)
-- AccountStatus: OPEN, PARTIAL, PAID, OVERDUE, NETTED, CANCELLED
-- Terminal (paid/closed): PAID, NETTED, CANCELLED
-- Actionable: OPEN, PARTIAL, OVERDUE
-- ------------------------------------------------------------

-- Unpaid receivables (finance dashboard, AR aging, collections)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ar_unpaid_by_customer
  ON "account_receivables" (customer_id, due_date)
  WHERE status NOT IN ('PAID', 'NETTED', 'CANCELLED');

-- Unpaid receivables sorted by due date (overdue detection)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ar_unpaid_by_due_date
  ON "account_receivables" (due_date, status)
  WHERE status NOT IN ('PAID', 'NETTED', 'CANCELLED');

-- ------------------------------------------------------------
-- NOTIFICATIONS (table: notifications)
-- Hot path: unread notifications per user (notification bell)
-- Field: is_read (Boolean, mapped from isRead)
-- ------------------------------------------------------------

-- Unread notifications per user (notification bell, hot path)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_unread
  ON "notifications" (user_id, created_at DESC)
  WHERE is_read = false;

-- ------------------------------------------------------------
-- APPROVALS (table: approvals)
-- ApprovalStatus: PENDING, APPROVED, REJECTED, CANCELLED,
--                 RETURNED, WITHDRAWN
-- Terminal: APPROVED, REJECTED, CANCELLED, WITHDRAWN
-- Actionable: PENDING, RETURNED
-- ------------------------------------------------------------

-- Pending approvals (approval inbox — most critical query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_approval_pending
  ON "approvals" (status, created_at DESC)
  WHERE status IN ('PENDING', 'RETURNED');

-- Pending approvals by requester (my pending requests view)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_approval_pending_by_requester
  ON "approvals" (requested_by, status, created_at DESC)
  WHERE status IN ('PENDING', 'RETURNED');

-- Pending approval steps by assigned user (approver inbox)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_approval_step_pending_by_assignee
  ON "approval_steps" (assigned_user_id, status)
  WHERE status = 'PENDING'
    AND assigned_user_id IS NOT NULL;

-- ------------------------------------------------------------
-- PAYMENT VOUCHERS (table: payment_vouchers)
-- ApprovalStatus: PENDING, APPROVED, REJECTED, CANCELLED,
--                 RETURNED, WITHDRAWN
-- Actionable: PENDING, RETURNED
-- ------------------------------------------------------------

-- Pending payment vouchers (finance approval queue)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_voucher_pending
  ON "payment_vouchers" (status, created_at DESC)
  WHERE status IN ('PENDING', 'RETURNED');

-- Pending vouchers by creator (my pending vouchers)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_voucher_pending_by_creator
  ON "payment_vouchers" (created_by, status, created_at DESC)
  WHERE status IN ('PENDING', 'RETURNED');

-- ------------------------------------------------------------
-- CUSTOMS DECLARATIONS (table: customs_declarations)
-- CustomsDeclarationStatus: DRAFT, READY, SUBMITTED,
--   CHANNEL_ASSIGNED, INSPECTING, CLEARED, REJECTED, CANCELLED
-- Terminal: CLEARED, REJECTED, CANCELLED
-- ------------------------------------------------------------

-- Active customs declarations (XNK operations view)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customs_active
  ON "customs_declarations" (status, container_id)
  WHERE status NOT IN ('CLEARED', 'REJECTED', 'CANCELLED');

-- ------------------------------------------------------------
-- SUPPLIER ORDERS (table: supplier_orders)
-- SupplierOrderStatus: DRAFT, QUOTED, ORDERED, CONFIRMED,
--   PARTIALLY_SHIPPED, SHIPPED_CN, RECEIVED_CN,
--   RETURN_IN_PROGRESS, REFUNDED, CANCELLED, ISSUE
-- Terminal: RECEIVED_CN, REFUNDED, CANCELLED
-- ------------------------------------------------------------

-- Active supplier orders (MHH sourcing board)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_supplier_order_active
  ON "supplier_orders" (status, created_at DESC)
  WHERE status NOT IN ('RECEIVED_CN', 'REFUNDED', 'CANCELLED');

-- Active supplier orders by order (order detail → sourcing tab)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_supplier_order_active_by_order
  ON "supplier_orders" (order_id, status)
  WHERE status NOT IN ('RECEIVED_CN', 'REFUNDED', 'CANCELLED');

-- ------------------------------------------------------------
-- QUOTATIONS (table: quotations)
-- QuotationStatus: DRAFT, PENDING_APPROVAL, APPROVED,
--                  REJECTED, CONVERTED, EXPIRED
-- Terminal: REJECTED, CONVERTED, EXPIRED
-- Actionable: DRAFT, PENDING_APPROVAL, APPROVED
-- ------------------------------------------------------------

-- Active quotations (sales pipeline view)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quotation_active
  ON "quotations" (status, created_at DESC)
  WHERE status NOT IN ('REJECTED', 'CONVERTED', 'EXPIRED');

-- Active quotations by customer (customer detail → quotations tab)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quotation_active_by_customer
  ON "quotations" (customer_id, status, created_at DESC)
  WHERE status NOT IN ('REJECTED', 'CONVERTED', 'EXPIRED');

-- ------------------------------------------------------------
-- ORDER ITEMS (table: order_items)
-- Soft-deleted rows excluded from all queries
-- ------------------------------------------------------------

-- Non-deleted order items (all query paths use this filter)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_item_active
  ON "order_items" (order_id, created_at DESC)
  WHERE deleted_at IS NULL;
