// Auth
export { useLogin, useLogout, useProfile, useChangePassword, authKeys } from './use-auth';

// Orders
export {
  useOrders,
  useOrder,
  useCreateOrder,
  useUpdateOrder,
  useChangeOrderStatus,
  useCancelOrder,
  orderKeys,
} from './use-orders';

// Customers
export {
  useCustomers,
  useCustomer,
  useCreateCustomer,
  useUpdateCustomer,
  useCustomerWallet,
  useTopupWallet,
  customerKeys,
} from './use-customers';

// Containers
export {
  useContainers,
  useContainer,
  useCreateContainer,
  useAddPackages,
  useUpdateContainerStatus,
  containerKeys,
} from './use-containers';

// Warehouse CN
export {
  useCnPackages,
  useCnPackage,
  useReceivePackage,
  useMeasurePackage,
  cnPackageKeys,
} from './use-warehouse-cn';

// Warehouse VN
export {
  useVnPackages,
  useReceiveFromContainer,
  useDispatchDelivery,
  useConfirmDelivery,
  useDeliveryPlan,
  vnPackageKeys,
} from './use-warehouse-vn';

// Finance
export {
  useReceivables,
  useReceivable,
  useRecordArPayment,
  usePayables,
  useRecordApPayment,
  useVouchers,
  useCreateVoucher,
  useApproveVoucher,
  useRejectVoucher,
  useInvoices,
  useCreateInvoice,
  financeKeys,
} from './use-finance';

// Approvals
export {
  useApprovals,
  useApproval,
  usePendingApprovals,
  useApproveApproval,
  useRejectApproval,
  approvalKeys,
} from './use-approvals';

// Dashboard
export {
  useDashboardOverview,
  useOrderStats,
  useFinanceStats,
  useWarehouseStats,
  dashboardKeys,
} from './use-dashboard';

// Employees
export {
  useEmployees,
  useEmployee,
  useCreateEmployee,
  useUpdateEmployee,
  employeeKeys,
} from './use-employees';

// Drivers
export {
  useDrivers,
  useDriver,
  useDriverDeliveries,
  useDriverPerformance,
  useCreateDriver,
  useUpdateDriver,
  useAssignVehicle,
  driverKeys,
} from './use-drivers';

// Tasks
export {
  useTasks,
  useTask,
  useMyTasks,
  useCreateTask,
  useUpdateTask,
  useChangeTaskStatus,
  useAddComment,
  taskKeys,
} from './use-tasks';

// Complaints
export {
  useComplaints,
  useComplaint,
  useComplaintStatistics,
  useCreateComplaint,
  useAssignComplaintHandler,
  useResolveComplaint,
  complaintKeys,
} from './use-complaints';

// Quotations
export {
  useQuotations,
  useQuotation,
  useCreateQuotation,
  useApproveQuotation,
  useRejectQuotation,
  useConvertQuotationToOrder,
  useDuplicateQuotation,
  quotationKeys,
} from './use-quotations';

// Documents
export {
  useDocuments,
  useDocument,
  useUploadDocument,
  useDeleteDocument,
  documentKeys,
} from './use-documents';

// Vendors
export {
  useVendors,
  useVendor,
  useCreateVendor,
  useUpdateVendor,
  useRateVendor,
  useToggleVendorApproval,
  vendorKeys,
} from './use-vendors';

// Purchases
export {
  usePurchaseRequests,
  usePurchaseRequest,
  usePurchaseOrders,
  usePurchaseOrder,
  useCreatePurchaseRequest,
  useApprovePurchaseRequest,
  useConvertToPO,
  useRecordReceipt,
  purchaseKeys,
} from './use-purchases';

// Fleet
export {
  useVehicles,
  useVehicle,
  useVehicleMaintenance,
  useVehicleFuelRecords,
  useCreateVehicle,
  useUpdateVehicle,
  useCreateMaintenance,
  useCreateFuelRecord,
  fleetKeys,
} from './use-fleet';

// Tracking
export {
  useTracking,
  useContainerTracking,
  trackingKeys,
} from './use-tracking';

// Payroll
export {
  usePayrollList,
  usePayrollSummary,
  useCalculatePayroll,
  useApprovePayroll,
  payrollKeys,
} from './use-payroll';

// Inventory
export {
  useCurrentStock,
  useStockItem,
  useLowStockAlerts,
  useCreateStockItem,
  useCreateStockMovement,
  inventoryKeys,
} from './use-inventory';

// Utilities
export { useDebounce } from './use-debounce';
export { usePagination } from './use-pagination';
export type { UsePaginationReturn } from './use-pagination';
