'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  expenseApi,
  type CreateExpenseDto,
  type UpdateExpenseDto,
  type CreateExpenseItemDto,
  type ExpenseQueryParams,
} from '@/lib/api/expense.api';

// ============================================
// Query key factory
// ============================================

export const expenseKeys = {
  all: ['expenses'] as const,
  lists: () => [...expenseKeys.all, 'list'] as const,
  list: (params?: ExpenseQueryParams) => [...expenseKeys.lists(), params] as const,
  myLists: () => [...expenseKeys.all, 'my'] as const,
  myList: (params?: ExpenseQueryParams) => [...expenseKeys.myLists(), params] as const,
  stats: () => [...expenseKeys.all, 'stats'] as const,
  details: () => [...expenseKeys.all, 'detail'] as const,
  detail: (id: string) => [...expenseKeys.details(), id] as const,
};

// ============================================
// Queries
// ============================================

/** Danh sách tất cả đề nghị (HR/Finance) */
export function useExpenses(params?: ExpenseQueryParams) {
  return useQuery({
    queryKey: expenseKeys.list(params),
    queryFn: () => expenseApi.list(params),
  });
}

/** Đề nghị chi phí của tôi */
export function useMyExpenses(params?: ExpenseQueryParams) {
  return useQuery({
    queryKey: expenseKeys.myList(params),
    queryFn: () => expenseApi.listMy(params),
  });
}

/** Thống kê */
export function useExpenseStats() {
  return useQuery({
    queryKey: expenseKeys.stats(),
    queryFn: () => expenseApi.getStats(),
  });
}

/** Chi tiết */
export function useExpense(id: string) {
  return useQuery({
    queryKey: expenseKeys.detail(id),
    queryFn: () => expenseApi.getById(id),
    enabled: !!id,
  });
}

// ============================================
// Mutations
// ============================================

/** Tạo đề nghị mới */
export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateExpenseDto) => expenseApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: expenseKeys.myLists() });
      qc.invalidateQueries({ queryKey: expenseKeys.stats() });
      toast.success('Tạo đề nghị chi phí thành công');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Không thể tạo đề nghị chi phí');
    },
  });
}

/** Cập nhật đề nghị */
export function useUpdateExpense(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateExpenseDto) => expenseApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: expenseKeys.detail(id) });
      qc.invalidateQueries({ queryKey: expenseKeys.myLists() });
      toast.success('Cập nhật đề nghị thành công');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Không thể cập nhật đề nghị');
    },
  });
}

/** Gửi để phê duyệt */
export function useSubmitExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => expenseApi.submit(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: expenseKeys.detail(id) });
      qc.invalidateQueries({ queryKey: expenseKeys.myLists() });
      qc.invalidateQueries({ queryKey: expenseKeys.stats() });
      toast.success('Gửi đề nghị phê duyệt thành công');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Không thể gửi đề nghị');
    },
  });
}

/** Phê duyệt */
export function useApproveExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => expenseApi.approve(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: expenseKeys.detail(id) });
      qc.invalidateQueries({ queryKey: expenseKeys.lists() });
      qc.invalidateQueries({ queryKey: expenseKeys.stats() });
      toast.success('Phê duyệt đề nghị thành công');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Không thể phê duyệt đề nghị');
    },
  });
}

/** Từ chối */
export function useRejectExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      expenseApi.reject(id, reason),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: expenseKeys.detail(id) });
      qc.invalidateQueries({ queryKey: expenseKeys.lists() });
      qc.invalidateQueries({ queryKey: expenseKeys.stats() });
      toast.success('Đã từ chối đề nghị chi phí');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Không thể từ chối đề nghị');
    },
  });
}

/** Đánh dấu đã chi */
export function useMarkPaidExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => expenseApi.markPaid(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: expenseKeys.detail(id) });
      qc.invalidateQueries({ queryKey: expenseKeys.lists() });
      qc.invalidateQueries({ queryKey: expenseKeys.stats() });
      toast.success('Đã đánh dấu thanh toán thành công');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Không thể đánh dấu thanh toán');
    },
  });
}

/** Thêm khoản chi */
export function useAddExpenseItem(claimId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateExpenseItemDto) => expenseApi.addItem(claimId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: expenseKeys.detail(claimId) });
      qc.invalidateQueries({ queryKey: expenseKeys.myLists() });
      qc.invalidateQueries({ queryKey: expenseKeys.stats() });
      toast.success('Thêm khoản chi thành công');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Không thể thêm khoản chi');
    },
  });
}

/** Xóa khoản chi */
export function useRemoveExpenseItem(claimId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => expenseApi.removeItem(itemId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: expenseKeys.detail(claimId) });
      qc.invalidateQueries({ queryKey: expenseKeys.myLists() });
      qc.invalidateQueries({ queryKey: expenseKeys.stats() });
      toast.success('Xóa khoản chi thành công');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Không thể xóa khoản chi');
    },
  });
}
