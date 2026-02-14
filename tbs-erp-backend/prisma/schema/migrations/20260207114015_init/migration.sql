-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CEO', 'COO', 'SALES_DIRECTOR', 'SALES_LEADER', 'SALE', 'MARKETING_STAFF', 'CSKH', 'CHIEF_ACCOUNTANT', 'ACCOUNTANT_AR', 'ACCOUNTANT_COST', 'XNK_MANAGER', 'XNK_STAFF', 'WAREHOUSE_CN_AGENT', 'WAREHOUSE_VN_MANAGER', 'WAREHOUSE_VN_STAFF', 'DRIVER');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('VCT', 'MHH', 'UTXNK', 'LCLCN');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('CONSULTING', 'QUOTATION', 'PENDING_DEPOSIT', 'SOURCING', 'WAREHOUSE_CN', 'PACKING', 'CONSOLIDATION', 'IN_TRANSIT', 'CUSTOMS', 'WAREHOUSE_VN', 'DELIVERING', 'SETTLEMENT', 'COMPLETED', 'ON_HOLD', 'CANCELLED', 'RETURNED', 'ISSUE');

-- CreateEnum
CREATE TYPE "CustomerTier" AS ENUM ('NEW', 'REGULAR', 'VIP', 'STRATEGIC');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('WALLET', 'BANK_TRANSFER', 'CASH', 'COD', 'CREDIT');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('VND', 'CNY', 'USD');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApprovalType" AS ENUM ('DISCOUNT', 'PAYMENT_VOUCHER', 'RECEIPT_VOUCHER', 'ORDER_CANCEL', 'CREDIT_EXTENSION', 'DEPOSIT_EXEMPTION', 'CONTAINER_PLAN', 'WAREHOUSE_RELEASE');

-- CreateEnum
CREATE TYPE "ShippingRoute" AS ENUM ('SEA', 'ROAD', 'AIR');

-- CreateEnum
CREATE TYPE "Branch" AS ENUM ('HN', 'HCM');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('APP_PUSH', 'EMAIL', 'SMS', 'ZALO_ZNS');

-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CONVERTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ComplaintType" AS ENUM ('DAMAGE', 'MISSING', 'DELAY', 'QUALITY', 'OTHER');

-- CreateEnum
CREATE TYPE "ComplaintSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'PENDING_RESOLUTION', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ResolutionType" AS ENUM ('REFUND', 'REPLACEMENT', 'CREDIT', 'APOLOGY', 'NONE');

-- CreateEnum
CREATE TYPE "CostType" AS ENUM ('FREIGHT', 'CUSTOMS_DUTY', 'HANDLING', 'TRANSPORT_CN', 'TRANSPORT_VN', 'INSURANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('RECEIPT', 'ISSUE', 'ADJUSTMENT', 'TRANSFER');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('ANNUAL', 'SICK', 'PERSONAL', 'MATERNITY', 'OTHER');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MaintenanceType" AS ENUM ('ROUTINE', 'REPAIR', 'INSPECTION');

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('TRUCK', 'VAN', 'MOTORCYCLE');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'RETIRED');

-- CreateEnum
CREATE TYPE "DriverStatus" AS ENUM ('AVAILABLE', 'ON_DELIVERY', 'OFF_DUTY');

-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('CONTRACT', 'INVOICE', 'CUSTOMS', 'POD', 'PHOTO', 'OTHER');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'ORDERED', 'RECEIVED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'RESIGNED');

-- CreateEnum
CREATE TYPE "TrackingEventType" AS ENUM ('PICKED_UP', 'IN_WAREHOUSE_CN', 'PACKED', 'LOADED_CONTAINER', 'DEPARTED_CN', 'IN_TRANSIT', 'ARRIVED_PORT', 'CUSTOMS_CLEARANCE', 'CUSTOMS_RELEASED', 'IN_WAREHOUSE_VN', 'OUT_FOR_DELIVERY', 'DELIVERED');

-- CreateEnum
CREATE TYPE "NettingStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'EXECUTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CODStatus" AS ENUM ('PENDING', 'COLLECTED', 'REMITTED', 'RECONCILED', 'SHORTAGE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "branch" "Branch",
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_2fa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "reset_token" TEXT,
    "reset_token_expiry" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "leader_id" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "old_data" JSONB,
    "new_data" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaints" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "order_id" TEXT,
    "customer_id" TEXT NOT NULL,
    "package_id" TEXT,
    "type" "ComplaintType" NOT NULL,
    "severity" "ComplaintSeverity" NOT NULL,
    "status" "ComplaintStatus" NOT NULL DEFAULT 'OPEN',
    "description" TEXT NOT NULL,
    "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "handler_id" TEXT,
    "assigned_at" TIMESTAMP(3),
    "investigation_notes" JSONB,
    "resolution_type" "ResolutionType",
    "compensation_amount" DECIMAL(15,2),
    "resolution_notes" TEXT,
    "resolved_at" TIMESTAMP(3),
    "escalation_level" TEXT,
    "escalated_at" TIMESTAMP(3),
    "note" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "complaints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "containers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "shipping_route" "ShippingRoute" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNING',
    "origin" TEXT,
    "destination" TEXT,
    "carrier" TEXT,
    "booking_ref" TEXT,
    "seal_number" TEXT,
    "vessel_name" TEXT,
    "total_packages" INTEGER NOT NULL DEFAULT 0,
    "total_weight" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "max_capacity" DECIMAL(10,2),
    "fill_rate" DECIMAL(5,2),
    "estimated_departure_at" TIMESTAMP(3),
    "actual_departure_at" TIMESTAMP(3),
    "estimated_arrival_at" TIMESTAMP(3),
    "actual_arrival_at" TIMESTAMP(3),
    "customs_cleared_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "containers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "company_name" TEXT,
    "full_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT,
    "tax_code" TEXT,
    "tier" "CustomerTier" NOT NULL DEFAULT 'NEW',
    "credit_limit" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "current_debt" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "deposit_rate" INTEGER NOT NULL DEFAULT 100,
    "total_orders" INTEGER NOT NULL DEFAULT 0,
    "total_revenue" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "branch" "Branch",
    "sale_id" TEXT,
    "note" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "position" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "balance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "currency" "Currency" NOT NULL DEFAULT 'VND',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "type" TEXT NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_receivables" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "order_id" TEXT,
    "amount" DECIMAL(15,2) NOT NULL,
    "paid_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "currency" "Currency" NOT NULL DEFAULT 'VND',
    "due_date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "netted_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_receivables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_payables" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "vendor_id" TEXT,
    "vendor_name" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "paid_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "currency" "Currency" NOT NULL DEFAULT 'VND',
    "due_date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "netted_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_payables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_vouchers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'VND',
    "payment_method" "PaymentMethod" NOT NULL,
    "cost_type" TEXT NOT NULL,
    "beneficiary" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "is_flagged" BOOLEAN NOT NULL DEFAULT false,
    "flag_reason" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_transactions" (
    "id" TEXT NOT NULL,
    "voucher_id" TEXT,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'VND',
    "payment_method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "order_id" TEXT,
    "customer_id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'GTGT',
    "amount" DECIMAL(15,2) NOT NULL,
    "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0.1,
    "tax_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(15,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "issued_at" TIMESTAMP(3),
    "sent_to_tax_at" TIMESTAMP(3),
    "external_id" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" TEXT NOT NULL,
    "from" "Currency" NOT NULL,
    "to" "Currency" NOT NULL,
    "rate" DECIMAL(15,6) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'VIETCOMBANK',
    "date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debt_nettings" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "partner_id" TEXT NOT NULL,
    "partner_name" TEXT NOT NULL,
    "ar_amount" DECIMAL(15,2) NOT NULL,
    "ap_amount" DECIMAL(15,2) NOT NULL,
    "net_amount" DECIMAL(15,2) NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "note" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "debt_nettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChartOfAccount" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "parentCode" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChartOfAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "reference" TEXT,
    "periodYear" INTEGER NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "isPosted" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntryLine" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "debit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "credit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "description" TEXT,

    CONSTRAINT "JournalEntryLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionRule" (
    "id" TEXT NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "minProfit" DOUBLE PRECISION NOT NULL,
    "maxProfit" DOUBLE PRECISION NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionRecord" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "orderRevenue" DOUBLE PRECISION NOT NULL,
    "orderCost" DOUBLE PRECISION NOT NULL,
    "netProfit" DOUBLE PRECISION NOT NULL,
    "commissionRate" DOUBLE PRECISION NOT NULL,
    "commissionAmount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequest" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "vendorId" TEXT,
    "orderId" TEXT,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'DRAFT',
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" "Currency" NOT NULL DEFAULT 'VND',
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequestItem" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PurchaseRequestItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "prId" TEXT,
    "vendorId" TEXT NOT NULL,
    "orderId" TEXT,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'DRAFT',
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" "Currency" NOT NULL DEFAULT 'CNY',
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockItem" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "category" TEXT,
    "currentQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minLevel" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxLevel" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CODRecord" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "collectedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "CODStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMethod" TEXT,
    "driverId" TEXT NOT NULL,
    "collectedAt" TIMESTAMP(3),
    "remittedAt" TIMESTAMP(3),
    "shortage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CODRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "closed_periods" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "closed_by" TEXT NOT NULL,
    "closed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "closed_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debt_netting_items" (
    "id" TEXT NOT NULL,
    "netting_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "reference_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "debt_netting_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "userId" TEXT,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "departmentCode" TEXT NOT NULL,
    "positionTitle" TEXT NOT NULL,
    "branch" "Branch" NOT NULL,
    "managerId" TEXT,
    "joinDate" TIMESTAMP(3) NOT NULL,
    "salary" DOUBLE PRECISION,
    "bankAccount" TEXT,
    "bankName" TEXT,
    "taxCode" TEXT,
    "insuranceId" TEXT,
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "checkIn" TIMESTAMP(3),
    "checkOut" TIMESTAMP(3),
    "checkInLat" DOUBLE PRECISION,
    "checkInLng" DOUBLE PRECISION,
    "checkOutLat" DOUBLE PRECISION,
    "checkOutLng" DOUBLE PRECISION,
    "type" TEXT NOT NULL DEFAULT 'OFFICE',
    "workHours" DOUBLE PRECISION,
    "overtimeHours" DOUBLE PRECISION DEFAULT 0,
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" "LeaveType" NOT NULL,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "totalDays" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OvertimeRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "approverId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OvertimeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRecord" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "baseSalary" DOUBLE PRECISION NOT NULL,
    "overtimePay" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "allowances" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grossSalary" DOUBLE PRECISION NOT NULL,
    "taxDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "insuranceDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherDeductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netSalary" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "plate_number" TEXT NOT NULL,
    "type" "VehicleType" NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "year" INTEGER,
    "capacityKg" DOUBLE PRECISION,
    "volumeM3" DOUBLE PRECISION,
    "status" "VehicleStatus" NOT NULL DEFAULT 'ACTIVE',
    "branch" "Branch" NOT NULL,
    "insuranceExpiry" TIMESTAMP(3),
    "registrationExpiry" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Driver" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "licenseNumber" TEXT,
    "licenseExpiry" TIMESTAMP(3),
    "licenseType" TEXT,
    "vehicleId" TEXT,
    "branch" "Branch" NOT NULL,
    "status" "DriverStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deliveries" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "driver_id" TEXT,
    "vehicle_id" TEXT,
    "branch" "Branch" NOT NULL,
    "recipient_name" TEXT NOT NULL,
    "recipient_phone" TEXT NOT NULL,
    "delivery_address" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "scheduled_at" TIMESTAMP(3),
    "picked_up_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "pod_image_url" TEXT,
    "signature_url" TEXT,
    "cod_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "cod_collected" BOOLEAN NOT NULL DEFAULT false,
    "cod_collected_at" TIMESTAMP(3),
    "cod_receipt_url" TEXT,
    "fail_reason" TEXT,
    "note" TEXT,
    "dispatched_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleMaintenance" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "type" "MaintenanceType" NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "completedDate" TIMESTAMP(3),
    "cost" DOUBLE PRECISION,
    "notes" TEXT,
    "nextDueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleMaintenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FuelRecord" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "liters" DOUBLE PRECISION NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL,
    "odometer" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FuelRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operation_costs" (
    "id" TEXT NOT NULL,
    "container_id" TEXT NOT NULL,
    "cost_type" "CostType" NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'VND',
    "description" TEXT,
    "invoice_ref" TEXT,
    "estimated_amount" DECIMAL(15,2),
    "note" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operation_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_allocations" (
    "id" TEXT NOT NULL,
    "container_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'WEIGHT',
    "proportion" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "allocated_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cost_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "sale_id" TEXT NOT NULL,
    "service_type" "ServiceType" NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'CONSULTING',
    "branch" "Branch" NOT NULL,
    "total_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "currency" "Currency" NOT NULL DEFAULT 'VND',
    "deposit_required" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "deposit_paid" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "is_deposit_paid" BOOLEAN NOT NULL DEFAULT false,
    "discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "shipping_route" "ShippingRoute",
    "container_id" TEXT,
    "total_actual_weight" DECIMAL(10,2),
    "total_chargeable_weight" DECIMAL(10,2),
    "note" TEXT,
    "cancel_reason" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "product_url" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "currency" "Currency" NOT NULL DEFAULT 'CNY',
    "total_price" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_status_history" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "from_status" "OrderStatus",
    "to_status" "OrderStatus" NOT NULL,
    "changed_by" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pre_alerts" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "tracking_number" TEXT NOT NULL,
    "description" TEXT,
    "expected_pieces" INTEGER,
    "image_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "matched_package_id" TEXT,
    "order_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pre_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotations" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "service_type" "ServiceType" NOT NULL,
    "branch" "Branch" NOT NULL,
    "shipping_route" "ShippingRoute",
    "status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "subtotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "discount_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tax_rate" DECIMAL(5,4) NOT NULL DEFAULT 0.1,
    "tax_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "valid_until" TIMESTAMP(3),
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "rejected_by" TEXT,
    "rejected_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "converted_order_id" TEXT,
    "parent_quotation_id" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_items" (
    "id" TEXT NOT NULL,
    "quotation_id" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "product_url" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "total_price" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approvals" (
    "id" TEXT NOT NULL,
    "type" "ApprovalType" NOT NULL,
    "reference_id" TEXT NOT NULL,
    "reference_code" TEXT,
    "requested_by" TEXT NOT NULL,
    "request_data" JSONB,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "current_step" INTEGER NOT NULL DEFAULT 1,
    "total_steps" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_steps" (
    "id" TEXT NOT NULL,
    "approval_id" TEXT NOT NULL,
    "step_number" INTEGER NOT NULL,
    "approver_role" "UserRole" NOT NULL,
    "approver_id" TEXT,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "decided_at" TIMESTAMP(3),

    CONSTRAINT "approval_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'APP_PUSH',
    "type" TEXT,
    "reference_id" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "is_urgent" BOOLEAN NOT NULL DEFAULT false,
    "sent_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'APP_PUSH',
    "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "data" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "DocumentCategory" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "tags" TEXT[],
    "uploadedBy" TEXT NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assigneeId" TEXT NOT NULL,
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "dueDate" TIMESTAMP(3),
    "entityType" TEXT,
    "entityId" TEXT,
    "tags" TEXT[],
    "createdBy" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskComment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "country" TEXT NOT NULL DEFAULT 'CN',
    "paymentTerms" TEXT,
    "bankName" TEXT,
    "bankAccount" TEXT,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorRating" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "category" TEXT,
    "comment" TEXT,
    "orderId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracking_events" (
    "id" TEXT NOT NULL,
    "package_id" TEXT,
    "container_id" TEXT,
    "tracking_number" TEXT,
    "event_type" "TrackingEventType" NOT NULL,
    "location" TEXT,
    "description" TEXT,
    "carrier" TEXT,
    "event_timestamp" TIMESTAMP(3) NOT NULL,
    "source" TEXT,
    "raw_data" JSONB,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracking_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packages" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "tracking_number_cn" TEXT,
    "description" TEXT,
    "image_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "actual_weight" DECIMAL(10,2),
    "length" DECIMAL(10,2),
    "width" DECIMAL(10,2),
    "height" DECIMAL(10,2),
    "volumetric_weight" DECIMAL(10,2),
    "chargeable_weight" DECIMAL(10,2),
    "warehouse_cn_status" TEXT,
    "warehouse_vn_status" TEXT,
    "received_cn_at" TIMESTAMP(3),
    "received_cn_by" TEXT,
    "packed_at" TIMESTAMP(3),
    "received_vn_at" TIMESTAMP(3),
    "received_vn_by" TEXT,
    "delivered_at" TIMESTAMP(3),
    "container_id" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lost_and_found" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "tracking_number" TEXT,
    "description" TEXT,
    "image_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "weight" DECIMAL(10,2),
    "warehouse" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNIDENTIFIED',
    "claimed_by" TEXT,
    "claimed_at" TIMESTAMP(3),
    "received_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lost_and_found_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "complaints_code_key" ON "complaints"("code");

-- CreateIndex
CREATE INDEX "complaints_order_id_idx" ON "complaints"("order_id");

-- CreateIndex
CREATE INDEX "complaints_customer_id_idx" ON "complaints"("customer_id");

-- CreateIndex
CREATE INDEX "complaints_status_idx" ON "complaints"("status");

-- CreateIndex
CREATE INDEX "complaints_severity_idx" ON "complaints"("severity");

-- CreateIndex
CREATE INDEX "complaints_handler_id_idx" ON "complaints"("handler_id");

-- CreateIndex
CREATE UNIQUE INDEX "containers_code_key" ON "containers"("code");

-- CreateIndex
CREATE INDEX "containers_status_idx" ON "containers"("status");

-- CreateIndex
CREATE INDEX "containers_created_at_idx" ON "containers"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "customers_code_key" ON "customers"("code");

-- CreateIndex
CREATE INDEX "customers_sale_id_idx" ON "customers"("sale_id");

-- CreateIndex
CREATE INDEX "customers_tier_idx" ON "customers"("tier");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_customer_id_key" ON "wallets"("customer_id");

-- CreateIndex
CREATE INDEX "wallet_transactions_wallet_id_created_at_idx" ON "wallet_transactions"("wallet_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "account_receivables_code_key" ON "account_receivables"("code");

-- CreateIndex
CREATE INDEX "account_receivables_customer_id_status_idx" ON "account_receivables"("customer_id", "status");

-- CreateIndex
CREATE INDEX "account_receivables_due_date_idx" ON "account_receivables"("due_date");

-- CreateIndex
CREATE UNIQUE INDEX "account_payables_code_key" ON "account_payables"("code");

-- CreateIndex
CREATE INDEX "account_payables_vendor_id_status_idx" ON "account_payables"("vendor_id", "status");

-- CreateIndex
CREATE INDEX "account_payables_due_date_idx" ON "account_payables"("due_date");

-- CreateIndex
CREATE UNIQUE INDEX "payment_vouchers_code_key" ON "payment_vouchers"("code");

-- CreateIndex
CREATE INDEX "payment_vouchers_order_id_idx" ON "payment_vouchers"("order_id");

-- CreateIndex
CREATE INDEX "payment_vouchers_created_by_idx" ON "payment_vouchers"("created_by");

-- CreateIndex
CREATE INDEX "payment_vouchers_status_idx" ON "payment_vouchers"("status");

-- CreateIndex
CREATE INDEX "cash_transactions_created_at_idx" ON "cash_transactions"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_code_key" ON "invoices"("code");

-- CreateIndex
CREATE INDEX "invoices_order_id_idx" ON "invoices"("order_id");

-- CreateIndex
CREATE INDEX "invoices_customer_id_idx" ON "invoices"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rates_from_to_date_key" ON "exchange_rates"("from", "to", "date");

-- CreateIndex
CREATE UNIQUE INDEX "debt_nettings_code_key" ON "debt_nettings"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ChartOfAccount_code_key" ON "ChartOfAccount"("code");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_code_key" ON "JournalEntry"("code");

-- CreateIndex
CREATE INDEX "JournalEntry_periodYear_periodMonth_idx" ON "JournalEntry"("periodYear", "periodMonth");

-- CreateIndex
CREATE INDEX "JournalEntry_date_idx" ON "JournalEntry"("date");

-- CreateIndex
CREATE INDEX "JournalEntryLine_entryId_idx" ON "JournalEntryLine"("entryId");

-- CreateIndex
CREATE INDEX "JournalEntryLine_accountCode_idx" ON "JournalEntryLine"("accountCode");

-- CreateIndex
CREATE INDEX "CommissionRecord_orderId_idx" ON "CommissionRecord"("orderId");

-- CreateIndex
CREATE INDEX "CommissionRecord_saleId_idx" ON "CommissionRecord"("saleId");

-- CreateIndex
CREATE INDEX "CommissionRecord_status_idx" ON "CommissionRecord"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRequest_code_key" ON "PurchaseRequest"("code");

-- CreateIndex
CREATE INDEX "PurchaseRequest_status_idx" ON "PurchaseRequest"("status");

-- CreateIndex
CREATE INDEX "PurchaseRequest_vendorId_idx" ON "PurchaseRequest"("vendorId");

-- CreateIndex
CREATE INDEX "PurchaseRequestItem_requestId_idx" ON "PurchaseRequestItem"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_code_key" ON "PurchaseOrder"("code");

-- CreateIndex
CREATE INDEX "PurchaseOrder_vendorId_idx" ON "PurchaseOrder"("vendorId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_status_idx" ON "PurchaseOrder"("status");

-- CreateIndex
CREATE UNIQUE INDEX "StockItem_code_key" ON "StockItem"("code");

-- CreateIndex
CREATE INDEX "StockMovement_itemId_idx" ON "StockMovement"("itemId");

-- CreateIndex
CREATE INDEX "StockMovement_type_idx" ON "StockMovement"("type");

-- CreateIndex
CREATE INDEX "CODRecord_deliveryId_idx" ON "CODRecord"("deliveryId");

-- CreateIndex
CREATE INDEX "CODRecord_driverId_idx" ON "CODRecord"("driverId");

-- CreateIndex
CREATE INDEX "CODRecord_status_idx" ON "CODRecord"("status");

-- CreateIndex
CREATE UNIQUE INDEX "closed_periods_year_month_key" ON "closed_periods"("year", "month");

-- CreateIndex
CREATE INDEX "debt_netting_items_netting_id_idx" ON "debt_netting_items"("netting_id");

-- CreateIndex
CREATE UNIQUE INDEX "employees_code_key" ON "employees"("code");

-- CreateIndex
CREATE UNIQUE INDEX "employees_userId_key" ON "employees"("userId");

-- CreateIndex
CREATE INDEX "employees_departmentCode_idx" ON "employees"("departmentCode");

-- CreateIndex
CREATE INDEX "employees_branch_idx" ON "employees"("branch");

-- CreateIndex
CREATE INDEX "employees_status_idx" ON "employees"("status");

-- CreateIndex
CREATE INDEX "Attendance_employeeId_idx" ON "Attendance"("employeeId");

-- CreateIndex
CREATE INDEX "Attendance_date_idx" ON "Attendance"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_employeeId_date_key" ON "Attendance"("employeeId", "date");

-- CreateIndex
CREATE INDEX "LeaveRequest_employeeId_idx" ON "LeaveRequest"("employeeId");

-- CreateIndex
CREATE INDEX "LeaveRequest_status_idx" ON "LeaveRequest"("status");

-- CreateIndex
CREATE INDEX "OvertimeRequest_employeeId_idx" ON "OvertimeRequest"("employeeId");

-- CreateIndex
CREATE INDEX "OvertimeRequest_date_idx" ON "OvertimeRequest"("date");

-- CreateIndex
CREATE INDEX "PayrollRecord_employeeId_idx" ON "PayrollRecord"("employeeId");

-- CreateIndex
CREATE INDEX "PayrollRecord_month_year_idx" ON "PayrollRecord"("month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRecord_employeeId_month_year_key" ON "PayrollRecord"("employeeId", "month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_plate_number_key" ON "vehicles"("plate_number");

-- CreateIndex
CREATE INDEX "vehicles_status_idx" ON "vehicles"("status");

-- CreateIndex
CREATE INDEX "vehicles_branch_idx" ON "vehicles"("branch");

-- CreateIndex
CREATE INDEX "Driver_status_idx" ON "Driver"("status");

-- CreateIndex
CREATE INDEX "Driver_branch_idx" ON "Driver"("branch");

-- CreateIndex
CREATE UNIQUE INDEX "deliveries_code_key" ON "deliveries"("code");

-- CreateIndex
CREATE INDEX "deliveries_order_id_idx" ON "deliveries"("order_id");

-- CreateIndex
CREATE INDEX "deliveries_driver_id_idx" ON "deliveries"("driver_id");

-- CreateIndex
CREATE INDEX "deliveries_status_idx" ON "deliveries"("status");

-- CreateIndex
CREATE INDEX "deliveries_scheduled_at_idx" ON "deliveries"("scheduled_at");

-- CreateIndex
CREATE INDEX "VehicleMaintenance_vehicleId_idx" ON "VehicleMaintenance"("vehicleId");

-- CreateIndex
CREATE INDEX "FuelRecord_vehicleId_idx" ON "FuelRecord"("vehicleId");

-- CreateIndex
CREATE INDEX "FuelRecord_date_idx" ON "FuelRecord"("date");

-- CreateIndex
CREATE INDEX "operation_costs_container_id_idx" ON "operation_costs"("container_id");

-- CreateIndex
CREATE INDEX "operation_costs_cost_type_idx" ON "operation_costs"("cost_type");

-- CreateIndex
CREATE INDEX "cost_allocations_order_id_idx" ON "cost_allocations"("order_id");

-- CreateIndex
CREATE INDEX "cost_allocations_container_id_idx" ON "cost_allocations"("container_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_code_key" ON "orders"("code");

-- CreateIndex
CREATE INDEX "orders_customer_id_idx" ON "orders"("customer_id");

-- CreateIndex
CREATE INDEX "orders_sale_id_idx" ON "orders"("sale_id");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_created_at_idx" ON "orders"("created_at");

-- CreateIndex
CREATE INDEX "orders_container_id_idx" ON "orders"("container_id");

-- CreateIndex
CREATE INDEX "order_status_history_order_id_created_at_idx" ON "order_status_history"("order_id", "created_at");

-- CreateIndex
CREATE INDEX "pre_alerts_tracking_number_idx" ON "pre_alerts"("tracking_number");

-- CreateIndex
CREATE INDEX "pre_alerts_customer_id_idx" ON "pre_alerts"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "quotations_code_key" ON "quotations"("code");

-- CreateIndex
CREATE INDEX "quotations_customer_id_idx" ON "quotations"("customer_id");

-- CreateIndex
CREATE INDEX "quotations_status_idx" ON "quotations"("status");

-- CreateIndex
CREATE INDEX "quotations_created_by_idx" ON "quotations"("created_by");

-- CreateIndex
CREATE INDEX "quotations_parent_quotation_id_idx" ON "quotations"("parent_quotation_id");

-- CreateIndex
CREATE INDEX "quotation_items_quotation_id_idx" ON "quotation_items"("quotation_id");

-- CreateIndex
CREATE INDEX "approvals_type_status_idx" ON "approvals"("type", "status");

-- CreateIndex
CREATE INDEX "approvals_requested_by_idx" ON "approvals"("requested_by");

-- CreateIndex
CREATE INDEX "approvals_reference_id_idx" ON "approvals"("reference_id");

-- CreateIndex
CREATE UNIQUE INDEX "approval_steps_approval_id_step_number_key" ON "approval_steps"("approval_id", "step_number");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "NotificationRecord_userId_isRead_idx" ON "NotificationRecord"("userId", "isRead");

-- CreateIndex
CREATE INDEX "NotificationRecord_createdAt_idx" ON "NotificationRecord"("createdAt");

-- CreateIndex
CREATE INDEX "Document_entityType_entityId_idx" ON "Document"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Document_category_idx" ON "Document"("category");

-- CreateIndex
CREATE UNIQUE INDEX "Task_code_key" ON "Task"("code");

-- CreateIndex
CREATE INDEX "Task_assigneeId_idx" ON "Task"("assigneeId");

-- CreateIndex
CREATE INDEX "Task_status_idx" ON "Task"("status");

-- CreateIndex
CREATE INDEX "Task_dueDate_idx" ON "Task"("dueDate");

-- CreateIndex
CREATE INDEX "TaskComment_taskId_idx" ON "TaskComment"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_code_key" ON "Vendor"("code");

-- CreateIndex
CREATE INDEX "VendorRating_vendorId_idx" ON "VendorRating"("vendorId");

-- CreateIndex
CREATE INDEX "tracking_events_package_id_idx" ON "tracking_events"("package_id");

-- CreateIndex
CREATE INDEX "tracking_events_container_id_idx" ON "tracking_events"("container_id");

-- CreateIndex
CREATE INDEX "tracking_events_tracking_number_idx" ON "tracking_events"("tracking_number");

-- CreateIndex
CREATE INDEX "tracking_events_event_timestamp_idx" ON "tracking_events"("event_timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "packages_code_key" ON "packages"("code");

-- CreateIndex
CREATE INDEX "packages_order_id_idx" ON "packages"("order_id");

-- CreateIndex
CREATE INDEX "packages_tracking_number_cn_idx" ON "packages"("tracking_number_cn");

-- CreateIndex
CREATE INDEX "packages_container_id_idx" ON "packages"("container_id");

-- CreateIndex
CREATE UNIQUE INDEX "lost_and_found_code_key" ON "lost_and_found"("code");

-- CreateIndex
CREATE INDEX "lost_and_found_tracking_number_idx" ON "lost_and_found"("tracking_number");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_leader_id_fkey" FOREIGN KEY ("leader_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_handler_id_fkey" FOREIGN KEY ("handler_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_receivables" ADD CONSTRAINT "account_receivables_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_receivables" ADD CONSTRAINT "account_receivables_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_vouchers" ADD CONSTRAINT "payment_vouchers_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntryLine" ADD CONSTRAINT "JournalEntryLine_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntryLine" ADD CONSTRAINT "JournalEntryLine_accountCode_fkey" FOREIGN KEY ("accountCode") REFERENCES "ChartOfAccount"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionRecord" ADD CONSTRAINT "CommissionRecord_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionRecord" ADD CONSTRAINT "CommissionRecord_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequestItem" ADD CONSTRAINT "PurchaseRequestItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PurchaseRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvertimeRequest" ADD CONSTRAINT "OvertimeRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRecord" ADD CONSTRAINT "PayrollRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleMaintenance" ADD CONSTRAINT "VehicleMaintenance_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelRecord" ADD CONSTRAINT "FuelRecord_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operation_costs" ADD CONSTRAINT "operation_costs_container_id_fkey" FOREIGN KEY ("container_id") REFERENCES "containers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_allocations" ADD CONSTRAINT "cost_allocations_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_container_id_fkey" FOREIGN KEY ("container_id") REFERENCES "containers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_approval_id_fkey" FOREIGN KEY ("approval_id") REFERENCES "approvals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationRecord" ADD CONSTRAINT "NotificationRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorRating" ADD CONSTRAINT "VendorRating_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_events" ADD CONSTRAINT "tracking_events_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_events" ADD CONSTRAINT "tracking_events_container_id_fkey" FOREIGN KEY ("container_id") REFERENCES "containers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_container_id_fkey" FOREIGN KEY ("container_id") REFERENCES "containers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
