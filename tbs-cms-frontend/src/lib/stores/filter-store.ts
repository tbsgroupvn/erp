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

      // Actions
      setOrderFilters: (filters) =>
        set((state) => ({
          orders: { ...state.orders, ...filters },
        })),

      setCustomerFilters: (filters) =>
        set((state) => ({
          customers: { ...state.customers, ...filters },
        })),

      setContainerFilters: (filters) =>
        set((state) => ({
          containers: { ...state.containers, ...filters },
        })),

      setVoucherFilters: (filters) =>
        set((state) => ({
          vouchers: { ...state.vouchers, ...filters },
        })),

      setInvoiceFilters: (filters) =>
        set((state) => ({
          invoices: { ...state.invoices, ...filters },
        })),

      setApprovalFilters: (filters) =>
        set((state) => ({
          approvals: { ...state.approvals, ...filters },
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
    },
  ),
);
