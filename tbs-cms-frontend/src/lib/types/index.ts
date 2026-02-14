// ============================================
// RE-EXPORT ALL TYPES
// ============================================

// Enums
export {
  UserRole,
  OrderStatus,
  ServiceType,
  CustomerTier,
  PaymentMethod,
  Currency,
  ApprovalStatus,
  ApprovalType,
  ApprovalNodeType,
  ApproverType,
  ApprovalMode,
  ApprovalAction,
  ShippingRoute,
  Branch,
  NotificationChannel,
  QuotationStatus,
  ComplaintType,
  ComplaintSeverity,
  ComplaintStatus,
  ResolutionType,
  TaskPriority,
  TaskStatus,
  EmployeeStatus,
  LeaveType,
  LeaveStatus,
  VehicleType,
  VehicleStatus,
  MaintenanceType,
  DriverStatus,
  DocumentCategory,
  PurchaseStatus,
  StockMovementType,
  TrackingEventType,
  NettingStatus,
  CODStatus,
  NotificationPriority,
  MasterOrderStatus,
  ClearanceType,
} from './enums';

// Common
export type {
  BaseResponse,
  PaginatedResponse,
  PaginationMeta,
  QueryParams,
} from './common.types';

// Auth
export type { LoginDto, TokenResponse, UserProfile } from './auth.types';

// Order
export type {
  Order,
  OrderItem,
  OrderStatusHistory,
  PreAlert,
  CreateOrderDto,
  CreateOrderItemDto,
  UpdateOrderDto,
  OrderQueryParams,
  MasterOrder,
  CreateMasterOrderDto,
  CreateSubOrderDto,
  MasterOrderQueryParams,
} from './order.types';

// Customer
export type {
  Customer,
  Contact,
  Wallet,
  WalletTransaction,
  CreateCustomerDto,
  UpdateCustomerDto,
  CustomerQueryParams,
  TopupWalletDto,
} from './customer.types';

// Container
export type {
  Container,
  CreateContainerDto,
  ContainerQueryParams,
} from './container.types';

// Package
export type {
  WarehouseCNStatus,
  WarehouseVNStatus,
  Package,
  ReceivePackageDto,
  MeasurePackageDto,
} from './package.types';

// Delivery
export type {
  DeliveryStatus,
  Delivery,
  Vehicle,
  DispatchDto,
} from './delivery.types';

// Finance
export type {
  AccountReceivable,
  AccountPayable,
  PaymentVoucher,
  CashTransaction,
  Invoice,
  ExchangeRate,
  DebtNetting,
  CreateVoucherDto,
  CreateInvoiceDto,
} from './finance.types';

// Approval
export type {
  Approval,
  ApprovalStep,
  ApprovalCC,
  ApprovalComment,
  ApprovalActionLog,
  ApprovalDelegation,
  ApprovalFlowDefinition,
  ApprovalFlowNode,
  ApprovalFlowEdge,
  ApprovalCounts,
  CreateApprovalDto,
  ProcessApprovalDto,
} from './approval.types';

// Dashboard
export type {
  DashboardOverview,
  OrderStats,
  FinanceStats,
  WarehouseStats,
  HRStats,
  DashboardQueryParams,
} from './dashboard.types';

// Notification
export type { Notification } from './notification.types';

// Employee
export type {
  Employee,
  CreateEmployeeDto,
  UpdateEmployeeDto,
  EmployeeQueryParams,
  Headcount,
} from './employee.types';

// Driver
export type {
  Driver,
  CreateDriverDto,
  UpdateDriverDto,
  DriverQueryParams,
  DriverPerformance,
} from './driver.types';

// Task
export type {
  Task,
  TaskComment,
  CreateTaskDto,
  UpdateTaskDto,
  TaskQueryParams,
} from './task.types';

// Complaint
export type {
  Complaint,
  CreateComplaintDto,
  ResolveComplaintDto,
  ComplaintQueryParams,
  ComplaintStatistics,
} from './complaint.types';

// Quotation
export type {
  Quotation,
  QuotationItem,
  CreateQuotationDto,
  CreateQuotationItemDto,
  QuotationQueryParams,
} from './quotation.types';

// Document
export type {
  Document,
  DocumentQueryParams,
} from './document.types';

// Vendor
export type {
  Vendor,
  VendorRating,
  CreateVendorDto,
  UpdateVendorDto,
  RateVendorDto,
  VendorQueryParams,
} from './vendor.types';

// Purchase
export type {
  PurchaseRequest,
  PurchaseOrder,
  PurchaseItem,
  CreatePurchaseRequestDto,
  PurchaseQueryParams,
} from './purchase.types';

// Fleet
export type {
  Vehicle as FleetVehicle,
  MaintenanceRecord,
  FuelRecord,
  CreateVehicleDto,
  UpdateVehicleDto,
  CreateMaintenanceDto,
  CreateFuelRecordDto,
  VehicleQueryParams,
} from './fleet.types';

// Tracking
export type {
  TrackingEvent,
  TrackingInfo,
  ContainerTracking,
} from './tracking.types';

// Payroll
export type {
  PayrollRecord,
  PayrollSummary,
  PayrollQueryParams,
} from './payroll.types';

// Inventory
export type {
  StockItem,
  StockMovement,
  LowStockAlert,
  CreateStockItemDto,
  CreateStockMovementDto,
  InventoryQueryParams,
} from './inventory.types';

// Order Template
export type {
  OrderTemplate,
  OrderTemplateItem,
  OrderTemplateSubOrder,
  CreateOrderTemplateDto,
  UpdateOrderTemplateDto,
  OrderTemplateQueryParams,
} from './order-template.types';

// Supplier Order
export type {
  SupplierOrderStatus,
  SupplierOrder,
  CreateSupplierOrderDto,
  UpdateSupplierOrderDto,
  SupplierOrderQueryParams,
} from './supplier-order.types';
