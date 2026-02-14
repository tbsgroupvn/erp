import {
  ApprovalStatus,
  ApprovalType,
  Branch,
  ClearanceType,
  ComplaintSeverity,
  ComplaintStatus,
  ComplaintType,
  Currency,
  CustomerTier,
  DocumentCategory,
  DriverStatus,
  EmployeeStatus,
  LeaveStatus,
  LeaveType,
  MasterOrderStatus,
  OrderStatus,
  ResolutionType,
  PaymentMethod,
  PurchaseStatus,
  QuotationStatus,
  ServiceType,
  ShippingRoute,
  StockMovementType,
  TaskPriority,
  TaskStatus,
  TrackingEventType,
  UserRole,
  VehicleStatus,
  VehicleType,
} from '@/lib/types/enums';

// ============================================
// ORDER STATUS
// ============================================

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  [OrderStatus.CONSULTING]: 'Tiếp nhận',
  [OrderStatus.QUOTATION]: 'Báo giá',
  [OrderStatus.PENDING_DEPOSIT]: 'Chờ cọc',
  [OrderStatus.SOURCING]: 'Mua hàng',
  [OrderStatus.WAREHOUSE_CN]: 'Kho TQ',
  [OrderStatus.PACKING]: 'Đóng gói',
  [OrderStatus.CONSOLIDATION]: 'Ghép cont',
  [OrderStatus.IN_TRANSIT]: 'Vận chuyển',
  [OrderStatus.CUSTOMS]: 'Thông quan',
  [OrderStatus.WAREHOUSE_VN]: 'Kho VN',
  [OrderStatus.DELIVERING]: 'Giao hàng',
  [OrderStatus.SETTLEMENT]: 'Quyết toán',
  [OrderStatus.COMPLETED]: 'Hoàn thành',
  [OrderStatus.ON_HOLD]: 'Tạm giữ',
  [OrderStatus.CANCELLED]: 'Đã hủy',
  [OrderStatus.RETURNED]: 'Trả hàng',
  [OrderStatus.ISSUE]: 'Có vấn đề',
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  [OrderStatus.CONSULTING]: 'bg-slate-100 text-slate-700',
  [OrderStatus.QUOTATION]: 'bg-blue-100 text-blue-700',
  [OrderStatus.PENDING_DEPOSIT]: 'bg-amber-100 text-amber-700',
  [OrderStatus.SOURCING]: 'bg-indigo-100 text-indigo-700',
  [OrderStatus.WAREHOUSE_CN]: 'bg-purple-100 text-purple-700',
  [OrderStatus.PACKING]: 'bg-violet-100 text-violet-700',
  [OrderStatus.CONSOLIDATION]: 'bg-fuchsia-100 text-fuchsia-700',
  [OrderStatus.IN_TRANSIT]: 'bg-cyan-100 text-cyan-700',
  [OrderStatus.CUSTOMS]: 'bg-teal-100 text-teal-700',
  [OrderStatus.WAREHOUSE_VN]: 'bg-emerald-100 text-emerald-700',
  [OrderStatus.DELIVERING]: 'bg-sky-100 text-sky-700',
  [OrderStatus.SETTLEMENT]: 'bg-orange-100 text-orange-700',
  [OrderStatus.COMPLETED]: 'bg-green-100 text-green-700',
  [OrderStatus.ON_HOLD]: 'bg-yellow-100 text-yellow-800',
  [OrderStatus.CANCELLED]: 'bg-red-100 text-red-700',
  [OrderStatus.RETURNED]: 'bg-rose-100 text-rose-700',
  [OrderStatus.ISSUE]: 'bg-destructive/10 text-destructive',
};

// ============================================
// MASTER ORDER STATUS
// ============================================

export const MASTER_ORDER_STATUS_LABELS: Record<MasterOrderStatus, string> = {
  [MasterOrderStatus.ACTIVE]: 'Đang xử lý',
  [MasterOrderStatus.COMPLETED]: 'Hoàn thành',
  [MasterOrderStatus.CANCELLED]: 'Đã hủy',
};

export const MASTER_ORDER_STATUS_COLORS: Record<MasterOrderStatus, string> = {
  [MasterOrderStatus.ACTIVE]: 'bg-blue-100 text-blue-700',
  [MasterOrderStatus.COMPLETED]: 'bg-green-100 text-green-700',
  [MasterOrderStatus.CANCELLED]: 'bg-red-100 text-red-700',
};

// ============================================
// CLEARANCE TYPE
// ============================================

export const CLEARANCE_TYPE_LABELS: Record<ClearanceType, string> = {
  [ClearanceType.CHINH_NGACH]: 'Chính ngạch',
  [ClearanceType.TIEU_NGACH]: 'Tiểu ngạch',
};

export const CLEARANCE_TYPE_COLORS: Record<ClearanceType, string> = {
  [ClearanceType.CHINH_NGACH]: 'bg-blue-100 text-blue-700',
  [ClearanceType.TIEU_NGACH]: 'bg-orange-100 text-orange-700',
};

// ============================================
// SERVICE TYPE
// ============================================

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  [ServiceType.VCT]: 'Vận chuyển thuần',
  [ServiceType.MHH]: 'Mua hàng hộ',
  [ServiceType.UTXNK]: 'Ủy thác XNK',
  [ServiceType.LCLCN]: 'LCL chính ngạch',
};

export const SERVICE_TYPE_DESCRIPTIONS: Record<ServiceType, string> = {
  [ServiceType.VCT]: 'Khách tự mua hàng, TBS vận chuyển từ TQ về VN',
  [ServiceType.MHH]: 'TBS mua hàng hộ và vận chuyển về VN',
  [ServiceType.UTXNK]: 'Ủy thác xuất nhập khẩu chính ngạch',
  [ServiceType.LCLCN]: 'Hàng lẻ (LCL) nhập chính ngạch',
};

// ============================================
// CUSTOMER TIER
// ============================================

export const CUSTOMER_TIER_LABELS: Record<CustomerTier, string> = {
  [CustomerTier.NEW]: 'Khách mới',
  [CustomerTier.REGULAR]: 'Khách thường',
  [CustomerTier.VIP]: 'VIP',
  [CustomerTier.STRATEGIC]: 'Chiến lược',
};

export const CUSTOMER_TIER_COLORS: Record<CustomerTier, string> = {
  [CustomerTier.NEW]: 'bg-slate-100 text-slate-700',
  [CustomerTier.REGULAR]: 'bg-blue-100 text-blue-700',
  [CustomerTier.VIP]: 'bg-amber-100 text-amber-700',
  [CustomerTier.STRATEGIC]: 'bg-emerald-100 text-emerald-700',
};

// ============================================
// APPROVAL STATUS
// ============================================

export const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  [ApprovalStatus.PENDING]: 'Chờ duyệt',
  [ApprovalStatus.APPROVED]: 'Đã duyệt',
  [ApprovalStatus.REJECTED]: 'Từ chối',
  [ApprovalStatus.CANCELLED]: 'Đã hủy',
  [ApprovalStatus.RETURNED]: 'Trả lại',
  [ApprovalStatus.WITHDRAWN]: 'Đã rút',
};

export const APPROVAL_STATUS_COLORS: Record<ApprovalStatus, string> = {
  [ApprovalStatus.PENDING]: 'bg-yellow-100 text-yellow-800',
  [ApprovalStatus.APPROVED]: 'bg-green-100 text-green-700',
  [ApprovalStatus.REJECTED]: 'bg-red-100 text-red-700',
  [ApprovalStatus.CANCELLED]: 'bg-slate-100 text-slate-500',
  [ApprovalStatus.RETURNED]: 'bg-orange-100 text-orange-700',
  [ApprovalStatus.WITHDRAWN]: 'bg-gray-100 text-gray-600',
};

// ============================================
// APPROVAL TYPE
// ============================================

export const APPROVAL_TYPE_LABELS: Record<ApprovalType, string> = {
  [ApprovalType.DISCOUNT]: 'Giảm giá',
  [ApprovalType.PAYMENT_VOUCHER]: 'Phiếu chi',
  [ApprovalType.RECEIPT_VOUCHER]: 'Phiếu thu',
  [ApprovalType.ORDER_CANCEL]: 'Hủy đơn',
  [ApprovalType.CREDIT_EXTENSION]: 'Gia hạn công nợ',
  [ApprovalType.DEPOSIT_EXEMPTION]: 'Miễn/giảm cọc',
  [ApprovalType.CONTAINER_PLAN]: 'Kế hoạch container',
  [ApprovalType.WAREHOUSE_RELEASE]: 'Xuất kho',
  [ApprovalType.LEAVE_REQUEST]: 'Nghỉ phép',
  [ApprovalType.OVERTIME_REQUEST]: 'Tăng ca',
  [ApprovalType.PURCHASE_ORDER]: 'Mua hàng',
  [ApprovalType.QUOTATION_SPECIAL]: 'Báo giá đặc biệt',
  [ApprovalType.EXPENSE_CLAIM]: 'Hoàn ứng chi phí',
  [ApprovalType.SALARY_ADJUSTMENT]: 'Điều chỉnh lương',
  [ApprovalType.CUSTOM]: 'Tùy chỉnh',
};

// ============================================
// USER ROLE
// ============================================

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.CEO]: 'Tổng Giám đốc',
  [UserRole.COO]: 'Giám đốc Điều hành',
  [UserRole.SALES_DIRECTOR]: 'Giám đốc Kinh doanh',
  [UserRole.SALES_LEADER]: 'Trưởng nhóm Kinh doanh',
  [UserRole.SALE]: 'Nhân viên Kinh doanh',
  [UserRole.MARKETING_STAFF]: 'Nhân viên Marketing',
  [UserRole.CSKH]: 'Chăm sóc Khách hàng',
  [UserRole.CHIEF_ACCOUNTANT]: 'Kế toán Trưởng',
  [UserRole.ACCOUNTANT_AR]: 'Kế toán Thanh toán',
  [UserRole.ACCOUNTANT_COST]: 'Kế toán Chi phí',
  [UserRole.XNK_MANAGER]: 'Trưởng phòng XNK',
  [UserRole.XNK_STAFF]: 'Nhân viên XNK',
  [UserRole.WAREHOUSE_CN_AGENT]: 'Agent kho Trung Quốc',
  [UserRole.WAREHOUSE_VN_MANAGER]: 'Trưởng kho Việt Nam',
  [UserRole.WAREHOUSE_VN_STAFF]: 'Nhân viên kho Việt Nam',
  [UserRole.DRIVER]: 'Tài xế',
};

// ============================================
// BRANCH
// ============================================

export const BRANCH_LABELS: Record<Branch, string> = {
  [Branch.HN]: 'Hà Nội',
  [Branch.HCM]: 'Hồ Chí Minh',
};

// ============================================
// SHIPPING ROUTE
// ============================================

export const SHIPPING_ROUTE_LABELS: Record<ShippingRoute, string> = {
  [ShippingRoute.SEA]: 'Đường biển',
  [ShippingRoute.ROAD]: 'Đường bộ',
  [ShippingRoute.AIR]: 'Đường hàng không',
};

// ============================================
// PAYMENT METHOD
// ============================================

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  [PaymentMethod.WALLET]: 'Ví điện tử',
  [PaymentMethod.BANK_TRANSFER]: 'Chuyển khoản',
  [PaymentMethod.CASH]: 'Tiền mặt',
  [PaymentMethod.COD]: 'Thu hộ (COD)',
  [PaymentMethod.CREDIT]: 'Công nợ',
};

// ============================================
// CURRENCY SYMBOLS
// ============================================

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  [Currency.VND]: '₫',
  [Currency.CNY]: '¥',
  [Currency.USD]: '$',
};

// ============================================
// QUOTATION STATUS
// ============================================

export const QUOTATION_STATUS_LABELS: Record<QuotationStatus, string> = {
  [QuotationStatus.DRAFT]: 'Nháp',
  [QuotationStatus.PENDING_APPROVAL]: 'Chờ duyệt',
  [QuotationStatus.APPROVED]: 'Đã duyệt',
  [QuotationStatus.REJECTED]: 'Từ chối',
  [QuotationStatus.CONVERTED]: 'Đã chuyển đơn',
  [QuotationStatus.EXPIRED]: 'Hết hạn',
};

export const QUOTATION_STATUS_COLORS: Record<QuotationStatus, string> = {
  [QuotationStatus.DRAFT]: 'bg-gray-100 text-gray-700',
  [QuotationStatus.PENDING_APPROVAL]: 'bg-yellow-100 text-yellow-700',
  [QuotationStatus.APPROVED]: 'bg-green-100 text-green-700',
  [QuotationStatus.REJECTED]: 'bg-red-100 text-red-700',
  [QuotationStatus.CONVERTED]: 'bg-blue-100 text-blue-700',
  [QuotationStatus.EXPIRED]: 'bg-gray-100 text-gray-500',
};

// ============================================
// COMPLAINT
// ============================================

export const COMPLAINT_TYPE_LABELS: Record<ComplaintType, string> = {
  [ComplaintType.DAMAGE]: 'Hư hỏng',
  [ComplaintType.MISSING]: 'Thiếu hàng',
  [ComplaintType.DELAY]: 'Chậm trễ',
  [ComplaintType.QUALITY]: 'Chất lượng',
  [ComplaintType.OTHER]: 'Khác',
};

export const COMPLAINT_SEVERITY_LABELS: Record<ComplaintSeverity, string> = {
  [ComplaintSeverity.LOW]: 'Thấp',
  [ComplaintSeverity.MEDIUM]: 'Trung bình',
  [ComplaintSeverity.HIGH]: 'Cao',
  [ComplaintSeverity.CRITICAL]: 'Nghiêm trọng',
};

export const COMPLAINT_SEVERITY_COLORS: Record<ComplaintSeverity, string> = {
  [ComplaintSeverity.LOW]: 'bg-gray-100 text-gray-700',
  [ComplaintSeverity.MEDIUM]: 'bg-yellow-100 text-yellow-700',
  [ComplaintSeverity.HIGH]: 'bg-orange-100 text-orange-700',
  [ComplaintSeverity.CRITICAL]: 'bg-red-100 text-red-700',
};

export const COMPLAINT_STATUS_LABELS: Record<ComplaintStatus, string> = {
  [ComplaintStatus.OPEN]: 'Mở',
  [ComplaintStatus.INVESTIGATING]: 'Đang điều tra',
  [ComplaintStatus.PENDING_RESOLUTION]: 'Chờ giải quyết',
  [ComplaintStatus.RESOLVED]: 'Đã giải quyết',
  [ComplaintStatus.CLOSED]: 'Đã đóng',
};

export const COMPLAINT_STATUS_COLORS: Record<ComplaintStatus, string> = {
  [ComplaintStatus.OPEN]: 'bg-blue-100 text-blue-700',
  [ComplaintStatus.INVESTIGATING]: 'bg-yellow-100 text-yellow-700',
  [ComplaintStatus.PENDING_RESOLUTION]: 'bg-orange-100 text-orange-700',
  [ComplaintStatus.RESOLVED]: 'bg-green-100 text-green-700',
  [ComplaintStatus.CLOSED]: 'bg-gray-100 text-gray-500',
};

// ============================================
// TASK
// ============================================

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  [TaskStatus.OPEN]: 'Mở',
  [TaskStatus.IN_PROGRESS]: 'Đang làm',
  [TaskStatus.COMPLETED]: 'Hoàn thành',
  [TaskStatus.CANCELLED]: 'Đã hủy',
};

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  [TaskStatus.OPEN]: 'bg-blue-100 text-blue-700',
  [TaskStatus.IN_PROGRESS]: 'bg-yellow-100 text-yellow-700',
  [TaskStatus.COMPLETED]: 'bg-green-100 text-green-700',
  [TaskStatus.CANCELLED]: 'bg-gray-100 text-gray-500',
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  [TaskPriority.LOW]: 'Thấp',
  [TaskPriority.MEDIUM]: 'Trung bình',
  [TaskPriority.HIGH]: 'Cao',
  [TaskPriority.URGENT]: 'Khẩn cấp',
};

export const TASK_PRIORITY_COLORS: Record<TaskPriority, string> = {
  [TaskPriority.LOW]: 'bg-gray-100 text-gray-700',
  [TaskPriority.MEDIUM]: 'bg-blue-100 text-blue-700',
  [TaskPriority.HIGH]: 'bg-orange-100 text-orange-700',
  [TaskPriority.URGENT]: 'bg-red-100 text-red-700',
};

// ============================================
// EMPLOYEE STATUS
// ============================================

export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  [EmployeeStatus.ACTIVE]: 'Đang làm',
  [EmployeeStatus.INACTIVE]: 'Tạm nghỉ',
  [EmployeeStatus.RESIGNED]: 'Đã nghỉ',
};

export const EMPLOYEE_STATUS_COLORS: Record<EmployeeStatus, string> = {
  [EmployeeStatus.ACTIVE]: 'bg-green-100 text-green-700',
  [EmployeeStatus.INACTIVE]: 'bg-yellow-100 text-yellow-700',
  [EmployeeStatus.RESIGNED]: 'bg-gray-100 text-gray-500',
};

// ============================================
// DRIVER STATUS
// ============================================

export const DRIVER_STATUS_LABELS: Record<DriverStatus, string> = {
  [DriverStatus.AVAILABLE]: 'Sẵn sàng',
  [DriverStatus.ON_DELIVERY]: 'Đang giao',
  [DriverStatus.OFF_DUTY]: 'Nghỉ',
};

export const DRIVER_STATUS_COLORS: Record<DriverStatus, string> = {
  [DriverStatus.AVAILABLE]: 'bg-green-100 text-green-700',
  [DriverStatus.ON_DELIVERY]: 'bg-blue-100 text-blue-700',
  [DriverStatus.OFF_DUTY]: 'bg-gray-100 text-gray-500',
};

// ============================================
// VEHICLE
// ============================================

export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  [VehicleType.TRUCK]: 'Xe tải',
  [VehicleType.VAN]: 'Xe van',
  [VehicleType.MOTORCYCLE]: 'Xe máy',
};

export const VEHICLE_STATUS_LABELS: Record<VehicleStatus, string> = {
  [VehicleStatus.ACTIVE]: 'Hoạt động',
  [VehicleStatus.MAINTENANCE]: 'Bảo dưỡng',
  [VehicleStatus.RETIRED]: 'Đã thanh lý',
};

export const VEHICLE_STATUS_COLORS: Record<VehicleStatus, string> = {
  [VehicleStatus.ACTIVE]: 'bg-green-100 text-green-700',
  [VehicleStatus.MAINTENANCE]: 'bg-yellow-100 text-yellow-700',
  [VehicleStatus.RETIRED]: 'bg-gray-100 text-gray-500',
};

// ============================================
// DOCUMENT CATEGORY
// ============================================

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  [DocumentCategory.CONTRACT]: 'Hợp đồng',
  [DocumentCategory.INVOICE]: 'Hóa đơn',
  [DocumentCategory.CUSTOMS]: 'Hải quan',
  [DocumentCategory.POD]: 'Biên nhận giao',
  [DocumentCategory.PHOTO]: 'Ảnh',
  [DocumentCategory.OTHER]: 'Khác',
};

// ============================================
// PURCHASE STATUS
// ============================================

export const PURCHASE_STATUS_LABELS: Record<PurchaseStatus, string> = {
  [PurchaseStatus.DRAFT]: 'Nháp',
  [PurchaseStatus.SUBMITTED]: 'Đã gửi',
  [PurchaseStatus.APPROVED]: 'Đã duyệt',
  [PurchaseStatus.ORDERED]: 'Đã đặt',
  [PurchaseStatus.RECEIVED]: 'Đã nhận',
  [PurchaseStatus.CLOSED]: 'Đã đóng',
  [PurchaseStatus.CANCELLED]: 'Đã hủy',
};

export const PURCHASE_STATUS_COLORS: Record<PurchaseStatus, string> = {
  [PurchaseStatus.DRAFT]: 'bg-gray-100 text-gray-700',
  [PurchaseStatus.SUBMITTED]: 'bg-blue-100 text-blue-700',
  [PurchaseStatus.APPROVED]: 'bg-green-100 text-green-700',
  [PurchaseStatus.ORDERED]: 'bg-purple-100 text-purple-700',
  [PurchaseStatus.RECEIVED]: 'bg-teal-100 text-teal-700',
  [PurchaseStatus.CLOSED]: 'bg-gray-100 text-gray-500',
  [PurchaseStatus.CANCELLED]: 'bg-red-100 text-red-500',
};

// ============================================
// STOCK MOVEMENT
// ============================================

export const STOCK_MOVEMENT_LABELS: Record<StockMovementType, string> = {
  [StockMovementType.RECEIPT]: 'Nhập kho',
  [StockMovementType.ISSUE]: 'Xuất kho',
  [StockMovementType.ADJUSTMENT]: 'Điều chỉnh',
  [StockMovementType.TRANSFER]: 'Chuyển kho',
};

// ============================================
// LEAVE
// ============================================

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  [LeaveType.ANNUAL]: 'Phép năm',
  [LeaveType.SICK]: 'Ốm',
  [LeaveType.PERSONAL]: 'Việc riêng',
  [LeaveType.MATERNITY]: 'Thai sản',
  [LeaveType.OTHER]: 'Khác',
};

export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  [LeaveStatus.PENDING]: 'Chờ duyệt',
  [LeaveStatus.APPROVED]: 'Đã duyệt',
  [LeaveStatus.REJECTED]: 'Từ chối',
  [LeaveStatus.CANCELLED]: 'Đã hủy',
};

// ============================================
// TRACKING EVENT
// ============================================

// ============================================
// RESOLUTION TYPE
// ============================================

export const RESOLUTION_TYPE_LABELS: Record<ResolutionType, string> = {
  [ResolutionType.REFUND]: 'Hoàn tiền',
  [ResolutionType.REPLACEMENT]: 'Đổi hàng',
  [ResolutionType.CREDIT]: 'Ghi có',
  [ResolutionType.APOLOGY]: 'Xin lỗi',
  [ResolutionType.NONE]: 'Không',
};

export const TRACKING_EVENT_LABELS: Record<TrackingEventType, string> = {
  [TrackingEventType.PICKED_UP]: 'Đã lấy hàng',
  [TrackingEventType.IN_WAREHOUSE_CN]: 'Tại kho TQ',
  [TrackingEventType.PACKED]: 'Đã đóng gói',
  [TrackingEventType.LOADED_CONTAINER]: 'Đã lên cont',
  [TrackingEventType.DEPARTED_CN]: 'Xuất phát TQ',
  [TrackingEventType.IN_TRANSIT]: 'Đang vận chuyển',
  [TrackingEventType.ARRIVED_PORT]: 'Đến cảng',
  [TrackingEventType.CUSTOMS_CLEARANCE]: 'Thông quan',
  [TrackingEventType.CUSTOMS_RELEASED]: 'Đã thông quan',
  [TrackingEventType.IN_WAREHOUSE_VN]: 'Tại kho VN',
  [TrackingEventType.OUT_FOR_DELIVERY]: 'Đang giao',
  [TrackingEventType.DELIVERED]: 'Đã giao',
};

// ============================================
// ROLE_LABELS (alias for USER_ROLE_LABELS)
// ============================================
export const ROLE_LABELS: Record<UserRole, string> = USER_ROLE_LABELS;

// ============================================
// PATH LABELS (for breadcrumb segments)
// ============================================
export const PATH_LABELS: Record<string, string> = {
  'tong-quan': 'Tổng quan',
  'don-hang': 'Đơn hàng',
  'bao-gia': 'Báo giá',
  'khach-hang': 'Khách hàng',
  'tai-chinh': 'Tài chính',
  'cong-no-phai-thu': 'Công nợ phải thu',
  'cong-no-phai-tra': 'Công nợ phải trả',
  'phieu-thu-chi': 'Phiếu thu chi',
  'hoa-don': 'Hóa đơn',
  'kho-trung-quoc': 'Kho Trung Quốc',
  'kho-viet-nam': 'Kho Việt Nam',
  container: 'Container',
  'giao-hang': 'Giao hàng',
  'theo-doi': 'Theo dõi',
  'phuong-tien': 'Phương tiện',
  'tai-xe': 'Tài xế',
  'mua-hang': 'Mua hàng',
  'nha-cung-cap': 'Nhà cung cấp',
  'kho-vat-tu': 'Kho vật tư',
  'nhan-su': 'Nhân sự',
  luong: 'Bảng lương',
  'cong-viec': 'Công việc',
  'khieu-nai': 'Khiếu nại',
  'tai-lieu': 'Tài liệu',
  'phe-duyet': 'Phê duyệt',
  'quy-trinh-phe-duyet': 'Quy trình phê duyệt',
  'cai-dat': 'Cài đặt',
  'bao-cao': 'Báo cáo',
  'cham-cong': 'Chấm công',
  'thong-bao': 'Thông báo',
  'uy-quyen': 'Ủy quyền',
  'quan-ly-user': 'Quản lý user',
  'tao-moi': 'Tạo mới',
  'nhap-excel': 'Nhập từ Excel',
  'ho-so': 'Hồ sơ',
  'doi-mat-khau': 'Đổi mật khẩu',
};
