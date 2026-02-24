'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  OrderQueryParams,
  CustomerQueryParams,
  ContainerQueryParams,
} from '@/lib/types';
import type { VoucherQueryParams, InvoiceQueryParams } from '@/lib/types/finance.types';
import type { ApprovalQueryParams } from '@/lib/api/approvals.api';

interface FilterState {
  // Per-page filter state
  orders: OrderQueryParams;
  customers: CustomerQueryParams;
  containers: ContainerQueryParams;
  vouchers: VoucherQueryParams;
  invoices: InvoiceQueryParams;
  approvals: ApprovalQueryParams;

  // Actions
  setOrderFilters: (filters: Partial<OrderQueryParams>) => void;
  setCustomerFilters: (filters: Partial<CustomerQueryParams>) => void;
  setContainerFilters: (filters: Partial<ContainerQueryParams>) => void;
  setVoucherFilters: (filters: Partial<VoucherQueryParams>) => void;
  setInvoiceFilters: (filters: Partial<InvoiceQueryParams>) => void;
  setApprovalFilters: (filters: Partial<ApprovalQueryParams>) => void;
  resetOrderFilters: () => void;
  resetCustomerFilters: () => void;
  resetContainerFilters: () => void;
  resetAllFilters: () => void;
}

const defaultOrderFilters: OrderQueryParams = { page: 1, limit: 20 };
const defaultCustomerFilters: CustomerQueryParams = { page: 1, limit: 20 };
const defaultContainerFilters: ContainerQueryParams = { page: 1, limit: 20 };
const defaultVoucherFilters: VoucherQueryParams = { page: 1, limit: 20 };
const defaultInvoiceFilters: InvoiceQueryParams = { page: 1, limit: 20 };
const defaultApprovalFilters: ApprovalQueryParams = { page: 1, limit: 20 };

export const useFilterStore = create<FilterState>()(
  persist(
    (set) => ({
      // Initial state
      orders: defaultOrderFilters,
      customers: defaultCustomerFilters,
      containers: defaultContainerFilters,
      vouchers: defaultVoucherFilters,
      invoices: defaultInvoiceFilters,
      approvals: defaultApprovalFilters,

      // Actions — merge incoming filter values with existing state, ensuring page/limit are positive integers
      setOrderFilters: (filters) =>
        set((state) => ({
          orders: { ...state.orders, ...filters, page: Math.max(1, filters.page ?? state.orders.page ?? 1), limit: Math.max(1, Math.min(100, filters.limit ?? state.orders.limit ?? 20)) },
        })),

      setCustomerFilters: (filters) =>
        set((state) => ({
          customers: { ...state.customers, ...filters, page: Math.max(1, filters.page ?? state.customers.page ?? 1), limit: Math.max(1, Math.min(100, filters.limit ?? state.customers.limit ?? 20)) },
        })),

      setContainerFilters: (filters) =>
        set((state) => ({
          containers: { ...state.containers, ...filters, page: Math.max(1, filters.page ?? state.containers.page ?? 1), limit: Math.max(1, Math.min(100, filters.limit ?? state.containers.limit ?? 20)) },
        })),

      setVoucherFilters: (filters) =>
        set((state) => ({
          vouchers: { ...state.vouchers, ...filters, page: Math.max(1, filters.page ?? state.vouchers.page ?? 1), limit: Math.max(1, Math.min(100, filters.limit ?? state.vouchers.limit ?? 20)) },
        })),

      setInvoiceFilters: (filters) =>
        set((state) => ({
          invoices: { ...state.invoices, ...filters, page: Math.max(1, filters.page ?? state.invoices.page ?? 1), limit: Math.max(1, Math.min(100, filters.limit ?? state.invoices.limit ?? 20)) },
        })),

      setApprovalFilters: (filters) =>
        set((state) => ({
          approvals: { ...state.approvals, ...filters, page: Math.max(1, filters.page ?? state.approvals.page ?? 1), limit: Math.max(1, Math.min(100, filters.limit ?? state.approvals.limit ?? 20)) },
        })),

      resetOrderFilters: () => set({ orders: defaultOrderFilters }),
      resetCustomerFilters: () => set({ customers: defaultCustomerFilters }),
      resetContainerFilters: () => set({ containers: defaultContainerFilters }),

      resetAllFilters: () =>
        set({
          orders: defaultOrderFilters,
          customers: defaultCustomerFilters,
          containers: defaultContainerFilters,
          vouchers: defaultVoucherFilters,
          invoices: defaultInvoiceFilters,
          approvals: defaultApprovalFilters,
        }),
    }),
    {
      name: 'tbs-filter-storage',
      partialize: (state) => ({
        orders: { ...state.orders, page: 1 },
        customers: { ...state.customers, page: 1 },
        containers: { ...state.containers, page: 1 },
        vouchers: { ...state.vouchers, page: 1 },
        invoices: { ...state.invoices, page: 1 },
        approvals: { ...state.approvals, page: 1 },
      }),
    },
  ),
);
