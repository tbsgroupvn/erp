import { ApprovalType, UserRole } from '@prisma/client';

/**
 * Defines the required approval steps for each approval type.
 * Each step specifies the role that must approve at that level.
 * Steps are processed sequentially: step 1 must be approved before step 2, etc.
 */
export const APPROVAL_STEPS: Record<ApprovalType, UserRole[]> = {
  [ApprovalType.DISCOUNT]: [UserRole.SALES_LEADER, UserRole.CHIEF_ACCOUNTANT, UserRole.SALES_DIRECTOR],
  [ApprovalType.PAYMENT_VOUCHER]: [UserRole.CHIEF_ACCOUNTANT, UserRole.COO],
  [ApprovalType.RECEIPT_VOUCHER]: [UserRole.CHIEF_ACCOUNTANT],
  [ApprovalType.ORDER_CANCEL]: [UserRole.SALES_LEADER, UserRole.SALES_DIRECTOR],
  [ApprovalType.CREDIT_EXTENSION]: [UserRole.CHIEF_ACCOUNTANT, UserRole.COO, UserRole.CEO],
  [ApprovalType.DEPOSIT_EXEMPTION]: [UserRole.SALES_LEADER, UserRole.COO],
  [ApprovalType.CONTAINER_PLAN]: [UserRole.XNK_MANAGER],
  [ApprovalType.WAREHOUSE_RELEASE]: [UserRole.WAREHOUSE_VN_MANAGER, UserRole.CHIEF_ACCOUNTANT],
  [ApprovalType.LEAVE_REQUEST]: [],
  [ApprovalType.OVERTIME_REQUEST]: [],
  [ApprovalType.PURCHASE_ORDER]: [UserRole.XNK_MANAGER, UserRole.CHIEF_ACCOUNTANT],
  [ApprovalType.QUOTATION_SPECIAL]: [UserRole.SALES_LEADER, UserRole.SALES_DIRECTOR],
  [ApprovalType.EXPENSE_CLAIM]: [UserRole.CHIEF_ACCOUNTANT, UserRole.COO],
  [ApprovalType.SALARY_ADJUSTMENT]: [UserRole.CHIEF_ACCOUNTANT, UserRole.COO],
  [ApprovalType.CUSTOMS_DECLARATION]: [UserRole.XNK_MANAGER, UserRole.CHIEF_ACCOUNTANT],
  [ApprovalType.CUSTOM]: [],
  [ApprovalType.GRACE_PERIOD_REQUEST]: [UserRole.CHIEF_ACCOUNTANT, UserRole.COO],
  [ApprovalType.EXTRA_CHARGE_APPROVAL]: [UserRole.CHIEF_ACCOUNTANT, UserRole.COO],
  [ApprovalType.CREDIT_OVERDRAFT]: [UserRole.CHIEF_ACCOUNTANT, UserRole.COO],
  [ApprovalType.PROCUREMENT_PAYMENT]: [
    UserRole.SALES_LEADER,
    UserRole.CHIEF_ACCOUNTANT,
    UserRole.COO,
  ],
  [ApprovalType.RETURN_REQUEST]: [UserRole.COO],
};

/**
 * Vietnamese labels for each approval type.
 */
export const APPROVAL_TYPE_LABELS: Record<ApprovalType, string> = {
  [ApprovalType.DISCOUNT]: 'Phê duyệt giảm giá',
  [ApprovalType.PAYMENT_VOUCHER]: 'Phê duyệt phiếu chi',
  [ApprovalType.RECEIPT_VOUCHER]: 'Phê duyệt phiếu thu',
  [ApprovalType.ORDER_CANCEL]: 'Phê duyệt hủy đơn',
  [ApprovalType.CREDIT_EXTENSION]: 'Phê duyệt gia hạn công nợ',
  [ApprovalType.DEPOSIT_EXEMPTION]: 'Phê duyệt miễn/giảm cọc',
  [ApprovalType.CONTAINER_PLAN]: 'Phê duyệt kế hoạch container',
  [ApprovalType.WAREHOUSE_RELEASE]: 'Phê duyệt xuất kho',
  [ApprovalType.LEAVE_REQUEST]: 'Phê duyệt nghỉ phép',
  [ApprovalType.OVERTIME_REQUEST]: 'Phê duyệt tăng ca',
  [ApprovalType.PURCHASE_ORDER]: 'Phê duyệt mua hàng',
  [ApprovalType.QUOTATION_SPECIAL]: 'Phê duyệt báo giá đặc biệt',
  [ApprovalType.EXPENSE_CLAIM]: 'Phê duyệt hoàn ứng chi phí',
  [ApprovalType.SALARY_ADJUSTMENT]: 'Phê duyệt điều chỉnh lương',
  [ApprovalType.CUSTOMS_DECLARATION]: 'Phê duyệt tờ khai hải quan',
  [ApprovalType.CUSTOM]: 'Phê duyệt tùy chỉnh',
  [ApprovalType.GRACE_PERIOD_REQUEST]: 'Phê duyệt ân hạn',
  [ApprovalType.EXTRA_CHARGE_APPROVAL]: 'Phê duyệt phụ phí phát sinh',
  [ApprovalType.CREDIT_OVERDRAFT]: 'Phê duyệt thấu chi tạm thời',
  [ApprovalType.PROCUREMENT_PAYMENT]: 'Duyệt chi mua hàng NCC',
  [ApprovalType.RETURN_REQUEST]: 'Phê duyệt yêu cầu trả hàng',
};

/**
 * Returns the required approval steps (roles) for a given approval type.
 */
export function getApprovalSteps(type: ApprovalType): UserRole[] {
  return APPROVAL_STEPS[type] ?? [];
}

/**
 * Returns the total number of approval steps required for a given type.
 */
export function getTotalApprovalSteps(type: ApprovalType): number {
  return (APPROVAL_STEPS[type] ?? []).length;
}

/**
 * Returns the approver role required at a specific step (1-indexed).
 * Returns undefined if the step number is out of range.
 */
export function getApproverRoleAtStep(
  type: ApprovalType,
  stepNumber: number,
): UserRole | undefined {
  const steps = APPROVAL_STEPS[type];
  if (!steps || stepNumber < 1 || stepNumber > steps.length) {
    return undefined;
  }
  return steps[stepNumber - 1];
}

/**
 * Checks whether a given role can approve a specific step of an approval type.
 */
export function canApproveStep(type: ApprovalType, stepNumber: number, role: UserRole): boolean {
  const requiredRole = getApproverRoleAtStep(type, stepNumber);
  return requiredRole === role;
}
