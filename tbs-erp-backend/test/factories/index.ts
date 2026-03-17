/**
 * Test Data Factories
 *
 * Pure functions that return plain objects for use in unit and integration tests.
 * No database dependency — each factory produces a complete object with sensible
 * defaults that can be overridden via a partial argument.
 *
 * Usage:
 *   const order = buildOrder();                          // all defaults
 *   const order = buildOrder({ status: 'SOURCING' });    // override status
 *   const pkg   = buildPackage({ orderId: order.id });   // link to order
 */

import {
  OrderStatus,
  ServiceType,
  ContainerStatus,
  CustomerTier,
  SupplierOrderStatus,
  UserRole,
  WarehouseCNStatus,
} from '@prisma/client';

// ---------------------------------------------------------------------------
// Internal counters for unique code generation
// ---------------------------------------------------------------------------

let _idCounter = 0;
let _orderCodeCounter = 0;
let _customerCodeCounter = 0;
let _containerCodeCounter = 0;
let _supplierOrderCodeCounter = 0;
let _packageCodeCounter = 0;
let _userCounter = 0;

/**
 * Resets all internal counters. Call in `beforeEach` if you need
 * deterministic sequences across tests.
 */
export function resetFactoryCounters(): void {
  _idCounter = 0;
  _orderCodeCounter = 0;
  _customerCodeCounter = 0;
  _containerCodeCounter = 0;
  _supplierOrderCodeCounter = 0;
  _packageCodeCounter = 0;
  _userCounter = 0;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generates a unique, cuid-like identifier.
 *
 * Format: `test_<13-char-hex>_<counter>`
 * Not cryptographically random, but unique within a single test run.
 */
export function generateId(): string {
  _idCounter++;
  const hex = Date.now().toString(16).slice(-8);
  return `test_${hex}_${String(_idCounter).padStart(5, '0')}`;
}

/**
 * Generates a business code with the given prefix.
 *
 * @example generateCode('ORD')  => 'TBS-ORD-260317-0001'
 * @example generateCode('KH')   => 'TBS-KH-260317-0002'
 */
export function generateCode(prefix: string): string {
  _idCounter++;
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `TBS-${prefix}-${yy}${mm}${dd}-${String(_idCounter).padStart(4, '0')}`;
}

// ---------------------------------------------------------------------------
// Data types — plain interfaces matching the shapes services work with
// ---------------------------------------------------------------------------

export interface OrderData {
  id: string;
  orderCode: string;
  status: OrderStatus;
  serviceType: ServiceType;
  customerId: string;
  saleId: string;
  totalAmount: number;
  depositAmount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerData {
  id: string;
  code: string;
  name: string;
  phone: string;
  email: string;
  tier: CustomerTier;
  walletBalance: number;
  creditLimit: number;
  createdAt: Date;
}

export interface ContainerData {
  id: string;
  containerCode: string;
  status: ContainerStatus;
  estimatedDeparture: Date | null;
  actualDeparture: Date | null;
  estimatedArrival: Date | null;
  createdAt: Date;
}

export interface UserData {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  departmentId: string | null;
  isActive: boolean;
  createdAt: Date;
}

export interface SupplierOrderData {
  id: string;
  supplierOrderCode: string;
  status: SupplierOrderStatus;
  orderId: string;
  supplierId: string | null;
  totalAmount: number;
  createdAt: Date;
}

export interface PackageData {
  id: string;
  trackingNumber: string;
  status: WarehouseCNStatus;
  orderId: string;
  cnWeight: number | null;
  vnWeight: number | null;
  declaredValue: number | null;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Factory functions
// ---------------------------------------------------------------------------

/**
 * Builds a test order object.
 *
 * Defaults:
 *   - status: CONSULTING
 *   - serviceType: VCT
 *   - totalAmount: 5_000_000 (5 trieu VND)
 *   - depositAmount: 0
 */
export function buildOrder(overrides: Partial<OrderData> = {}): OrderData {
  _orderCodeCounter++;
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');

  return {
    id: generateId(),
    orderCode: `TBS-ORD-${yy}${mm}${dd}-${String(_orderCodeCounter).padStart(4, '0')}`,
    status: OrderStatus.CONSULTING,
    serviceType: ServiceType.VCT,
    customerId: generateId(),
    saleId: generateId(),
    totalAmount: 5_000_000,
    depositAmount: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Builds a test customer object.
 *
 * Defaults:
 *   - tier: STANDARD -> mapped to CustomerTier.NEW (the base tier)
 *   - walletBalance: 0
 *   - creditLimit: 0
 *   - Vietnamese phone format: 09xx xxx xxx
 */
export function buildCustomer(overrides: Partial<CustomerData> = {}): CustomerData {
  _customerCodeCounter++;
  const seq = String(_customerCodeCounter).padStart(6, '0');
  const phoneSeq = String(90_000_000 + _customerCodeCounter);

  return {
    id: generateId(),
    code: `TBS-KH-${seq}`,
    name: `Khach Hang ${_customerCodeCounter}`,
    phone: `0${phoneSeq}`,
    email: `khachhang${_customerCodeCounter}@example.com`,
    tier: CustomerTier.NEW,
    walletBalance: 0,
    creditLimit: 0,
    createdAt: new Date(),
    ...overrides,
  };
}

/**
 * Builds a test container object.
 *
 * Defaults:
 *   - status: PLANNING
 *   - estimatedDeparture: 3 days from now
 *   - actualDeparture: null
 *   - estimatedArrival: 10 days from now
 */
export function buildContainer(overrides: Partial<ContainerData> = {}): ContainerData {
  _containerCodeCounter++;
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');

  const threeDaysLater = new Date(now);
  threeDaysLater.setDate(threeDaysLater.getDate() + 3);

  const tenDaysLater = new Date(now);
  tenDaysLater.setDate(tenDaysLater.getDate() + 10);

  return {
    id: generateId(),
    containerCode: `TBS${yy}${mm}${dd}${String(_containerCodeCounter).padStart(3, '0')}`,
    status: ContainerStatus.PLANNING,
    estimatedDeparture: threeDaysLater,
    actualDeparture: null,
    estimatedArrival: tenDaysLater,
    createdAt: now,
    ...overrides,
  };
}

/**
 * Builds a test user object.
 *
 * Defaults:
 *   - role: SALE
 *   - isActive: true
 *   - departmentId: null
 */
export function buildUser(overrides: Partial<UserData> = {}): UserData {
  _userCounter++;
  const seq = String(_userCounter).padStart(3, '0');

  return {
    id: generateId(),
    email: `nhanvien${seq}@tbs.vn`,
    username: `NV${seq}`,
    role: UserRole.SALE,
    departmentId: null,
    isActive: true,
    createdAt: new Date(),
    ...overrides,
  };
}

/**
 * Builds a test supplier order object.
 *
 * Defaults:
 *   - status: DRAFT
 *   - totalAmount: 1_500_000 (1.5 trieu VND)
 *   - supplierId: null
 */
export function buildSupplierOrder(overrides: Partial<SupplierOrderData> = {}): SupplierOrderData {
  _supplierOrderCodeCounter++;
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');

  return {
    id: generateId(),
    supplierOrderCode: `SO-${yy}${mm}-${String(_supplierOrderCodeCounter).padStart(4, '0')}`,
    status: SupplierOrderStatus.DRAFT,
    orderId: generateId(),
    supplierId: null,
    totalAmount: 1_500_000,
    createdAt: now,
    ...overrides,
  };
}

/**
 * Builds a test package (warehouse item) object.
 *
 * Defaults:
 *   - status: RECEIVED (WarehouseCNStatus)
 *   - cnWeight / vnWeight: null (not yet measured)
 *   - declaredValue: null
 *   - Tracking number follows Chinese domestic courier format
 */
export function buildPackage(overrides: Partial<PackageData> = {}): PackageData {
  _packageCodeCounter++;
  const seq = String(_packageCodeCounter).padStart(6, '0');
  // Chinese domestic tracking numbers are typically 12-15 digits
  const trackingSeq = String(770_000_000_000 + _packageCodeCounter);

  return {
    id: generateId(),
    trackingNumber: trackingSeq,
    status: WarehouseCNStatus.RECEIVED,
    orderId: generateId(),
    cnWeight: null,
    vnWeight: null,
    declaredValue: null,
    createdAt: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Batch helpers
// ---------------------------------------------------------------------------

/**
 * Creates an array of N objects using the given factory.
 *
 * @example buildMany(buildOrder, 5, { serviceType: ServiceType.MHH })
 */
export function buildMany<T>(
  factory: (overrides?: Partial<T>) => T,
  count: number,
  overrides: Partial<T> = {},
): T[] {
  return Array.from({ length: count }, () => factory(overrides));
}
