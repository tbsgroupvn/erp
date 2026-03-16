import { apiClient } from './client';
import type { BaseResponse, PaginatedResponse } from '@/lib/types';

// ============================================
// CONSTANTS
// ============================================

export const EXPENSE_CATEGORIES: Record<string, string> = {
  TRAVEL: 'Đi lại',
  MEAL: 'Ăn uống',
  TRANSPORT: 'Vận chuyển',
  OFFICE: 'Văn phòng phẩm',
  PHONE: 'Điện thoại',
  OTHER: 'Khác',
};

export const EXPENSE_STATUS: Record<string, string> = {
  DRAFT: 'Nháp',
  SUBMITTED: 'Đã gửi',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
  PAID: 'Đã chi',
};

export const EXPENSE_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SUBMITTED: 'bg-blue-100 text-blue-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  PAID: 'bg-purple-100 text-purple-700',
};

// ============================================
// TYPES
// ============================================

export interface ExpenseItem {
  id: string;
  expenseClaimId: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  receiptUrl: string | null;
  createdAt: string;
}

export interface ExpenseClaim {
  id: string;
  code: string;
  employeeId: string;
  title: string;
  description: string | null;
  totalAmount: number;
  currency: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'PAID';
  submittedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  paidAt: string | null;
  items: ExpenseItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseStats {
  draft: { count: number; totalAmount: number };
  submitted: { count: number; totalAmount: number };
  approved: { count: number; totalAmount: number };
  rejected: { count: number; totalAmount: number };
  paid: { count: number; totalAmount: number };
}

export interface CreateExpenseItemDto {
  category: string;
  description: string;
  amount: number;
  date: string;
  receiptUrl?: string;
}

export interface CreateExpenseDto {
  title: string;
  description?: string;
  currency?: string;
  items?: CreateExpenseItemDto[];
}

export interface UpdateExpenseDto {
  title?: string;
  description?: string;
  currency?: string;
}

export interface ExpenseQueryParams {
  page?: number;
  limit?: number;
  status?: string;
  employeeId?: string;
  dateFrom?: string;
  dateTo?: string;
}

// ============================================
// API
// ============================================

export const expenseApi = {
  /** POST /expenses — tạo đề nghị chi phí */
  create: (data: CreateExpenseDto) =>
    apiClient
      .post<BaseResponse<ExpenseClaim>>('/expenses', data)
      .then((r) => r.data.data),

  /** GET /expenses — danh sách tất cả (HR/Finance) */
  list: (params?: ExpenseQueryParams) =>
    apiClient
      .get<BaseResponse<{ items: ExpenseClaim[]; total: number; page: number; limit: number; totalPages: number }>>('/expenses', { params })
      .then((r) => r.data.data),

  /** GET /expenses/my — đề nghị của tôi */
  listMy: (params?: ExpenseQueryParams) =>
    apiClient
      .get<BaseResponse<{ items: ExpenseClaim[]; total: number; page: number; limit: number; totalPages: number }>>('/expenses/my', { params })
      .then((r) => r.data.data),

  /** GET /expenses/stats */
  getStats: () =>
    apiClient
      .get<BaseResponse<ExpenseStats>>('/expenses/stats')
      .then((r) => r.data.data),

  /** GET /expenses/:id */
  getById: (id: string) =>
    apiClient
      .get<BaseResponse<ExpenseClaim>>(`/expenses/${encodeURIComponent(id)}`)
      .then((r) => r.data.data),

  /** PATCH /expenses/:id */
  update: (id: string, data: UpdateExpenseDto) =>
    apiClient
      .patch<BaseResponse<ExpenseClaim>>(`/expenses/${encodeURIComponent(id)}`, data)
      .then((r) => r.data.data),

  /** POST /expenses/:id/submit */
  submit: (id: string) =>
    apiClient
      .post<BaseResponse<ExpenseClaim>>(`/expenses/${encodeURIComponent(id)}/submit`)
      .then((r) => r.data.data),

  /** POST /expenses/:id/approve */
  approve: (id: string) =>
    apiClient
      .post<BaseResponse<ExpenseClaim>>(`/expenses/${encodeURIComponent(id)}/approve`)
      .then((r) => r.data.data),

  /** POST /expenses/:id/reject */
  reject: (id: string, reason: string) =>
    apiClient
      .post<BaseResponse<ExpenseClaim>>(`/expenses/${encodeURIComponent(id)}/reject`, { reason })
      .then((r) => r.data.data),

  /** POST /expenses/:id/paid */
  markPaid: (id: string) =>
    apiClient
      .post<BaseResponse<ExpenseClaim>>(`/expenses/${encodeURIComponent(id)}/paid`)
      .then((r) => r.data.data),

  /** POST /expenses/:id/items */
  addItem: (id: string, data: CreateExpenseItemDto) =>
    apiClient
      .post<BaseResponse<ExpenseItem>>(`/expenses/${encodeURIComponent(id)}/items`, data)
      .then((r) => r.data.data),

  /** DELETE /expenses/items/:itemId */
  removeItem: (itemId: string) =>
    apiClient
      .delete<BaseResponse<{ success: boolean }>>(`/expenses/items/${encodeURIComponent(itemId)}`)
      .then((r) => r.data.data),
};
